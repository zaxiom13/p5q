import type { ElectrobunConfig } from "electrobun";

const config: ElectrobunConfig = {
  app: {
    name: "Qanvas5 Studio",
    identifier: "com.qanvas5.studio",
    version: "0.2.0",
    description: "Desktop-first p5.js-style editor for kdb+/q sketches"
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts"
    },
    mac: {
      codesign: false,
      notarize: false,
      bundleCEF: false,
      bundleWGPU: false,
      defaultRenderer: "native"
    }
  },
  runtime: {
    exitOnLastWindowClosed: true
  }
};

export default config;
