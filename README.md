# dev/null Community Globe

[View the live site](https://dev-null-global.r-kipsang.workers.dev/?user=tom&mode=following)

Install dependencies with `yarn install`.

- `yarn dev`: start the development server at http://localhost:5173.
- `yarn prod`: build the app and preview the production build at http://localhost:4173.
- `yarn build`: create deployment assets in `dist/`.
- `yarn test:e2e`: run the desktop and mobile browser tests.

Both local servers proxy `/api` requests to https://dev-null.sh. Production previews run locally; deployment uses the Cloudflare Worker in `src/worker.js`. Wrangler builds the app and serves `dist/` using `wrangler.jsonc`.
