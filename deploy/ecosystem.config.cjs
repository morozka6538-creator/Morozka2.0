module.exports = {
  apps: [
    {
      name: 'morozka-backend',
      script: './server/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
