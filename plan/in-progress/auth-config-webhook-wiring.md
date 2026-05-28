---
worktree: .claude/worktrees/auth-config-webhook-wiring
started: 2026-05-28
owner: developer
status: in-progress
---

# Webhook 인증 AuthConfig vault 로 wiring + AuthConfig 도메인 보강

> Plan SoT: `/Users/gehrig/.claude/plans/lucky-seeking-dawn.md` (Plan v2)
> 사용자 결정 5건은 plan Context 섹션 참고. 본 진행 메모는 phase 진척·결정·미해결 항목 추적 전용.

## Phase 0 — Spec 선행 갱신

위임처: `project-planner` skill (사용자 confirm).
대상 7파일 + 1 detail (`PROJECT.md §변경 유형 매트릭스` 동반 행 추가):

- [ ] `spec/1-data-model.md` §2.17 AuthConfig — type enum (`hmac` 추가, `none` 제거), type 별 config JSONB schema sub-section, secret prefix 컨벤션, 마스킹 정책.
- [ ] `spec/5-system/12-webhook.md` §2.1/§2.2/§3.1/§4/§7 + Rationale (inline path 폐지).
- [ ] `spec/5-system/1-auth.md` §3.2 권한 매트릭스 (AuthConfig reveal Admin+), §4.1 audit 카테고리 (`auth_config.reveal`).
- [ ] `spec/2-navigation/6-config.md` Part A (hmac 행, basic_auth UI, 마스킹, Reveal flow), §3 API (`POST /:id/reveal`).
- [ ] `spec/2-navigation/2-trigger-list.md` NAV-TR-10 + §3 API (rotate-secret deprecate).
- [ ] `spec/data-flow/10-triggers.md` (인증 분기 단순화 + last_used_at).
- [ ] `spec/conventions/secret-store.md` cross-ref.
- [ ] `/consistency-check --impl-prep spec/5-system/12-webhook.md spec/2-navigation/6-config.md spec/1-data-model.md` 의무 실행.

## Phase 1~7 — Plan SoT 참고

Phase 1 (migration 2개) / Phase 2 (AuthConfig 도메인 TDD) / Phase 3 (webhook 경로 TDD) / Phase 4 (trigger cleanup) / Phase 5 (frontend trigger UI) / Phase 6 (/authentication + i18n + user guide) / Phase 7 (verification).

## Side effect 추적

- 패키지 매니저: PROJECT.md SoT = **npm** (plan v2 의 pnpm 표기는 정정).
- e2e 의무: 본 PR 은 코드 변경 포함 — 면제 없음.
- DOCUMENTATION 매트릭스: "인증·권한·세션 흐름 변경 → `07-workspace-and-team/` + e2e" 행에 해당. 본 PR 은 webhook auth + AuthConfig 페이지 변경이므로 매트릭스 적용 — user guide 동반 갱신 의무 (Phase 6 에서 처리).
- `spec/conventions/spec-impl-evidence.md` frontmatter 가드: AuthConfig 신규 API (reveal) 등록 시 spec frontmatter `code:` 글로브 확인.

## 미해결·후속

- AuthConfig `last_used_at` 의 race 무시 정책 — 추후 통계 정확도 PR 에서 재논의 (Plan out-of-scope).
- secret rotation 자동 정책 — out of scope.
- IP whitelist 의 webhook 수신 시 시행 — out of scope.

## 결정 로그

- 2026-05-28 — 사용자 confirm 5건 (Plan Context 참고).
- 2026-05-28 — Phase 0 spec 갱신은 project-planner 위임 (CLAUDE.md 그대로).
