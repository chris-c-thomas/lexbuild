import type { ContentProvider, NavProvider } from "./types";
import { FsContentProvider, FsNavProvider } from "./fs-provider";

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
      // Future: case "s3", case "r2", case "blob"
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
      default:
        throw new Error(`Unknown CONTENT_STORAGE: ${storage}`);
    }
  }
  return _nav;
}
