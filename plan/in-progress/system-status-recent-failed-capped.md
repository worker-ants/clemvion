---
worktree: system-status-recent-failed-86831b
started: 2026-06-03
owner: planner → developer
---

# 시스템 상태 — recentFailed 스캔 캡 초과 시 "N+" 런타임 시그널

> 선행 plan: [`plan/complete/system-status-recent-failed.md`](../complete/system-status-recent-failed.md) (recentFailed 윈도우 지표 본 작업)
> 트리거: 선행 작업 ai-review INFO-5/16 — spec §2.3 "캡 초과 시 N+ 표기 허용" 을 구체 구현으로 승격.

## 배경

선행 작업에서 `recentFailed` 는 큐당 스캔 캡(`SYSTEM_STATUS_FAILED_SCAN_CAP`, 기본 1000) 도달 시 **하한값**으로 반환되지만, 클라이언트가 "이 값이 하한값인지"를 알 길이 없어 UI 가 정확한 값으로 오인할 수 있다. spec §2.3 은 "N+ 표기 허용"(optional)만 명시했고 런타임 시그널은 미구현이었다.

## 목표

스캔 캡에 도달해 `recentFailed` 가 하한값일 때 이를 알리는 boolean 시그널을 노출하고, UI 에서 "N+" 로 표기한다.

## 작업 단위

### Phase 1 — Spec 개정 (planner) ✅
- [x] `spec/5-system/16-system-status-api.md`: DTO 2곳 `recentFailedCapped` additive, §2 캡 설명(캡 소진 시 true + N+), R-5 보강. status partial 격하 + pending_plans.
- [x] `spec/2-navigation/15-system-status.md`: §2.3 N+ 구체화 + Rationale 보강. status partial.
- [x] consistency-check --spec 통과 (BLOCK: NO — WARNING 다수는 base 대비 비교 아티팩트, SUMMARY 에 기록).

### Phase 2 — Backend 구현 ✅
- [x] `system-status.service.ts`: `computeRecentFailed` → `{ recent, capped }` (capped = !crossedWindow && !endOfSet, 즉 캡 소진 종료). `inspect` recentFailedCapped(failed===0 단락 시 false). `getOverview` 집계 OR.
- [x] `dto`: `QueueStatusDto.recentFailedCapped` + `SystemStatusOverviewDto.recentFailedCapped` + @ApiProperty.
- [x] `service.spec.ts`: capped=true(캡 소진), capped=false(윈도우 경계/집합끝/failed===0) 케이스 (23개 통과).

### Phase 3 — Frontend ✅
- [x] `page.tsx`: CountCell `capped` prop("+" suffix), 카드 recentFailed + 헤더 totalRecentFailed 에 N+ 적용. 타입 mirror. (별도 i18n 키 불필요 — "+" 직접 부착)

### Phase 4 — 문서 ✅
- [x] 유저 가이드 mdx KO/EN: 하한값에 "+" 표기 안내 추가.
- [x] e2e 단언: `recentFailedCapped` boolean 타입 확인(overview·queue).

### Phase 5 — 품질 검증
- [x] lint·unit·build·e2e green (resolution fix 후 재통과).
- [x] `/ai-review` (RISK=HIGH 보고됐으나 CRITICAL 2건은 documentation-reviewer 의 base/stale 오독 false positive — HEAD spec 검증으로 확인). WARNING 2 + 고가치 INFO 반영, RESOLUTION.md 기록.
- [ ] plan complete 이동 + spec partial→implemented 재승격 (본 turn 마무리).

## Rationale

- 별도 `recentFailedCapped` boolean 으로 둔 이유: `recentFailed===scanCap` 휴리스틱은 "정확히 캡과 같은 정상 케이스"와 "캡으로 잘린 케이스"를 구분 못 한다. 스캔 종료 사유(윈도우 경계/집합끝 vs 캡 소진)를 직접 추적해야 정확하다.
