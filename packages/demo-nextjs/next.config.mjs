import path from "path";

export default {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.+(js|jsx|mjs|cjs|ts|tsx)$/,
      use: [
        {
          loader: "@useportal/reagent/dev/webpack/index.js",
          options: {
            ssr: isServer,
            tools: [
              path.resolve("../reagent/agent/nodes"),
              path.resolve("../react/demo-agents/tools"),
            ],
          },
        },
      ],
    });
    return config;
  },
};
