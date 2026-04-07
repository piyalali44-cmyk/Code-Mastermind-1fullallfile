// Stub for shaka-player — not available on web in this environment
module.exports = {
  polyfill: { installAll: () => {} },
  Player: class {
    constructor() {}
    configure() {}
    load() { return Promise.resolve(); }
    destroy() { return Promise.resolve(); }
    addEventListener() {}
    removeEventListener() {}
  },
  net: { NetworkingEngine: { RequestType: {} } },
  util: { Error: class extends Error {} },
};
