import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const options = {
  entryPoints: ["src/plugin/main.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2017",
  format: "iife",
  logLevel: "info"
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching plugin code for changes...");
} else {
  await esbuild.build(options);
}
