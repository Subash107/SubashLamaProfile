/**
 * Cloudflare Pages Function — Telegram Bot Webhook
 * URL: https://subashlamaprofile.pages.dev/api/bot
 *
 * Handles /stats /latest /log /week /help commands.
 * Uses pages.dev domain which Telegram can resolve (unlike workers.dev).
 *
 * Secrets (set in Cloudflare Pages dashboard → Settings → Environment variables):
 *   TELEGRAM_BOT_TOKEN
 *   GITHUB_READ_TOKEN  (optional — increases GitHub API rate limit)
 */

const GITHUB_REPO = "Subash107/SubashLamaProfile";
const LOG_PATH    = "download-logs/resume-downloads.txt";

export async function onRequestPost(context) {
  const env = context.env;
  try {
    const update = await context.request.json();
    const msg    = update.message || update.edited_message;
    if (!msg?.text) return new Response("OK");

    const chatId  = msg.chat.id;
    const text    = msg.text.trim().split(" ")[0].toLowerCase();
    let reply     = "";

    const fullText = msg.text.trim();
    switch (text) {
      case "/start":
      case "/help":
        reply = "Resume Tracker Bot\n\n--- DOWNLOADS ---\n/stats      - Total downloads + top countries\n/latest     - Most recent download\n/log        - Last 5 downloads\n/week       - This week's count\n\n--- JOB APPLICATIONS ---\n/apply      - Add application (/apply Microsoft SOC Analyst)\n/apps       - List all applications\n/appstats   - Application analytics\n/hired      - Mark hired (/hired Microsoft)\n/reject     - Mark rejected (/reject Microsoft)\n/interview  - Mark interview (/interview Microsoft)\n\n--- RECRUITERS ---\n/recruiter  - Add recruiter (/recruiter John Smith Microsoft)\n/recruiters - List all recruiters\n\n--- PREP ---\n/prep       - Interview questions (/prep Microsoft)\n\n/help - Show this menu";
        break;
      case "/stats":      reply = await getStats(env);  break;
      case "/latest":     reply = await getLatest(env); break;
      case "/log":        reply = await getLog(env);    break;
      case "/week":       reply = await getWeek(env);   break;
      case "/apply":      reply = await addApplication(env, fullText); break;
      case "/apps":       reply = await listApplications(env); break;
      case "/appstats":   reply = await appStats(env); break;
      case "/hired":      reply = await updateApplication(env, fullText, "HIRED"); break;
      case "/reject":     reply = await updateApplication(env, fullText, "REJECTED"); break;
      case "/interview":  reply = await updateApplication(env, fullText, "INTERVIEW"); break;
      case "/recruiter":  reply = await addRecruiter(env, fullText); break;
      case "/recruiters": reply = await listRecruiters(env); break;
      case "/prep":       reply = await interviewPrep(fullText); break;
      default:            reply = "Unknown command. Send /help to see available commands.";
    }

    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, reply);
    return new Response("OK");
  } catch {
    return new Response("OK");
  }
}

export async function onRequestGet(context) {
  return new Response("Telegram Bot Webhook — OK", { status: 200 });
}

async function fetchLog(env) {
  const headers = {};
  if (env.GITHUB_READ_TOKEN) headers["Authorization"] = "Bearer " + env.GITHUB_READ_TOKEN;
  headers["User-Agent"] = "ResumeTrackerBot/1.0";

  const res = await fetch(
    "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + LOG_PATH,
    { headers }
  );
  if (!res.ok) return [];
  const data    = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return content.split("\n").filter(line => /^\d{4}-\d{2}-\d{2}/.test(line));
}

function parseLine(line) {
  const p = line.split("|").map(s => s.trim());
  return { timestamp: p[0]||"", ip: p[1]||"", location: p[2]||"", org: p[3]||"", os: p[4]||"", browser: p[5]||"", device: p[6]||"" };
}

async function getStats(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  const countries = {}, companies = {};
  lines.forEach(l => {
    const d = parseLine(l);
    const c = d.location.split(",").pop().trim() || "Unknown";
    countries[c] = (countries[c]||0) + 1;
    companies[d.org||"Unknown"] = (companies[d.org||"Unknown"]||0) + 1;
  });
  const topC = Object.entries(countries).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>"  "+k+": "+v).join("\n");
  const topO = Object.entries(companies).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>"  "+k+": "+v).join("\n");
  return "Resume Download Stats\n\nTotal: " + lines.length + " downloads\n\nTop Countries:\n" + topC + "\n\nTop Companies:\n" + topO;
}

async function getLatest(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  const d = parseLine(lines[lines.length - 1]);
  return "Latest Download\n\nLocation: " + d.location + "\nCompany:  " + d.org + "\nDevice:   " + d.device + " / " + d.os + " / " + d.browser + "\nIP:       " + d.ip + "\nTime:     " + d.timestamp;
}

