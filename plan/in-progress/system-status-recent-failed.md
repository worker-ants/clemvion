---
worktree: system-status-recent-failed-86831b
started: 2026-06-03
owner: planner → developer
---

# 시스템 상태 — failed 지표 "최근 윈도우 + 누적(보관 중)" 병기

> 관련 spec: [`spec/5-system/16-system-status-api.md`](../../spec/5-system/16-system-status-api.md) · [`spec/2-navigation/15-system-status.md`](../../spec/2-navigation/15-system-status.md)
> 트리거: 사용자 피드백 — `/system-status` 의 failed 지표가 "전 기간 누적"처럼 보여 "현재 상태"로 읽기 애매함.

## 배경

현재 `/system-status` 의 `failed` / `totalFailed` 는 `queue.getJobCounts('failed')` 기반이다. 이 값은 lifetime 누적이 아니라 **각 큐의 `removeOnFail` 보관기간 내 "보관 중 실패 잡 수"** 다 — 큐별 정책이 제각각:

- `execution-continuation`: `removeOnFail: false` → 무한 보관 (DLQ)
- `background-execution`: `removeOnFail: 100` → 최근 100건
- `notification-webhook`: 7일 · `cafe24-token-refresh`: 5분 · cron 류: 30일

스냅샷성 지표(waiting/active/delayed/paused/utilization)는 이미 "현재 상태"라 윈도우가 무의미하다. **누적성 지표는 `failed` 하나뿐**이라 이것만 손본다.

## 목표

1. 실패 카드의 주 수치를 **최근 윈도우(기본 60분) 내 실패 수(`recentFailed`)** 로 표시.
2. 그 옆에 기존 **누적(보관 중) 수(`failed`)** 를 부 수치로 병기.
3. health(degraded) 판정의 failed 체크를 `recentFailed` 기준으로 변경 → 오래된 보관 실패로 영구 degraded 되던 문제 해소.

## 확정된 결정

- **윈도우**: 기본 60분, env `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`. UI 선택 메뉴 없음(단일 고정).
- **health**: degraded 의 failed 임계를 `recentFailed >= SYSTEM_STATUS_FAILED_THRESHOLD` 로. delayed 규칙 불변. (사용자 합의 — 동작 변화)
- **누적 라벨**: "누적(보관 중)" 으로 표기 (진짜 lifetime 아님을 명확화).

## 작업 단위

### Phase 1 — Spec 개정 (planner, 본 turn) ✅
- [x] `spec/5-system/16-system-status-api.md` (`status: partial` + pending_plans)
  - [x] DTO additive: `QueueStatusDto.recentFailed`, `SystemStatusOverviewDto.totalRecentFailed` · `failedWindowMinutes`. 기존 `failed`/`totalFailed` 는 "보관 중 누적" 의미 유지.
  - [x] §3 health: failed 임계 체크를 `recentFailed` 기준으로 (env↔상수 매핑·의미변경 주의 노트 포함).
  - [x] §2 비용 노트: `getFailed()` newest→역순 스캔 추가로 "큐 수 비례 상수" 깨짐 명시 + 큐당 스캔 캡(`SYSTEM_STATUS_FAILED_SCAN_CAP` 기본 1000) + 캡 초과 시 하한("N+").
  - [x] Rationale R-5 추가 (상수 비용 번복 근거·R-2 대조·health 트레이드오프 포함).
- [x] `spec/2-navigation/15-system-status.md`: §1 ASCII·§2.2·§2.3 병기 반영, R-3 신설 (`status: partial` + pending_plans).
- [x] `spec/2-navigation/_product-overview.md`: NAV-SS-07/08 추가. `spec/5-system/_product-overview.md`: NF-OB-06 동기화.
- [x] consistency-check --spec 통과 (BLOCK: NO — `review/consistency/2026/06/03/08_32_33/`).

### Phase 2 — Backend 구현 (developer 후속 turn)
- [ ] `system-status.constants.ts`: `getFailedWindowMinutes()` getter + 스캔 캡 상수.
- [ ] `dto/system-status-response.dto.ts`: 신규 필드 + `@ApiProperty`.
- [ ] `system-status.service.ts`: `QueueHandle` 의 `Pick<Queue,...>` 에 `getFailed` 추가; newest→역순 스캔으로 `finishedOn >= now - windowMs` 카운트(캡 적용); `recentFailed`/`totalRecentFailed`/`failedWindowMinutes` 산출; `deriveHealth` 를 `recentFailed` 기준으로.
- [ ] `system-status.service.spec.ts`: `getFailed` mock — 윈도우 경계/캡 초과/health(recentFailed 기준) 케이스.

### Phase 3 — Frontend 구현 (developer 후속 turn)
- [ ] `page.tsx`: 타입 mirror 갱신(`recentFailed`/`totalRecentFailed`/`failedWindowMinutes`); 실패 카드 — 주 수치 `recentFailed`("최근 N분") + 부 수치 `counts.failed`("누적 보관"); OverallHeader 에 `totalRecentFailed`(주)·`totalFailed`(부) 병기; 캡 초과 "N+" 표기.
- [ ] i18n `dict/{ko,en}/systemStatus.ts`: 신규 라벨 + **기존 `systemStatus.counts.failed` 라벨 값을 "실패(누적 보관)" 의미로 변경**.

### Phase 검증 메모 (consistency 보강)
- `partial` 전환 후 `spec-code-paths.test.ts` 통과 확인(기존 `code:` glob 매치 유지).
- 구현 완료 + 본 plan `complete/` 이동 commit 에서 두 spec `partial → implemented` 승격.

### Phase 4 — 문서 동반 갱신 (developer 후속 turn)
- [ ] `content/docs/07-workspace-and-team/system-status.mdx` + `.en.mdx`: 최근 윈도우/누적 병기 설명 반영 (doc-sync 매트릭스 대상).

### Phase 5 — 품질 검증 (developer 후속 turn)
- [ ] backend/frontend 빌드 + 테스트 그린.
- [ ] `/ai-review` 의무 수행 + Critical/Warning fix.

## Rationale

- failed 만 손보는 이유·다른 지표가 윈도우 무의미한 이유: 본 plan 배경 + spec R-5.
- 전역 기간 선택 메뉴를 두지 않은 이유: 12개 지표 중 누적성은 failed 하나뿐이라 전역 메뉴는 "모든 수치가 윈도우된다"는 오해를 유발. 사용자와 합의해 failed 카드 한정으로 축소.
