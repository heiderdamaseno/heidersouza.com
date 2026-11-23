# heidersouza.com

Website of Heider Souza: Agile transformation, digitalization and migration.

One static page (`index.html`), hosted on GitHub Pages with the custom domain in `CNAME`. No build step: edit `index.html` and merge to `main`, and Pages publishes it within a minute or two.

- `og-image.png`: the preview image shown when the link is shared (1200 x 630).
- `robots.txt` and `sitemap.xml`: help search engines find the page. Update `lastmod` in the sitemap when the page changes.

## Offer pages (one folder per offer)

Each offer is a folder with one `index.html`, for example `jira-cloud-migration/`. It uses the shared kit in `assets/`:

- `assets/offer.css`: the look (same colours and fonts as the home page).
- `assets/watch.js`: the live console demo. The page holds the scenario as JSON in `<script type="application/json" data-watch-for="...">`.
- `assets/check.js`: the readiness check. Questions, scores and result texts are JSON in `<script type="application/json" data-check-for="...">`.

To add an offer or a country version: copy the folder, change the words and the two JSON blocks, add the page to `sitemap.xml`. All demo data must be made up; never use client names or data.
