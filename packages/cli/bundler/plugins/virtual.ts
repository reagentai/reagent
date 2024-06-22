export function virtualFiles(map: Record<string, string>) {
  const virtualFiles = new Map(Object.entries(map));

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
