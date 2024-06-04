import { program } from "commander";
import pkg from "./package.json";
import * as bundler from "./bundler";

program
  .name("reagent")
  .description("Graph based agent builder")
  .version(pkg.version);

program
  .command("dev")
  .description("Start a development web server for an agent")
  .argument("<file>", "path to the agent file")
  .option(
    "--open <open>",
    "Open the browser if true; default value is true",
    "true"
  )
  .option("--port <port>", "Agent port", "1337")
  .action(async (file, options) => {
    await bundler.dev({
      file,
      open: options.open == "true",
      port: parseInt(options.port),
    });
  });

program.parse();
