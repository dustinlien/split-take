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
      '?select=id,variants!variants_test_id_fkey(id,label,traffic_weight,is_control,variant_changes(*))' +
      '&status=eq.running' +
      '&url=eq.' + encodeURIComponent(url);
    return Promise.race([
      fetch(SUPABASE_URL + '/rest/v1/tests' + qs, {
        headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
      }).then(function (r) { return r.ok ? r.json() : []; }),
      new Promise(function (res) { setTimeout(function () { res([]); }, 1500); }),
    ]).catch(function () { return []; });
  }

  /* Fetch a single variant by ID — used for preview mode, no status filter */
  function fetchVariantForPreview(variantId) {
    var qs = '?select=id,label,variant_changes(*)&id=eq.' + encodeURIComponent(variantId);
    return Promise.race([
      fetch(SUPABASE_URL + '/rest/v1/variants' + qs, {
        headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
      }).then(function (r) { return r.ok ? r.json() : []; }),
      new Promise(function (res) { setTimeout(function () { res([]); }, 1500); }),
    ]).catch(function () { return []; });
  }

  /* ── Boot sequence ─────────────────────────────────── */

  /* 1. Hide body immediately to prevent flash of original content */
  document.documentElement.style.visibility = 'hidden';

  /* 2. Kick off fetch in parallel with HTML parsing */
  var cleanUrl   = location.href.split('?')[0].split('#')[0].replace(/\\/$/, '');
  var previewId  = new URLSearchParams(location.search).get('_st_preview');
  /* In preview mode fetch the variant directly (no status filter).
     In normal mode fetch all running tests for this URL. */
  var testsFetch    = previewId ? null : fetchTests(cleanUrl);
  var previewFetch  = previewId ? fetchVariantForPreview(previewId) : null;
  var assignments   = {};   /* testId → { variantId, visitorHash } */

  /* 3. Once DOM is ready, check for preview mode or run normally */
  document.addEventListener('DOMContentLoaded', function () {

    /* ── Preview mode ────────────────────────────────── */
    /* Triggered by ?_st_preview=<variant-id> in the URL. */
    /* Fetches that variant directly — works on draft, paused, or running tests. */
    /* No logging, no cookies. */
    if (previewId) {
      previewFetch.then(function (variants) {
        try {
          var variant = variants && variants[0];
          if (variant && variant.variant_changes && variant.variant_changes.length) {
            applyChanges(variant.variant_changes);
          }
        } catch (e) {
          console.error('[SplitTake preview]', e);
        }
      }).finally(function () {
        document.documentElement.style.visibility = '';
        /* Expose a no-op convert in preview so page code doesn't error */
        window.SplitTake = { convert: function () {}, _preview: true };  /* no-op in preview */
      });
      return;
    }

    /* ── Normal mode ─────────────────────────────────── */
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

          /* Auto-click tracking: fire convert() once per page session
             when any <button> or <a> is clicked */
          var clicked = false;
          document.addEventListener('click', function (e) {
            if (clicked) return;
            var el = e.target;
            /* Walk up to 3 levels to catch clicks on child elements inside buttons/links */
            for (var i = 0; i < 3; i++) {
              if (!el) break;
              if (el.tagName === 'BUTTON' || el.tagName === 'A') {
                clicked = true;
                window.SplitTake.convert();
                return;
              }
              el = el.parentElement;
            }
          }, { passive: true });

        } catch (e) {
          console.error('[SplitTake]', e);
        }
      }).finally(function () {
        document.documentElement.style.visibility = '';
      });
    });
  });

  /* ── Public API ────────────────────────────────────── */

  /*
   * Call SplitTake.convert() anywhere after a conversion event.
   *   SplitTake.convert()               → logs for all active tests, no revenue
   *   SplitTake.convert(null, 49.99)    → logs for all tests with revenue value
   *   SplitTake.convert('test-id')      → logs for a specific test only
   *   SplitTake.convert('test-id', 49.99) → specific test + revenue
   *
   * Revenue should be a number in dollars (e.g. 49.99).
   * On Shopify order confirmation use: SplitTake.convert(null, {{ checkout.total_price | divided_by: 100.0 }})
   */
  window.SplitTake = {
    convert: function (testId, revenue) {
      var ids = testId ? [testId] : Object.keys(assignments);
      var rev = (typeof revenue === 'number' && revenue > 0) ? revenue : 0;
      ids.forEach(function (id) {
        var a = assignments[id];
        if (a) {
          apiPost('/rest/v1/conversions', {
            test_id: id,
            variant_id: a.variantId,
            visitor_token: a.visitorHash,
            revenue: rev,
          });
        }
      });
    },
  };
})();
<\/script>`;
}
