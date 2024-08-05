export default {
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.+(js|jsx|mjs|cjs|ts|tsx)$/,
      use: [
        {
          loader: "@reagentai/reagent/webpack",
          options: {
            ssr: isServer,
            include: ["**/reagent/packages/**", "**/@reagentai/**"],
            exclude: ["**/node_modules/**"],
          },
        },
      ],
    });
    return config;
  },
};
