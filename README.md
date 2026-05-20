# The Ledger

**[View the site →](https://tuckerrasbury.github.io/a-country-worth-criticizing/)**

A personal civic technology site by Isaac D. Tucker-Rasbury, built in the Baldwin ethic: loving this country enough to criticize it, rigorously and by name.

---

## Pages

**[Archive](https://tuckerrasbury.github.io/a-country-worth-criticizing/index.html)** — A personal research library. Every PDF, article, link, or text passage that has shaped Isaac's civic thinking, tagged to policy pillars and searchable.

**[Builder](https://tuckerrasbury.github.io/a-country-worth-criticizing/builder.html)** — A structured drafting workspace for writing federal-style legislation. The Archive serves as the reference layer; the Builder is where a policy idea becomes a bill.

**[Platform](https://tuckerrasbury.github.io/a-country-worth-criticizing/platform.html)** — A public declaration. What Isaac believes, the real policies that prove it's possible, and the research that backs it up.

---

## Policy Pillars

1. Housing and Homelessness
2. Economic Justice and Wages
3. Voting Rights and Electoral Reform
4. Education and Access
5. Healthcare
6. Criminal Justice and Policing
7. Civil Rights and Racial Equity
8. Environment and Climate
9. Military and Federal Spending
10. Immigration
11. Arts, Culture, and Public Life
12. Technology and Data Rights

---

## Tech

Plain HTML, CSS, and JavaScript. No frameworks, no build step. Hosted on GitHub Pages. Data lives in `localStorage`, seeded from `data/` on first visit.

```
index.html        # The Archive
builder.html      # The Policy Builder
platform.html     # The Platform
css/              # Design system + page-specific styles
js/               # store.js, nav.js, archive.js, builder.js, platform.js
data/             # Seed JSON: resources, platform beliefs, drafts
```

To run locally, serve the repo root over HTTP (e.g. `python3 -m http.server 8000`) and open `http://localhost:8000`.
