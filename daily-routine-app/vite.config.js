import 'dotenv/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  appDataMiddleware,
  foodEstimateMiddleware,
  activityBurnEstimateMiddleware,
  bookSummaryMiddleware,
} from './server/persist-api.mjs';

function persistFilePlugin() {
  return {
    name: 'persist-app-data',
    configureServer(server) {
      server.middlewares.use(appDataMiddleware);
      server.middlewares.use(foodEstimateMiddleware);
      server.middlewares.use(activityBurnEstimateMiddleware);
      server.middlewares.use(bookSummaryMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(appDataMiddleware);
      server.middlewares.use(foodEstimateMiddleware);
      server.middlewares.use(activityBurnEstimateMiddleware);
      server.middlewares.use(bookSummaryMiddleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), persistFilePlugin()],
});
