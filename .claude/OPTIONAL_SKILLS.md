# Optional / uninstalled skills

Skills that are **not part of this harness's core workflow** but can be
re-installed on demand. They live here as a pointer, not as code — the source
of truth is the upstream repo.

## Why these are not installed

Clemvion is a backend-heavy NestJS + Next.js product. The role skills under
`.claude/skills/` (`developer`, `project-planner`, `consistency-checker`,
`code-review-agents`, `merge-coordinator`, `spec-coverage`) carry the workflow.

The design/output skills below are general-purpose, imported assets with broad
auto-trigger descriptions (`design`, `UI`, `full output`). Kept installed, they
risk firing on ordinary frontend/implementation prompts and competing with the
`developer` workflow — for low payoff on a backend-centric codebase. They were
**uninstalled** (removed from `skills-lock.json` and `.claude/skills/`) to keep
the skill namespace clean. Nothing is lost: they are one command away upstream.

## Catalog

All six come from the same source: **`Leonxlnx/taste-skill`** (GitHub).

| Skill | Purpose |
|---|---|
| `design-taste-frontend` | Senior UI/UX engineering rules, component architecture, CSS hardware acceleration. |
| `high-end-visual-design` | Agency-tier fonts/spacing/shadows/motion; blocks generic AI design defaults. |
| `minimalist-ui` | Editorial monochrome minimalism — flat bento grids, muted pastels. |
| `redesign-existing-projects` | Audits an existing UI and upgrades it to premium quality. |
| `stitch-design-taste` | Generates `DESIGN.md` design-system files for Google Stitch. |
| `full-output-enforcement` | Overrides truncation; enforces complete, unabridged code output. |

## Re-install

Use whatever skill sync tool manages `skills-lock.json` (the entries were
removed from it), pointing at `Leonxlnx/taste-skill`. After install they
reappear under `.claude/skills/<name>/` and become auto-triggerable again. If
re-installing only a subset, prefer the single most relevant one to avoid the
trigger-overlap that motivated removal.
