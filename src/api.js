import { createApp } from './app.js';
import { config } from './config.js';
import { con } from './repository/connection.js';
const server = createApp().listen(config.port, config.host, () => console.log(`Sobraê API: http://${config.host}:${config.port}`));
server.on('error', error => { console.error('Não foi possível iniciar a API:', error.code); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await con.end(); process.exit(0); }));
