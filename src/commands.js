import { ChannelType, SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
  .setName('smashorpass')
  .setDescription('Participer à Smash Or Pass ou gérer une publication.')
  .addSubcommand((subcommand) => subcommand
    .setName('setup')
    .setDescription('Configure la modération, les logs et les salons de vote (administrateurs).')
    .addChannelOption((option) => option
      .setName('moderation')
      .setDescription('Salon privé réservé à l’équipe de modération.')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('logs')
      .setDescription('Salon privé staff pour suivre les publications validées.')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('hommes')
      .setDescription('Salon de publication Masculin, accessible aux membres du serveur.')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('femmes')
      .setDescription('Salon de publication Féminin, accessible aux membres du serveur.')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
    .addChannelOption((option) => option
      .setName('autre')
      .setDescription('Salon de publication Autre, accessible aux membres du serveur.')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('retirer')
    .setDescription('Retire ta participation en attente ou ta publication.')
    .addStringOption((option) => option
      .setName('reference')
      .setDescription('La référence SFX affichée dans ton DM ou sous la publication.')
      .setRequired(true)
      .setMaxLength(20)));

export const commandData = command.toJSON();
