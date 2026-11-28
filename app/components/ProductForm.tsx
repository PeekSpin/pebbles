"use client";

import { useRef, useState, type FormEvent } from "react";
import { productCategories } from "../lib/product-categories";
import {
  editorColor, editorErrors, hexPattern, productRequest,
  type BaseFields, type EditableProduct, type EditorColor,
} from "../lib/product-editor";
import { ProductGalleryEditor } from "./ProductGalleryEditor";
import { ProductInventoryEditor } from "./ProductInventoryEditor";
import "./product-editor.css";

const palette = [
  ["Ivory", "#F4ECDD"], ["Blush", "#DAB2AC"], ["Rose", "#B66076"], ["Terracotta", "#BE7056"],
  ["Saffron", "#DCA63D"], ["Pista green", "#A7B694"], ["Teal", "#317C77"], ["Indigo", "#465477"],
  ["Mulberry", "#754460"], ["Onyx", "#302F32"],
] as const;

const baseLabels: Record<keyof BaseFields, string> = {
  name: "Product name", sku: "Product SKU", price: "Base price (₹)", category: "Category", description: "Description",
};
const placeholders = {
  name: "e.g. Mul Chanderi floral kurti", sku: "e.g. PB-KUR-104", price: "0.00",
  description: "Describe the fabric, fit and details your customers will want to know.",
};

function saveForm(url: string, method: string, body: FormData, progress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    request.responseType = "json";
    request.upload.onprogress = e => { if (e.lengthComputable) progress(Math.round(e.loaded * 100 / e.total)); };
    request.upload.onload = () => progress(100);
    request.onerror = () => reject(new Error("Connection lost. Check your connection and try saving again."));
    request.onabort = () => reject(new Error("Upload interrupted. Your edits are still here."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300 && typeof request.response?.id === "string") resolve();
      else reject(new Error(request.response?.error || "Could not save the product. Check your session and try again."));
    };
    request.send(body);
  });
}

function swatchStyle(hex: string) {
  return hexPattern.test(hex) ? { background: hex } : undefined;
}

function ColorSettings({ color, update, errors }: {
  color: EditorColor; update: (patch: Partial<EditorColor>) => void; errors: Record<string,string>;
}) {
  const nameId = color.key+"-name";
  const hexId = color.key+"-hex";
  const chooseHex = (value: string) => {
    const hex = value.toUpperCase();
    const match = palette.find(([, preset]) => preset === hex);
    update(match && (!color.name.trim() || palette.some(([name]) => name.toLowerCase() === color.name.toLowerCase()))
      ? {hex, name:match[0]} : {hex});
  };
  return <section className="ce-settings" aria-label="Colour details">
    <h3>Colour details</h3>
    <label className="ce-field" htmlFor={nameId}><span>Colour name</span>
      <input id={nameId} value={color.name} maxLength={100} placeholder="e.g. Pista green"
        aria-invalid={!!errors[nameId]} aria-describedby={errors[nameId] ? nameId+"-error" : undefined}
        onChange={e => {
          const name = e.target.value;
          const preset = palette.find(([label]) => label.toLowerCase() === name.trim().toLowerCase());
          update(preset ? {name, hex:preset[1]} : {name});
        }}/>
      {errors[nameId] && <small className="ce-error" id={nameId+"-error"}>{errors[nameId]}</small>}
    </label>
    <div className="ce-field"><label htmlFor={hexId}>HEX colour</label>
      <div className="ce-picker-row">
        <label className="ce-picker" style={swatchStyle(color.hex)} title="Choose a custom colour">
          <input type="color" aria-label="Choose a custom colour" value={hexPattern.test(color.hex) ? color.hex : "#808080"} onChange={e => chooseHex(e.target.value)}/>
        </label>
        <input id={hexId} className="ce-hex" spellCheck={false} placeholder="#A7B694" maxLength={7} value={color.hex}
          aria-invalid={!!errors[hexId]} aria-describedby={errors[hexId] ? hexId+"-error" : undefined}
          onChange={e => chooseHex(e.target.value)} onBlur={() => { if (/^[a-f0-9]{6}$/i.test(color.hex)) chooseHex("#"+color.hex); }}/>
      </div>{errors[hexId] && <small className="ce-error" id={hexId+"-error"}>{errors[hexId]}</small>}
    </div>
    <div className="ce-palette" role="group" aria-label="Fashion colour palette">
      {palette.map(([name, hex]) => <button type="button" key={hex} title={name} aria-label={name} aria-pressed={color.hex.toUpperCase() === hex}
        onClick={() => update({name, hex})}><span style={{background:hex}} /></button>)}
    </div>
  </section>;
}

