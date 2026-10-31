# BEAUTY SALON MANAGER

Application de gestion pour salon de coiffure (Cameroun, FCFA). Elle fonctionne dans Google Chrome, sans serveur ni installation. Les données restent dans le navigateur de l'ordinateur ou de la tablette.

## Installation

1. Décompressez le dossier `beauty-salon-manager`.
2. Double-cliquez sur `index.html` (ou faites-le glisser dans Chrome).
3. Au premier démarrage, créez le compte administrateur.

Pour que les graphiques et les reçus PDF fonctionnent, Chrome doit pouvoir charger Chart.js et jsPDF depuis Internet. Une fois la page ouverte, le reste de l'application ne demande pas de connexion.

## Installer comme application (PWA) et utiliser hors connexion

L'installation et le mode hors connexion par service worker ne fonctionnent que si le dossier est servi en **https** ou sur **localhost**. Ouvrir `index.html` directement depuis le disque ne suffit pas.

1. Hébergez le dossier sur un serveur https (ou lancez-le en local avec un petit serveur web).
2. Ouvrez l'adresse dans Chrome, puis choisissez **Installer l'application** dans le menu du navigateur (sur téléphone : « Ajouter à l'écran d'accueil »).
3. Lors du premier chargement, Chart.js et jsPDF sont mis en cache. Ensuite, l'application s'ouvre même sans Internet.

Après une mise à jour des fichiers, changez le numéro `CACHE` dans `sw.js` pour forcer la mise à jour du cache.

## Structure

```
index.html            Structure de l'application
manifest.json         Fiche d'application (installation, icône, mode plein écran)
sw.js                 Service worker (fonctionnement hors connexion)
icons/                Icônes de l'application (192 et 512 px)
css/styles.css        Design (violet/bordeaux, rose poudré, responsive)
js/db.js              Stockage IndexedDB, écritures groupées, sauvegarde
js/core.js            Utilitaires, connexion, rôles, navigation, calculs financiers
js/pages-a.js         Tableau de bord, caisse, rendez-vous
js/pages-b.js         Clients, prestations, personnel, stock, dépenses,
                      finances, rapports, paramètres, journal, espace coiffeur
_ancienne-version/    (dossier de travail, non nécessaire au fonctionnement)
```

## Modules

| Module | Contenu |
|---|---|
| Tableau de bord | 10 indicateurs, 5 graphiques, rendez-vous du jour, alertes de stock |
| Caisse | Client (recherche ou création), prestations, produits, réduction, paiement mixte, reçu imprimable et PDF |
| Rendez-vous | Vues jour, semaine et mois, statuts, alerte de conflit horaire, encaissement direct |
| Clients | Fiches, historique, client fidèle (5 visites ou plus), clients à relancer (plus de 60 jours), archivage |
| Prestations | Catalogue avec prix, durée, catégorie et statut actif ou inactif |
| Personnel | Salaire fixe, commission, ou les deux ; avances, paiements et solde à payer |
| Stock & produits | Entrées, sorties, ventes, ruptures, stocks faibles, valeur du stock |
| Dépenses | Catégories, totaux jour, semaine et mois, justificatif facultatif |
| Finances | Recettes, chiffre d'affaires, bénéfice brut et net, évolution sur l'année |
| Rapports | 11 rapports, impression ou PDF, export CSV (ouvrable dans Excel) |
| Paramètres | Infos du salon, logo, jours de fermeture, utilisateurs et rôles, sauvegarde |
| Journal | Suppressions, changements de prix, modifications de montants et de comptes |

## Rôles

- **Administrateur** : accès total.
- **Réceptionniste** : clients, rendez-vous, caisse, prestations, stock.
- **Coiffeur** : son planning, ses prestations et ses commissions (espace « Mon espace »).

## Règles de calcul (pour éviter les doubles comptes)

- Le **chiffre d'affaires** est la somme des ventes nettes de réduction.
- Les **encaissements** sont les montants réellement payés.
- Le **coût des produits vendus** est déduit du chiffre d'affaires pour donner le bénéfice brut.
- Les **commissions** sont calculées au moment de la vente et ne changent plus si le taux est modifié ensuite.
- Les **salaires fixes** sont comptés au prorata du temps. Les catégories « Achat de produits » et « Salaires » des dépenses ne sont pas redéduites, car elles sont déjà comptées ailleurs.

## Sauvegarde

Allez dans **Paramètres > Sauvegarde** et téléchargez régulièrement le fichier JSON, par exemple chaque semaine. Les données sont propres à chaque navigateur : un nouvel ordinateur ou un nettoyage du navigateur les efface. La restauration remplace toutes les données actuelles.

## Limites connues

- **Hors connexion** : depuis un serveur (https ou localhost), l'application s'ouvre sans Internet après un premier chargement. Ouverte directement depuis le disque, elle fonctionne sans Internet, mais Chart.js et jsPDF doivent avoir déjà été chargés une fois : les graphiques et les PDF peuvent être indisponibles.
- **PWA** : l'installation comme application n'est possible que si le dossier est hébergé sur un serveur (https) ou sur localhost. Ouvert directement depuis le disque, le navigateur ne l'accepte pas.
- **Excel** : l'export est au format CSV (séparateur point-virgule), qui s'ouvre directement dans Excel. Un fichier .xlsx natif n'est pas généré.
- **PDF des rapports** : utilisez « Imprimer » puis « Enregistrer au format PDF ». Les reçus, eux, se téléchargent directement en PDF.
- **Sécurité** : les mots de passe sont protégés dans le navigateur, mais ce n'est pas une sécurité de niveau serveur. Ne laissez pas l'appareil sans surveillance, déconnectez-vous et protégez l'accès à la session.
