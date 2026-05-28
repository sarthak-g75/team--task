import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

export default defineConfig({
  migrate: {
    async adapter() {
      return new PrismaPg({
        connectionString: process.env['DATABASE_URL'],
      });
    },
  },
});
