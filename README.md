# Subash Lama | Static Portfolio
This repository hosts Subash Lama's multimedia-rich portfolio as a static site, deployed with GitHub Pages and GitHub Actions.

## Features
- Responsive hero with ambient video background and optional audio.
- Floating 3D "glass" panels for About, Projects, Skills, and Contact.
- A dedicated Record Producer page plus media assets.
- CI + deploy workflows with GitHub Actions.

## Local Preview
Run a local server (or Docker) so media assets and animations load the same way they do in production. The deployed site now lives under `public/`, while Docker serves that folder directly:
```bash
# Option A: Docker (recommended)
docker build -t static-site .
docker run --rm -p 8080:80 --name static-site static-site

# Option B: Any static server (if installed)
# python -m http.server 8000 --directory public
# npx serve public
```
Then open `http://localhost:8080/` (Docker) or your chosen server URL.

## Deployment
- GitHub Actions automatically publishes the `main` branch to GitHub Pages.
- For workflow details, see `.github/workflows`.
