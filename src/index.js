import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  PermissionFlagsBits,
  escapeMarkdown,
} from 'discord.js';
import { loadStore, saveStore, store } from './store.js';
import {
  anonymityCard,
  approvalLogCard,
  categorySelectedCard,
  dmUploadCard,
  genderSelectionCard,
  messageCard,
  notificationCard,
  postCard,
  rejectionModal,
  reviewCard,
  submissionRetryCard,
  submissionStatusCard,
  welcomeCard,
} from './ui.js';

const token = process.env.DISCORD_TOKEN;
const MAX_UPLOAD_MB = Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 25);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const UPLOAD_WINDOW_MS = 5 * 60 * 1000;
const awaitingUploads = new Map();
const pendingMedia = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const ephemeral = { flags: MessageFlags.Ephemeral };
const makeId = () => randomUUID().replaceAll('-', '').slice(0, 12).toLowerCase();
const notificationKey = (guildId, userId) => `${guildId}:${userId}`;
const publicReference = (id) => `SFX-${id.toUpperCase()}`;

function containerPayload(container, options = {}) {
  return {
    ...options,
    components: [container],
    flags: (options.flags ?? 0) | MessageFlags.IsComponentsV2,
  };
}

async function updateInteractionCard(interaction, card) {
  await interaction.deferUpdate();
  return interaction.editReply({ components: [card] });
}

function referenceToId(reference) {
  return reference.trim().replace(/^SFX[-_]?/i, '').toLowerCase();
}

function hasModeratorPermission(interaction) {
  return Boolean(interaction.guild && interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages));
}

function mediaDetails(attachment) {
  const extension = extname(attachment.name ?? '').toLowerCase();
  const mime = (attachment.contentType ?? '').split(';')[0].toLowerCase();
  const images = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
  const videos = new Set(['.mp4', '.mov', '.webm']);
  const isImage = images.has(extension) && (!mime || mime.startsWith('image/'));
  const isVideo = videos.has(extension) && (!mime || mime.startsWith('video/'));
  if (!isImage && !isVideo) return null;
  return {
    mediaType: isImage ? 'image' : 'video',
    mediaFileName: `smash-or-pass-${makeId()}${extension}`,
  };
}

async function sendUserDm(userId, payload) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(payload);
    return true;
  } catch {
    return false;
  }
}

async function verifyModeratorInteraction(interaction) {
  if (!hasModeratorPermission(interaction)) {
    await interaction.reply({ content: 'Cette action est réservée à l’équipe de modération.', ...ephemeral });
    return false;
  }
  const config = store.guilds[interaction.guildId];
  if (!config || interaction.channelId !== config.moderationChannelId) {
    await interaction.reply({ content: 'Cette action doit être faite dans le salon privé de modération configuré.', ...ephemeral });
    return false;
  }
  return true;
}

async function notifySubscribers(guildId, post) {
  const config = store.guilds[guildId];
  const channel = await client.channels.fetch(post.channelId).catch(() => null);
  if (!config || !channel) return;
  const users = Object.entries(store.notifications)
    .filter(([key, enabled]) => enabled && key.startsWith(`${guildId}:`))
    .map(([key]) => key.slice(guildId.length + 1))
    .filter((userId) => userId !== post.ownerId);

  await Promise.allSettled(users.map((userId) => sendUserDm(userId, containerPayload(messageCard(
    'Une nouvelle participation est en ligne',
    `La communauté peut maintenant voter dans <#${post.channelId}>.\n\n[Ouvrir la publication](https://discord.com/channels/${guildId}/${post.channelId}/${post.messageId})`,
  )))));
}

