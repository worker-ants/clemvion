# 변경 범위(Scope) 리뷰

## 작업 의도 파악

이번 리뷰 대상은 **consistency-check(16_28_07) W-3 fix(TERMINAL_STATUSES 상수명 충돌)와 W-1 fix(큐 모니터링 미등록) 적용** 및 그에 수반된 review 산출물·spec 보완을 포함하는 커밋이다.

---

## 발견사항

### [INFO] 파일 1 (interaction-token.service.ts) — RECONCILE_TERMINAL_STATUSES 상수 rename
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` diff L35–53
- 상세: consistency-check W-3 (같은 `external-interaction/` 폴더 내 `TERMINAL_STATUSES` 동명 중복) fix 로 상수명이 `TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES` 로 변경됐다. JSDoc 주석도 용도 차이(SQL `IN` 절용 배열 vs `interaction.service.ts` 의 `ReadonlySet`) 설명으로 보강됐고, 참조 위치(`where` 절) 도 함께 갱신됐다. 이름 변경 이유가 명확히 추적되며 동작 변화 없음. 범위 내.
- 제안: 없음.

### [INFO] 파일 2 (system-status.constants.ts) — 큐 모니터링 등록
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` diff L72–77
- 상세: consistency-check naming_collision W-1 fix(`MONITORED_QUEUES` 미등록) 에 직접 대응한다. `TERMINAL_REVOKE_RECONCILE_QUEUE` import 추가와 `MONITORED_QUEUES` 배열 항목 추가 — 두 변경 모두 fix 범위 내. 다른 큐 항목 수정 없음. 범위 내.
- 제안: 없음.

### [INFO] 파일 3 (system-status.e2e-spec.ts) — EXPECTED_QUEUE_NAMES 동기화
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` diff L111
- 상세: `system-status.constants.ts` 주석에 "큐 추가 시 e2e 목록도 갱신" 이 명시되어 있으며, 이 변경이 그 의무를 이행한 것이다. 한 줄 추가, 기존 항목 수정 없음. 범위 내.
- 제안: 없음.

### [INFO] 파일 36 (spec/5-system/14-external-interaction-api.md) — 부팅 정책 문단 추가
- 위치: `spec/5-system/14-external-interaction-api.md` diff (R15 잔여 위험 문단 뒤 `**부팅 정책**` 단락 삽입)
- 상세: rationale_continuity checker(16_43_08) INFO 제안("scheduler 등록 실패 = fail-fast 정책을 R15 에 한 문장 추가") 에 대응한다. 내용은 기존 구현 동작을 사후 문서화하는 수준이며 over-engineering 이 아니다. 범위 내.
- 단, `spec/` 파일 쓰기 권한은 `project-planner` 에게 있으며(`CLAUDE.md` Skill 체계), developer 가 직접 수정했을 경우 권한 분리 위반에 해당하나 이는 scope 리뷰 범위 밖이다. 범위(내용) 관점에서는 이탈 없음.
- 제안: 없음.

### [INFO] 파일 37 (spec/data-flow/0-overview.md) — 큐 카탈로그 업데이트
- 위치: `spec/data-flow/0-overview.md` diff (큐 수 15→16 갱신, §4 카탈로그 테이블 1행 추가)
- 상세: naming_collision W-1 fix 제안 "(1) spec/data-flow/0-overview.md §4 카탈로그에 terminal-revoke-reconcile 행 추가" 에 대응한다. 기존 큐 항목 수정 없음. 범위 내.
- 제안: 없음.

### [INFO] review/ 산출물 파일들 (파일 4~35) — 프로젝트 규약에 따른 산출물
- 위치: `review/code/2026/06/14/16_17_36/` 및 `review/consistency/2026/06/14/16_28_07/`, `16_43_08/` 하위 파일들
- 상세: CLAUDE.md 및 plan-lifecycle.md 규약에 따라 ai-review·consistency-check 산출물이 커밋에 포함된다. 규약 내 의도적 포함.
- 제안: 없음.

---

## 요약

이번 변경 세트는 consistency-check(16_28_07)의 실질 발견사항 W-3(TERMINAL_STATUSES 동명 충돌 → RECONCILE_TERMINAL_STATUSES rename)·W-1(큐 모니터링 미등록 → system-status.constants.ts + e2e 목록 동기화) fix와, rationale_continuity(16_43_08) INFO 제안(부팅 정책 문단 추가) 이행, 큐 카탈로그 spec 업데이트로 구성된다. 변경된 코드 파일 3개(interaction-token.service.ts, system-status.constants.ts, system-status.e2e-spec.ts)와 spec 파일 2개(14-external-interaction-api.md, data-flow/0-overview.md), review 산출물 파일 다수 모두 명시된 fix·보완 항목에 1:1 대응한다. 의도 외 추가 리팩토링, 무관한 기능 확장, 불필요한 포맷팅 혼입, 의도하지 않은 임포트 변경은 발견되지 않았다.

## 위험도

NONE
