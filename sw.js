const CACHE_NAME = "predjetx-pro-v3";
const DYNAMIC_CACHE = "predjetx-dynamic-v1";

// Fichiers à mettre en cache pour le fonctionnement hors ligne
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./offline.html",
  "./prediction.mp3",
  "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Inter:wght@300;400;500;600&display=swap",
  "https://img.icons8.com/fluency/192/000000/airplane-mode-on.png",
  "https://img.icons8.com/fluency/512/000000/airplane-mode-on.png",
];

// Installation
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installation...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Mise en cache des fichiers statiques");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()),
  );
});

// Activation
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activation...");

  // Nettoyer les anciens caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Stratégie de cache : Network First avec fallback cache
self.addEventListener("fetch", (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== "GET") return;

  // Ignorer les requêtes vers GitHub API (doivent être en ligne)
  if (event.request.url.includes("api.github.com")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: "Hors ligne - Impossible de vérifier la licence",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    return;
  }

  // Pour les autres ressources, essayer le réseau d'abord
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache la réponse
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback sur le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // Si la ressource n'est pas en cache, rediriger vers offline.html
          if (event.request.mode === "navigate") {
            return caches.match("./offline.html");
          }

          return new Response("Ressource non disponible hors ligne", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
      }),
  );
});

// Gestion des messages
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});

// Background sync pour les actions hors ligne
self.addEventListener("sync", (event) => {
  if (event.tag === "license-check") {
    event.waitUntil(checkLicenses());
  }
});

async function checkLicenses() {
  // Vérifier les licences en arrière-plan
  const cache = await caches.open(DYNAMIC_CACHE);
  const requests = await cache.keys();
  // Logique de vérification...
}
