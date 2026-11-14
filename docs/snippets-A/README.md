# Snippets — rôle A (ciel, antenne, carte du ciel)

Tout est déjà intégré dans ce dépôt. Ce dossier garde les morceaux à recopier
si tu travailles sur une autre copie du site.

| Fichier | Où il va | À quoi il sert |
|---|---|---|
| `horizons_to_json.py` | `tools/horizons_to_json.py` | Positions + distances depuis JPL Horizons |
| `pioneer10_fallback.json` | `data/sky/pioneer10.json` (si besoin) | Plan B si Horizons n'a pas Pioneer 10 |
| `antenna_patch.js` | `js/engine/antenna.js` | Lissage + valeurs brutes pour le debug |
| `guide.js` | `js/engine/guide.js` | Calcul de la flèche de guidage |
| `skymap.js` | `js/engine/skymap.js` | La carte du ciel |
| `targeting.js` | `js/engine/targeting.js` | Choix de la cible la plus proche (pénalité sous l'horizon) |
| `lighttime.js` | fin de `js/engine/sky.js` | Distance et délai lumière |
| `main_integration.js` | morceaux de `js/main.js` | Debug, flèche, compteur, carte, verrouillage |
| `index_additions.html` | `index.html` + `css/style.css` | HTML et CSS de la flèche, du compteur, de la carte |

## Branchements à ne pas oublier

- `onPointing(onAim)` → `onPointing(onAntenna)`.
- Supprimer `state.gotOrientation = true` au début de `onAim()` : c'est
  `onAntenna()` qui le fait, parce que la carte du ciel appelle aussi `onAim`.
- Ajouter `<p id="debug" class="mono"></p>` dans l'écran radio.
- Garder `#skymap[hidden] { display: none; }`, sinon la carte ne se cache pas
  quand l'antenne prend le relais.
- La carte envoie son centre à `onAim()` toutes les 100 ms.
- Les seuils : `TOLERANCE_DEG = 20`, `LOCK_LEVEL = 0.7`, `LOCK_TIME_MS = 1500`.
  `0.7 × 20°` correspond exactement à 6°, le message « You're on it! ».

## Ce qui n'est pas dans ce dossier

Le récit, les voix, la radio, la transition et le final sont le rôle B.
Le panneau de verrouillage de ce dépôt est un placeholder : B y branche
`showStory()`.

## Tests rapides

```bash
python3 -m http.server 8080
# ordinateur : http://localhost:8080/?debug
# téléphone : URL GitHub Pages + ?debug (HTTPS obligatoire pour les capteurs)
```

Voir `README.md` à la racine pour le protocole du test Lune de 17 h 30 et la
fiche de relevé.
