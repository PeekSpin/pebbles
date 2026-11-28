import nextConstants from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" }
    ]
  }
};

let observingShutdown = false;

export default function config(phase) {
  if (phase === nextConstants.PHASE_PRODUCTION_SERVER && !observingShutdown && !process.env.NEXT_MANUAL_SIG_HANDLE) {
    // Next installs its graceful shutdown listeners before loading the server config.
    for (const signal of ["SIGTERM", "SIGINT"]) {
      if (process.listenerCount(signal) > 0) {
        process.once(signal, () => console.info(`[shutdown] Received ${signal}`));
      }
    }
    observingShutdown = true;
  }
  return nextConfig;
}
