module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./app'],
          alias: {
            '@/hooks':      './app/hooks',
            '@/lib':        './app/lib',
            '@/utils':      './app/utils',
            '@/components': './app/components',
          },
        },
      ],
    ],
  };
};