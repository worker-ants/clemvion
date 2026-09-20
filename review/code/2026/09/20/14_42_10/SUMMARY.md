# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경 0(테스트 파일 1건만 변경), Critical 없음. 1라운드 WARNING 2건(재계산 게이트 「둘 다 거짓」 분기 미검증, `scheduleRow()` 팩토리 미적용 중복)은 커밋 `ae060b266`으로 실제 해소됐음을 requirement/scope/testing/documentation 4개 리뷰어가 각각 독립 확인(testing 은 `if (true)` 뮤턴트 직접 재현으로 RED 확인). 신규 WARNING 1건은 이 조치 사실이 `plan/in-progress/sched-recalc-unit.md` 원문에는 반영되지 않아 plan 서술("뮤턴트 셋 전부")이 실제보다 좁다는 문서 갭. forced 화이트리스트(7명) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | plan 문서의 뮤턴트 목록·체크리스트가 같은 작업의 1라운드 WARNING 조치(`ae060b266`, 게이트를 통째로 무력화하는 네 번째 표면용 대조군 테스트)를 반영하지 않는다. `## 할 것`은 "두 항이 각각 표면"이라는 반쪽 설계를 그대로 서술하고, `## 테스트`는 뮤턴트 3개만 나열하며, 체크리스트는 "뮤턴트 셋 전부 RED"라고 확정 서술한다 — 정작 RESOLUTION.md 는 이 설계가 "반쪽이었다"고 스스로 인정했는데 그 정정이 plan 원문에는 없다 | `plan/in-progress/sched-recalc-unit.md:45-47`(뮤턴트 목록), `:54-55`(체크리스트) | `## 테스트` 뮤턴트 목록에 네 번째 항목("게이트 조건을 `if (true)`로 무력화 → 대조군 테스트 RED, 커밋 `ae060b266`") 추가, `## 할 것`에 1라운드 리뷰로 드러난 정정을 취소선 없이 덧붙임, 체크리스트에 커밋 해시 기록. 이 plan 은 아직 `--impl-done`/`plan/complete/` 이전 단계라 고칠 기회가 남아 있음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항/테스트 | cron **과** timezone 을 **동시에** 바꾸는 PATCH 조합의 전용 단위 테스트가 없음(MC/DC 상 필수는 아니나 "두 값 모두 갱신 후 값으로 호출되는지"는 어떤 테스트도 직접 보지 않음). plan 「비대상」에도 언급 없어 의도적 스코프 축소로 보임 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts` update 관련 테스트 3건(게이트 433, 468, 502) | 낮은 우선순위. 이 영역을 다시 만질 때 조합 케이스 1건 추가 고려 — 이번 diff 를 막을 사유 아님 |
| 2 | 유지보수성/테스트 | `computeNextRuns` spy 캐스트 boilerplate 가 이번 라운드에서 4중 중복으로 늘었고, nullary 타입 선언이 실제 3-인자 시그니처(`cronExpression, timezone, count`)와 여전히 불일치. `unknown` 이중 캐스트가 타입체크를 우회해 `tsc --noEmit` 은 통과하지만, 시그니처 변경 시 컴파일타임 경고를 못 받음(런타임 판별력에는 영향 없음) | `schedules.service.spec.ts:408, 442, 477, 513` | 공용 헬퍼(`spyOnComputeNextRuns`)로 추출하고 실제 시그니처에 맞는 타입 지정. 중복이 3→4로 늘었으니 다음에 이 파일을 만질 때 우선순위 상향 고려 |
| 3 | 유지보수성 | `saved` 배열 캡처 4줄 boilerplate 가 이제 4개 `update` 테스트 전부에서 반복 | `schedules.service.spec.ts:399-404, 434-439, 469-474, 504-511` | `captureSaved()` 헬퍼 추출 검토(강제 아님 — 이 파일은 테스트별 명시적 재세팅 스타일을 선호) |
| 4 | 유지보수성 | cron 변경·timezone 변경 두 happy-path 테스트가 변경 필드만 다르고 구조가 라인 단위로 거의 동일 — `it.each` 파라미터화 여지 | `schedules.service.spec.ts:433-462`(cron), `468-496`(timezone) | 강제 아님. 개별 이름이 실패 시 분기를 즉시 드러내는 장점도 있어 현재 형태 유지 근거 있음 |
| 5 | 유지보수성 | 신규 대조군 테스트의 `before` 리터럴(`2020-01-01T00:00:00Z`)이 `scheduleRow()` 기본값과 우연히 동일해, 의도(팩토리 기본값 변경에도 전제가 안 깨지도록 명시적으로 고정)가 주석 없이 드러나지 않음 | `schedules.service.spec.ts:502-507` (팩토리 기본값 `:379`) | 의도를 설명하는 한 줄 주석 추가, 또는 기본값과 다른 임의 날짜 사용 |
| 6 | 유지보수성 | 신규 테스트 3건이 이름-내용이 어긋난 거대 `describe` 블록에 계속 편입되어 블록이 라운드마다 더 커짐(1라운드에서 이미 지적된 기존 구조 문제) | `describe('create — timezone fallback (§2.2)', ...)` (`:248`~파일 끝, 842줄), 최상위 `describe('SchedulesService.runNow', ...)` (`:17`) | 필수 아님. 다음에 `update()` 영역을 크게 만질 때 하위 `describe` 분리 고려 |
| 7 | 문서화 | 신규 네 번째 테스트의 JSDoc 이 근거 인용에서 세션 경로를 생략("1라운드 리뷰가 실측"만 기재) — 바로 위 두 테스트의 JSDoc 은 구체적 경로를 인용해 스타일이 어긋남. 실측 수치("29건 전부 GREEN") 자체는 `review/code/2026/09/20/14_22_46/SUMMARY.md` 와 대조해 일치 확인 | `schedules.service.spec.ts` (현재 줄 494-497) | `(review/code/2026/09/20/14_22_46 W1)` 형태로 세션 경로 추가 — 필수 아님 |
| 8 | 부작용 | 리뷰 도중 `schedules.service.ts:266` 게이트가 순간적으로 `if (true)` 로 뮤테이션된 작업트리 상태를 관측(직후 자체 원복 확인) — 1라운드 SUMMARY 가 이미 같은 형태로 기록한 병렬 세션(뮤턴트 판별력 검증)의 잔상이 2라운드에도 재발. 이번 changeset diff 에는 포함되지 않음 | `codebase/backend/src/modules/schedules/schedules.service.ts:266` | 조치 불요(이번 diff 밖, 자체 원복 확인). 병렬 fan-out 리뷰가 공유 워크트리에서 도는 동안 재발할 수 있는 형태로 기록만 |
| 9 | 부작용 | `jest.spyOn(service, 'computeNextRuns')` 3건(신규 대조군 포함)이 명시적으로 복구되지 않음 — 다만 매 테스트 `beforeEach` 가 새 `service` 인스턴스를 생성해 스파이가 인스턴스 own-property 이므로 다음 테스트로 전이되지 않아 실질 위험 없음(1라운드와 동일 결론) | `schedules.service.spec.ts` 게이트 512행 등 update 테스트 3건 | 조치 불요. 방어적으로 원한다면 `afterEach(() => jest.restoreAllMocks())` 추가 가능 |
| 10 | 부작용 | 커밋된 `_retry_state.json` 2건(`review/code/.../14_22_46/`, `review/consistency/.../14_01_01/`)이 `routing_status: "pending"`, `agents_pending` 전체 목록 등 "미완료" 초기 스냅숏 그대로 남아 있음 — 실제로는 SUMMARY.md 가 완료 결과를 담고 있음. 다만 더 이른 라운드들에도 동일 패턴이 있어 이 diff 가 새로 들여온 문제는 아니고 harness 의 기존 산출 관례로 보임 | `review/code/2026/09/20/14_22_46/_retry_state.json`, `review/consistency/2026/09/20/14_01_01/_retry_state.json` | 조치 불요(기존 관례). 향후 어떤 자동화가 이 스냅숏을 완료 판정에 실사용하게 되면 거짓 차단 위험이 있다는 점만 참고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 코드 변경 0, 시크릿·인증우회·의존성 표면 없음(테스트 파일 mock/fixture 뿐) |
| requirement | NONE | spec(`10-triggers.md` §1.4·§3.2, `3-schedule.md` §4)과 line-level 일치. 1라운드 WARNING 2건 조치를 diff·RESOLUTION 대조로 검증 완료 |
| scope | NONE | 21개 파일 diff 전체가 1라운드 WARNING 조치 + 리뷰 산출물 커밋으로만 구성. 스코프 이탈·드라이브바이 리팩토링·설정/임포트 변경 없음 |
| side_effect | NONE | 이번 diff 자체의 부작용 없음. 병렬 세션의 파일 순간 뮤테이션 재관측(자체 원복, INFO), spy 미복구(실질 위험 없음), `_retry_state.json` 스냅숏 불일치(기존 관례) |
| maintainability | LOW | 1라운드 WARNING(팩토리 미적용 중복) 해소 확인. spy 캐스트·`saved` 캡처 boilerplate 반복이 3→4로 증가(전부 INFO) |
| testing | NONE | `npx jest` 30/30 통과. `if (true)` 뮤턴트 직접 재현으로 WARNING #1 해소를 재검증(RED 확인). 잔여 갭은 전부 INFO |
| documentation | LOW | 1라운드 INFO(JSDoc 배치) 해소 확인. 신규 WARNING: plan 원문이 1라운드 조치로 드러난 설계 정정을 반영하지 않음 |

