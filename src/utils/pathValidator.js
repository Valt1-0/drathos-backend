// src/utils/pathValidator.js - Validation et sécurisation des chemins

import path from "path";
import fs from "fs";

/**
 * Valide et sécurise un chemin de fichier
 * Empêche les attaques de type Path Traversal (../../etc/passwd)
 */
export function sanitizePath(basePath, userPath) {
  // Résoudre les chemins absolus
  const resolvedBase = path.resolve(basePath);
  const resolvedPath = path.resolve(basePath, userPath);

  // CRITIQUE: Vérifier que le chemin final est bien dans le dossier autorisé
  if (
    !resolvedPath.startsWith(resolvedBase + path.sep) &&
    resolvedPath !== resolvedBase
  ) {
    throw new Error("Accès interdit: chemin invalide");
  }

  return resolvedPath;
}

/**
 * Valide le nom d'un fichier uploadé
 * Empêche les noms de fichiers malveillants
 */
export function validateFileName(filename) {
  if (!filename || typeof filename !== "string") {
    throw new Error("Nom de fichier invalide");
  }

  // Interdire les caractères dangereux dans les noms de fichiers
  const forbiddenChars = /[<>:"|?*\x00-\x1F]/g;
  if (forbiddenChars.test(filename)) {
    throw new Error("Nom de fichier contient des caractères interdits");
  }

  // Interdire les tentatives de path traversal
  // ✅ On vérifie uniquement ".." et les slashes (pas les underscores ou tirets)
  if (filename.includes("..")) {
    throw new Error(
      "Nom de fichier invalide: tentative de path traversal détectée"
    );
  }

  // Interdire les slashes dans le nom (mais après nettoyage il ne devrait pas y en avoir)
  if (filename.includes("/") || filename.includes("\\")) {
    throw new Error("Nom de fichier invalide: chemin non autorisé");
  }

  // Vérifier l'extension
  const ext = path.extname(filename).toLowerCase();
  const allowedExtensions = [".zip", ".7z", ".rar", ".tar", ".gz"];

  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Extension non autorisée: ${ext}`);
  }

  // Limiter la longueur du nom
  if (filename.length > 255) {
    throw new Error("Nom de fichier trop long (max 255 caractères)");
  }

  return filename;
}

/**
 * Vérifie qu'un fichier existe et est dans le bon dossier
 * Utilisé avant de servir un fichier en téléchargement
 */
export function validateFileAccess(filePath, allowedDir) {
  // Vérifier que le fichier est dans le dossier autorisé
  const sanitized = sanitizePath(allowedDir, filePath);

  // Vérifier que le fichier existe
  if (!fs.existsSync(sanitized)) {
    throw new Error("Fichier introuvable");
  }

  // Vérifier que c'est bien un fichier (pas un dossier)
  const stats = fs.statSync(sanitized);
  if (!stats.isFile()) {
    throw new Error("Le chemin ne pointe pas vers un fichier");
  }

  return sanitized;
}

/**
 * Nettoie un nom de fichier en enlevant les caractères spéciaux
 * Utilisé pour créer des noms de fichiers sûrs
 */
export function cleanFileName(filename) {
  // Garder uniquement les caractères alphanumériques, tirets, underscores
  return filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_{2,}/g, "_") // Remplacer les underscores multiples par un seul
    .substring(0, 200); // Limiter la longueur
}
