# woolies-shoppinglist-copier

A tiny static site with three bookmarklets for copying Woolworths shopping
lists from one account to another. No server, no backend, no credentials
handled anywhere but the real Woolworths login page.

**Live once deployed:** `https://YOUR-GITHUB-USERNAME.github.io/woolies-shoppinglist-copier/`

## Deploying to GitHub Pages

1. Create a new repo on GitHub named `woolies-shoppinglist-copier` (or
   anything you like — just update the two links in `index.html` to match).
2. Push these files to it:
   ```bash
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/YOUR-GITHUB-USERNAME/woolies-shoppinglist-copier.git
   git push -u origin main
   ```
3. In the repo's **Settings → Pages**, set the source to the `main` branch,
   root folder, and save. GitHub will publish it at the URL above within a
   minute or two.
4. Edit the two `github.com/YOUR-GITHUB-USERNAME/...` links near the bottom
   of `index.html` to point at your actual repo, commit, and push again.

## What's in here

- `index.html` — the whole site (instructions + the three bookmarklets as
  drag-to-bookmarks-bar links).
- `scripts/export.js`, `scripts/download.js`, `scripts/import.js` — the
  readable source for each bookmarklet. **These aren't loaded by the page**
  (bookmarklets can't reference an external file) — they're here so you can
  read, edit, and re-minify them instead of working with the compressed
  one-liner in `index.html`'s `href`.

## How it actually works

- **Export**: run on an open Woolworths list page. Reads the list name (from
  the page's `<h1>`) and, for each item row, both its name
  (`.product-list-item-title`) and its quantity (the `input[aria-label="List
  quantity"]` field), and saves them into `localStorage` under the key
  `wwListExport`, scoped to woolworths.com.au. Re-running it on the same list
  overwrites that list's entry rather than duplicating it, so it's safe to
  click more than once.
- **Download**: reads that `localStorage` entry and triggers a browser
  download of it as JSON, then optionally clears it.
- **Import**: run on the destination account's `My Lists` page. Prompts for
  the JSON file, then for each list:
  1. Skips it if a list with that name already exists on the account.
  2. Otherwise clicks **Create new list**, types the name, and confirms.
  3. For each item, types it into the **Add to this list** search box and
     clicks the actual "Save to list +" link on the first suggestion —
     skipping any item already in the list. The item that gets added is
     identified by comparing the list's contents before and after, since the
     real product name Woolworths adds often has nothing in common with what
     you searched for (searching "bread" might add "Woolworths Soft White
     Loaf 680g").
  4. If the item's saved quantity is more than 1, clicks the list's own "+"
     button that many times, verifying after each click that it actually
     registered (Woolworths occasionally drops one) and retrying once if not.
  5. Uses the page's own **Back to Lists** link to return to the overview
     (rather than a hard page reload) so the script keeps running instead of
     being killed by a full navigation.

## Fixing a broken selector

Woolworths can change their site's markup at any time. If a bookmarklet
starts failing (an alert saying "could not find X", or nothing visibly
happening):

1. Open woolworths.com.au in Chrome, log in, and go to **My Lists**.
2. Right-click the element that isn't matching → **Inspect**, and note its
   class name or attributes.
3. Update the matching selector in the relevant file under `scripts/`. The
   selectors currently in use (as of Sep 2026):

   | What | Selector |
   |---|---|
   | List row on the overview page | `a.listItem-anchor` (name in `.listItem-title`) |
   | "Create new list" button | matched by its visible text |
   | New-list name field | `input[placeholder*="Weekly Shop"]` |
   | "Continue" button in that modal | matched by its visible text |
   | Item row on an open list | `.product-list-item` |
   | Item name within a row | `.product-list-item-title` |
   | Item quantity within a row | `input[aria-label="List quantity"]` (read this for export) |
   | Quantity "+" / "−" buttons | `.cartControls-increment-button` / `.cartControls-decrement-button` |
   | "Add to this list" search box | `.savedListFreeTextSearch-searchBox` |
   | Autocomplete suggestion | `.savedListFreeTextSearch-autocompleteItem` (row) → `a.savedListFreeTextSearch-autocompleteItemIcon` (the actual "Save to list +" link — clicking the row/product-name link instead does nothing) |
   | "Back to Lists" link | matched by its visible text |

   A few things that aren't selectors but matter just as much:
   - The search box only actually searches while it has **focus** — call
     `.focus()` on it before setting its value, or nothing happens.
   - Typing into it has to fire a `keyup` event, not just `input` —
     Woolworths' autocomplete only triggers its search request on `keyup`.
     `setNativeValue()` in `import.js` does both.
   - The product actually added from a search is often named nothing like
     what you searched — identify the new row by diffing the list's item
     names before and after, not by matching the search term.
   - Quantity changes are genuinely flaky on Woolworths' end (see Safety
     notes below) — `addItem()` verifies each "+" click actually registered
     and retries once if not.

4. Re-minify and rebuild the bookmarklet link. With Node installed:
   ```bash
   npx terser scripts/import.js --compress --mangle -o /tmp/import.min.js
   node -e "console.log('javascript:' + encodeURIComponent(require('fs').readFileSync('/tmp/import.min.js','utf8').trim()))"
   ```
   Paste the output as the `href` of the matching `<a class="bookmarklet">`
   in `index.html`.

## Safety notes

- No password, ever, touches this code — you're always already logged in
  when you click a bookmarklet, exactly as if you'd typed the same thing by
  hand.
- The full create-list-then-add-items-then-set-quantity sequence **has been
  tested live** (against throwaway test lists on Oliver's own account,
  deleted afterwards) — not against your wife's real lists. It's worth
  trying on one small real list first before trusting it with everything.
- **Quantities are genuinely unreliable on Woolworths' own end**, confirmed
  by testing: even clicking their own "+" button with delays between clicks,
  a click can silently fail to register — their per-item total and the
  page's overall price recalculation are both a bit buggy about this
  (reducing a quantity, for instance, doesn't always reduce the shown
  price). The script verifies each click and retries once if it didn't
  stick, and waits after each list before moving on to give the site time to
  save, but this can't be made 100% reliable when the flakiness is on
  Woolworths' side. **Spot-check quantities after an import**, especially
  for items you know had a quantity above 1.
- It's idempotent by list/item name, so a partial or failed run is safe to
  just re-trigger.
- Worth a quick check that this stays within the spirit of Woolworths' Terms
  of Service for your own comfort — this is personal/household use at a
  small scale, not scraping at volume.
