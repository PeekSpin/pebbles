import { AdminShell } from "../../../../components/store";
import { ProductForm } from "../../../../components/store";
import { findProduct } from "../../../../../server/repositories/product.repository";
import { getProductImageUrl } from "../../../../../server/storage";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await findProduct(params.id);
  if (!product) return <AdminShell><div className="admin-content"><h1>Product not found</h1></div></AdminShell>;
  const productForEdit = {
    ...product,
    images: await Promise.all(product.images.map(async (image) => ({
      ...image,
      imageUrl: await getProductImageUrl(image.imageUrl)
    })))
  };
  return <AdminShell><ProductForm key={`${product.id}-${product.updatedAt?.toString()}`} title="Edit product" button="Save changes" product={productForEdit} /></AdminShell>;
}
