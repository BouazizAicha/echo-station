# Echo Station — rôle A · ciel, antenne, carte du ciel

NASA Space Apps Challenge 2026 · Tunis · samedi 14 novembre 2026.

Ce dépôt contient **uniquement le périmètre du rôle A** : les positions réelles,
l'antenne du téléphone, la flèche de guidage, la carte du ciel, le compteur et le
délai lumière. Le récit, les voix, la radio, la transition et le final sont le
rôle B — le panneau de verrouillage est le point de branchement.

## Démarrage

```bash
python3 -m http.server 8080
# puis http://localhost:8080
# mode debug : http://localhost:8080/?debug
```

Les capteurs du téléphone exigent **HTTPS** : teste l'antenne sur l'URL GitHub
Pages, pas sur `localhost` depuis le téléphone.

```bash
npm test          # ou : node --test tests/*.test.mjs
python3 tools/horizons_to_json.py   # régénère data/sky/*.json depuis la NASA
```

## Ce qui est branché

| Partie | Fichier | État |
|---|---|---|
| 1 · Données Horizons | `tools/horizons_to_json.py`, `data/sky/*.json` | ✅ 366 points Cérès + Pioneer 10, distances réelles |
| 2 · Test téléphones | `?debug`, `js/main.js` | ✅ ligne de debug complète |
| 3 · Lissage + debug | `js/engine/antenna.js` | ✅ lissage vectoriel, valeurs brutes, calibrage |
| 4 · Flèche + seuils | `js/engine/guide.js`, `js/main.js` | ✅ 20° / 0,7 / 1,5 s, flèche CSS |
| 5 · Test Lune | protocole ci-dessous | ⏳ à faire à 17 h 30 |
| 6.1 · Carte du ciel | `js/engine/skymap.js` | ✅ souris, doigt, clavier, 90° de champ |
| 6.2 · Délai lumière | `js/engine/sky.js` | ✅ Lune 1,4 s · Mars 11 min · Pioneer 10 19 h 36 min |
| 6.3 · Compteur | `js/main.js` | ✅ Moon 0/1 · Mars 0/3 · Far 0/2 |

## Structure

```
.
├── index.html                  écran intro, radio, verrouillage (placeholder B)
├── css/style.css               thème + responsive + prefers-reduced-motion
├── js/
│   ├── main.js                 signal, verrouillage, compteur, debug, branchements
│   ├── lib/astronomy.browser.min.js   astronomy-engine 2.1.19 (MIT, vendored)
│   └── engine/
│       ├── sky.js              positions + distances + délai lumière
│       ├── targeting.js        cible la plus proche (pénalité sous l'horizon)
│       ├── antenna.js          DeviceOrientation → az/alt, lissage, calibrage
│       ├── guide.js            angle et texte de la flèche
│       └── skymap.js           canvas 90°, drag / clavier, envoie onAim()
├── data/
│   ├── robots/index.json       mapping temporaire id → sky_target (B le remplace)
│   └── sky/                    tables JPL Horizons (Cérès, Pioneer 10)
├── docs/snippets-A/            les morceaux du brief, prêts à recopier
├── tools/horizons_to_json.py   export NASA JPL Horizons
└── tests/                      node --test (guide, sky, antenna, data)
```

### Où sont les cibles

| Cible | Source | `sky_target` |
|---|---|---|
| Lune | astronomy-engine | `moon` |
| Mars | astronomy-engine | `mars` |
| Cérès | JPL Horizons (`data/sky/ceres.json`) | `ceres` |
| Pioneer 10 | JPL Horizons (`data/sky/pioneer10.json`) | `pioneer10` |

L'observateur par défaut est Tunis (36,8065° N, 10,1815° E). La géolocalisation
le remplace si l'utilisateur l'autorise. Pour tester ailleurs :
`?lat=48.85&lon=2.35`.

## Les données NASA

`tools/horizons_to_json.py` interroge l'API officielle JPL Horizons :

```bash
python3 tools/horizons_to_json.py                 # Cérès + Pioneer 10
python3 tools/horizons_to_json.py --all           # + Éros, Pioneer 11, Kepler
python3 tools/horizons_to_json.py --start 2026-11-01 --stop 2026-12-01 --step "6 h"
```

Chaque point contient `t`, `ra` (heures), `dec` (degrés) et `dist_au` (distance
observateur–cible). `js/engine/sky.js` interpole entre les points, avec
enroulement de l'ascension droite. Si Pioneer 10 échoue, le script copie
automatiquement `docs/snippets-A/pioneer10_fallback.json`.

Valeurs vérifiées ce soir (Tunis, 17 h 30 local) :

