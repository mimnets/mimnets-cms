// Project override of the @apostrophecms/form widget player (m1-012, D-SEC-3).
//
// Apostrophe's supported ui/src override: this file replaces the upstream
// `ui/src/index.js` of @apostrophecms/form-widget in the asset build, while
// the upstream `errors.js` and `fields.js` next to it are still used.
// Based on @apostrophecms/form 1.5.6. Upstream showed the thank-you message
// for every failed request that carried no `formErrors` (CSRF 403, 429 from
// middleware, 500, network errors), so visitors were told that a message
// which was never stored had been sent.
//
// Changes from upstream, all in `submit()`:
// - Success is shown only for a 2xx response carrying
//   `X-Assurer-Submission: stored`, which the server (modules/assurer-forms)
//   sets only after it has stored the submission.
// - Every other outcome shows an error and keeps what the visitor typed:
//   field errors as upstream, otherwise a message for the status (403, 404,
//   429, other 4xx, 5xx) or for a lost connection or timeout.
// - A random key per form fill (X-Assurer-Submission-Key) lets the server
//   answer a retry of an already stored submission without storing it twice.
// - A second click while a request is in flight is ignored (upstream queued
//   it, which could send the message twice).
// - After 30 seconds without an answer the visitor is told the outcome is
//   unknown. A late success still switches to the thank-you message.
// - m1-066: the submission states are explicit (see `setState` below), and
//   the thank-you message is final: an error from a retry that answers
//   after a success no longer appears next to it.
// - m1-019: the spam guard's fill token and honeypot value, rendered by
//   views/widget.jsx, are sent with the submission (modules/assurer-forms).
//   reCAPTCHA is not offered, so upstream's `recaptcha.js` (which loads
//   Google's script) is no longer imported.
//
// The upstream file's hash is checked by scripts/form-ops.test.mjs: when an
// upgrade changes it, compare it with this file before accepting the
// upgrade.
//
// Portions copyright (c) 2021 Apostrophe Technologies, MIT License; the full
// notice is in node_modules/@apostrophecms/form/LICENSE.md.

// Upstream helpers, through Apostrophe's `Modules/` build alias: a relative
// import would be resolved next to this project file, where they don't exist.
import { processErrors } from 'Modules/@apostrophecms/form-widget/errors.js';
import { collectValues } from 'Modules/@apostrophecms/form-widget/fields.js';

const TIMEOUT_MS = 30000;
// Must match modules/assurer-forms/lib/guard.js.
const HONEYPOT_FIELD = '_assurerWebsite';
const TOKEN_FIELD = '_assurerFill';
const MESSAGES = {
  csrf: 'Your message was not sent: your session has expired or a security cookie is ' +
    'missing. Please reload the page and try again.',
  gone: 'Your message was not sent: this form is no longer available. Please reload the page.',
  rejected: 'Your message was not sent: it could not be accepted. Please check your entries ' +
    'and try again.',
  limited: 'Your message was not sent: too many submissions. Please try again later.',
  server: 'Your message was not sent because of a problem on our side. Please try again later.',
  unknown: 'We could not confirm that your message was received. Please check your connection ' +
    'and try again; your message will not be stored twice.'
};

function newSubmissionKey() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Maps a rejected apos.http request to a visitor message. `null` status means
// no HTTP answer at all (network error, aborted request).
function failureMessage(status) {
  if (!status) {
    return MESSAGES.unknown;
  }
  if (status === 403) {
    return MESSAGES.csrf;
  }
  if (status === 404) {
    return MESSAGES.gone;
  }
  if (status === 429) {
    return MESSAGES.limited;
  }
  if (status >= 500) {
    return MESSAGES.server;
  }
  return MESSAGES.rejected;
}

