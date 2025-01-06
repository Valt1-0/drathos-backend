# Étape 1 : Utiliser une image Node.js officielle
FROM node:18

# Étape 2 : Définir le répertoire de travail
WORKDIR /usr/src/app

# Étape 3 : Copier les fichiers de l'application
COPY package*.json ./

# Étape 4 : Installer les dépendances
RUN npm install

# Étape 5 : Copier le reste des fichiers de l'application
COPY . .

# Étape 6 : Exposer le port de l'API
EXPOSE 5001

# Étape 7 : Définir la commande de démarrage
CMD ["npm", "start"]