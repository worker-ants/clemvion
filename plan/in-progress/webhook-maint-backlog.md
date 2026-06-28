---
worktree: webhook-maint-backlog-f14768
started: 2026-06-28
owner: developer
---

# webhook 하드닝 후속 — 코드 유지보수 백로그 (단위 3)

#765 ai-review(`review/code/2026/06/28/19_15_39/SUMMARY.md`)의 비차단 INFO. **동작 보존**.
별도 PR. 단위 2(D-12, PR #770)와 파일 disjoint — base origin/main(#769).

## 범위

- [x] **M-1** `auth/utils/client-ip.ts`: `extractClientIpFromHeaders` 반환형 `string | null` → `string | undefined`
  로 통일 + JSDoc 갱신. 소비자 전수:
  - `hooks.service.ts` 152·262 `?? undefined` 제거(반환형이 이미 undefined), 201·632 `clientIp ?? undefined` →
    `clientIp` (clientIp 가 `string | undefined` 이므로 4곳 모두 정리).
  - `public-webhook-throttle.guard.ts` 101: `if (!ip)`(falsy) — undefined 와 호환, 변경 불필요(확인).
  - `extractClientIp(req)`(full, req 기반)는 **범위 밖** — 자체 `return null` 유지(auth/* 소비자는 `?? undefined`
    그대로). 본 변경은 헤더 전용 코어만.
- [x] **M-2** `http-exception.filter.spec.ts` 테스트 갭 보강 (분기는 이미 구현 — 동작 보존, 테스트만):
  - QueryFailedError(driverError.code `23505`) → 409 `RESOURCE_CONFLICT` 분기.
  - nested `{ error: { code, message, details } }` 봉투 인식 분기.
  - 5xx(매핑 안 된 Error) → generic 500 마스킹 + `requestId` 단언.
- [x] **M-3 (선택)** `getActiveExecutionStatus`(hooks.service:887)의 `this.executionsService['executionRepository']`
  private 브래킷 접근 → `ExecutionsService.getStatusById` 공개 메서드로 대체. 동작 보존. (테스트 mock 은
  getStatusById 를 executionRepository.findOne 에 위임시켜 사이트 무변경.)

## 범위 밖
- **W14 guard.spec `__publicWebhookTrigger` 단언**: 단위 2(PR #770)에서 noIp 경로에 이미 추가됨 → 중복/충돌
  회피 위해 본 PR 에서 생략.
- `handleChatChannelWebhook` command-kind 핸들러 분리 — 별도 대형 리팩터.

## 워크플로 (developer)
- [x] `/consistency-check --impl-prep spec/5-system/` — `review/consistency/2026/06/28/22_10_21` BLOCK:NO (WARNING 전부 단위 3 무관 pre-existing)
- [x] TDD: 테스트 선작성 → 구현
- [x] TEST WORKFLOW lint·unit(48)·TS build 통과. **build:docker·e2e 는 docker.io 레지스트리 인프라
  (`node:24-alpine`/`flyway:10-alpine` manifest fetch DeadlineExceeded)로 로컬 미실행 — 사용자 docker-infra
  진행 기조로 PR CI 위임.**
- [x] `/ai-review` (`review/code/2026/06/28/22_30_54`) RISK:MEDIUM, Critical 0, Warning ~10 → W-1·2·3·4·5·6·7·9
  + INFO 4·5·6·10·11 반영(RESOLUTION.md). W-8 오탐, W-10 backlog.
- [x] `/consistency-check --impl-done` — `review/consistency/2026/06/28/22_49_52` BLOCK:NO (WARNING=plan 체크박스, 본 커밋 해소)
- [ ] push + PR

## Followup 이월
- (선택) error-handling §1.3/Rationale 에 "race-window 23505 → RESOURCE_CONFLICT(409) 필터 변환" 문장 추가(spec polish, --impl-done INFO-2).
- backlog: HooksService SRP 분리, getActiveExecutionStatus 인메모리 캐시(busy conversation).
