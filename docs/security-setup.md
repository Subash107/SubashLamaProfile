# Remaining Security Setup Steps

These require your manual action — they cannot be done via code changes.

---

## 1. Branch Protection on `main` (5 minutes)

Go to: **GitHub → Repository → Settings → Branches → Add rule**

Settings to enable:
- Branch name pattern: `main`
- ✅ Require status checks to pass before merging
  - Add: `build-and-deploy`, `lighthouse`, `codeql`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to matching branches → add yourself only

---

## 2. Enable Push Protection + Secret Scanning (2 minutes)

Go to: **GitHub → Repository → Settings → Security & Analysis**

Enable:
- ✅ Secret scanning
- ✅ Push protection (blocks secrets before they're committed)
- ✅ Dependency graph
- ✅ Dependabot alerts
- ✅ Dependabot security updates

---

## 3. GPG-Signed Commits (10 minutes)

Every commit will show a green **Verified** badge on GitHub.

```bash
# Step 1: Generate a GPG key
gpg --full-generate-key
# Choose: RSA and RSA, 4096 bits, 0 (no expiry), your name + lamasubash107@gmail.com

# Step 2: Get your key ID
gpg --list-secret-keys --keyid-format LONG
# Copy the long key ID (after "sec rsa4096/")

# Step 3: Export your public key and add it to GitHub
gpg --armor --export YOUR_KEY_ID
# Copy the output → GitHub → Settings → SSH and GPG keys → New GPG key

# Step 4: Tell git to sign all commits
git config --global user.signingkey YOUR_KEY_ID
git config --global commit.gpgsign true

# Step 5: (Windows) Point git to gpg
git config --global gpg.program "C:/Program Files (x86)/gnupg/bin/gpg.exe"
# Or wherever gpg is installed — check with: where gpg
```

---

## 4. Pin GitHub Actions to SHAs (automated)

Run the provided script after setting a GitHub token:

```bash
# Create a token at: github.com/settings/tokens (repo:read scope only)
export GITHUB_TOKEN=ghp_your_token_here
bash scripts/pin-actions.sh
git add .github/workflows/
git commit -m "ci: pin GitHub Actions to full commit SHAs"
git push
```

---

## 5. Cloudflare Proxy for Real HTTP Headers (30 minutes)

Your `_headers` file is already configured. When you set up Cloudflare Pages:

**Option A — Cloudflare Pages (recommended):**
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect your GitHub repo (`Subash107/SubashLamaProfile`)
3. Build settings: **Framework preset → None**, **Build output → `public`**
4. Deploy — Cloudflare Pages reads `public/_headers` automatically
5. Your SecurityHeaders.com grade goes from C → **A+**

**Option B — Cloudflare as a Proxy (keep GitHub Pages):**
1. Transfer your domain to Cloudflare or change DNS nameservers
2. Add a CNAME record pointing to `subash107.github.io`
3. Add Transform Rules to inject the headers from `_headers`

---

## 6. Cloudflare Worker — Add CSP Report Handler

Your Cloudflare Worker at `lingering-surf-6d77.lamasubash107.workers.dev` is referenced as the CSP reporting endpoint. Add this route to your Worker:

```javascript
// In your Cloudflare Worker — add this handler
if (request.method === 'POST' && url.pathname === '/csp-report') {
  const report = await request.json().catch(() => null);
  if (report) {
    // Log to console (visible in Cloudflare dashboard → Workers → Logs)
    console.log('CSP Violation:', JSON.stringify(report));
    // Or store in a KV namespace, D1 database, or forward to email
  }
  return new Response('', { status: 204 });
}
```

---

## 7. HSTS Preload

Once on Cloudflare and running for 30 days with HSTS max-age=63072000:
1. Go to [hstspreload.org](https://hstspreload.org)
2. Submit your domain
3. Your domain gets added to browsers' built-in HSTS list — enforced before DNS resolves

---

*After completing all steps, run your site through:*
- *[securityheaders.com](https://securityheaders.com/?q=subash107.github.io) — target: A+*
- *[observatory.mozilla.org](https://observatory.mozilla.org/analyze/subash107.github.io) — target: A+*
- *[ssllabs.com/ssltest](https://www.ssllabs.com/ssltest/analyze.html?d=subash107.github.io) — target: A+*