export function ProductForm({ title, button, product }: {title:string; button:string; product?: EditableProduct}) {
  const [fields, setFields] = useState<BaseFields>(() => ({
    name:product?.name ?? "", sku:product?.sku ?? "", price:product?.price ?? "",
    category:product?.category ?? "", description:product?.description ?? "",
  }));
  const [colors, setColors] = useState<EditorColor[]>(() => product?.colors.length
    ? product.colors.map(c => editorColor(c.id, c)) : [editorColor("first-colour")]);
  const [isPreorder, setIsPreorder] = useState(product?.isPreorder ?? false);
  const [expanded, setExpanded] = useState<string[]>(() => [colors[0].key]);
  const [touched, setTouched] = useState<Record<string,boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [serverError, setServerError] = useState("");
  const submitting = useRef(false);
  const active = colors.filter(c => c.active);
  const hasUploads = active.some(c => c.gallery.some(i => i.file));
  const allErrors = editorErrors(fields, colors);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([id]) => attempted || touched[id]));
  const update = (key: string, patch: Partial<EditorColor>) => setColors(prev => prev.map(c => c.key === key ? {...c,...patch} : c));

  function openColor(key: string, field = key+"-name") {
    setExpanded(prev => prev.includes(key) ? prev : [...prev,key]);
    requestAnimationFrame(() => document.getElementById(field)?.focus());
  }
  function addColor() {
    const color = editorColor(crypto.randomUUID());
    setColors(prev => [...prev,color]);
    openColor(color.key);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setAttempted(true);
    setServerError("");
    const first = Object.keys(allErrors)[0];
    if (first) {
      const owner = active.find(c => first.startsWith(c.key+"-"));
      if (owner) openColor(owner.key, first);
      else document.getElementById(first)?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setPercent(null);
    try {
      await saveForm("/api/admin/products"+(product ? "/"+product.id : ""), product ? "PATCH" : "POST",
        productRequest(fields, colors, product?.revision, isPreorder), setPercent);
      window.location.assign("/admin/products?saved="+(product ? "updated" : "created"));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Unable to save product.");
      submitting.current = false;
      setSaving(false);
    }
  }

  return <div className="admin-content catalog-editor">
    <a className="ce-back" href="/admin/products"><span aria-hidden="true">←</span> Products</a>
    <h1>{title}</h1>
    <form noValidate onSubmit={submit} aria-busy={saving} onBlur={e => {
      const id = e.target.id;
      if (id) setTouched(prev => prev[id] ? prev : {...prev,[id]:true});
    }}>
      <fieldset className="ce-form-fields" disabled={saving}>
        <section className="ce-panel ce-info" aria-labelledby="ce-info-title">
          <h2 id="ce-info-title">Product information</h2>
          <div className="ce-info-grid">
            {(["name","sku","category","price","description"] as const).map(key => {
              const common = {
                id:key, name:key, value:fields[key], required:true,
                "aria-invalid":!!errors[key], "aria-describedby":errors[key] ? key+"-error" : undefined,
                onChange:(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                  const value = event.target.value;
                  setFields(prev => ({...prev,[key]:value}));
                },
              };
              return <label key={key} className={"ce-field"+(key === "description" ? " ce-wide" : "")}>
                <span>{baseLabels[key]}</span>
                {key === "category" ? <select {...common}>
                  <option value="" disabled>Select a category</option>
                  {Array.from(new Set([...productCategories,...(product?.category ? [product.category] : [])])).map(c => <option key={c}>{c}</option>)}
                </select> : key === "description" ? <textarea {...common} maxLength={100000} rows={3} placeholder={placeholders[key]}/>
                : <input {...common} maxLength={key === "sku" ? 100 : key === "name" ? 255 : 13}
                    inputMode={key === "price" ? "decimal" : "text"} placeholder={placeholders[key]}/>}
                {errors[key] && <small className="ce-error" id={key+"-error"}>{errors[key]}</small>}
              </label>;
            })}
          </div>
          <label className="ce-preorder-option">
            <input type="checkbox" checked={isPreorder} onChange={event => setIsPreorder(event.target.checked)} />
            <span><strong>Preorder</strong><small>Show preorder messaging and terms on the storefront.</small></span>
          </label>
        </section>
        <section className="ce-colours" aria-labelledby="ce-colours-title">
          <div className="ce-section-heading"><h2 id="ce-colours-title">Colour variants</h2>
            <button type="button" className="ce-secondary ce-add-colour" onClick={addColor}><span aria-hidden="true">＋</span> Add colour</button>
          </div>
          {colors.map(color => {
            const isDefault = active[0]?.key === color.key;
            const open = color.active && expanded.includes(color.key);
            const panelId = "panel-"+color.key;
            return <article key={color.key} className="ce-panel ce-colour-card" data-active={color.active}>
              <div className="ce-card-head">
                <button className="ce-card-toggle" type="button" aria-expanded={open} aria-controls={panelId} disabled={!color.active}
                  onClick={() => setExpanded(prev => open ? prev.filter(k => k !== color.key) : [...prev,color.key])}>
                  <span className="ce-swatch" style={swatchStyle(color.hex)} aria-hidden="true"/>
                  <span className="ce-colour-identity"><strong>{color.name.trim() || "New colour"}</strong>
                    <small>{hexPattern.test(color.hex) ? color.hex.toUpperCase() : "No HEX selected"}</small></span>
                  <span className="ce-chevron" aria-hidden="true"/>
                </button>
                <div className="ce-card-flags">{isDefault && <span className="ce-default">Default</span>}
                  <span className="ce-status"><i aria-hidden="true"/>{color.active ? "Active" : "Inactive"}</span></div>
                <div className="ce-card-actions">{color.active ? <>
                  <button type="button" onClick={() => openColor(color.key)}>Edit</button>
                  <button type="button" disabled={active.length === 1} title={active.length === 1 ? "Keep at least one active colour" : "Remove this colour on save"}
                    onClick={() => update(color.key,{active:false})}>Remove</button>
                </> : <button type="button" onClick={() => {update(color.key,{active:true}); openColor(color.key);}}>Undo removal</button>}</div>
              </div>
              {!color.active && <p className="ce-removal-note">This colour will be removed when you save.</p>}
              <div className="ce-card-body" hidden={!open} id={panelId}>
                <div className="ce-colour-grid"><ColorSettings color={color} update={patch => update(color.key,patch)} errors={errors}/>
                  <ProductGalleryEditor items={color.gallery} onChange={gallery => update(color.key,{gallery})} disabled={saving || !color.active}/></div>
                <ProductInventoryEditor color={color} saree={fields.category === "Sarees"} change={variants => update(color.key,{variants})} errors={errors}/>
                {!isDefault && <button type="button" className="ce-text-action" onClick={() => setColors(prev => [color,...prev.filter(c => c.key !== color.key)])}>Make default colour</button>}
              </div>
            </article>;
          })}
        </section>
      </fieldset>
      <div className="ce-action-bar">
        <div className="ce-feedback" aria-live="polite">
          {serverError ? <p role="alert" className="ce-error">{serverError}</p> : attempted && Object.keys(allErrors).length > 0 ?
            <p className="ce-error">Review the highlighted fields before saving.</p> : saving && <div role="status">
              {hasUploads && percent !== 100 ? <>Uploading images{percent === null ? "…" : " · "+percent+"%"}
                <progress aria-label="Upload progress" max={100} value={percent ?? undefined}/></> : "Saving product…"}
            </div>}
        </div>
        <button className="ce-secondary" type="button" disabled={saving} onClick={() => window.location.assign("/admin/products")}>Cancel</button>
        <button type="submit" className="admin-button ce-save" disabled={saving}>{saving ? "Saving…" : button}</button>
      </div>
    </form>
  </div>;
}
