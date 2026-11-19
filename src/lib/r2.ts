/**
 * Library for interacting with Cloudflare R2 bucket where static images are kept
 */

import { sha256 } from "js-sha256";

export const R2_ACCOUNT_ID = "1e2b1572aeaa13f765f8fcff4df74f60";
export const R2_BUCKET = "wereonlyalittlelostblog";
export const R2_PUBLIC_URL_BASE =
  "https://pub-6552d22062234bd394ccc7a815d71ba7.r2.dev";

export type R2UploadResult = {
  key: string;
  publicUrl: string;
};

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  svg: "image/svg+xml",
};

export function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_TYPES[ext] ?? "application/octet-stream";
}

function formatAmzDate(d: Date): { amzDate: string; dateStamp: string } {
  const amzDate = d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function hmac(key: string | number[] | Uint8Array, data: string): number[] {
  return sha256.hmac.array(key as string, data);
}

async function sign(opts: {
  method: string;
  url: string;
  body: Uint8Array;
  contentType: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  now: Date;
}): Promise<Record<string, string>> {
  const {
    method,
    url,
    body,
    contentType,
    accessKeyId,
    secretAccessKey,
    region,
    service,
    now,
  } = opts;
  const parsed = new URL(url);
  const { amzDate, dateStamp } = formatAmzDate(now);
  const payloadHashHex = sha256(body);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${parsed.host}\n` +
    `x-amz-content-sha256:${payloadHashHex}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    parsed.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHashHex,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = sha256.hmac(kSigning as unknown as string, stringToSign);

  return {
    "Content-Type": contentType,
    "x-amz-content-sha256": payloadHashHex,
    "x-amz-date": amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export async function uploadToR2(opts: {
  accessKeyId: string;
  secretAccessKey: string;
  accountId: string;
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType: string;
  publicUrlBase: string;
  onStep?: (msg: string) => void;
}): Promise<R2UploadResult> {
  const {
    accessKeyId,
    secretAccessKey,
    accountId,
    bucket,
    key,
    body,
    contentType,
    publicUrlBase,
    onStep,
  } = opts;
  const step = (msg: string) => onStep?.(msg);

  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURI(key)}`;

  step("Signing request (SigV4)");
  const headers = await sign({
    method: "PUT",
    url,
    body,
    contentType,
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
    now: new Date(),
  });

  step(`Uploading ${body.byteLength} bytes to ${bucket}/${key}`);
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: body as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    const trimmed = text.length > 300 ? text.slice(0, 300) + "…" : text;
    throw new Error(`R2 PUT failed: HTTP ${res.status} — ${trimmed}`);
  }

  const publicUrl = `${publicUrlBase.replace(/\/$/, "")}/${encodeURI(key)}`;
  step("Done");
  return { key, publicUrl };
}
