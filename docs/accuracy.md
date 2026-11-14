# Précision des positions : Echo Station ↔ Stellarium Web

Comparaison des positions célestes calculées par l'application contre [Stellarium Web](https://stellarium-web.org/) à trois moments différents (depuis Toulouse, France, lat 43.6°N, lon 1.4°E).

| Cible | Heure (HEC) | Application az/alt | Stellarium az/alt | Écart |
|-------|-------------|-------------------|-------------------|-------|
| Lune | 20:00 | 228.6° / +9.9° | à vérifier | à vérifier |
| Mars | 20:00 | 24.8° / -34.3° (sous hor.) | à vérifier | à vérifier |
| Cérès | 20:00 | 47.6° / -10.4° (sous hor.) | à vérifier | à vérifier |
| Pioneer 10 | 20:00 | 68.0° / +14.5° | à vérifier | à vérifier |
| Lune | 23:00 | 254.5° / -20.0° (sous hor.) | à vérifier | à vérifier |
| Mars | 23:00 | 63.4° / -8.7° (sous hor.) | à vérifier | à vérifier |
| Cérès | 23:00 | 74.0° / +20.6° | à vérifier | à vérifier |
| Pioneer 10 | 23:00 | 91.8° / +49.8° | à vérifier | à vérifier |
| Lune | 02:00 | 280.7° / -54.2° (sous hor.) | à vérifier | à vérifier |
| Mars | 02:00 | 90.2° / +25.6° | à vérifier | à vérifier |
| Cérès | 02:00 | 100.6° / +56.3° | à vérifier | à vérifier |
| Pioneer 10 | 02:00 | 175.8° / +79.3° | à vérifier | à vérifier |

**Comment vérifier** : Ouvrez [stellarium-web.org](https://stellarium-web.org/), paramétrez votre position sur Toulouse (43.6°N, 1.4°E) et l'heure correspondante. Les positions affichées devraient matcher celles du tableau ci-dessus (écarts attendus < 2° compte tenu de la différence entre l'astronomie-engine et les calculs de Stellarium basés sur JPL Horizons).

**Notes** :
- Les cibles sous l'horizon (altitude négative) ne s'affichent pas toujours de la même manière selon les interfaces.
- Les distances astronomiques (Pioneer 10 ~141 UA) sont indépendantes de la position de l'observateur.
- Les écarts attendus entre l'astronomy-engine de l'app et Stellarium sont de l'ordre de 1-3° pour les corps du système solaire proches.
