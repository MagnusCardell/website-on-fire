
import * as shell from "shelljs";

shell.cp("-R", ["src/views", "src/public"], "dist/");
shell.rm(["dist/views/*.ts"]);