/**
 * "3. Import lists" bookmarklet — readable source.
 *
 * Run this on the DESTINATION account's "My Lists" page
 * (woolworths.com.au/shop/mylists). It asks you to pick the JSON file
 * downloaded earlier, then automates: create each list that doesn't already
 * exist, open it, and add each item that isn't already in it, using the same
 * "Add to this list" search box + suggestion you'd click yourself.
 *
 * Safety notes:
 *  - It never touches your password — you're already logged in when you run it.
 *  - It's idempotent: lists/items that already exist by name are skipped, so
 *    it's safe to re-run if it gets interrupted partway through.
 *  - It stays on woolworths.com.au the whole time, using the site's own
 *    "Back to Lists" link so the page doesn't do a hard reload that would
 *    stop the script mid-run.
 *  - Test it on ONE small list first before importing everything, and keep
 *    the tab in the foreground/don't navigate away while it runs.
 *  - Woolworths can change their site's markup at any time, which would need
 *    the selectors below updating (see the README for how).
 */
(function () {
  if (!/woolworths\.com\.au$/.test(location.hostname)) {
    alert('Open your Woolworths account (My Lists page) first, then click this bookmark.');
    return;
  }
  if (location.pathname.replace(/\/$/, '') !== '/shop/mylists') {
    alert('Please go to My Lists (woolworths.com.au/shop/mylists) on the account you want to copy INTO, then click this bookmark again.');
    return;
  }

  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    document.body.removeChild(fileInput);
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        alert('That file does not look like a valid export.');
        return;
      }
      if (!data || !Array.isArray(data.lists) || !data.lists.length) {
        alert('No lists found in that file.');
        return;
      }
      if (!confirm('Import ' + data.lists.length + ' list(s) into this account?\n\nKeep this tab open and avoid clicking away while it runs.')) {
        return;
      }
      runImport(data.lists).catch(function (e) {
        hideStatus();
        alert('Import stopped early: ' + e.message + '\n\nYou can re-run the bookmark — lists/items already added will be skipped.');
      });
    };
    reader.readAsText(file);
  });

  fileInput.click();

  // ---------- helpers ----------

  function qAll(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function findButtonByText(text) {
    return qAll('button').find(function (b) {
      return b.textContent.trim().toLowerCase().indexOf(text.toLowerCase()) > -1;
    });
  }

  function findLinkByText(text) {
    return qAll('a').find(function (a) {
      return a.textContent.trim().toLowerCase().indexOf(text.toLowerCase()) > -1;
    });
  }

  function setNativeValue(el, value) {
    var proto = Object.getPrototypeOf(el);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    desc.set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    // Woolworths' autocomplete only actually fires its search request on
    // keyup, not on the input event alone — confirmed by testing live.
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function waitFor(checkFn, timeoutMs, intervalMs) {
    timeoutMs = timeoutMs || 15000;
    intervalMs = intervalMs || 250;
    return new Promise(function (resolve, reject) {
      var waited = 0;
      var t = setInterval(function () {
        var result;
        try {
          result = checkFn();
        } catch (e) {
          result = null;
        }
        if (result) {
          clearInterval(t);
          resolve(result);
        } else if ((waited += intervalMs) >= timeoutMs) {
          clearInterval(t);
          reject(new Error('Timed out waiting for the page to respond.'));
        }
      }, intervalMs);
    });
  }

  function getExistingListNames() {
    return qAll('a.listItem-anchor').map(function (a) {
      var t = (a.querySelector('.listItem-title') || a).textContent.trim();
      return t.replace(/\s*\(\d+\)\s*$/, '');
    });
  }

  function getCurrentListItems() {
    return qAll('.product-list-item-title').map(function (a) {
      return a.textContent.trim();
    });
  }

  function showStatus(text) {
    var el = document.getElementById('wwImportStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wwImportStatus';
      el.style.cssText =
        'position:fixed;bottom:16px;right:16px;background:#2F5233;color:#fff;' +
        'padding:10px 14px;border-radius:8px;font:13px/1.4 -apple-system,sans-serif;' +
        'z-index:999999;max-width:320px;box-shadow:0 4px 12px rgba(0,0,0,.3)';
      document.body.appendChild(el);
    }
    el.textContent = text;
  }

  function hideStatus() {
    var el = document.getElementById('wwImportStatus');
    if (el) el.remove();
  }

  async function createList(name) {
    var btn = findButtonByText('Create new list');
    if (!btn) throw new Error('Could not find the "Create new list" button.');
    btn.click();

    var input = await waitFor(function () {
      return document.querySelector('input[placeholder*="Weekly Shop"]');
    }, 8000);
    setNativeValue(input, name);
    await wait(300);

    var cont = await waitFor(function () {
      return findButtonByText('Continue');
    }, 5000);
    cont.click();

    // Wait for the new list's own page to be ready.
    await waitFor(function () {
      return document.querySelector('.savedListFreeTextSearch-searchBox');
    }, 12000);
  }

  async function addItem(name) {
    var box = document.querySelector('.savedListFreeTextSearch-searchBox');
    if (!box) throw new Error('Search box not found on this list page.');
    setNativeValue(box, name);

    // Each suggestion row has TWO links: the product name (goes to the
    // product page) and a separate "Save to list +" icon link that's the
    // one that actually adds it. We want the second one, on the first
    // *real* product row (row 0 is "Select to add '<query>' to list",
    // a free-text entry — skip it and use row 1, the first real match).
    var saveLink;
    try {
      saveLink = await waitFor(function () {
        var rows = document.querySelectorAll('.savedListFreeTextSearch-autocompleteItem');
        var row = rows[1] || rows[0];
        return row ? row.querySelector('a.savedListFreeTextSearch-autocompleteItemIcon') : null;
      }, 6000);
    } catch (e) {
      setNativeValue(box, '');
      throw new Error('No match found for "' + name + '".');
    }
    saveLink.click();
    await wait(600);
    setNativeValue(box, '');
  }

  async function backToLists() {
    var link = findLinkByText('Back to Lists');
    if (link) link.click();
    await waitFor(function () {
      return findButtonByText('Create new list');
    }, 12000);
  }

  async function runImport(lists) {
    var report = { createdLists: [], skippedLists: [], addedItems: 0, skippedItems: 0, failedItems: [] };
    showStatus('Starting import…');

    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      showStatus('List ' + (i + 1) + '/' + lists.length + ': "' + list.name + '"');

      var existing = getExistingListNames();
      if (existing.indexOf(list.name) > -1) {
        report.skippedLists.push(list.name);
        continue;
      }

      try {
        await createList(list.name);
        report.createdLists.push(list.name);
      } catch (e) {
        report.failedItems.push(list.name + ': could not create list — ' + e.message);
        continue;
      }

      var already = getCurrentListItems();
      for (var j = 0; j < list.items.length; j++) {
        var itemName = list.items[j];
        showStatus('"' + list.name + '": item ' + (j + 1) + '/' + list.items.length + ' — ' + itemName);
        if (already.indexOf(itemName) > -1) {
          report.skippedItems++;
          continue;
        }
        try {
          await addItem(itemName);
          report.addedItems++;
        } catch (e) {
          report.failedItems.push(list.name + ' / ' + itemName + ': ' + e.message);
        }
      }

      await backToLists();
    }

    hideStatus();
    alert(
      'Import finished.\n\n' +
      'Created lists: ' + report.createdLists.length + '\n' +
      'Skipped lists (already existed): ' + report.skippedLists.length + '\n' +
      'Items added: ' + report.addedItems + '\n' +
      'Items skipped (already in list): ' + report.skippedItems + '\n' +
      'Failed: ' + report.failedItems.length +
      (report.failedItems.length ? '\n\n' + report.failedItems.slice(0, 20).join('\n') : '')
    );
  }
})();
