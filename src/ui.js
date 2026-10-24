import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

const text = (content) => new TextDisplayBuilder().setContent(content);

function divider() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function addMedia(container, mediaType, fileName, altText = 'Média envoyé pour la participation') {
  if (mediaType === 'image') {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${fileName}`)
          .setDescription(altText),
      ),
    );
  } else {
    container.addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));
  }
  return container;
}

export function messageCard(title, description) {
  return new ContainerBuilder().addTextDisplayComponents(
    text(title ? `## ${title}\n${description}` : description),
  );
}

export function welcomeCard() {
  return new ContainerBuilder()
    .addTextDisplayComponents(text('# SMASH OR PASS  💋'))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text([
      'Tu te sens prêt·e à te montrer ? **C’est ici que ça se passe.**',
      '',
      'Partage une photo ou une vidéo de toi, laisse la communauté voter et découvre les résultats. Tu choisis ta catégorie et si tu souhaites rester anonyme.',
      '',
      '### Comment participer ?',
      '1. Clique sur **Je souhaite participer**',
      '2. Choisis une catégorie : **Masculin**, **Féminin** ou **Autre**',
      '3. Envoie ta photo ou vidéo au bot en DM dans les 5 minutes',
      '4. Choisis si ton nom apparaît ou si tu restes anonyme',
      '5. Après validation par l’équipe, la communauté vote',
      '',
      '💌 La participation est réservée aux personnes majeures. Toutes les personnes visibles doivent être majeures et consentantes.',
      'Les contenus sexuellement explicites sont refusés. Après validation, le média est publié tel quel dans le salon du serveur, sans flou ni retouche.',
    ].join('\n')))
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('sf:join:start')
        .setLabel('Je souhaite participer')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('sf:notifications')
        .setLabel('Gérer les notifications')
        .setEmoji('🔔')
        .setStyle(ButtonStyle.Secondary),
    ));
}

export function genderSelectionCard() {
  return new ContainerBuilder()
    .addTextDisplayComponents(text([
      '## Quel est ton genre ?',
      'Ton contenu sera publié dans le salon correspondant à ta catégorie.',
      '',
      'En choisissant, tu confirmes avoir **18 ans ou plus**, être la personne sur le média et accepter sa publication après validation.',
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sf:join:gender:men').setLabel('Masculin').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sf:join:gender:women').setLabel('Féminin').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sf:join:gender:other').setLabel('Autre').setStyle(ButtonStyle.Danger),
    ));
}

export function categoryLabel(category) {
  return ({ men: 'Garçon', women: 'Fille', other: 'Autre' })[category] ?? 'Autre';
}

export function categorySelectedCard(category) {
  return new ContainerBuilder().addTextDisplayComponents(text([
    '## Catégorie sélectionnée',
    `Genre sélectionné : **${categoryLabel(category)}**`,
    '',
    'Envoie maintenant ta **photo ou vidéo** en message privé au bot. Tu as **5 minutes** pour le faire.',
  ].join('\n')));
}