async function handleSetup(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: 'La configuration de Smash Or Pass est réservée aux administrateurs du serveur.', ...ephemeral });
  }
  if (!interaction.guild || !interaction.channel?.isTextBased()) {
    return interaction.reply({ content: 'L’installation doit être lancée dans un salon texte du serveur.', ...ephemeral });
  }

  const moderation = interaction.options.getChannel('moderation', true);
  const logs = interaction.options.getChannel('logs', true);
  const men = interaction.options.getChannel('hommes', true);
  const women = interaction.options.getChannel('femmes', true);
  const other = interaction.options.getChannel('autre', true);
  const everyonePermissions = logs.permissionsFor(interaction.guild.roles.everyone);
  if (!everyonePermissions || everyonePermissions.has(PermissionFlagsBits.ViewChannel)) {
    return interaction.reply({
      content: 'Le salon de logs doit être privé : retire à @everyone la permission « Voir le salon », puis relance `/smashorpass setup`.',
      ...ephemeral,
    });
  }
  const botLogPermissions = interaction.guild.members.me
    ? logs.permissionsFor(interaction.guild.members.me)
    : null;
  if (!botLogPermissions
    || !botLogPermissions.has(PermissionFlagsBits.ViewChannel)
    || !botLogPermissions.has(PermissionFlagsBits.SendMessages)
    || !botLogPermissions.has(PermissionFlagsBits.AttachFiles)) {
    return interaction.reply({
      content: 'Le bot doit pouvoir voir le salon de logs, y envoyer des messages et joindre des fichiers. Ajoute ces permissions au bot, puis relance `/smashorpass setup`.',
      ...ephemeral,
    });
  }
  await interaction.deferReply(ephemeral);
  const oldConfig = store.guilds[interaction.guildId] ?? {};
  const panel = await interaction.channel.send(containerPayload(welcomeCard()));
  if (oldConfig.panelChannelId && oldConfig.panelMessageId) {
    const oldChannel = await client.channels.fetch(oldConfig.panelChannelId).catch(() => null);
    const oldMessage = oldChannel?.messages ? await oldChannel.messages.fetch(oldConfig.panelMessageId).catch(() => null) : null;
    if (oldMessage) await oldMessage.delete().catch(() => null);
  }

  store.guilds[interaction.guildId] = {
    moderationChannelId: moderation.id,
    logsChannelId: logs.id,
    menChannelId: men.id,
    womenChannelId: women.id,
    otherChannelId: other.id,
    panelChannelId: interaction.channelId,
    panelMessageId: panel.id,
  };
  await saveStore();
  return interaction.editReply({
    content: `C’est prêt ✨ Le panneau est en ligne ici. Modération : <#${moderation.id}> · Logs staff : <#${logs.id}> · Publications : <#${men.id}>, <#${women.id}> et <#${other.id}>.`,
  });
}

async function handleRemoval(interaction) {
  if (!interaction.guildId) {
    return interaction.reply({ content: 'Utilise cette commande depuis le serveur où tu as participé.', ...ephemeral });
  }
  const id = referenceToId(interaction.options.getString('reference', true));
  const submission = store.submissions[id];
  const post = store.posts[id];
  const ownerId = submission?.userId ?? post?.ownerId;
  if (!ownerId || ownerId !== interaction.user.id || (submission?.guildId ?? post?.guildId) !== interaction.guildId) {
    return interaction.reply({ content: 'Je ne trouve pas de participation à toi avec cette référence.', ...ephemeral });
  }
  if (submission?.status !== 'pending' && post?.status !== 'published') {
    return interaction.reply({ content: 'Cette participation n’est plus en attente et n’a pas de publication active.', ...ephemeral });
  }

  await interaction.deferReply(ephemeral);
  if (submission?.status === 'pending') {
    const reviewChannel = await client.channels.fetch(submission.reviewChannelId).catch(() => null);
    const reviewMessage = reviewChannel?.messages
      ? await reviewChannel.messages.fetch(submission.reviewMessageId).catch(() => null)
      : null;
    if (reviewMessage) {
      try {
        await reviewMessage.delete();
      } catch {
        return interaction.editReply({ content: 'Je n’ai pas réussi à retirer l’envoi de la file de modération. Préviens l’équipe.' });
      }
    }
    submission.status = 'withdrawn';
  }
  if (post && post.status === 'published') {
    const channel = await client.channels.fetch(post.channelId).catch(() => null);
    const message = channel?.messages ? await channel.messages.fetch(post.messageId).catch(() => null) : null;
    if (message) {
      try {
        await message.delete();
      } catch {
        return interaction.editReply({ content: 'Je n’ai pas réussi à supprimer le message. Préviens l’équipe pour qu’elle le retire.' });
      }
    }
    post.status = 'removed';
    post.votes = {};
    if (submission) submission.status = 'withdrawn';
  }
  await saveStore();
  return interaction.editReply({ content: 'C’est fait. Ta participation a été retirée.' });
}

