import { loadOwnEnv, main } from "./main.ts";

loadOwnEnv();
process.exitCode = await main(process.argv.slice(2));
