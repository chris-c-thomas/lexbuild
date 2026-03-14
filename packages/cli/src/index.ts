/** lexbuild CLI — Convert U.S. legal XML to structured Markdown */

import { createRequire } from "node:module";
import { Command } from "commander";
import { convertUscCommand } from "./commands/convert-usc.js";
import { downloadUscCommand } from "./commands/download-usc.js";
import { convertEcfrCommand } from "./commands/convert-ecfr.js";
import { downloadEcfrCommand } from "./commands/download-ecfr.js";
import { error } from "./ui.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const program = new Command();

program
  .name("lexbuild")
  .description("Convert U.S. legal XML to structured Markdown for AI/RAG ingestion")
  .version(pkg.version)
  .addHelpText(
    "after",
    `
Quick start (U.S. Code):
  $ lexbuild download-usc --all          Download all 54 USC titles from OLRC
  $ lexbuild convert-usc --all           Convert all downloaded USC titles
  $ lexbuild convert-usc --titles 1      Convert USC Title 1 only

Quick start (eCFR):
  $ lexbuild download-ecfr --all         Download all 50 eCFR titles from govinfo
  $ lexbuild convert-ecfr --all          Convert all downloaded eCFR titles
  $ lexbuild convert-ecfr --titles 17    Convert eCFR Title 17 only

Documentation: https://github.com/chris-c-thomas/LexBuild`,
  );

// Source-specific commands
program.addCommand(downloadUscCommand);
program.addCommand(convertUscCommand);
program.addCommand(downloadEcfrCommand);
program.addCommand(convertEcfrCommand);

// Bare "download" and "convert" stubs — guide users to source-specific commands
program.addCommand(
  new Command("download")
    .description("(use download-usc or download-ecfr)")
    .allowUnknownOption()
    .helpOption(false)
    .action(() => {
      console.error(error("Please specify a source:\n"));
      console.error("  lexbuild download-usc     Download U.S. Code XML from OLRC");
      console.error("  lexbuild download-ecfr    Download eCFR XML from govinfo");
      console.error("");
      process.exit(1);
    }),
);

program.addCommand(
  new Command("convert")
    .description("(use convert-usc or convert-ecfr)")
    .allowUnknownOption()
    .helpOption(false)
    .action(() => {
      console.error(error("Please specify a source:\n"));
      console.error("  lexbuild convert-usc      Convert U.S. Code XML to Markdown");
      console.error("  lexbuild convert-ecfr     Convert eCFR XML to Markdown");
      console.error("");
      process.exit(1);
    }),
);

program.parse();
