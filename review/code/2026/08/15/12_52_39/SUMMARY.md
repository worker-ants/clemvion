# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. 이 PR 은 오늘 10차 이상 반복 리뷰를 거쳐 대부분 LOW/NONE 로 수렴했으나, (1) side_effect 가 이미 추적 중인 프런트엔드 Duration 컬럼 문제를 MEDIUM 으로 재확인했고, (2) database reviewer 가 이번 라운드에서 **직전 라운드 자신의 판정이 틀렸음을 실측으로 정정**했다 — `finalizeStalledExhausted` 도 Execution+NodeExecution 2-테이블 쓰기인데 트랜잭션 밖에 있어 부분 커밋 시 자식 NodeExecution 이 영구 `RUNNING` 으로 잔류할 수 있다(pre-existing, 이 PR 의 신규 회귀는 아니나 이 PR 이 직접 확장한 함수이고 트래커에도 미등재). forced reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | database | `finalizeStalledExhausted` 가 Execution UPDATE + NodeExecution cascade UPDATE 를 트랜잭션 없이 별도 autocommit 문으로 수행한다. 형제 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)는 같은 패턴을 이미 `dataSource.transaction()`으로 원자화했는데 이 함수만 빠져 있다. 첫 UPDATE 커밋 후 둘째가 실패(DB 오류·크래시)하면 자식 NodeExecution 이 영구 `RUNNING`으로 잔류 — 형제 함수 docstring 이 경고하는 바로 그 실패 모드. pre-existing 구조(이 PR 의 신규 회귀 아님)이나 어느 plan 트래커에도 등재돼 있지 않음 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334`(선언), Execution UPDATE `:3342-3360`, NodeExecution cascade UPDATE `:3374-3389` | 두 UPDATE 를 `dataSource.transaction(async (manager) => {...})`로 형제 두 함수와 동일 패턴으로 통일. 이번 PR 범위 밖으로 유예한다면 최소한 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 근거와 함께 등재 |
| 2 | side_effect | 프런트엔드 "Duration" 컬럼이 취소·타임아웃 경로에서 실제 실행 시간이 아니라 대기 시간을 표시한다(기능은 무해하나 UI 오독 가능). "status 필터만으로 해결 불가"가 이번 라운드에 실측 확인됨(REST `stop()` 취소 경로는 duration 이 진짜 실행시간이라 status 로 못 가름) | `codebase/frontend/.../executions/page.tsx:292`, `.../[executionId]/page.tsx:379`, `run-results-panel/execution-history-panel.tsx:158` | 근본 해법(필드 분리)은 후속 PR 로. CHANGELOG·유저가이드(KO/EN)로 이미 고지, plan 트래커 등재됨 — 이번 PR 차단 사유 아님 |
| 3 | api_contract | REST 재조회(`GET /api/external/executions/:id`)에는 `durationMs` 필드가 없는데 push 이벤트(webhook/SSE/WS) 종결 3종에는 실린다 — 이벤트 유실 후 재조회로 복구하는 클라이언트 패턴에서 필드가 사라지는 스키마 비대칭 | `spec/5-system/14-external-interaction-api.md:575`(필드표), `:453-486`(§5.3 GET 응답 예시) | `ExecutionStatusDto`/projection 에 `durationMs` 추가하는 후속 PR. CHANGELOG·트래커에 이미 고지 — 차단 사유 아님 |
| 4 | api_contract | retry-turn 재진입 중 Stop 시 DB(`COALESCE`로 보존된 T1)와 emit(재계산된 T2) 의 `durationMs`가 어긋난다 — 희귀 레이스가 아니라 일반 흐름에서 결정적으로 재현 | `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기, spec §6.5 "알려진 예외 1건" | CANCELLED 분기에 `.returning(['duration_ms'])` 추가해 emit 직전 실제 persist 값을 되읽는 후속 PR. spec/트래커에 이미 등재 — 차단 사유 아님 |
| 5 | maintainability | `RETURNING` 값 추출(`toFiniteNumber((result.raw as ...)?.[0]?.duration_ms) ?? null`) 표현이 5개 raw-UPDATE 경로에 문자 그대로 반복. `toFiniteNumber`는 `undefined`를 반환하지 않으므로 5곳의 `?? null`은 죽은 코드 | `execution-engine.service.ts:1045-1049,1182-1186,2861-2865,2910-2914,3363-3367` | `terminal-duration.ts`에 `extractReturnedDurationMs(result)` 헬퍼 추출, 죽은 코드 정리 |
| 6 | maintainability | "확정 후 재계산" 대입 관용구(`X.durationMs = resolveTerminalDurationMs(X) ?? X.durationMs;`)가 두 파일 11곳에 손으로 복붙돼 있음 — 헬퍼 도입 취지(분산 스레딩 방지)를 대입 지점 자체는 못 지킴 | `execution-engine.service.ts:639,2415,2579,3566,4296,4756,4884,4945` / `retry-turn.service.ts:714,896,949` | `applyResolvedDuration(entity)` 얇은 in-place 헬퍼로 11곳을 1줄 호출로 축소 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance / maintainability | 완료 경로 다수에서 `resolveTerminalDurationMs`를 같은 인자로 두 번 호출(대입 시점·emit 시점) — O(1) 순수함수라 실질 비용 무시 가능하나 "왜 두 번 계산하는가"를 매번 재확인해야 함 | `execution-engine.service.ts:2415/2426, 3566/3577, 4756/4769, 4884/4888, 4945/4967` 등 | 대입 결과(`savedExecution.durationMs`)를 emit 에서 재사용 |
| 2 | architecture / maintainability | dashboard(`ExecutionStatus.COMPLETED` 파라미터 바인딩) vs statistics(`'completed'` 하드코딩 리터럴) — 같은 "완료만 집계" 필터를 서로 다른 기법으로 구현. enum 값 변경 시 statistics 쪽은 컴파일러가 drift 를 못 잡음 | `dashboard.service.ts:100` vs `statistics.service.ts:97,225` | 강제 아님. 다음 편집 기회에 statistics 도 파라미터 바인딩으로 통일 검토 |
| 3 | testing | `retry-turn.service.spec.ts` 4곳이 `durationMs`를 `expect.any(Number)`로만 검증(값 자체는 미검증, `NaN`도 통과) | `retry-turn.service.spec.ts:691,727,858,894` | 인접 테스트처럼 관계식(`finishedAt-startedAt`) 비교로 통일 권장, 우선순위 낮음 |
| 4 | documentation | `plan/in-progress/eia-terminal-payload.md` "차단 해제 조건" 절이 이미 풀린 BLOCK 을 현재형으로 서술 (9라운드 이상 재확인, 비차단) | `plan/in-progress/eia-terminal-payload.md` | 다음 plan 갱신 시 정리 |
| 5 | documentation / maintainability | `chat-channel/types.ts`의 `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 3곳에 동일 5줄 설명 주석이 문자 그대로 3중 복제 | `types.ts:392-397,415-420,433-438` | 파일 상단 1회 설명 + 필드별 짧은 참조로 축소(강제 아님) |
| 6 | api_contract | 대시보드/통계 `avg` 지표의 **값 정의**가 스키마 변경 없이 "duration_ms 있는 모든 실행"→"완료된 실행만"으로 좁아짐. CHANGELOG 로 고지됨, breaking 아님 | `dashboard.service.ts`, `statistics.service.ts`, `CHANGELOG.md` | 다음 지표 문서 갱신 시 "완료 실행 기준" 라벨/툴팁 반영 검토 |
| 7 | security/database/concurrency | raw SQL 삽입 구간 전부 파라미터 바인딩(`setParameter`)만 사용, 문자열 결합 없음 — SQL 인젝션 표면 없음. `TERMINAL_DURATION_MS_SQL`은 사용자 입력이 아닌 서버 상수 | `terminal-duration.ts:102-105`, execution-engine.service.ts 5개 raw UPDATE 경로 | 없음(현행 유지) |
| 8 | architecture | 직전 라운드가 WARNING 으로 남겼던 "종결 emit 타입 초크포인트 부재"가 이번 라운드에 실제로 plan 체크박스로 등재됐음을 실측 확인(후속 PR 범위) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 없음 — 후속 PR 에서 파사드 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션·시크릿 노출·인가 우회 없음. raw SQL 전부 파라미터 바인딩 |
| performance | LOW | `resolveTerminalDurationMs` 이중 호출(INFO), 그 외 N+1/알고리즘 문제 없음 |
| architecture | LOW | dashboard/statistics 필터 기법 불일치(INFO), 레이어 경계 유지, 순환 의존 없음 |
| requirement | NONE | 9라운드 재검증, 신규 CRITICAL/WARNING 없음, spec fidelity 확인 |
| scope | LOW | 신규 커밋 2개(int4 클램프 마지막 자매 경로 + review 산출물 커밋) 모두 단일 의도 내 |
| side_effect | MEDIUM | 프런트 Duration 컬럼 대기시간 표시(기지, 추적 중), 그 외 신규 side effect 없음 |
| maintainability | LOW | RETURNING 추출·대입 관용구 반복 2건 WARNING, 헬퍼 추출 권고 |
| testing | LOW | 614/614 테스트 통과, 직전 라운드 WARNING 정정 확인, 약한 단언 소수 INFO |
| documentation | NONE | CHANGELOG·plan·유저가이드 정합 확인, 신규 발견 없음 |
| database | LOW | `finalizeStalledExhausted` 트랜잭션 미적용(신규 WARNING, pre-existing) |
| concurrency | NONE | 조건부 UPDATE·트랜잭션 경계 무변경, 신규 race window 없음 |
| api_contract | LOW | REST/push durationMs 비대칭·retry-turn DB≠emit 불일치(기지 WARNING 2건), stop() int4 클램프는 개선 |
| user_guide_sync | NONE | 유일 매칭 trigger(run-debug-flow-change) 이미 KO/EN 양쪽 co-update 완료 |