## 발견 없는 에이전트

- security — 8개 점검 관점 전반에서 보안 결함 없음(확인성 INFO만 존재)
- scope — 스코프 이탈·불필요한 리팩토링·기능 확장 없음(확인성 서술만 존재)

## 권장 조치사항

1. `plan/in-progress/sched-recalc-unit.md` 에 1라운드 조치(`ae060b266`, 게이트 통째 무력화 대조군)를 반영 — `## 할 것`·`## 테스트`·체크리스트 3곳에 정정 추가(원문은 취소선 없이 보존, 인접 서술은 유지). `--impl-done`/`plan/complete/` 이전 단계이므로 지금 반영 가능(문서화 WARNING).
2. (낮은 우선순위, 선택) cron+timezone 동시 변경 PATCH 조합 테스트 1건 추가 검토 — 이번 스코프 밖, 이번 diff 를 막을 사유 아님.
3. (낮은 우선순위, 선택) `computeNextRuns` spy 캐스트를 공용 헬퍼로 추출하고 실제 3-인자 시그니처에 맞게 타입 정정 — 중복이 4곳으로 늘어난 시점에 고려.
4. 그 외 INFO(saved 캡처 반복, happy-path 파라미터화, `before` 리터럴 우연 일치, describe 블록 비대화, JSDoc 인용 경로, 병렬 세션 파일 순간 뮤테이션 재발, spy 미복구, `_retry_state.json` 스냅숏 불일치)는 모두 조치 불요 또는 강제 아님 — 필요 시 다음에 해당 영역을 만질 때 함께 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 프로덕션 로직 변경 없음(테스트 파일만 변경) |
  | architecture | router 판단 — 아키텍처 영향 없음 |
  | dependency | router 판단 — 의존성 변경 없음 |
  | database | router 판단 — DB 접근/스키마 변경 없음(테스트는 전부 mock) |
  | concurrency | router 판단 — 동시성 로직 변경 없음 |
  | api_contract | router 판단 — API/DTO 계약 변경 없음(`spec_impact: none`과 일치) |
  | user_guide_sync | router 판단 — 사용자 대면 문서 동기화 대상 아님 |
