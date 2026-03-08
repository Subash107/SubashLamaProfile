# Security Policy

## Scope

This repository hosts a static portfolio site and its GitHub Actions deployment configuration.

## Reporting

- Preferred contact: `lamasubash107@gmail.com`
- Please include a clear reproduction path, affected URL or file, impact, and any relevant logs or screenshots.

## Response

- Good-faith reports will be reviewed and triaged.
- Sensitive findings should not be disclosed publicly before a fix is available.

## Current Security Controls

- Restrictive Content Security Policy for the published site.
- Hardened nginx response headers for Docker-based serving.
- Reduced GitHub Actions token exposure through read-only permissions and credential-less checkout.
- Weekly Dependabot monitoring for GitHub Actions updates.
- Standard `security.txt` disclosure contact published under `public/.well-known/`.
