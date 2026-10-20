# DESIGN.md — Calendario dell'Avvento Our Elysion

Direzione: **l'ufficio postale dei moogle sotto la neve di Ishgard.**
Le 25 caselle sono buste da lettera (la storia parla di lettere perdute).
La testata è una fascia notturna innevata dove brilla l'albero di Our Elysion;
il resto del sito è carta crema e inchiostro blu, come le grafiche OE (intervista a Tullio).
Non è basata su siti di riferimento esterni: parte dal brand OE esistente.

## Colore

| Token | Chiaro | Scuro (notte di Ishgard) | Ruolo |
|---|---|---|---|
| `--bg` | #F7F1E6 | #0D1F2E | sfondo pagina |
| `--surface` | #FFFBF4 | #13293B | pannelli, schede staff |
| `--paper` | #FFF7EA | #1B3449 | buste |
| `--ink` | #14324A | #EAF2F7 | testo principale |
| `--muted` | #56697A | #9DB3C3 | testo secondario |
| `--line` | #E3D7C3 | #2A475D | bordi e divisori |
| `--primary` | #1576AE | #6CC3EE | pulsanti, link, stato attivo (blu OE) |
| `--on-primary` | #FFFFFF | #0D1F2E | testo sui pulsanti primari |
| `--accent` | #E8962A | #F2A93B | "oggi", sigillo di ceralacca, Biscotti (arancio dei biscotti OE) |
| `--night` | #0F2638 | #0A1824 | fascia testata innevata (scura in entrambi i temi) |
| `--ice` | #D3EAF5 | #1E4560 | evidenze leggere, contatore |
| `--ok` / `--warn` / `--err` | #2E7D4F / #A86A12 / #B3261E | #6FCF97 / #F2C94C / #FF8A80 | consegnato / in attesa / errori |
| `--discord` | #5865F2 | #5865F2 | solo il pulsante "Accedi con Discord" |

Una sola tinta forte (blu OE) per le azioni; l'arancio è riservato a ciò che è "di oggi" o ai Biscotti.

## Tipografia

- **Display**: Big Shoulders Display 700/800 (titoli, numeri delle buste). Condensato, richiama la testata dell'intervista.
- **Etichette**: Josefin Sans 600, maiuscolo con spaziatura 0.12em (come "L'ELEZEN DAI MILLE TALENTI").
- **Testo e storia**: Literata 400/600, 17px, interlinea 1.65, righe max 65 caratteri.
- Scala: 12 · 14 · 17 · 20 · 26 · 34 · 48 · 72.

## Spazi e forme

- Scala a base 4: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Larghezza contenuto 1120px; testo storia 680px.
- Raggio: 4px buste e campi, 10px pannelli, pill per i badge. Un'ombra sola (`--shadow`) per le buste sollevate.

## Componenti

- **Busta**: sigillata (futura, lucchetto e "tra N giorni"), oggi (sigillo arancio pulsante), aperta (lembo alzato, spunta se hai partecipato), sfida (nastro "Sfida"). La 25 è la busta grande di Natale.
- **Pulsanti**: primario (blu pieno), secondario (contorno), quieto (solo testo). Focus visibile con anello `--primary`.
- **Contatore lettere**: barra di avanzamento su `--ice` con traguardo segnato.
- **Badge stato**: in gara, estratto, consegnato, in attesa.
- **Area staff**: barra laterale a sezioni, tabelle con numeri tabulari.

## Immagini

- Logo albero OE su fondo notte. Illustrazioni dei capitoli fornite dall'autore (screenshot gpose), formato 16:9.
- Neve: animazione leggera solo nella testata, disattivata con `prefers-reduced-motion`.
- Icone: SVG semplici a tratto, niente emoji.
