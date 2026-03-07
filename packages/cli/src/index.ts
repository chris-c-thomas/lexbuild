/** lexbuild CLI — Convert U.S. legislative XML to structured Markdown */

import { createRequire } from "node:module";
import { Command } from "commander";
import { convertCommand } from "./commands/convert.js";
import { downloadCommand } from "./commands/download.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("lexbuild")
  .description("Convert U.S. legislative XML (USLM) to structured Markdown for AI/RAG ingestion")
  .version(pkg.version)
  .addHelpText(
    "after",
    `
Quick start:
  $ lexbuild download --all             Download all 54 titles from OLRC
  $ lexbuild convert --all              Convert all downloaded titles
  $ lexbuild convert --titles 1         Convert Title 1 only
  $ lexbuild convert --titles 1 -g title   Whole title as a single file

Documentation: https://github.com/chris-c-thomas/lexbuild`,
  );

program.addCommand(convertCommand);
program.addCommand(downloadCommand);

program.parse();
