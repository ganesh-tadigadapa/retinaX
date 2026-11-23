/** @type {import('next').NextConfig} */
// distDir is overridable so a production build can be verified without clobbering the
// .next directory a running `next dev` is using. Defaults to the standard location.
module.exports = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Optional same-origin proxy: with API_PROXY_TARGET set (e.g. http://127.0.0.1:8081),
  // /backend/* is forwarded to the API, so one public URL (a tunnel) serves both the
  // site and the API. Unset (the default), nothing is rewritten.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/backend/:path*", destination: `${target}/:path*` }] : [];
  },
  experimental: {
    // /api/eye-hospitals reads this snapshot with fs at runtime, which the bundler cannot
    // see. Without this a Vercel deployment would ship the route without its data.
    outputFileTracingIncludes: {
      "/api/eye-hospitals": ["./data/osm-india-health.json.gz"],
    },
  },
};
