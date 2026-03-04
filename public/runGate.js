(function (global) {
  function createRunGate(sendRun) {
    let inFlight = false;
    let queuedCode = null;

    return {
      requestRun(code) {
        if (inFlight) {
          queuedCode = code;
          return false;
        }

        const sent = sendRun(code);
        if (sent === false) {
          return false;
        }

        inFlight = true;
        return true;
      },

      resolveRun() {
        if (!inFlight) {
          return;
        }

        if (queuedCode !== null) {
          const next = queuedCode;
          queuedCode = null;
          const sent = sendRun(next);
          if (sent === false) {
            inFlight = false;
          }
          return;
        }

        inFlight = false;
      },

      cancelRun() {
        inFlight = false;
        queuedCode = null;
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createRunGate };
  }

  global.createRunGate = createRunGate;
})(typeof globalThis !== 'undefined' ? globalThis : window);
