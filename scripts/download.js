/**
 * "2. Download export" bookmarklet — readable source.
 *
 * Run this on any woolworths.com.au page once you've exported all the lists
 * you want (using the "1. Export this list" bookmark on each one). It reads
 * everything saved in localStorage and downloads it as a single JSON file.
 */
(function () {
  if (!/woolworths\.com\.au$/.test(location.hostname)) {
    alert('Open woolworths.com.au first.');
    return;
  }

  var KEY = 'wwListExport';
  var data;
  try {
    data = JSON.parse(localStorage.getItem(KEY) || '{"lists":[]}');
  } catch (e) {
    data = { lists: [] };
  }

  if (!data.lists.length) {
    alert('No saved lists yet. Open a list and use "1. Export this list" first.');
    return;
  }

  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'woolworths-lists-export.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1500);

  if (
    confirm(
      data.lists.length + ' list(s) downloaded as woolworths-lists-export.json.\n\n' +
      'Clear the saved data now? (Choose Cancel if you still have more lists to export.)'
    )
  ) {
    localStorage.removeItem(KEY);
  }
})();