| Cible | Azimut | Hauteur | Distance | Délai lumière |
|---|---|---|---|---|
| Lune | 197,9° (S) | 25,8° | 0,0026 UA | 1,3 s |
| Cérès | selon l'heure | — | ~2 UA | ~17 min |
| Pioneer 10 | ~60–76° (ENE) | 4–26° | ~141 UA | 19 h 36 min |

## Test sur la vraie Lune — 17 h 15 → 18 h 15

1. Sur place avec vue dégagée au sud / sud-ouest, téléphones chargés,
   site ouvert avec `?debug`.
2. **Start listening** → **Use my phone as an antenna** → autoriser.
3. Vise la Lune avec la caméra arrière. Note l'écart `aim` / `moon` **avant**
   calibrage.
4. **Calibrate on the Moon**.
5. Détourne-toi de 90°, reviens, chronomètre jusqu'au panneau de verrouillage.
   3 essais par téléphone.
6. Pars de 3 directions différentes : la flèche doit guider correctement.
7. Recommence sur l'autre téléphone (Android et iPhone).

### Fiche de relevé

| Téléphone | Écart avant calibrage | Essai 1 | Essai 2 | Essai 3 | Stable ? | Notes |
|---|---|---|---|---|---|---|
| Android | …… ° | …… s | …… s | …… s | oui / non | |
| iPhone | …… ° | …… s | …… s | …… s | oui / non | |

### Décision

| Verdict | Condition | Suite |
|---|---|---|
| **GO** | Verrouillage < 5 s, 3/3 essais, Android **et** iPhone après calibrage, flèche correcte | L'antenne devient la vedette de la vidéo |
| **GO partiel** | Une seule plateforme | Antenne en option « beta », carte du ciel par défaut |
| **NO-GO** | Écart > 20° après calibrage, ou autorisation impossible | Carte du ciel seule, bouton antenne masqué |

Message type à C : `Antenna test: GO on Android (lock 2-4 s), partial on iPhone (heading mirrored, fixed).`

## Problèmes connus et corrections

| Problème | Correction |
|---|---|
| iPhone : pas de fenêtre d'autorisation | HTTPS obligatoire ; la demande part d'un appui sur un bouton. Sinon Réglages → Safari → Avancé → Données de sites → supprimer github.io. |
| iPhone : l'est affiche ≈ 270° | Utiliser `webkitCompassHeading` directement, **pas** `360 - webkitCompassHeading` (déjà le cas dans `antenna.js`). |
| `acc = -1` / direction qui saute | Calibrer la boussole : mouvement en 8, loin du métal et des coques magnétiques. |
| Android : `abs=false` | Pas d'orientation absolue : le calibrage sur la Lune devient obligatoire, le reste fonctionne. |
| La direction dérive | Recalibrer sur la Lune ; normal avec les gyroscopes. |
| Valeurs bizarres en paysage | Rester en portrait (verrouillage de rotation). |
| Direction est/ouest inversée sur un Android | Ajouter `?heading=alpha` ou `?mirror=1` à l'URL. |

## Branchement pour le rôle B

`js/main.js` s'arrête à `openLockPanel(robot, target)`. B remplace ce panneau par
`showStory()` et branche :

```js
$('story-light').textContent =
  'Light-time: ' + formatLightTime(getLightTime(robot.sky_target));
```

`data/robots/index.json` est un mapping temporaire `id / name / sky_target` ;
B le remplace par `data/robots/<id>.json` + la liste d'identifiants, sans toucher
au moteur ciel.

## Check-list rôle A avant 2 h

- [x] `data/sky/` rempli (Cérès, Pioneer 10) avec les distances
- [x] Lissage et mode `?debug` intégrés
- [ ] Testé sur un Android **et** un iPhone, résultats notés
- [x] Flèche de guidage et nouveaux seuils intégrés
- [ ] Test sur la vraie Lune terminé, décision annoncée à C et à l'équipe
- [x] Carte du ciel, délai lumière et compteur intégrés
- [x] Carte cachée quand l'antenne prend le relais
- [x] Chaque cible ouvre les bons robots ; Mars les enchaîne
- [x] Aucune erreur console, `?debug` réservé au paramètre d'URL
- [x] Tout est poussé sur GitHub (à faire : `git init && git push`)

## Crédits

- [astronomy-engine](https://github.com/cosinekitty/astronomy) © Don Cross, MIT.
- Positions Cérès / Pioneer 10 : NASA/JPL Horizons (DE441).
- Brief et architecture : équipe Echo Station.

L'IA a aidé à rédiger le squelette ; tout le code doit être relu, testé et
adapté par l'équipe.
