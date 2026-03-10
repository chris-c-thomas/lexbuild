import type { ContentProvider, NavProvider } from "./types";

let _contentPromise: Promise<ContentProvider> | null = null;
let _navPromise: Promise<NavProvider> | null = null;

/** Returns the singleton ContentProvider based on CONTENT_STORAGE env var. */
export function getContentProvider(): Promise<ContentProvider> {
  if (!_contentPromise) {
    _contentPromise = (async () => {
      const storage = process.env.CONTENT_STORAGE ?? "fs";
      switch (storage) {
        case "fs": {
          const { FsContentProvider } = await import("./fs-provider");
          return new FsContentProvider();
        }
        case "s3": {
          const { S3ContentProvider } = await import("./s3-provider");
          return new S3ContentProvider();
        }
        default:
          throw new Error(`Unknown CONTENT_STORAGE: ${storage}`);
      }
    })();
  }
  return _contentPromise;
}

/** Returns the singleton NavProvider based on CONTENT_STORAGE env var. */
export function getNavProvider(): Promise<NavProvider> {
  if (!_navPromise) {
    _navPromise = (async () => {
      const storage = process.env.CONTENT_STORAGE ?? "fs";
      switch (storage) {
        case "fs": {
          const { FsNavProvider } = await import("./fs-provider");
          return new FsNavProvider();
        }
        case "s3": {
          const { S3NavProvider } = await import("./s3-provider");
          return new S3NavProvider();
        }
        default:
          throw new Error(`Unknown CONTENT_STORAGE: ${storage}`);
      }
    })();
  }
  return _navPromise;
}
