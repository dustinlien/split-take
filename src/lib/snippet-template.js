/**
 * Returns the embed snippet string with Supabase credentials injected.
 * The snippet is ~2.5kb, framework-free, and safe to paste into <head>.
 */
export function generateSnippet(supabaseUrl, anonKey) {
  return `<script>
/* Split Take — install once in <head>, never touch again */
(function () {
  'use strict';

  var SUPABASE_URL = '${supabaseUrl}';
  var ANON_KEY     = '${anonKey}';
  var COOKIE_DAYS  = 30;
  var VISITOR_KEY  = '_stv';

  /* ── Utilities ─────────────────────────────────────── */

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setCookie(name, value, days) {
    var exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie =
      name + '=' + encodeURIComponent(value) +
      '; expires=' + exp + '; path=/; SameSite=Lax';
  }

  /* SHA-256 hash via SubtleCrypto; falls back to djb2 for old browsers */
  function hashToken(token) {
    if (window.crypto && crypto.subtle) {
      return crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(token))
        .then(function (buf) {
          return Array.from(new Uint8Array(buf))
            .map(function (b) { return b.toString(16).padStart(2, '0'); })
            .join('');
        });
    }
    var h = 5381;
    for (var i = 0; i < token.length; i++) {
      h = ((h << 5) + h) ^ token.charCodeAt(i);
    }
    return Promise.resolve((h >>> 0).toString(16));
  }

  /* Weighted random variant picker */
  function pickVariant(variants) {
    var r = Math.random() * 100;
    var cum = 0;
    for (var i = 0; i < variants.length; i++) {
      cum += variants[i].traffic_weight;
      if (r < cum) return variants[i];
    }
    return variants[variants.length - 1];
  }

  /* Apply a variant's DOM changes (called after DOMContentLoaded) */
  function applyChanges(changes) {
    changes.forEach(function (ch) {
      var el = document.querySelector(ch.element_id);
      if (!el) return;
      if (ch.change_type === 'text') {
        el.textContent = ch.new_value;
      } else if (ch.change_type === 'image') {
        if (el.tagName === 'IMG') el.src = ch.new_value;
        else el.style.backgroundImage = 'url(' + ch.new_value + ')';
      } else if (ch.change_type === 'visibility') {
        el.style.display = ch.new_value === 'hide' ? 'none' : '';
      } else if (ch.change_type === 'insert_after' || ch.change_type === 'insert_before') {
        /* Duplicate guard — use change ID as a data attribute marker */
        var marker = 'data-st-' + ch.id.replace(/-/g, '').slice(0, 12);
        if (document.querySelector('[' + marker + ']')) return;
        var pos = ch.change_type === 'insert_after' ? 'afterend' : 'beforebegin';
        /* Wrap in a hidden span so we can find it on return visits */
        el.insertAdjacentHTML(pos,
          '<span ' + marker + '="" style="display:contents">' + ch.new_value + '</span>'
        );
      }
    });
  }

  /* ── Supabase REST helpers ──────────────────────────── */

  function apiPost(path, body) {
    return fetch(SUPABASE_URL + path, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: 'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  }

  function fetchTests(pageUrl) {
    /* Match on URL without hash, without trailing slash */
    var url = pageUrl.split('#')[0].replace(/\\/$/, '');
    var qs =
      '?select=id,variants(id,label,traffic_weight,is_control,variant_changes(*))' +
      '&status=eq.running' +
      '&url=eq.' + encodeURIComponent(url);
    return Promise.race([
      fetch(SUPABASE_URL + '/rest/v1/tests' + qs, {
        headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
      }).then(function (r) { return r.ok ? r.json() : []; }),
      new Promise(function (res) { setTimeout(function () { res([]); }, 1500); }),
    ]).catch(function () { return []; });
  }

  /* ── Boot sequence ─────────────────────────────────── */

  /* 1. Hide body immediately to prevent flash of original content */
  document.documentElement.style.visibility = 'hidden';

  /* 2. Kick off async work in parallel with HTML parsing */
  var testsFetch = fetchTests(location.href);
  var assignments = {};   /* testId → { variantId, visitorHash } */

  /* 3. Once DOM is ready, apply changes and reveal */
  document.addEventListener('DOMContentLoaded', function () {
    var visitorId = getCookie(VISITOR_KEY);
    if (!visitorId) {
      visitorId = uuid();
      setCookie(VISITOR_KEY, visitorId, 365);
    }

    hashToken(visitorId).then(function (visitorHash) {
      testsFetch.then(function (tests) {
        try {
          tests.forEach(function (test) {
            if (!test.variants || !test.variants.length) return;
            var cookieKey = '_st_' + test.id.replace(/-/g, '').slice(0, 16);
            var assignedId = getCookie(cookieKey);
            var isNew = !assignedId;

            if (isNew) {
              var picked = pickVariant(test.variants);
              assignedId = picked.id;
              setCookie(cookieKey, assignedId, COOKIE_DAYS);
            }

            assignments[test.id] = { variantId: assignedId, visitorHash: visitorHash };

            /* Apply variant DOM changes */
            var variant = test.variants.find(function (v) { return v.id === assignedId; });
            if (variant && variant.variant_changes && variant.variant_changes.length) {
              applyChanges(variant.variant_changes);
            }

            /* Log visit only on first assignment */
            if (isNew) {
              apiPost('/rest/v1/visits', {
                test_id: test.id,
                variant_id: assignedId,
                visitor_token: visitorHash,
              });
            }
          });
        } catch (e) {
          console.error('[SplitTake]', e);
        }
      }).finally(function () {
        /* Always reveal the page */
        document.documentElement.style.visibility = '';
      });
    });
  });

  /* ── Public API ────────────────────────────────────── */

  /*
   * Call SplitTake.convert() anywhere after a conversion event.
   *   SplitTake.convert()          → logs conversion for all active tests
   *   SplitTake.convert('test-id') → logs conversion for a specific test only
   */
  window.SplitTake = {
    convert: function (testId) {
      var ids = testId ? [testId] : Object.keys(assignments);
      ids.forEach(function (id) {
        var a = assignments[id];
        if (a) {
          apiPost('/rest/v1/conversions', {
            test_id: id,
            variant_id: a.variantId,
            visitor_token: a.visitorHash,
          });
        }
      });
    },
  };
})();
<\/script>`;
}
