import createVitePlugin from "../vite/plugin.js";

export default function (source) {
  const options = this.getOptions();
  const vitePlugin = createVitePlugin({
    tools: options.tools,
    plugins: ["@babel/plugin-syntax-jsx"],
    presets: [
      [
        "@babel/preset-typescript",
        {
          allowDeclareFields: true,
        },
      ],
    ],
  });

  const result = vitePlugin.transform(source, this.resourcePath, {
    ssr: options.ssr,
  });
  if (!result) {
    return source;
  }
  return result.code;
}
