# Ashen Rounds

A first-person, round-based survival game set in a ruined outpost. Hold Ash Hall, buy your way into the Relay Pit, Watch Gallery, and Ember Crypt, and last as many waves as you can. Everything here is original: places, arms, and the Ember Vault were made for this game.

## Play

Live game: https://ashen-rounds.vercel.app

Locally:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints. A mouse and keyboard are required. Click **Enter the bunker** to lock the pointer.

```bash
npm test
npm run build
```

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint |
| Click | Shoot |
| R | Reload |
| V | Knife |
| F or E | Buy a gate, wall arm, tonic, perk, or the Ember Vault |
| Hold F or E | Brace a breach for points |
| 1 / 2, Q, or mouse wheel | Swap the pistol and your carried arm |
| Esc | Pause |

You start in **Ash Hall** with the **Cinder Pistol** and 500 points. Clear every husk to start the next, harder round. On death you return to round 1; your best round stays in this browser.

## The outpost

- **Cinder Gate** (750) opens the Relay Pit and the Grave Lance.
- **Iron Hatch** (1,000) opens the Watch Gallery, the Long Pyre, and Cinder Heart.
- **Rift Seal** (1,250) opens the Ember Crypt and Ashen Step.
- **Ember Vault** (950) trades your carried arm for something else, then moves.
- **Ember Tonic** (500) restores health once each round.
- Breaches start boarded. Husks tear them down. Hold interact to brace them.
