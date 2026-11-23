/** @type {import('next').NextConfig} */
// distDir is overridable so a production build can be verified without clobbering the
// .next directory a running `next dev` is using. Defaults to the standard location.
module.exports = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // /api/eye-hospitals reads this snapshot with fs at runtime, which the bundler cannot
    // see. Without this a Vercel deployment would ship the route without its data.
    outputFileTracingIncludes: {
      "/api/eye-hospitals": ["./data/osm-india-health.json.gz"],
    },
  },
};
