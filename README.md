# SuperKarts 95

Une course de karts en **mode 7**, hommage libre à *SuperKarts* (Manic Media / Virgin, 1995),
jouable directement dans le navigateur. Aucun serveur, aucune dépendance, aucune image : le
circuit, les karts et le décor sont dessinés par le code au chargement.

▶️ **Jouer : https://labilbe.github.io/superkarts/**

## Le moteur

Le rendu vise l'écran VGA d'époque : une image interne de **360 × 240** agrandie sans lissage.

- **Le sol** est une texture de 2048 × 2048 unités projetée ligne d'écran par ligne d'écran. Pour
  chaque rangée sous l'horizon, la distance se déduit de la hauteur de caméra, puis les
  coordonnées de texture avancent d'un pas constant sur toute la largeur — le mode 7 affine des
  consoles 16 bits. La brume se calcule une fois par rangée, la distance y étant constante.
- **Le circuit** part d'une spline de Catmull-Rom fermée, ré-échantillonnée à pas constant. La
  même ligne médiane sert à peindre la texture (asphalte, vibreurs, damier, traces de gomme), à
  situer chaque kart (tour en cours, écart latéral, sortie de piste) et à tracer la trajectoire
  de l'IA.
- **Les karts** sont des sprites : 24 rotations calculées à l'avance par pilote, châssis, roues et
  casque compris, choisies selon l'angle entre le kart et la caméra.
- **Le panorama** défile sur 360° derrière l'horizon, et change avec le circuit : collines
  boisées, sommets enneigés, mesas, silhouettes de port la nuit.

## La course

Huit pilotes, chacun avec sa vitesse de pointe, son accélération et sa tenue de route. Quatre
circuits — Trélazé, Alpenring, Baja Seca, Port de Nuit — en course simple ou en championnat
(barème 10-8-6-5-4-3-2-1 sur quatre manches).

Tourner coûte de la vitesse : le frein à main fait glisser le kart et en coûte moins, c'est la
trajectoire rapide. L'herbe retire un tiers de la vitesse de pointe. L'IA anticipe la courbure à
venir pour choisir son allure, se décale vers l'intérieur du virage et garde un élastique discret
pour que la course reste serrée.

Quatre armes, ramassées dans les caisses réparties sur le tour (elles reviennent 5 s après) :
turbo, bidon d'huile largué derrière soi, roquette sur le kart devant, bouclier.

## Commandes

| Touche | Effet |
| --- | --- |
| `↑` / `W` / `Z` | Accélérer |
| `↓` / `S` | Freiner, puis marche arrière |
| `←` `→` / `A` `D` / `Q` `D` | Diriger |
| `Espace` | Frein à main (dérapage) |
| `Maj` ou `Ctrl` | Tirer l'arme |
| `P` | Pause |
| `M` | Couper le son |

Sur écran tactile, un pavé de commandes apparaît sous l'écran.

## Développement

```bash
npm start     # sert le dossier sur http://localhost:1995
```

Quatre fichiers, sans outil de construction : `track.js` (spline, texture, décor),
`sprites.js` (karts et bords de piste), `render.js` (mode 7, sprites, minicarte),
`game.js` (physique, IA, armes, déroulé de course, son, interface).