async function getLog(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  return "Last " + Math.min(5, lines.length) + " Downloads\n\n" +
    lines.slice(-5).reverse().map((l, i) => {
      const d = parseLine(l);
      return (i+1) + ". " + d.location + " - " + d.org + "\n   " + d.timestamp;
    }).join("\n\n");
}

async function getWeek(env) {
  const lines = await fetchLog(env);
  if (!lines.length) return "No downloads recorded yet.";
  const weekAgo = new Date(Date.now() - 7*864e5).toISOString().slice(0,10);
  const week    = lines.filter(l => parseLine(l).timestamp >= weekAgo);
  return "This Week: " + week.length + " download(s)\n\n" +
    week.reverse().slice(0,5).map(l => {
      const d = parseLine(l);
      return "- " + d.location + " (" + d.timestamp.slice(0,10) + ")";
    }).join("\n");
}

async function addApplication(env, fullText) {
  const parts = fullText.replace("/apply", "").trim();
  if (!parts) return "Usage: /apply CompanyName JobTitle\nExample: /apply Microsoft SOC Analyst";
  const words = parts.split(" ");
  const company = words[0];
  const role = words.slice(1).join(" ") || "Not specified";
  const date = new Date().toISOString().slice(0, 10);

  const apps = JSON.parse(await env.TELEGRAM_BOT_TOKEN ? "{}" : "{}");
  const stored = await fetchApps(env);
  stored.push({ company, role, date, status: "APPLIED" });
  await saveApps(env, stored);
  return "Application added!\n\nCompany : " + company + "\nRole    : " + role + "\nDate    : " + date + "\nStatus  : APPLIED\n\nTotal applications: " + stored.length;
}

async function listApplications(env) {
  const apps = await fetchApps(env);
  if (!apps.length) return "No applications tracked yet.\n\nUse /apply CompanyName Role to add one.";
  const STATUS_ICONS = { APPLIED: "APPLIED", HIRED: "HIRED", REJECTED: "REJECTED", INTERVIEW: "INTERVIEW" };
  return "Your Job Applications (" + apps.length + " total)\n\n" +
    apps.slice(-15).reverse().map((a, i) =>
      (i+1) + ". " + a.company + " — " + a.role + "\n   Status: " + (STATUS_ICONS[a.status]||a.status) + " | Applied: " + a.date
    ).join("\n\n");
}

async function updateApplication(env, fullText, newStatus) {
  const company = fullText.replace("/" + newStatus.toLowerCase(), "").trim();
  if (!company) return "Usage: /" + newStatus.toLowerCase() + " CompanyName";
  const apps = await fetchApps(env);
  const idx = apps.findIndex(a => a.company.toLowerCase().includes(company.toLowerCase()));
  if (idx === -1) return "No application found for: " + company + "\n\nUse /apps to see all applications.";
  apps[idx].status = newStatus;
  await saveApps(env, apps);
  return "Updated!\n\n" + apps[idx].company + " — " + apps[idx].role + "\nNew status: " + newStatus;
}

async function fetchApps(env) {
  try {
    const res = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/contents/download-logs/job-applications.json", {
      headers: { "User-Agent": "ResumeTrackerBot/1.0", ...(env.GITHUB_READ_TOKEN ? { "Authorization": "Bearer " + env.GITHUB_READ_TOKEN } : {}) }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return JSON.parse(atob(data.content.replace(/\n/g, "")));
  } catch { return []; }
}

async function saveApps(env, apps) {
  if (!env.GITHUB_READ_TOKEN) return;
  let sha = "";
  try {
    const existing = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/contents/download-logs/job-applications.json", {
      headers: { "Authorization": "Bearer " + env.GITHUB_READ_TOKEN, "User-Agent": "ResumeTrackerBot/1.0" }
    });
    if (existing.ok) { const d = await existing.json(); sha = d.sha; }
  } catch {}
  await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/contents/download-logs/job-applications.json", {
    method: "PUT",
    headers: { "Authorization": "Bearer " + env.GITHUB_READ_TOKEN, "Content-Type": "application/json", "User-Agent": "ResumeTrackerBot/1.0" },
    body: JSON.stringify({ message: "chore: update job applications", content: btoa(JSON.stringify(apps, null, 2)), ...(sha ? { sha } : {}) })
  });
}

async function appStats(env) {
  const apps = await fetchApps(env);
  if (!apps.length) return "No applications yet.\n\nUse /apply CompanyName Role to start tracking.";
  const total     = apps.length;
  const applied   = apps.filter(a => a.status === "APPLIED").length;
  const interview = apps.filter(a => a.status === "INTERVIEW").length;
  const hired     = apps.filter(a => a.status === "HIRED").length;
  const rejected  = apps.filter(a => a.status === "REJECTED").length;
  const interviewRate = total > 0 ? Math.round((interview + hired) / total * 100) : 0;
  const offerRate     = (interview + hired) > 0 ? Math.round(hired / (interview + hired) * 100) : 0;
  return "Job Application Analytics\n\nTotal applied  : " + total + "\nIn interview   : " + interview + "\nHired          : " + hired + "\nRejected       : " + rejected + "\nPending        : " + applied + "\n\nInterview rate : " + interviewRate + "%\nOffer rate     : " + offerRate + "%\n\n" + (hired > 0 ? "Congratulations on the offer(s)!" : interview > 0 ? "You have active interviews — good luck!" : "Keep applying — consistency wins!");
}

