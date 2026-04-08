# Contributing

Thanks for contributing to this portfolio site.

## Workflow
1. Start from the latest `main`.
2. Create a focused branch for your change.
3. Make updates in the correct source folder:
   - `public/` for the live static site.
   - `content/resume/` for source resume PDFs.
   - `.github/` for automation, CI, and maintenance settings.
4. Preview the site locally before opening a pull request.
5. Open a pull request with a clear summary and testing notes.

## Local Checks
- Sync the newest resume before previewing or committing resume-related changes:
  `pwsh ./scripts/sync-resume.ps1`
  or
  `powershell -ExecutionPolicy Bypass -File .\scripts\sync-resume.ps1`
- Keep resume source filenames professional and descriptive, for example:
  `Subash-Lama-Resume.pdf`
- Run the secret hygiene check before pushing:
  `pwsh ./scripts/check-secret-hygiene.ps1`
  or
  `powershell -ExecutionPolicy Bypass -File .\scripts\check-secret-hygiene.ps1`
- Preview locally with Docker, `pwsh ./scripts/serve-static.ps1`, or another static server as described in [README.md](README.md).

## Content Notes
- Only commit public assets that are meant to ship with the site.
- Keep large binary updates intentional and easy to explain in the pull request.
- Do not commit secrets, private keys, `.env` files, or local-only artifacts.

## Pull Request Tips
- Keep each pull request focused on one improvement.
- Include screenshots when layout or visual content changes.
- Mention any updated media, resume, or deployment behavior.
- Call out any follow-up work that should happen after merge.
- Repository ownership and default review routing are defined in `.github/CODEOWNERS`.
