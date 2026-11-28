import "server-only";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function environmentValue(name: string) {
  const value = process.env[name]?.trim();
  return value?.replace(/^(['"])(.*)\1$/, "$2").trim();
}

let storage: { client: S3Client; bucket: string; endpointHost: string } | undefined;

function getStorage() {
  if (storage) return storage;
  const bucket = environmentValue("S3_BUCKET_NAME") ?? "";
  console.log("Neon Object Storage bucket: %s", bucket);
  const region = environmentValue("AWS_REGION");
  console.log("Neon Object Storage region: %s", region);
  const endpoint = environmentValue("AWS_ENDPOINT_URL_S3") ?? "";
  console.log("Neon Object Storage endpoint: %s", endpoint);
  const s3AccessKey = environmentValue("S3_ACCESS_KEY_ID") ?? "";
  const s3SecretKey = environmentValue("S3_SECRET_ACCESS_KEY") ?? "";
  const awsAccessKey = environmentValue("AWS_ACCESS_KEY_ID") ?? "";
  const awsSecretKey = environmentValue("AWS_SECRET_ACCESS_KEY") ?? "";
  // Prefer a complete S3-prefixed pair; otherwise use the AWS-prefixed pair.
  const useS3Keys = Boolean(s3AccessKey && s3SecretKey);
  const accessKeyId = useS3Keys ? s3AccessKey : awsAccessKey;
  const secretAccessKey = useS3Keys ? s3SecretKey : awsSecretKey;
  console.log("Neon Object Storage access key: %s", accessKeyId ? "set" : "not set");
  console.log("Neon Object Storage secret key: %s", secretAccessKey ? "set" : "not set");
  const missingSettings = Object.entries({
    S3_BUCKET_NAME: bucket,
    AWS_REGION: region,
    AWS_ENDPOINT_URL_S3: endpoint,
    [useS3Keys ? "S3_ACCESS_KEY_ID" : "AWS_ACCESS_KEY_ID"]: accessKeyId,
    [useS3Keys ? "S3_SECRET_ACCESS_KEY" : "AWS_SECRET_ACCESS_KEY"]: secretAccessKey
  }).filter(([, value]) => !value).map(([name]) => name);
  if (missingSettings.length) {
    throw new Error(`Neon Object Storage configuration is missing: ${missingSettings.join(", ")}`);
  }

  let endpointHost: string;
  try {
    endpointHost = new URL(endpoint).hostname;
  } catch {
    throw new Error("Neon Object Storage endpoint is not a valid URL");
  }

  const client = new S3Client({ region, endpoint, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
  storage = { client, bucket, endpointHost };
  return storage;
}

function storageError(error: unknown, endpointHost: string) {
  if (!(error instanceof Error)) return new Error("Neon Object Storage request failed");
  if (error.message.startsWith("Neon Object Storage ")) return error;
  const details = error as Error & {
    code?: string;
    cause?: { code?: string; name?: string };
    $metadata?: { httpStatusCode?: number };
  };
  const code = details.code ?? details.cause?.code ?? (details.name !== "Error" ? details.name : details.cause?.name) ?? "unknown";
  const status = details.$metadata?.httpStatusCode;
  return new Error(`Neon Object Storage request failed (${code}${status ? `, HTTP ${status}` : ""} at ${endpointHost})`);
}

export async function uploadProductImage(key: string, body: Buffer, contentType: string) {
  const { client, bucket, endpointHost } = getStorage();
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    }));
  } catch (error) {
    throw storageError(error, endpointHost);
  }
}

export async function deleteProductImage(key: string) {
  const { client, bucket } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getProductImageUrl(key: string) {
  const { client, bucket } = getStorage();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );
}
