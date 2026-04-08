/**
 * Reads the package version from package.json at runtime.
 * Avoids hardcoding the version in multiple places.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

interface PackageJson {
  version: string;
}

const pkg: PackageJson = require("../../package.json") as PackageJson;

/** The current package version from package.json. */
export const VERSION: string = pkg.version;