export function anonymityCard(category) {
  return new ContainerBuilder()
    .addTextDisplayComponents(text([
      '## Photo bien reçue ✨',
      `Catégorie : **${categoryLabel(category)}**`,
      '',
      'Dernière étape : tu souhaites rester anonyme ou afficher ton nom Discord ?',
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sf:submission:anonymous:yes').setLabel('Rester anonyme').setEmoji('🕶️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sf:submission:anonymous:no').setLabel('Afficher mon nom').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sf:join:cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger),
    ));
}

export function submissionRetryCard(description) {
  return new ContainerBuilder()
    .addTextDisplayComponents(text([
      '## Envoi temporairement indisponible',
      description,
      '',
      'Tu peux réessayer en choisissant à nouveau ton anonymat.',
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sf:submission:anonymous:yes').setLabel('Réessayer anonymement').setEmoji('🕶️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sf:submission:anonymous:no').setLabel('Réessayer avec mon nom').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sf:join:cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger),
    ));
}

export function dmUploadCard(maxUploadMb = 25, category = 'men') {
  return new ContainerBuilder()
    .addTextDisplayComponents(text([
      '## Envoie ta photo ou vidéo',
      `Genre sélectionné : **${categoryLabel(category)}**`,
      '',
      'Réponds à ce DM avec **une photo ou une vidéo de toi**. Tu as **5 minutes**.',
      '',
      'Les contenus sexuellement explicites sont refusés par la modération. Toute personne visible doit être majeure et consentante. Après validation, le média est publié tel quel, sans flou ni retouche.',
      '',
      `Formats acceptés : JPG, PNG, WEBP, GIF, MP4, MOV et WEBM. Taille maximale : ${maxUploadMb} Mo.`,
    ].join('\n')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sf:join:learn').setLabel('En savoir plus').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sf:join:cancel').setLabel('Annuler').setStyle(ButtonStyle.Danger),
    ));
}

export function reviewCard(submission, username) {
  const card = new ContainerBuilder()
    .addTextDisplayComponents(text([
      '## Nouvelle participation · à vérifier',
      'Refuse les contenus sexuellement explicites, les médias non consentis et ceux représentant des mineurs. Vérifie aussi le respect des règles du serveur.',
      '',
      `**Référence :** SFX-${submission.id.toUpperCase()}  ·  **Catégorie :** ${categoryLabel(submission.category)}`,
      `**Visibilité :** ${submission.anonymous ? 'Anonyme' : `Nom affiché · ${username}`}`,
      `**Membre :** <@${submission.userId}>  ·  **Média :** ${submission.mediaType === 'video' ? 'Vidéo' : 'Photo'}`,
      '',
      'Le média sera publié uniquement après validation par l’équipe.',
    ].join('\n')));

  addMedia(card, submission.mediaType, submission.mediaFileName);
  card.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`sf:review:approve:${submission.id}`).setLabel('Valider et publier').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sf:review:reject:${submission.id}`).setLabel('Refuser').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  ));
  return card;
}

export function reviewButtons(id) {
  return [
    new ButtonBuilder().setCustomId(`sf:review:approve:${id}`).setLabel('Valider et publier').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`sf:review:reject:${id}`).setLabel('Refuser').setEmoji('✖️').setStyle(ButtonStyle.Danger),
  ];
}

export function postCard(post, displayName) {
  const who = post.anonymous ? 'un membre anonyme' : displayName;
  const kind = post.mediaType === 'video' ? 'Vidéo' : 'Photo';
  const card = new ContainerBuilder()
    .addTextDisplayComponents(text([
      '# SMASH OR PASS  ››',
      `Par **${who}** · ${kind}`,
      '',
      'À toi de voter — reste bienveillant·e 💜',
      '',
      `SFX-${post.id.toUpperCase()}  ·  publication modérée`,
    ].join('\n')));

  addMedia(card, post.mediaType, post.mediaFileName);
  card.addActionRowComponents(new ActionRowBuilder().addComponents(...voteButtons(post)));
  return card;
}

export function approvalLogCard(submission, moderatorId, publicUrl) {
  const card = new ContainerBuilder().addTextDisplayComponents(text([
    '## Publication validée',
    `**Membre :** <@${submission.userId}>`,
    `**Validée par :** <@${moderatorId}>`,
    `**Référence :** SFX-${submission.id.toUpperCase()}  ·  **Catégorie :** ${categoryLabel(submission.category)}`,
    `**Visibilité publique :** ${submission.anonymous ? 'Anonyme' : 'Nom affiché'}`,
    `**Média :** ${submission.mediaType === 'video' ? 'Vidéo' : 'Photo'}`,
    '',
    `[Ouvrir la publication](${publicUrl})`,
  ].join('\n')));

  addMedia(card, submission.mediaType, submission.mediaFileName, 'Média publié');
  return card;
}

export function voteButtons(post) {
  const votes = Object.values(post.votes ?? {});
  const count = (choice) => votes.filter((vote) => vote === choice).length;
  return [
    new ButtonBuilder()
      .setCustomId(`sf:vote:crush:${post.id}`)
      .setLabel(`Coup de foudre (${count('crush')})`)
      .setEmoji('💘')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`sf:vote:smash:${post.id}`)
      .setLabel(String(count('smash')))
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`sf:vote:pass:${post.id}`)
      .setLabel(String(count('pass')))
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  ];
}

export function notificationCard(enabled) {
  const card = new ContainerBuilder()
    .addTextDisplayComponents(text([
      '## Tes notifications',
      enabled
        ? 'Tu recevras en DM un petit message quand une nouvelle participation sera publiée.'
        : 'Les annonces de nouvelles participations sont désactivées.',
    ].join('\n')));
  card.addActionRowComponents(new ActionRowBuilder().addComponents(
    notificationButtons(enabled),
  ));
  return card;
}

export function notificationButtons(enabled) {
  return new ButtonBuilder()
    .setCustomId('sf:notifications:toggle')
    .setLabel(enabled ? 'Désactiver les annonces' : 'Recevoir les annonces')
    .setEmoji(enabled ? '🔕' : '🔔')
    .setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Primary);
}

export function submissionStatusCard(submission) {
  const card = new ContainerBuilder()
    .addTextDisplayComponents(text([
      'Ton contenu est en cours de vérification par l’équipe. Tu seras notifié·e une fois validé.',
      '',
      `Référence : **SFX-${submission.id.toUpperCase()}**.`,
    ].join('\n')));

  addMedia(card, submission.mediaType, submission.mediaFileName);
  card.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('sf:status:preview')
      .setLabel('Génération de l’aperçu…')
      .setDisabled(true)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sf:status:review')
      .setLabel('Contenu en cours de vérification…')
      .setDisabled(true)
      .setStyle(ButtonStyle.Secondary),
  ));
  return card;
}

export function rejectionModal(id) {
  return new ModalBuilder()
    .setCustomId(`sf:review:reject-modal:${id}`)
    .setTitle('Refuser la participation')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Motif envoyé en DM (facultatif)')
        .setPlaceholder('Ex. : une personne visible n’a pas confirmé son accord.')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(300)
        .setRequired(false),
    ));
}