## 발견 없는 에이전트

security, requirement, documentation, concurrency, user_guide_sync

## 권장 조치사항

1. `finalizeStalledExhausted` 를 `dataSource.transaction()` 으로 원자화하거나(권장), 최소한 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 근거와 함께 등재해 이 PR 이후 추적되게 한다 — 현재 어느 트래커에도 없는 유일한 신규 지적 사항.
2. (후속 PR, 이미 트래커 등재됨) `ExecutionStatusDto`/projection 에 `durationMs` 추가해 REST 재조회-push 스키마 비대칭 해소.
3. (후속 PR, 이미 트래커 등재됨) retry-turn CANCELLED 재진입 분기에 `.returning(['duration_ms'])` 추가해 DB≠emit 값 불일치 해소.
4. (선택, 강제 아님) `terminal-duration.ts` 에 `extractReturnedDurationMs`/`applyResolvedDuration` 헬퍼를 추가해 5곳·11곳 반복 관용구를 축소 — 다음 종결 경로 추가 시 threading 누락 위험을 줄인다.
5. 이번 PR 자체는 위 조치들 없이도 merge 가능한 상태 — 신규 CRITICAL 없음, 기존 WARNING 은 전부 CHANGELOG/spec/plan 트래커에 고지·등재된 기지 항목이거나(4건) 이번 라운드 신규 발견 저위험 pre-existing 구조 문제(1건)다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단(이번 diff 에 의존성 변경 없음) |