async function handleCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'setup') return handleSetup(interaction);
  if (subcommand === 'retirer') return handleRemoval(interaction);
}

async function beginUpload(interaction, category) {
  const guildId = interaction.guildId;
  if (!guildId || !store.guilds[guildId]) {
    return updateInteractionCard(interaction, messageCard('Parcours indisponible', 'Le parcours n’est plus configuré sur ce serveur.'));
  }
  if (awaitingUploads.has(interaction.user.id) || pendingMedia.has(interaction.user.id)) {
    return updateInteractionCard(interaction, messageCard('Participation déjà en cours', 'Tu as déjà une participation ouverte dans tes DM.'));
  }
  const alreadyPending = Object.values(store.submissions).some((submission) =>
    submission.userId === interaction.user.id && submission.guildId === guildId && ['pending', 'publishing'].includes(submission.status));
  if (alreadyPending) {
    return updateInteractionCard(interaction, messageCard('Participation en attente', 'Tu as déjà une participation en attente de validation.'));
  }

  await interaction.deferUpdate();
  try {
    const dm = await interaction.user.createDM();
    const prompt = await dm.send(containerPayload(dmUploadCard(MAX_UPLOAD_MB, category)));
    const session = {
      guildId,
      category,
      startedAt: Date.now(),
      dmChannelId: dm.id,
      promptMessageId: prompt.id,
      timer: null,
    };
    session.timer = setTimeout(async () => {
      const active = awaitingUploads.get(interaction.user.id);
      if (!active || active.startedAt !== session.startedAt) return;
      awaitingUploads.delete(interaction.user.id);
      const channel = await client.channels.fetch(active.dmChannelId).catch(() => null);
      const message = channel?.messages ? await channel.messages.fetch(active.promptMessageId).catch(() => null) : null;
      if (message) {
        await message.edit({
          components: [messageCard('Délai écoulé', 'Les 5 minutes sont passées. Tu peux recommencer depuis le panneau du serveur.')],
        }).catch(() => null);
      }
    }, UPLOAD_WINDOW_MS);
    session.timer.unref?.();
    awaitingUploads.set(interaction.user.id, session);
    await interaction.editReply({ components: [categorySelectedCard(category)] });
  } catch {
    await interaction.editReply({
      components: [messageCard('Impossible de t’envoyer un DM', 'Autorise les messages privés du serveur puis recommence.')],
    });
  }
}

