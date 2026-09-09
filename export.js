/**
 * "1. Export this list" bookmarklet — readable source.
 * The minified version of this is what's actually installed as the bookmark
 * (see index.html). Keep this file in sync if you edit the bookmarklet.
 *
 * Run this while an individual Woolworths list is open (not the "My Lists"
 * overview page). It reads the list's name and items straight off the page
 * and saves them into this browser's localStorage for woolworths.com.au,
 * so you can open each list in turn and click this bookmark once per list.
 */
(function () {
  if (!/woolworths\.com\.au$/.test(location.hostname)) {
    alert('Open a Woolworths list page first, then click this bookmark.');
    return;
  }

  var h1 = document.querySelector('h1');
  var raw = h1 ? h1.textContent : document.title;
  var name = raw.replace(/\s*\(\d+\s*Products?\)\s*$/i, '').trim();

  var items = Array.prototype.map
    .call(document.querySelectorAll('.product-list-item-title'), function (a) {
      return a.textContent.trim();
    })
    .filter(Boolean);

  if (!items.length) {
    alert('No items found on this page. Make sure a list is open (not the "My Lists" overview) and that it has items in it.');
    return;
  }

  var KEY = 'wwListExport';
  var data;
  try {
    data = JSON.parse(localStorage.getItem(KEY) || '{"lists":[]}');
  } catch (e) {
    data = { lists: [] };
  }

  // Re-running on the same list overwrites its saved copy rather than duplicating it.
  data.lists = data.lists.filter(function (l) {
    return l.name !== name;
  });
  data.lists.push({ name: name, items: items });
  localStorage.setItem(KEY, JSON.stringify(data));

  alert(
    'Saved "' + name + '" (' + items.length + (items.length === 1 ? ' item' : ' items') + ').\n\n' +
    'Saved so far: ' + data.lists.length + (data.lists.length === 1 ? ' list' : ' lists') + '.\n\n' +
    'Open your next list and click this bookmark again, or click "2. Download export" once you\'re done.'
  );
})();
