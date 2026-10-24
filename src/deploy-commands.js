import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandData } from './commands.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  throw new Error('Renseigne DISCORD_TOKEN et DISCORD_CLIENT_ID dans le fichier .env.');
}

const rest = new REST({ version: '10' }).setToken(token);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

await rest.put(route, { body: [commandData] });
console.log(guildId
  ? `Commande /smashorpass enregistrée sur le serveur ${guildId}.`
  : 'Commande /smashorpass enregistrée globalement.');
