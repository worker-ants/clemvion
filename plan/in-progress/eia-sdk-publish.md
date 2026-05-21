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

## 사용자 결정 사항 (선결 필요)

1. **Publish 시점**: (a) 즉시 publish (v0.1.0 alpha) — early adopter 가 사용 시작 / (b) 일정
   기간 internal QA 후 (예: workspace ↔ external bot 통합 1건 검증 완료 시) / (c) v1.0 stable
   까지 internal-only (monorepo 안에서만 사용)
2. **Registry**: (a) public npmjs.com — 외부 통합 partner 가 자유롭게 설치 / (b) 사내 private
   registry (예: GitHub Packages, Verdaccio) — 통제된 access / (c) GitHub Packages public 영역
3. **Package scope**: (a) `@workflow/sdk` (현재 일관성) / (b) `@clemvion/sdk` (외부 브랜드)
4. **버저닝 정책**: (a) v0.x — minor 도 breaking 가능 (README 현재 명시) / (b) v0 알파 끝나면
   즉시 v1.0 — 이후 strict SemVer / (c) v0 → v1 사이 마이그레이션 가이드 작성 의무
5. **CI/CD**: (a) tag push 시 자동 publish (GitHub Actions) / (b) 수동 publish only / (c) PR
   merge → canary 자동 publish + tag 시 stable

## 작업 단위

### 1. 결정 사항 합의

위 5건 — 사용자 합의 시점에 본 plan 의 §결정 사항 표 채움.

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

- 본 plan 은 결정 사항 5건이 충족되기 전까지 착수 불가. 결정 합의 시점에 §"결정 사항" 표를
  채우고 §"작업 단위" 진행.
