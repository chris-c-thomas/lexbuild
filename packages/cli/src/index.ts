/** law2md CLI — Convert U.S. legislative XML to structured Markdown */

import { createRequire } from "node:module";
import { Command } from "commander";
import { convertCommand } from "./commands/convert.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("law2md")
  .description("Convert U.S. legislative XML (USLM) to structured Markdown for AI/RAG ingestion")
  .version(pkg.version);

program.addCommand(convertCommand);

program.parse();
