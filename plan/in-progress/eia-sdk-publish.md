---
worktree: eia-sdk-publish-<slug>
started: 2026-05-21
owner: developer
---

# EIA — `@workflow/sdk` npm publish 정책

> 작성일: 2026-05-21
> 상위: [`plan/complete/external-interaction-api.md`](../complete/external-interaction-api.md) §"완료 후 잔여"
> 관련: `codebase/packages/sdk/` (PR #231, #236 머지본)

## 배경

PR2 (#230) 가 `@workflow/sdk` 0.1.0 패키지를 신설. v0 alpha 단계로 외부 npm publish 전. publish
정책이 결정되지 않아 follow-up 으로 분리.

## 결정 사항 (확정 — 2026-06-02)

> 사용자 결정: **별도 지정 전까지 internal-only**, scope 는 `@workflow/*` 로 통일.

| # | 항목 | 확정 | 비고 |
|---|---|---|---|
| 1 | **Publish 시점** | **(c) internal-only** — 별도 지정 전까지 monorepo 안에서만 사용 | 외부 publish 는 사용자가 별도 지정 시 재개. 그 전까지 본 plan §2 CI/CD·§5 검증 **착수 보류** |
| 2 | **Registry** | 보류 (internal-only 이므로 N/A) | publish 결정 시 재논의 |
| 3 | **Package scope** | **(a) `@workflow/*`** — `@workflow/sdk` + `@workflow/web-chat` 통일 | web-chat-sdk 도 `@workflow/web-chat` 로 통일 (channel-web-chat-followups A-1 에서 적용) |
| 4 | **버저닝 정책** | **(a) v0.x** — internal 단계 동안 minor breaking 허용 | publish 결정 시 v1 SemVer/마이그레이션 가이드 재논의 |
| 5 | **CI/CD** | **(b) 수동 only** (현재는 publish 자체 없음) | tag-push 자동 publish 는 외부 publish 결정 시 도입 |

### 후속 (외부 publish 결정 시 해제될 작업)

아래 §"작업 단위" 의 CI/CD(§2)·외부 partner 가이드(§4)·publish 검증(§5)은 **internal-only 동안 보류**.
scope 통일(§3)·README(§3 문서)는 즉시 적용 대상.

### (원본) 선택지 보존

1. **Publish 시점**: (a) 즉시 publish (v0.1.0 alpha) / (b) internal QA 후 / (c) v1.0 stable 까지 internal-only ← **채택**
2. **Registry**: (a) public npmjs.com / (b) 사내 private / (c) GitHub Packages public
3. **Package scope**: (a) `@workflow/sdk` ← **채택** / (b) `@clemvion/sdk`
4. **버저닝 정책**: (a) v0.x ← **채택** / (b) 즉시 v1.0 / (c) 마이그레이션 가이드 의무
5. **CI/CD**: (a) tag push 자동 / (b) 수동 only ← **채택** / (c) canary+stable

## 작업 단위

### 1. 결정 사항 합의 — ✅ 완료 (2026-06-02)

위 5건 확정 → §"결정 사항" 표 참조. 결론: **internal-only + `@workflow/*` scope**.

### 2. CI/CD workflow (결정 후)

- [ ] `.github/workflows/sdk-publish.yml` — tag push (`sdk-v*.*.*`) 시 자동 publish
- [ ] `package.json` 의 `publishConfig` — registry 명시
- [ ] `prepublishOnly` script — build + test 강제

### 3. 문서

- [ ] README — 설치·사용 예제 (현재 PR #236 에서 정리됨, scope/registry 결정 시 보강)
- [ ] CHANGELOG — release 별 변경 사항 (현재 0.1.0 만)
- [ ] 마이그레이션 가이드 — v0 → v1 시 작성

### 4. 외부 통합 partner 가이드

- [ ] `spec/5-system/14-external-interaction-api.md` 의 "사용 예" 절에 SDK 설치/사용 cross-link
- [ ] 외부 통합 가이드 (`codebase/frontend/src/content/docs/06-integrations-and-config/external-interaction-sdk.mdx`?) 신설 — partner 가 어떤 흐름으로 시작하는지 안내

### 5. 검증

- [ ] dry-run publish (`npm publish --dry-run`)
- [ ] CI workflow 의 secret (NPM_TOKEN / GHCR_TOKEN) 설정 확인
- [ ] 외부 환경에서 설치 → 기본 흐름 (triggerWebhook → interact) 동작 확인

## 수용 기준

- 결정된 registry 에서 `npm install @workflow/sdk` (또는 합의된 scope) 동작
- CI 가 tag push 시 자동 publish 성공
- README + spec cross-link 으로 외부 partner 가 자체 시작 가능

## 비고

- ~~본 plan 은 결정 사항 5건이 충족되기 전까지 착수 불가.~~ → 결정 완료(2026-06-02).
  **internal-only** 결론에 따라 CI/CD(§2)·외부 partner 가이드(§4)·publish 검증(§5)은 외부 publish
  결정 시점까지 보류. scope 통일만 즉시 반영(`@workflow/web-chat`).
