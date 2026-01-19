module.exports = {
  apps: [
    {
      name: 'mentorrotina',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3675,
        HOSTNAME: '0.0.0.0', // Listen on all interfaces (required for Tailscale)
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3675,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