async function addRecruiter(env, fullText) {
  const parts = fullText.replace("/recruiter", "").trim();
  if (!parts) return "Usage: /recruiter FirstName LastName Company\nExample: /recruiter John Smith Microsoft";
  const words   = parts.split(" ");
  const company = words[words.length - 1];
  const name    = words.slice(0, -1).join(" ") || parts;
  const date    = new Date().toISOString().slice(0, 10);
  const stored  = await fetchRecruiters(env);
  stored.push({ name, company, date, lastContact: date, status: "CONTACTED" });
  await saveRecruiters(env, stored);
  return "Recruiter added!\n\nName    : " + name + "\nCompany : " + company + "\nDate    : " + date + "\n\nTotal recruiters tracked: " + stored.length;
}

async function listRecruiters(env) {
  const recruiters = await fetchRecruiters(env);
  if (!recruiters.length) return "No recruiters tracked yet.\n\nUse /recruiter FirstName LastName Company to add one.";
  return "Recruiter CRM (" + recruiters.length + " contacts)\n\n" +
    recruiters.slice(-10).reverse().map((r, i) =>
      (i+1) + ". " + r.name + " — " + r.company + "\n   Added: " + r.date
    ).join("\n\n");
}

async function fetchRecruiters(env) {
  try {
    const res = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/contents/download-logs/recruiters.json", {
      headers: { "User-Agent": "ResumeTrackerBot/1.0", ...(env.GITHUB_READ_TOKEN ? { "Authorization": "Bearer " + env.GITHUB_READ_TOKEN } : {}) }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return JSON.parse(atob(data.content.replace(/\n/g, "")));
  } catch { return []; }
}

async function saveRecruiters(env, recruiters) {
  if (!env.GITHUB_READ_TOKEN) return;
  let sha = "";
  try {
    const existing = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/contents/download-logs/recruiters.json", {
      headers: { "Authorization": "Bearer " + env.GITHUB_READ_TOKEN, "User-Agent": "ResumeTrackerBot/1.0" }
    });
    if (existing.ok) { const d = await existing.json(); sha = d.sha; }
  } catch {}
  await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/contents/download-logs/recruiters.json", {
    method: "PUT",
    headers: { "Authorization": "Bearer " + env.GITHUB_READ_TOKEN, "Content-Type": "application/json", "User-Agent": "ResumeTrackerBot/1.0" },
    body: JSON.stringify({ message: "chore: update recruiters", content: btoa(JSON.stringify(recruiters, null, 2)), ...(sha ? { sha } : {}) })
  });
}

async function interviewPrep(fullText) {
  const company = fullText.replace("/prep", "").trim() || "General";
  const PREP = {
    "microsoft": "Microsoft Interview Prep\n\n1. Tell me about yourself and your cybersecurity background\n2. Describe a time you detected and responded to a security incident\n3. How do you approach threat hunting in a SIEM?\n4. Explain Zero Trust Architecture\n5. How do you prioritize vulnerabilities?\n6. Walk me through your SOC lab setup\n7. What MITRE ATT&CK techniques have you hunted for?\n\nTip: Research Microsoft Defender, Sentinel, and Azure Security Center.",
    "google": "Google Interview Prep\n\n1. Tell me about your security engineering experience\n2. How do you design a secure system?\n3. Explain a complex security incident you handled\n4. How do you think about security at scale?\n5. What is your approach to IAM in cloud environments?\n6. Describe your experience with Python for security automation\n\nTip: Research BeyondCorp, Google Cloud Security, and Chronicle SIEM.",
    "cisco": "Cisco Interview Prep\n\n1. Explain your network security experience\n2. How do you configure and tune IDS/IPS rules?\n3. Describe your experience with Suricata or Snort\n4. How do you handle a DDoS attack?\n5. Explain your firewall management experience\n6. What is your approach to network segmentation?\n\nTip: Research Cisco SecureX, Firepower, and Umbrella.",
    "general": "General Cybersecurity Interview Prep\n\n1. Walk me through your SOC experience and lab setup\n2. Describe a real security incident you detected and resolved\n3. How do you write SIEM detection rules?\n4. Explain the difference between IDS and IPS\n5. What is your IAM experience?\n6. How do you stay updated on new threats and CVEs?\n7. Why are you transitioning to this role?\n8. What is your biggest strength in cybersecurity?\n\nTip: Use STAR method (Situation, Task, Action, Result) for all behavioral questions."
  };
  const key = company.toLowerCase();
  return PREP[key] || PREP["general"].replace("General Cybersecurity", company + " Cybersecurity");
}

async function sendMessage(token, chatId, text) {
  await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ chat_id: chatId, text }),
  });
}
