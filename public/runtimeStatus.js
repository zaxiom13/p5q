(function (globalScope) {
  function fallbackRuntimeStatus() {
    return {
      platform: 'desktop',
      configured: false,
      source: null,
      qBinary: null,
      resolvedPath: null,
      message: 'Runtime actions are limited in this build. If a sketch runs, q is available for this session.'
    };
  }

  function inferRuntimeStatusFromSketch(status) {
    if (status && status.configured) {
      return status;
    }

    return {
      ...(status || fallbackRuntimeStatus()),
      configured: true,
      source: status?.source || 'session',
      resolvedPath: status?.resolvedPath || status?.qBinary || 'Connected for this session',
      qBinary: status?.qBinary || status?.resolvedPath || null,
      message: 'q is connected for this session. This sketch started successfully.'
    };
  }

  function sourceLabel(source) {
    if (source === 'saved') return 'Saved selection';
    if (source === 'auto') return 'Auto-detected';
    if (source === 'path') return 'PATH';
    if (source === 'wsl') return 'WSL';
    if (source === 'session') return 'Active session';
    return 'Not connected';
  }

  const api = {
    fallbackRuntimeStatus,
    inferRuntimeStatusFromSketch,
    sourceLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  globalScope.p5qRuntimeStatus = api;
})(typeof window !== 'undefined' ? window : globalThis);
