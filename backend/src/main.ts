import { Logger } from '@nestjs/common';

import { createApp } from './app.factory';
import { loadConfig } from './config';

async function main() {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.port);
  new Logger('Main').log(`Backgammon Coach API listening on :${config.port}`);
}

void main();
