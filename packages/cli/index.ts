import { program } from "commander";
import pkg from "./package.json";
import { serve } from "./server";

program
  .name("reagent")
  .description("Graph based agent builder")
  .version(pkg.version);

program
  .command("serve")
  .description("Start a web server for an agent")
  .argument("<file>", "path to the agent file")
  .option(
    "--open <open>",
    "Open the browser if true; default value is true",
    "true"
  )
  .action(async (file, options) => {
    await serve({
      file,
      open: options.open == "true",
    });
  });

program.parse();