export default () => {
  apos.util.widgetPlayers['@apostrophecms/form'] = {
    selector: '[data-apos-form-wrapper]',
    player: function (el) {
      const form = el.querySelector('[data-apos-form-form]');

      if (!form) {
        return;
      }

      form.addEventListener('submit', submit);

      // One key per form fill; renewed only after a confirmed success.
      let submissionKey = newSubmissionKey();

      // Submission state, shown on the wrapper as `data-assurer-form-state`:
      //   idle    -> sending  the visitor submits
      //   sending -> idle     an error, or no answer within TIMEOUT_MS
      //   sending -> sent     the server confirms it stored the message
      //   idle    -> sent     a late confirmation after a timeout
      // `sent` is final. Every request of one fill shares the key, so the
      // server stores the message once, and any answer after `sent` is
      // ignored.
      let state = 'idle';
      const spinner = el.querySelector('[data-apos-form-spinner]');
      const button = form.querySelector('[data-apos-form-submit]');
      setState('idle');

      function setState(next) {
        state = next;
        el.setAttribute('data-assurer-form-state', next);
        const sending = next === 'sending';
        // Upstream's busy marker, kept for compatibility.
        if (sending) {
          form.setAttribute('data-apos-form-busy', '1');
        } else {
          form.removeAttribute('data-apos-form-busy');
        }
        apos.util[sending ? 'addClass' : 'removeClass'](spinner, 'apos-form-visible');
        if (button) {
          button.disabled = sending;
        }
      }

      // If there are specified query parameters to capture, see if fields
      // can be populated.
      if (form.hasAttribute('data-apos-form-params')) {
        setParameterValues();
      }

      async function submit(event) {
        event.preventDefault();

        if (apos?.adminBar?.editMode) {
          await apos.notify('aposForm:disabledInEditMode', {
            type: 'info'
          });
          return;
        }

        // A second click while sending, or any click after `sent`.
        if (state !== 'idle') {
          return;
        }

        setState('sending');

        let input;
        const formData = new window.FormData();
        // Files are appended after the `data` field, because the server
        // only accepts files once it knows which form they belong to
        const fileFields = [];

        try {
          // Collect field values on the event
          input = await collectValues(form);

          // Upload each set of field files separately
          for (const field in input) {
            // Upload file field files if input has files.
            if (typeof input[field] === 'object' && input[field].files) {
              fileFields.push([ field, input[field] ]);

              input[field] = 'files-pending';
            }
          }

        } catch (error) {
          processErrors(error?.data?.formErrors, el);

          setState('idle');

          return;
        }

        input._id = form.getAttribute('data-apos-form-form');
        input[TOKEN_FIELD] = form.querySelector('[data-assurer-form-fill]')?.value || '';
        input[HONEYPOT_FIELD] = form.querySelector('[data-assurer-form-trap]')?.value || '';

        // For resubmissions
        const errorMsg = el.querySelector('[data-apos-form-submit-error]');
        const thankYou = el.querySelector('[data-apos-form-thank-you]');
        apos.util.removeClass(errorMsg, 'apos-form-visible');

        // Convert to arrays old school for IE.
        const existingErrorInputs = Array.prototype.slice.call(el.querySelectorAll('.apos-form-input-error'));
        const existingErrorMessages = Array.prototype.slice.call(el.querySelectorAll('[data-apos-input-message].apos-form-error'));

        existingErrorInputs.forEach(function (input) {
          apos.util.removeClass(input, 'apos-form-input-error');
        });

        existingErrorMessages.forEach(function (message) {
          apos.util.removeClass(message, 'apos-form-error');
          message.hidden = true;
        });

        // Capture query parameters.
        if (form.hasAttribute('data-apos-form-params')) {
          captureParameters(input);
        }

        formData.append('data', JSON.stringify(input));
        for (const [ field, fieldInput ] of fileFields) {
          await appendFiles(field, fieldInput, formData);
        }

        const request = apos.http.post('/api/v1/@apostrophecms/form/submit', {
          body: formData,
          fullResponse: true,
          headers: {
            'X-Assurer-Submission-Key': submissionKey
          }
        });

        let timer;
        const timeout = new Promise(resolve => {
          timer = setTimeout(() => resolve('timeout'), TIMEOUT_MS);
        });
        const outcome = await Promise.race([ request.then(accepted, failed), timeout ]);
        clearTimeout(timer);

        if (outcome === 'timeout') {
          // The answer may still arrive; show it when it does.
          showFailure(MESSAGES.unknown);
          request.then(accepted, () => null).then(late => {
            if (late?.ok) {
              showSuccess();
            }
          });
          return;
        }

        if (outcome.ok) {
          showSuccess();
        } else {
          showFailure(outcome.message, outcome.formErrors);
        }

        // The server sets this header only once the submission is stored
        // (modules/assurer-forms). A 2xx without it, for example a captive
        // portal page, is not treated as success.
        function accepted(response) {
          const ok = response?.status >= 200 && response.status < 300 &&
            response.headers?.['x-assurer-submission'] === 'stored';
          return ok ? { ok } : { message: MESSAGES.unknown };
        }

        function failed(error) {
          const formErrors = error?.body?.data?.formErrors;
          return {
            formErrors: (Array.isArray(formErrors) && formErrors.length)
              ? formErrors
              : null,
            message: failureMessage(error?.status)
          };
        }

        function showSuccess() {
          if (state === 'sent') {
            return;
          }
          setState('sent');
          apos.util.removeClass(errorMsg, 'apos-form-visible');
          submissionKey = newSubmissionKey();
          apos.util.emit(document.body, '@apostrophecms/form:submission-form', {
            form,
            formError: null
          });
          apos.util.addClass(thankYou, 'apos-form-visible');
          apos.util.addClass(form, 'apos-form-hidden');
        }

        function showFailure(message, formErrors) {
          if (state === 'sent') {
            return;
          }
          setState('idle');
          processErrors(formErrors || [ {
            global: true,
            message
          } ], el);
        }
      }

      function setParameterValues () {
        const paramList = form.getAttribute('data-apos-form-params').split(',');
        const params = apos.http.parseQuery(window.location.search);

        paramList.forEach(function (param) {
          const paramInput = form.querySelector('[name="' + param + '"]');

          if (!params[param]) {
            return;
          }

          // If the input is a checkbox, check all in the comma-separated query
          // parameter value.
          if (paramInput && paramInput.type === 'checkbox') {
            params[param].split(',').forEach(function (value) {
              const checkbox = form.querySelector('[name="' + param + '"][value="' + value + '"]');

              if (checkbox) {
                checkbox.checked = true;
              }
            });
            // If the input is a radio, check the matching input.
          } else if (paramInput && paramInput.type === 'radio') {
            form.querySelector('[name="' + param + '"][value="' + params[param] + '"]').checked = true;
            // If the input is a select field, make sure the value is an option.
          } else if (paramInput && paramInput.type === 'select') {
            if (paramInput.querySelector('option[value="' + params[param] + '"')) {
              paramInput.value = params[param];
            }
            // Otherwise set the input value to the parameter value.
          } else if (paramInput) {
            paramInput.value = params[param];
          }
        });
      }

      function captureParameters (input) {
        input.queryParams = apos.http.parseQuery(window.location.search);
      }

      async function appendFiles(field, fieldInput, data) {
        let i = 0;
        for (const file of fieldInput.files) {
          data.append(`${field}-${i}`, file);
          i++;
        }
      }
    }
  };
};
