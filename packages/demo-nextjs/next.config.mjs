import path from "path";

export default {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.+(js|jsx|mjs|cjs|ts|tsx)$/,
      use: [
        {
          loader: "@portal/cortex/dev/webpack/index.js",
          options: {
            ssr: isServer,
            tools: [path.resolve("../cortex/agent/nodes")],
          },
        },
      ],
    });
    return config;
  },
};
