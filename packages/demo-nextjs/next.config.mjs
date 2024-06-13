import path from "path";

export default {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.+(js|jsx|mjs|cjs|ts|tsx)$/,
      use: [
        {
          loader: "@reagentai/reagent/dev/webpack/index.js",
          options: {
            ssr: isServer,
            include: ["**/@reagentai/**"],
            exclude: ["**/node_modules/**"],
          },
        },
      ],
    });
    return config;
  },
};
