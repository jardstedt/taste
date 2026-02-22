module.exports = {
  apps: [
    {
      name: 'taste',
      script: './server/dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      env_file: '.env.production',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
