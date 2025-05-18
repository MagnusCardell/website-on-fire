const {cp, rm} = require("shelljs");

//Why do I need this :c I just wanted typescript in my js project...
cp("-R", ["src/views", "src/public"], "dist/");
rm(["dist/public/js/*.ts"]);