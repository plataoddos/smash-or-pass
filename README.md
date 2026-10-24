<div align="center">
  <img src="logo.png" alt="Logo Smash Or Pass" width="220">
  <h1>Smash Or Pass</h1>
  <p>Un bot Discord pour participer, voter et modérer en communauté.</p>
  <p><strong>Développé par Σmnosia</strong></p>
</div>

---

## Fonctionnement

1. Un membre choisit une catégorie depuis le panneau du serveur.
2. Il envoie une photo ou une vidéo au bot en message privé, dans les 5 minutes.
3. Il choisit de publier avec son nom Discord ou de rester anonyme.
4. L’équipe vérifie le média dans le salon de modération.
5. Après validation, le bot publie le média dans le salon correspondant et enregistre la validation dans le salon de logs privé.
6. Les membres du serveur votent avec les boutons **Coup de foudre**, **Smash** et **Pass**.

## Commandes

| Commande | Accès | Description |
| --- | --- | --- |
| `/smashorpass setup` | Administrateurs | Configure les salons et publie le panneau de participation. |
| `/smashorpass retirer` | Membres | Retire une participation en attente ou une publication avec sa référence `SFX-…`. |

Le salon de logs contient le média, le membre concerné même si sa publication est anonyme, le modérateur qui a validé et le lien vers la publication. Les mentions dans ce journal n’envoient pas de notification.

## Installation

### Prérequis

- Node.js **24.17.0 ou plus récent**
- Une application et un bot créés dans le [portail développeur Discord](https://discord.com/developers/applications)
- L’intent privilégié **Message Content** activé dans les paramètres du bot

Invite le bot avec les scopes `bot` et `applications.commands`. Il doit pouvoir voir les salons configurés, lire l’historique, envoyer des messages et joindre des fichiers.

### Installer et démarrer

Depuis le dossier du projet :

```sh
npm install
cp .env.example .env
```

Ouvre `.env` et renseigne les identifiants de ton application Discord :

```env
DISCORD_TOKEN=ton_token_de_bot
DISCORD_CLIENT_ID=identifiant_de_ton_application
DISCORD_GUILD_ID=
MAX_UPLOAD_MB=25
```

`DISCORD_GUILD_ID` est facultatif : renseigne-le pour enregistrer la commande sur un serveur précis, ou laisse-le vide pour l’enregistrer globalement. `MAX_UPLOAD_MB` définit la taille maximale d’un fichier ; la valeur par défaut est 25 Mo.

Enregistre les commandes slash puis démarre le bot :

```sh
npm run deploy
npm start
```

Après une modification des commandes slash, relance `npm run deploy`.

## Configuration des salons

Crée cinq salons texte :

| Salon | Accès conseillé | Utilisation |
| --- | --- | --- |
| Modération | Staff | Réception et validation des participations. |
| Logs | Staff uniquement | Historique des médias validés et des modérateurs responsables. |
| Masculin | Membres du serveur | Publications de la catégorie Masculin. |
| Féminin | Membres du serveur | Publications de la catégorie Féminin. |
| Autre | Membres du serveur | Publications de la catégorie Autre. |

Dans le salon où tu veux afficher le panneau, lance `/smashorpass setup` en tant qu’administrateur et sélectionne les cinq salons. Le salon de logs doit refuser à `@everyone` la permission **Voir le salon**. Le bot doit y avoir les permissions **Voir le salon**, **Envoyer des messages** et **Joindre des fichiers**.

## Modération et règles

La participation est réservée aux personnes majeures. Toute personne visible sur un média doit être majeure et avoir donné son accord. La modération refuse les contenus sexuellement explicites, les médias non consentis et ceux représentant des mineurs. Les médias acceptés sont publiés tels quels, sans flou ni retouche.

## Données

Les photos et vidéos transitent par Discord et ne sont pas enregistrées sur le disque par le bot. Les paramètres du serveur, les références, les votes et l’état des participations sont enregistrés dans `data/store.json`.

Le fichier `.env` contient le token du bot et doit rester privé. Il est ignoré par Git ; `.env.example` ne contient que des valeurs indicatives.

## Crédits

**Smash Or Pass — par Σmnosia**
