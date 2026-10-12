# Staging : tester TimeSheet en ligne

Ce guide met TimeSheet en ligne sur un serveur gratuit, pour le tester comme en vrai. Tout tourne sur une seule machine : l'application, la base de données, l'adresse sécurisée (https) et les tâches automatiques. Les fichiers sont dans `deploy/staging/`.

Le staging sert à tester. Pas de vraies données d'Orange dessus : seulement des comptes d'essai.

## Ce qu'il faut

- Un compte **Oracle Cloud** (offre « Always Free », gratuite ; une carte bancaire est demandée à l'inscription, rien n'est prélevé).
- Un compte **Brevo** (gratuit, 300 e-mails par jour) pour envoyer les e-mails.
- Un **jeton GitHub** pour copier le code (le dépôt est privé) : GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Choisir le dépôt `Timesheet`, droit « Contents : Read-only ».

## 1. Créer le serveur

Dans Oracle Cloud : **Compute → Instances → Create instance**.

- Image : **Ubuntu 24.04**.
- Shape : **Ampere (VM.Standard.A1.Flex)**, 2 OCPU et 12 Go de mémoire. Les petites machines « Micro » (1 Go) sont trop faibles pour les PDF.
- SSH keys : **Generate a key pair**, puis télécharger la clé privée (fichier `.key`). Elle sert à se connecter ; ne pas la perdre.

Noter l'**adresse IP publique** du serveur (ex. `141.147.10.20`).

## 2. Ouvrir les portes 80 et 443

Dans Oracle Cloud : page de l'instance → **Subnet** → **Security List** → **Add Ingress Rules**. Ajouter deux règles :

| Source CIDR | Protocole | Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

## 3. Se connecter au serveur

Depuis un terminal (PowerShell sous Windows) :

```
ssh -i chemin/vers/la-cle.key ubuntu@141.147.10.20
```

Toutes les commandes suivantes se tapent **sur le serveur**.

Ouvrir aussi les portes dans le pare-feu de la machine :

```
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 4. Installer Docker

```
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

Se reconnecter (commande `ssh` de l'étape 3) pour que le changement compte.

## 5. Copier le code

```
git clone -b staging https://github.com/NGONO0062/Timesheet.git
cd Timesheet/deploy/staging
```

Git demande un nom d'utilisateur (votre nom GitHub) et un mot de passe : coller le **jeton GitHub**.

## 6. Préparer les e-mails (Brevo)

Dans Brevo :

1. **Senders, Domains & Dedicated IPs → Senders** : ajouter l'adresse d'expédition et la valider (Brevo envoie un code).
2. **SMTP & API → SMTP** : noter le serveur (`smtp-relay.brevo.com`), le port (`587`), l'identifiant, et créer une **clé SMTP**.

## 7. Remplir les réglages

```
cp .env.example .env
nano .env
```

| Réglage | Quoi mettre |
|---|---|
| `DOMAIN` | L'IP du serveur, points remplacés par des tirets, suivie de `.sslip.io`. Ex. : `141-147-10-20.sslip.io`. |
| `POSTGRES_PASSWORD` | Résultat de `openssl rand -hex 24` |
| `AUTH_SECRET` | Résultat de `openssl rand -base64 32` |
| `TASKS_SECRET` | Résultat de `openssl rand -hex 32` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Les valeurs de Brevo (étape 6) |
| `SMTP_FROM` | `TimeSheet <adresse validée chez Brevo>` |

Laisser `DEMO_PROFILES="false"`, `TIMESHEET_NOW=""` et `SEED_PASSWORD=""`.

Pour lancer une commande `openssl`, ouvrir une seconde connexion `ssh`, ou quitter `nano` (Ctrl+X), lancer la commande, copier le résultat et rouvrir le fichier. Enregistrer dans `nano` : Ctrl+O, Entrée, puis Ctrl+X.

## 8. Démarrer

```
docker compose --profile outils build
docker compose up -d db
docker compose run --rm outils npx prisma migrate deploy
docker compose up -d
```

La première construction prend 10 à 20 minutes.

## 9. Créer le premier compte

```
docker compose run --rm outils npm run plateforme:admin -- votre.adresse@exemple.com "Prénom" "Nom"
```

La commande affiche un lien. L'ouvrir dans le navigateur, choisir un mot de passe, puis se connecter sur `https://<DOMAIN>`.

Ce compte est l'**admin plateforme**. Il crée une division (onboarding) ; l'administrateur de la division reçoit une invitation par e-mail et invite ensuite les autres personnes. Penser à renseigner l'adresse e-mail des RH de la division (Administration → Workflows) avant de tester la fiche de présence.

Les relances (chaque jour ouvré à 07:00) et le rappel de saisie (vendredi à 12:00, heure de Douala) partent tout seuls.

## Mettre à jour le staging

Après de nouveaux changements poussés sur GitHub :

```
cd ~/Timesheet && git pull
cd deploy/staging
docker compose --profile outils build
docker compose run --rm outils npx prisma migrate deploy
docker compose up -d
```

## Commandes utiles

| Besoin | Commande (dans `deploy/staging`) |
|---|---|
| Voir l'état | `docker compose ps` |
| Lire les messages de l'application | `docker compose logs -f app` (Ctrl+C pour sortir) |
| Arrêter | `docker compose stop` |
| Sauvegarder la base | `docker compose exec db pg_dump -U timesheet timesheet > sauvegarde.sql` |
| **Tout effacer** (base et PDF compris) | `docker compose down -v` |

## Variante : données de démonstration

Pour montrer les écrans des maquettes (comptes fictifs `@exemple.com`, mars 2026) au lieu d'un vrai test. Sur un staging vide seulement : sinon, tout effacer d'abord (`docker compose down -v`, puis l'étape 8).

1. Dans `.env` : `SEED_PASSWORD` (un mot de passe d'essai), `TIMESHEET_NOW="2026-03-19T09:42:00Z"`, `DEMO_PROFILES="true"`.
2. Après l'étape 8 : `docker compose run --rm outils npx prisma db seed`, puis `docker compose up -d`.

Les e-mails vers les adresses `@exemple.com` n'arrivent nulle part.

## En cas de problème

- **La page ne s'ouvre pas** : vérifier les portes 80 et 443 (étapes 2 et 3), puis `docker compose logs caddy`.
- **Pas d'e-mail** : `docker compose logs app` ; vérifier l'adresse d'expédition validée chez Brevo.
- **Un réglage oublié** : `docker compose` le dit au démarrage (« required variable … is missing »).
