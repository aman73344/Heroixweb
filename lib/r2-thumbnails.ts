import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { derivativePath, IMAGE_WIDTHS, parseStorageObject } from '@/lib/image-url';

if (typeof window !== 'undefined') {
  throw new Error('lib/r2-thumbnails.ts is server-only.');
}

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).replace(/\/+$/, '');
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : '');
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || 'products';
let r2Client: S3Client | undefined;

function getR2Client(): S3Client {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 is not configured. Set R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY on the server.',
    );
  }

  if (!r2Client) {
    r2Client = new S3Client({
      endpoint: R2_ENDPOINT,
      region: 'auto',
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return r2Client;
}

function isMissingObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const awsError = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    awsError.name === 'NotFound' ||
    awsError.name === 'NoSuchKey' ||
    awsError.$metadata?.httpStatusCode === 404
  );
}

export async function mirrorImageThumbnailsToR2(
  imageUrl: string,
): Promise<{ copied: number; skipped: number }> {
  const object = parseStorageObject(imageUrl);
  const expectedBase = `${SUPABASE_URL}/storage/v1/object/public`;

  // Only mirror this app's own product objects. Other image hosts and buckets
  // are valid product images but have no Supabase derivatives to copy.
  if (
    !object ||
    object.bucket !== 'products' ||
    object.base !== expectedBase
  ) {
    return { copied: 0, skipped: 0 };
  }

  const client = getR2Client();
  const results = await Promise.allSettled(
    IMAGE_WIDTHS.map(async (width) => {
      const key = derivativePath(object.key, width);
      const encodedKey = key.split('/').map(encodeURIComponent).join('/');
      const source = await fetch(
        `${SUPABASE_URL}/storage/v1/object/public/${object.bucket}/${encodedKey}`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!source.ok) {
        throw new Error(
          `Supabase thumbnail ${key} returned ${source.status} ${source.statusText}.`,
        );
      }

      const body = Buffer.from(await source.arrayBuffer());
      try {
        const existing = await client.send(
          new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }),
        );
        if (existing.ContentLength === body.length) return 'skipped' as const;
      } catch (error) {
        if (!isMissingObject(error)) throw error;
      }

      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: 'image/webp',
          CacheControl: '31536000',
        }),
      );
      return 'copied' as const;
    }),
  );

  const failures = results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [`${IMAGE_WIDTHS[index]}px: ${String(result.reason)}`]
      : [],
  );
  if (failures.length > 0) {
    throw new Error(`Could not mirror every thumbnail. ${failures.join(' ')}`);
  }

  return results.reduce(
    (counts, result) => {
      if (result.status === 'fulfilled' && result.value === 'copied') {
        counts.copied += 1;
      } else if (result.status === 'fulfilled') {
        counts.skipped += 1;
      }
      return counts;
    },
    { copied: 0, skipped: 0 },
  );
}
