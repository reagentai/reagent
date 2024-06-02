const virtualFiles = new Map([
  [
    "reagent.css",
    `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
  ],
]);
export default function virtual() {
  return {
    name: "reagent-server-virtual",
    enforce: "pre" as const,
    resolveId(id: string) {
      if (virtualFiles.has(id)) {
        return "\0" + id;
      }
    },
    load(id: string) {
      const file = id.substring(1);
      if (virtualFiles.has(file)) {
        return virtualFiles.get(file);
      }
    },
  };
}
