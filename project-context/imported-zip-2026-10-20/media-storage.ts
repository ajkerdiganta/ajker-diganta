import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export class MediaStorageUnavailable extends Error {
  constructor() { super("মিডিয়া স্টোরেজ কনফিগার করা হয়নি"); }
}

export type ObjectHead = { size: number; contentType?: string };
export type MediaObjectStore = {
  bucketName(): string;
  putQuarantine(key: string, body: Uint8Array, contentType: string): Promise<void>;
  head(key: string): Promise<ObjectHead | null>;
  read(key: string): Promise<Uint8Array>;
  putVerified(key: string, body: Uint8Array): Promise<void>;
  remove(key: string): Promise<void>;
  readUrl(key: string): Promise<string>;
  publicUrl(key: string): string | null;
};

let testStore: MediaObjectStore | undefined;
export function setMediaStoreForTests(store: MediaObjectStore | undefined) { testStore = store; }

function configuration() {
  const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new MediaStorageUnavailable();
  return { endpoint: R2_ENDPOINT, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY };
}

function createClient() {
  const config = configuration();
  return { config, client: new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  }) };
}

const cloudStore: MediaObjectStore = {
  bucketName() { return configuration().bucket; },
  async putQuarantine(key, body, contentType) {
    const { config, client } = createClient();
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.byteLength,
      CacheControl: "private, no-store",
    }));
  },
  async head(key) {
    const { config, client } = createClient();
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      return { size: Number(head.ContentLength ?? 0), contentType: head.ContentType };
    } catch (error) {
      const code = (error as { name?: string }).name;
      if (code === "NotFound" || code === "NoSuchKey" || code === "NotFoundException") return null;
      throw error;
    }
  },
  async read(key) {
    const { config, client } = createClient();
    const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!response.Body) throw new Error("Uploaded media body is missing");
    return response.Body.transformToByteArray();
  },
  async putVerified(key, body) {
    const { config, client } = createClient();
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      ContentLength: body.byteLength,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  },
  async remove(key) {
    const { config, client } = createClient();
    await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  },
  async readUrl(key) {
    const { config, client } = createClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), { expiresIn: 300 });
  },
  publicUrl(key) {
    const base = env.R2_PUBLIC_BASE_URL;
    return base ? `${base.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}` : null;
  },
};

export const mediaStore: MediaObjectStore = new Proxy(cloudStore, {
  get(target, property, receiver) {
    const store = testStore ?? target;
    const value = Reflect.get(store, property, receiver) as unknown;
    return typeof value === "function" ? value.bind(store) : value;
  },
});

export const quarantineKey = (userId: string, contentType: string) => {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return `quarantine/${userId}/${randomUUID()}.${extension}`;
};
