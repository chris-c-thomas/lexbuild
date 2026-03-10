import type { ContentProvider, NavProvider } from "./types";
import { FsContentProvider, FsNavProvider } from "./fs-provider";
import { S3ContentProvider, S3NavProvider } from "./s3-provider";

let _content: ContentProvider | null = null;
let _nav: NavProvider | null = null;

/** Returns the singleton ContentProvider based on CONTENT_STORAGE env var. */
export function getContentProvider(): ContentProvider {
  if (!_content) {
    const storage = process.env.CONTENT_STORAGE ?? "fs";
    switch (storage) {
      case "fs":
        _content = new FsContentProvider();
        break;
      case "s3":
        _content = new S3ContentProvider();
        break;
      default:
        throw new Error(`Unknown CONTENT_STORAGE: ${storage}`);
    }
  }
  return _content;
}

/** Returns the singleton NavProvider based on CONTENT_STORAGE env var. */
export function getNavProvider(): NavProvider {
  if (!_nav) {
    const storage = process.env.CONTENT_STORAGE ?? "fs";
    switch (storage) {
      case "fs":
        _nav = new FsNavProvider();
        break;
      case "s3":
        _nav = new S3NavProvider();
        break;
      default:
        throw new Error(`Unknown CONTENT_STORAGE: ${storage}`);
    }
  }
  return _nav;
}
