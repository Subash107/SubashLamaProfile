# Subash Lama | Static Portfolio
This repository hosts Subash Lama's multimedia-rich portfolio as a static site, deployed with GitHub Pages and GitHub Actions.

## Features
- Responsive hero with ambient video background and optional audio.
- Floating 3D "glass" panels for About, Projects, Skills, and Contact.
- A dedicated Record Producer page plus media assets.
- CI + deploy workflows with GitHub Actions.
- Security hardening for GitHub Pages output, Docker/nginx serving, and workflow execution.

## Repository Layout
- `public/` contains the deployed static site.
- `public/assets/` contains runtime CSS, JS, media, and the published resume output.
- `assets/cv/` contains the source resume PDFs that feed the published download file.
- `scripts/` contains local automation, including resume syncing.
- `nginx/` contains the Docker/nginx runtime config.
- `.github/workflows/` contains CI, Pages deploy, and security scanning workflows.
- `archive/` contains legacy template files, unused raw media, and old local artifacts that are not part of the live site.

## Local Preview
Run a local server (or Docker) so media assets and animations load the same way they do in production. The deployed site now lives under `public/`, while Docker serves that folder directly:
```bash
# Option A: Docker (recommended)
pwsh ./scripts/sync-resume.ps1
docker build -t static-site .
docker run --rm -p 8080:80 --name static-site static-site

# Option B: Any static server (if installed)
# pwsh ./scripts/sync-resume.ps1
# python -m http.server 8000 --directory public
# npx serve public
```
Then open `http://localhost:8080/` (Docker) or your chosen server URL.

## Resume Updates
- Put your current resume PDF in `assets/cv/`.
- The newest PDF in that folder is automatically copied to `public/assets/docs/cv/latest-resume.pdf` during local deploy and GitHub Actions.
- If you keep multiple PDFs there, the most recently modified one becomes the download target.

## Deployment
- GitHub Actions automatically publishes the `main` branch to GitHub Pages.
- For workflow details, see `.github/workflows`.

## Security Notes
- Only the generated `public/assets/docs/cv/latest-resume.pdf` is published for resume downloads.
- A stale public CV copy was removed so old resume files are not exposed by the site path anymore.
- Do not commit `.env`, private keys, certificate files, Terraform state, or other secret-bearing files.
- CI now includes a secret-hygiene workflow plus CodeQL analysis and Dependabot updates for security maintenance.
