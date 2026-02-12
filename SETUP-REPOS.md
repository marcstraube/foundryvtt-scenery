# Repository Setup Guide

Setup-Schritte für GitHub und GitLab nach dem v13-Release. Diese Datei ist nicht
Teil des Repositories — nach Abarbeitung löschen.

---

## GitHub

### Repository Settings

1. **Settings > General**
   - Description:
     `Manage background image variations per scene with separate GM/Player views, automatic scene element capture, smart map scanning, and instant switching.`
   - Website: Release-URL oder leer lassen
   - Topics: `foundryvtt`, `foundryvtt-module`, `foundry-vtt`, `scenery`

2. **Settings > General > Pull Requests**
   - [x] Allow squash merging (empfohlen als Default)
   - [ ] Allow merge commits — optional deaktivieren
   - [x] Automatically delete head branches

3. **Settings > Branches > Branch protection rules**
   - Branch: `master`
   - [x] Require a pull request before merging
   - [x] Require status checks to pass before merging
     - Required checks: `validate` (aus `ci.yml`)
   - [x] Require branches to be up to date before merging
   - [ ] Include administrators — optional, wenn du dir selbst Bypasses erlauben
         willst

4. **Settings > Environments** (optional)
   - Environment `release` erstellen
   - Deployment protection: nur Tags `v*`

### Labels prüfen

Der Release Drafter nutzt Labels zum Kategorisieren. Folgende Labels sollten
existieren (werden teils automatisch vom Autolabeler erstellt):

- `feat` / `feature` / `enhancement`
- `fix` / `bugfix` / `bug`
- `refactor`
- `docs`
- `perf`
- `security`
- `build` / `ci` / `chore`
- `test`
- `style`
- `major` / `minor` / `patch` (für Version Resolver)
- `breaking`

### Secrets

Keine zusätzlichen Secrets nötig — `GITHUB_TOKEN` wird automatisch
bereitgestellt.

### Actions prüfen

- **Settings > Actions > General**
  - [x] Allow all actions and reusable workflows (oder auf `actions/*`,
        `pnpm/*`, `ncipollo/*`, `release-drafter/*` beschränken)
  - Workflow permissions: Read and write

### Funding

Bereits konfiguriert in `.github/FUNDING.yml`:

- Ko-fi: `nerdybynature`
- Patreon: `NerdyByNatureDev`

Prüfen unter **Settings > General > Sponsorship** ob der "Sponsor" Button
sichtbar ist.

---

## GitLab (Mirror)

### Repository erstellen

1. Neues Projekt auf GitLab erstellen (z.B. `foundryvtt-scenery`)
2. **Settings > Repository > Mirroring repositories**
   - Git repository URL: `https://github.com/marcstraube/foundryvtt-scenery.git`
   - Mirror direction: **Pull** (GitLab zieht von GitHub)
   - Authentication: Personal Access Token von GitHub mit `repo` Scope
   - [x] Mirror only protected branches — deaktivieren, damit alle Branches +
         Tags kommen
   - Update interval: Automatisch (alle 5 Minuten)

   Alternativ: Push-Mirror von GitHub nach GitLab einrichten (GitHub Actions).

### CI/CD Variables

Unter **Settings > CI/CD > Variables** anlegen:

| Variable            | Value                            | Protected | Masked |
| ------------------- | -------------------------------- | --------- | ------ |
| `GITHUB_REPOSITORY` | `marcstraube/foundryvtt-scenery` | Nein      | Nein   |

Diese Variable wird in `.gitlab-ci.yml` genutzt, damit Release-Artefakte auf
GitHub als primäre Quelle verweisen.

### CI/CD Settings

- **Settings > CI/CD > General pipelines**
  - Git strategy: `fetch` (schneller als `clone`)
  - Timeout: 10 Minuten reicht

- **Settings > CI/CD > Runners**
  - Shared Runners sollten aktiviert sein (gitlab.com Standard)

### Protected Tags

- **Settings > Repository > Protected tags**
  - Tag: `v*`
  - Allowed to create: Maintainers (oder nur du)

  Damit nur du Release-Tags pushen kannst und die Release-Pipeline auslöst.

### Release erstellen

Releases werden automatisch erstellt wenn ein Tag mit `v*.*.*` gepusht wird. Da
GitLab ein Pull-Mirror ist, werden Tags automatisch von GitHub übernommen.

Ablauf:

1. Release auf GitHub erstellen (Tag `v1.0.0`)
2. GitLab Mirror synchronisiert (max. 5 Min)
3. GitLab CI erkennt den Tag und baut Release-Artefakte
4. Artefakte enthalten GitHub-URLs in module.json

### Optional: Merge Request Pipeline

Die `.gitlab-ci.yml` Validate-Stage läuft automatisch bei Merge Requests. Bei
einem reinen Mirror ohne MRs auf GitLab ist das irrelevant — schadet aber nicht.

---

## Checkliste vor Release

- [ ] Alle Issues für Milestone geschlossen/verschoben
- [ ] `update-v13` Branch in `master` gemerged
- [ ] CI-Pipeline auf `master` grün
- [ ] Release Draft auf GitHub prüfen (automatisch durch Release Drafter)
- [ ] Release auf GitHub publishen mit Tag `v1.0.0`
- [ ] Prüfen: module.zip enthält korrekte module.json mit Version + URLs
- [ ] Prüfen: Foundry Installation via Manifest-URL funktioniert
- [ ] GitLab Mirror synchronisiert und Release erstellt
- [ ] Foundry Package Admin: neue Version einreichen (falls nötig)
