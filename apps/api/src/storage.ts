import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ServiceUnavailableException } from "@nestjs/common";

let client: S3Client | null = null;
function config() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) throw new ServiceUnavailableException("Private document storage is not configured. Contact PAN support.");
  if (!client) client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey }
  });
  return { client, bucket };
}
export async function createPrivateUploadUrl(key: string, mimeType: string, sizeBytes: number) {
  const { client, bucket } = config();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType, Metadata: { "expected-size": String(sizeBytes) }, ServerSideEncryption: "AES256" });
  return getSignedUrl(client, command, { expiresIn: 600 });
}
export async function confirmPrivateUpload(key: string, expectedSize: number, expectedMime: string) {
  const { client, bucket } = config();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (!head.ContentLength || head.ContentLength !== expectedSize || head.ContentType !== expectedMime) throw new Error("Uploaded document size or content type did not match the signed upload.");
  return head;
}
export async function createPrivateDownloadUrl(key: string) {
  const { client, bucket } = config();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}
export function privateDocumentKey(manufacturerId: string, filename: string) {
  const safe = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90);
  return "manufacturers/" + manufacturerId + "/documents/" + crypto.randomUUID() + "/" + safe;
}
