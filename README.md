# Subash Lama | Static Portfolio
This repository hosts Subash Lama’s multimedia-rich portfolio, packaged as a static site that GitHub Pages and the included CI/CD workflows can deploy automatically.

## Features
- Responsive hero with ambient video/audio background.
- Floating 3D “glass” panels for About, Projects, Skills, and Contact.
- A dedicated Record Producer story page plus media assets.
- GitHub Actions workflows that build, lint, and deploy the static site.

## Local Preview
Before pushing deployments, run a lightweight server so the background video/audio and CSS animations load just as they will in production:
```bash
# serve from the repo root
python -m http.server 8000
```
Then open `http://localhost:8000/index.html` in your browser to see the latest animation work. Refresh after edits to confirm everything renders as expected.

## Deployment
- GitHub Actions automatically publishes the `main` branch to GitHub Pages.
- If you ever need to rebuild manually, run `docker build .` and `docker run` using the provided `Dockerfile`, or follow the instructions inside `.github/workflows`.