async function finalizeSubmission(interaction, anonymous) {
  const staged = pendingMedia.get(interaction.user.id);
  if (!staged || Date.now() - staged.createdAt > UPLOAD_WINDOW_MS) {
    if (staged) {
      clearTimeout(staged.timer);
      pendingMedia.delete(interaction.user.id);
    }
    return updateInteractionCard(interaction, messageCard('Délai écoulé', 'Recommence depuis le panneau du serveur pour envoyer une nouvelle participation.'));
  }
  if (staged.processing) {
    return interaction.reply({ content: 'Je transmets déjà ton média à l’équipe, attends un instant.', ...ephemeral });
  }

  staged.processing = true;
  await interaction.deferUpdate();
  const config = store.guilds[staged.guildId];
  const moderationChannel = config?.moderationChannelId
    ? await client.channels.fetch(config.moderationChannelId).catch(() => null)
    : null;
  if (!moderationChannel?.send) {
    staged.processing = false;
    return interaction.editReply({
      components: [submissionRetryCard('L’équipe ne peut pas recevoir ton média pour le moment. Réessaie dans quelques instants.')],
    });
  }

  const id = makeId();
  const submission = {
    id,
    guildId: staged.guildId,
    userId: interaction.user.id,
    category: staged.category,
    anonymous,
    mediaType: staged.mediaType,
    mediaFileName: staged.mediaFileName,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  let reviewMessage;
  try {
    reviewMessage = await moderationChannel.send(containerPayload(
      reviewCard(submission, escapeMarkdown(interaction.user.username)),
      {
        files: [{ attachment: staged.mediaUrl, name: staged.mediaFileName }],
        allowedMentions: { parse: [] },
      },
    ));
  } catch (error) {
    staged.processing = false;
    console.error('Échec de la transmission à la modération :', error);
    return interaction.editReply({
      components: [submissionRetryCard('Ton média n’a pas encore été transmis. Vérifie les DM du bot et réessaie.')],
    });
  }

  submission.reviewChannelId = moderationChannel.id;
  submission.reviewMessageId = reviewMessage.id;
  submission.mediaUrl = reviewMessage.attachments.first()?.url ?? staged.mediaUrl;
  store.submissions[id] = submission;
  await saveStore();
  clearTimeout(staged.timer);
  pendingMedia.delete(interaction.user.id);
  return interaction.editReply({
    files: [{ attachment: staged.mediaUrl, name: staged.mediaFileName }],
    components: [submissionStatusCard({ ...staged, id })],
  });
}

async function handleButton(interaction) {
  const { customId } = interaction;
  if (customId === 'sf:join:start') {
    if (!interaction.guildId || !store.guilds[interaction.guildId]) {
      return interaction.reply({ content: 'Le panneau n’est pas encore configuré. Demande à un administrateur de lancer `/smashorpass setup`.', ...ephemeral });
    }
    const active = Object.values(store.submissions).find((submission) =>
      submission.userId === interaction.user.id && submission.guildId === interaction.guildId && ['pending', 'publishing'].includes(submission.status));
    if (active) return interaction.reply({ content: `Tu as déjà une participation en cours (${publicReference(active.id)}).`, ...ephemeral });
    if (awaitingUploads.has(interaction.user.id) || pendingMedia.has(interaction.user.id)) {
      return interaction.reply({ content: 'Tu as déjà un parcours de participation ouvert dans tes DM.', ...ephemeral });
    }
    return interaction.reply(containerPayload(genderSelectionCard(), { flags: MessageFlags.Ephemeral }));
  }

  if (customId.startsWith('sf:join:gender:')) {
    const category = customId.slice('sf:join:gender:'.length);
    if (!['men', 'women', 'other'].includes(category)) {
      return updateInteractionCard(interaction, messageCard('Catégorie indisponible', 'Cette catégorie n’est pas disponible.'));
    }
    return beginUpload(interaction, category);
  }

  if (customId === 'sf:join:cancel') {
    await interaction.deferUpdate();
    const pending = awaitingUploads.get(interaction.user.id);
    if (pending) clearTimeout(pending.timer);
    awaitingUploads.delete(interaction.user.id);
    const staged = pendingMedia.get(interaction.user.id);
    if (staged) clearTimeout(staged.timer);
    pendingMedia.delete(interaction.user.id);
    return interaction.editReply({ components: [messageCard('Participation annulée', 'Tu pourras revenir quand tu le souhaites.')] });
  }

  if (customId === 'sf:join:learn') {
    return interaction.reply(containerPayload(messageCard(
      'Règles de publication',
      'Les contenus sexuellement explicites sont refusés. Les autres médias validés sont publiés tels quels, sans retouche. Toute personne visible doit être majeure et avoir donné son accord.',
    ), { flags: MessageFlags.Ephemeral }));
  }

  if (customId.startsWith('sf:submission:anonymous:')) {
    return finalizeSubmission(interaction, customId.endsWith(':yes'));
  }

  if (customId === 'sf:notifications') {
    const enabled = Boolean(store.notifications[notificationKey(interaction.guildId, interaction.user.id)]);
    return interaction.reply(containerPayload(notificationCard(enabled), { flags: MessageFlags.Ephemeral }));
  }

  if (customId === 'sf:notifications:toggle') {
    const key = notificationKey(interaction.guildId, interaction.user.id);
    store.notifications[key] = !store.notifications[key];
    await interaction.deferUpdate();
    await saveStore();
    return interaction.editReply({ components: [notificationCard(store.notifications[key])] });
  }

  if (customId.startsWith('sf:review:approve:')) {
    const id = customId.slice('sf:review:approve:'.length);
    if (!await verifyModeratorInteraction(interaction)) return;
    const submission = store.submissions[id];
    if (!submission || submission.status !== 'pending') {
      return interaction.reply({ content: 'Cette participation n’est plus en attente.', ...ephemeral });
    }
    submission.status = 'publishing';
    await interaction.deferUpdate();
    await saveStore();
    const config = store.guilds[submission.guildId];
    const targetId = submission.category === 'men'
      ? config?.menChannelId
      : submission.category === 'women'
        ? config?.womenChannelId
        : config?.otherChannelId;
    const target = targetId ? await client.channels.fetch(targetId).catch(() => null) : null;
    let attachmentUrl = submission.mediaUrl ?? interaction.message.attachments.first()?.url;
    if (!attachmentUrl && submission.reviewChannelId && submission.reviewMessageId) {
      const reviewChannel = await client.channels.fetch(submission.reviewChannelId).catch(() => null);
      const reviewMessage = reviewChannel?.messages
        ? await reviewChannel.messages.fetch(submission.reviewMessageId).catch(() => null)
        : null;
      attachmentUrl = reviewMessage?.attachments.first()?.url;
    }
    if (!target?.send) {
      submission.status = 'pending';
      await saveStore();
      return interaction.followUp({ content: 'Publication impossible : le salon associé à cette catégorie est introuvable ou le bot ne peut pas y publier. Vérifie `/smashorpass setup`.', ...ephemeral });
    }
    if (!attachmentUrl) {
      submission.status = 'pending';
      await saveStore();
      console.error(`Média introuvable pour la participation ${id} (ni URL sauvegardée, ni pièce jointe sur le message de modération).`);
      return interaction.followUp({ content: 'Publication impossible : je ne retrouve pas le fichier de cette participation. Renvoie le média pour créer une nouvelle demande de modération.', ...ephemeral });
    }

    let displayName = 'un membre';
    try {
      const member = await interaction.guild.members.fetch(submission.userId);
      displayName = escapeMarkdown(member.displayName);
    } catch {
      displayName = 'un membre';
    }

    const post = {
      id,
      guildId: submission.guildId,
      channelId: target.id,
      ownerId: submission.userId,
      anonymous: submission.anonymous,
      displayName: submission.anonymous ? null : displayName,
      mediaType: submission.mediaType,
      mediaFileName: submission.mediaFileName,
      createdAt: new Date().toISOString(),
      votes: {},
      status: 'published',
    };
    let publishedMessage;
    try {
      publishedMessage = await target.send(containerPayload(postCard(post, displayName), {
        files: [{ attachment: attachmentUrl, name: submission.mediaFileName }],
        allowedMentions: { parse: [] },
      }));
    } catch (error) {
      submission.status = 'pending';
      await saveStore();
      throw error;
    }
    post.messageId = publishedMessage.id;
    store.posts[id] = post;
    submission.status = 'published';
    submission.postChannelId = target.id;
    submission.postMessageId = publishedMessage.id;
    submission.approvedBy = interaction.user.id;
    delete submission.mediaUrl;
    await saveStore();

    const publicUrl = `https://discord.com/channels/${submission.guildId}/${target.id}/${publishedMessage.id}`;
    const logsChannel = config?.logsChannelId
      ? await client.channels.fetch(config.logsChannelId).catch(() => null)
      : null;
    let logged = false;
    if (logsChannel?.send) {
      try {
        const logMessage = await logsChannel.send(containerPayload(
          approvalLogCard(submission, interaction.user.id, publicUrl),
          {
            files: [{
              attachment: publishedMessage.attachments.first()?.url ?? attachmentUrl,
              name: submission.mediaFileName,
            }],
            allowedMentions: { parse: [] },
          },
        ));
        submission.logChannelId = logsChannel.id;
        submission.logMessageId = logMessage.id;
        await saveStore();
        logged = true;
      } catch (error) {
        console.error(`Échec de l’écriture des logs pour la participation ${id} :`, error);
      }
    }

    await interaction.message.delete().catch(() => null);
    await sendUserDm(submission.userId, containerPayload(messageCard(
      'Ta participation est en ligne ✨',
      `La communauté peut maintenant voter. Référence : **${publicReference(id)}**.\n\n[Ouvrir la publication](https://discord.com/channels/${submission.guildId}/${target.id}/${publishedMessage.id})\n\nTu peux la retirer à tout moment avec \`/smashorpass retirer\`.`,
    )));
    await notifySubscribers(submission.guildId, post);
    const logStatus = logged
      ? ' La validation a aussi été enregistrée dans le salon staff.'
      : ' Attention : les logs n’ont pas été écrits. Vérifie le salon de logs et les permissions du bot, puis relance `/smashorpass setup` si nécessaire.';
    return interaction.followUp({ content: `Publication en ligne dans <#${target.id}>.${logStatus}`, ...ephemeral });
  }

  if (customId.startsWith('sf:review:reject:')) {
    const id = customId.slice('sf:review:reject:'.length);
    if (!await verifyModeratorInteraction(interaction)) return;
    const submission = store.submissions[id];
    if (!submission || submission.status !== 'pending') {
      return interaction.reply({ content: 'Cette participation n’est plus en attente.', ...ephemeral });
    }
    return interaction.showModal(rejectionModal(id));
  }

  if (customId.startsWith('sf:vote:')) {
    const [, , choice, id] = customId.split(':');
    const post = store.posts[id];
    if (!post || post.status !== 'published') {
      return interaction.reply({ content: 'Cette publication n’est plus disponible.', ...ephemeral });
    }
    if (interaction.guildId !== post.guildId || interaction.channelId !== post.channelId) {
      return interaction.reply({ content: 'Ce vote ne correspond pas à ce salon.', ...ephemeral });
    }
    if (interaction.user.id === post.ownerId) {
      return interaction.reply({ content: 'Tu ne peux pas voter sur ta propre participation.', ...ephemeral });
    }
    if (!['crush', 'smash', 'pass'].includes(choice)) {
      return interaction.reply({ content: 'Ce choix de vote n’est pas valide.', ...ephemeral });
    }

    if (post.votes[interaction.user.id] === choice) delete post.votes[interaction.user.id];
    else post.votes[interaction.user.id] = choice;
    await interaction.deferUpdate();
    await saveStore();
    await interaction.editReply({ components: [postCard(post, post.displayName ?? 'un membre')] });
    const currentVote = post.votes[interaction.user.id];
    return interaction.followUp({
      content: currentVote ? 'Ton vote a été pris en compte 💜' : 'Ton vote a été retiré.',
      ...ephemeral,
    });
  }
}

async function handleModal(interaction) {
  if (!interaction.customId.startsWith('sf:review:reject-modal:')) return;
  if (!await verifyModeratorInteraction(interaction)) return;
  const id = interaction.customId.slice('sf:review:reject-modal:'.length);
  const submission = store.submissions[id];
  if (!submission || submission.status !== 'pending') {
    return interaction.reply({ content: 'Cette participation n’est plus en attente.', ...ephemeral });
  }
  submission.status = 'rejected';
  delete submission.mediaUrl;
  submission.rejectionReason = interaction.fields.getTextInputValue('reason').trim().slice(0, 300);
  await interaction.deferReply(ephemeral);
  await saveStore();

  const reviewChannel = await client.channels.fetch(submission.reviewChannelId).catch(() => null);
  const reviewMessage = reviewChannel?.messages
    ? await reviewChannel.messages.fetch(submission.reviewMessageId).catch(() => null)
    : null;
  if (reviewMessage) await reviewMessage.delete().catch(() => null);

  const reasonLine = submission.rejectionReason ? `\n\nMotif : ${submission.rejectionReason}` : '';
  await sendUserDm(submission.userId, containerPayload(messageCard(
    'Ta participation n’a pas été publiée',
    `L’équipe a refusé le média envoyé. Tu peux recommencer avec un contenu qui respecte les règles.${reasonLine}`,
  )));
  return interaction.editReply({ content: `Participation ${publicReference(id)} refusée.` });
}

async function handleIncomingDm(message) {
  if (message.author.bot || message.guild) return;
  const session = awaitingUploads.get(message.author.id);
  if (!session) return;
  if (Date.now() - session.startedAt > UPLOAD_WINDOW_MS) {
    clearTimeout(session.timer);
    awaitingUploads.delete(message.author.id);
    await message.reply('Le délai de 5 minutes est passé. Recommence depuis le panneau du serveur.');
    return;
  }
  if (session.processing) {
    await message.reply('Je vérifie déjà ton envoi, attends un instant 💜');
    return;
  }
  const attachment = message.attachments.first();
  if (!attachment) {
    await message.reply('Ajoute ta photo ou vidéo en pièce jointe à ce DM. Tu as toujours jusqu’à la fin du délai.');
    return;
  }
  if (message.attachments.size !== 1) {
    await message.reply('Envoie un seul fichier à la fois pour cette participation.');
    return;
  }
  if (attachment.size > MAX_UPLOAD_BYTES) {
    await message.reply(`Ce fichier dépasse la limite de ${MAX_UPLOAD_MB} Mo. Envoie un fichier plus léger.`);
    return;
  }
  const media = mediaDetails(attachment);
  if (!media) {
    await message.reply('Format non reconnu. Envoie une photo JPG, PNG, WEBP ou GIF, ou une vidéo MP4, MOV ou WEBM.');
    return;
  }

  session.processing = true;
  try {
    const staged = {
      guildId: session.guildId,
      category: session.category,
      mediaType: media.mediaType,
      mediaFileName: media.mediaFileName,
      mediaUrl: attachment.url,
      dmChannelId: session.dmChannelId,
      createdAt: Date.now(),
      choiceMessageId: null,
      timer: null,
      processing: false,
    };
    const choiceMessage = await message.reply(containerPayload(anonymityCard(session.category)));
    staged.choiceMessageId = choiceMessage.id;
    staged.timer = setTimeout(async () => {
      const active = pendingMedia.get(message.author.id);
      if (!active || active.createdAt !== staged.createdAt) return;
      pendingMedia.delete(message.author.id);
      const channel = await client.channels.fetch(active.dmChannelId).catch(() => null);
      const prompt = channel?.messages ? await channel.messages.fetch(active.choiceMessageId).catch(() => null) : null;
      if (prompt) {
        await prompt.edit({
          components: [messageCard('Délai écoulé', 'Ton média n’a pas été transmis. Recommence depuis le panneau du serveur.')],
        }).catch(() => null);
      }
    }, UPLOAD_WINDOW_MS);
    staged.timer.unref?.();
    pendingMedia.set(message.author.id, staged);

    clearTimeout(session.timer);
    awaitingUploads.delete(message.author.id);
    const dmChannel = await client.channels.fetch(session.dmChannelId).catch(() => null);
    const prompt = dmChannel?.messages ? await dmChannel.messages.fetch(session.promptMessageId).catch(() => null) : null;
    if (prompt) {
      await prompt.edit({
        components: [messageCard('Média reçu', 'Choisis maintenant ton niveau d’anonymat dans le message ci-dessous.')],
      }).catch(() => null);
    }
  } catch (error) {
    session.processing = false;
    console.error('Échec de la réception du média :', error);
    await message.reply('Je n’ai pas réussi à préparer ton média. Ton délai est encore actif, tu peux réessayer.');
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'smashorpass') {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (error) {
    const action = interaction.isButton()
      ? interaction.customId
      : interaction.isChatInputCommand()
        ? `/${interaction.commandName}`
        : interaction.isModalSubmit()
          ? interaction.customId
          : 'inconnue';
    console.error(`Erreur pendant l’interaction ${action} :`, error);
    const response = { content: 'Une erreur est survenue. Réessaie dans un instant ou préviens l’équipe.', ...ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => null);
    else await interaction.reply(response).catch(() => null);
  }
});

client.on(Events.MessageCreate, (message) => {
  handleIncomingDm(message).catch((error) => console.error('Erreur pendant la réception d’un DM :', error));
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Smash Or Pass prêt : ${readyClient.user.tag}`);
});

if (!token) throw new Error('Renseigne DISCORD_TOKEN dans le fichier .env.');
await loadStore();
await client.login(token);
