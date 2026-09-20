# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0, WARNING 1건(testing: `affected === 0` 판정 근거의 `null`/`undefined` 처리 미검증). Forced 화이트리스트(7명) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `affected === 0` 명시 비교가 `null`/`undefined`("모른다")를 `0`("없다")과 다르게 처리한다는 이번 커밋(`2879e88c7`)의 핵심 설계 근거를 실행 검증하는 테스트가 없다. 스위트에 등장하는 `affected` 값은 `0`·`1` 뿐이라 `=== 0` → `!affected` 로 되돌리는 뮤턴트가 32개 테스트 전건 GREEN 으로 생존한다. 자매 함수 `rewriteTriggerConfigLocked` 는 정확히 이 형태(`for (const affected of [undefined, null])`)의 전용 테스트를 갖고 있어 형태 대칭이 깨져 있다. 판정 로직이 이미 두 번(1라운드 `!affected` 도입 → 2라운드 `=== 0` 전환) 고쳐졌고 같은 자리가 세 번째로 틀릴 표면이 열려 있다. | `codebase/backend/src/modules/schedules/schedules.service.ts:342`(트리거 삭제 판정), `:380`(방어 분기 판정); 대응 테스트 `codebase/backend/src/modules/schedules/schedules.service.spec.ts`(이번 커밋 미변경) | 두 판정 지점 각각에 `mockResolvedValueOnce({ affected: undefined } as unknown as DeleteResult)`(및 `null`) 케이스를 추가해 `service.remove(...)` 가 404 를 던지지 않고 정상 resolve 함을 단언. `trigger-config-lock.spec.ts:176-185` 와 대칭 형태로 `for (const affected of [undefined, null])` 루프 사용 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | 동시 DELETE 의 "진 쪽" 응답이 204 → 404 로 바뀌는 관측 가능한 API 동작 변화 — 이 PR 의 의도된 목적이며 CHANGELOG/plan/e2e 로 명시 | `schedules.service.ts:342`, `:380` | 조치 불요 — 의도된 변경. `3-schedule.md §4` 서술 격차는 이미 트래커 등재. |
| 2 | side_effect | `NotFoundException` 발생 시 `Logger.error` 호출을 건너뛰어 "반쯤 삭제" 거짓 경보를 억제 — 신규 테스트가 `not.toHaveBeenCalled()` 로 계약 고정 | `schedules.service.ts:348` | 조치 불요. |
| 3 | requirement, side_effect, database, concurrency | `triggerId` 없는 방어 분기(`scheduleRepository.delete` 판정)는 `Schedule.triggerId` NOT NULL 제약상 현재 프로덕션에서 도달 불가한 방어 코드. 코드 주석·테스트가 이 사실을 일관되게 명시 | `schedules.service.ts:372-381` | 조치 불요 — `triggerId` nullable 전환 시 재검토. |
| 4 | side_effect, concurrency | 락 밖(트랜잭션 이전)에서 실행되는 `scheduleRunnerService.removeJob()` 은 동시 두 요청이 각자 호출 — 형제 PR(#1369/#1370)과 동일한 이미 문서화된 잔여, 이번 diff 의 의도적 비목표 | `schedules.service.ts:308-311` | 조치 불요 — 트래커에 이미 등재된 defer. |
| 5 | scope, maintainability, concurrency, database | `affected` 판정을 `!affected` → `affected === 0` 로 바꾼 것은 새 기능이 아니라 자매 함수 `rewriteTriggerConfigLocked` 의 기존 결정에 맞춘 좁은 정정. `throwScheduleNotFound()` 헬퍼 추출·CHANGELOG 인접 모순 각주 정정도 모두 직전 두 라운드 WARNING 에 대한 응답으로, 별도 커밋으로 분리되어 있고 임의 확장이 아님 | `schedules.service.ts:341-342,375-380,151-156`; `CHANGELOG.md:66-67` | 조치 불요. |
| 6 | requirement, documentation | `spec/2-navigation/3-schedule.md §4` 는 "동시 삭제 → 두 번째 요청 404" 계약을 자신의 API 표에 서술하지 않는다(침묵). `2-trigger-list.md §4.3/§4.4` 가 "트리거 행을 없애는 모든 경로"(스케줄 화면 삭제 포함)에 이를 일반화해 담고 있어 구현 불일치는 아니며, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재되고 이번 세션이 스코프를 확장함 | `spec/2-navigation/3-schedule.md:142` | 조치 불요(이미 추적 중) — SPEC-DRIFT 아님, 완전성 격차. |
| 7 | requirement, documentation | 공유 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)의 `SchedulesService.remove()` 항목이 여전히 `- [ ]` — plan 자신의 체크리스트에도 "트래커 항목 해소 + `plan/complete/` 이동"이 미체크로 남아 있어 세션 마무리 단계 처리로 이미 의도됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4773`; `plan/in-progress/schedule-dup-delete.md` 체크리스트 | 조치 불요(비차단) — 세션 마무리 커밋에서 `[x]` + 해소 각주. |
| 8 | database | CASCADE 경로의 `scheduleRepository.remove(schedule)` 는 트랜잭션 커밋 후 FK CASCADE 로 이미 지워진 행에 대해 항상 0행 no-op — 방어적 이중 삭제, 정합성 문제 아님 | `schedules.service.ts:369-371` | 조치 불요 — 원하면 CASCADE 를 유일 SoT 로 확정하고 제거 가능(선택 사항). |
| 9 | security | 락 안 삭제 실패 시 서버 로그에 `triggerId`·원본 에러 메시지 기록 — 클라이언트에는 노출 안 됨, 이번 diff 이전부터 있던 기존 패턴 | `schedules.service.ts` `.catch` 블록 | 조치 불요. |
| 10 | side_effect | 신규 테스트가 `Logger.prototype.error` 를 spy — 공유 프로토타입이지만 순차 실행 + `try/finally` 복원으로 오염 없음 | `schedules.service.spec.ts` | 조치 불요. |
| 11 | testing | 신규 `remove()` 관련 테스트들이 이름이 무관한 `describe('create — timezone fallback (§2.2)', ...)` 블록 안에 위치(재확인, 신규 아님) | `schedules.service.spec.ts:254` | 조치 불요(비차단, 기존 지적 재확인). |
| 12 | scope | 실질 코드 변경은 4개 파일(`schedules.service.ts`/`.spec.ts`/e2e/`CHANGELOG.md`)뿐, 나머지 38개는 plan/review 표준 워크플로 산출물 | 전체 diff | 조치 불요(정보 제공용). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인가·시크릿·에러노출 전 관점 이상 없음. 서버 로그 내부 정보(triggerId) 기록은 기존 패턴 |
| requirement | NONE | 직전 2라운드 WARNING 6건 전부 실물 대조로 해소 확인. `3-schedule.md §4` 서술 격차는 SPEC-DRIFT 아닌 완전성 격차로 이미 추적 중 |
| scope | NONE | 42개 변경 파일 1:1 대조, 6커밋 모두 좁은 단일 목적. 임의 확장·무관 변경 없음 |
| side_effect | LOW | 204→404 API 동작 변화는 의도된 목적. removeJob 이중호출은 기존 잔여, 신규 부작용 없음 |
| maintainability | NONE | 헬퍼 추출·판정식 전환으로 직전 WARNING 해소. `remove()` 책임 증가는 기존 추적 이슈 |
| testing | MEDIUM | `affected === 0` 의 `null`/`undefined` 처리 근거를 검증하는 테스트 부재(자매 함수 대비 형태 비대칭) |
| documentation | NONE | 직전 2라운드 documentation WARNING 모두 실물 대조로 해소 확인. 인용·근거 정확 |
| database | LOW | 트랜잭션/락/판별자 선택 모두 안전. CASCADE 방어 삭제는 항상 0행 no-op(문제 아님) |
| concurrency | LOW | advisory lock 정상 해제, 판정 전환 자매 함수와 일치. removeJob 중복은 기존 문서화된 잔여 |

## 발견 없는 에이전트

security, requirement, scope, maintainability, documentation — Critical/Warning 급 발견사항 없음(모두 NONE, 방금 위 표 참고).

## 권장 조치사항

1. (WARNING #1, testing) `schedules.service.ts:342`, `:380` 두 판정 지점에 `affected: undefined`/`null` mock 케이스를 추가해 `=== 0` 명시 비교의 존재 이유(드라이버 미보고 시 오판 방지)를 실행 검증할 것 — `trigger-config-lock.spec.ts:176-185` 와 대칭 형태 권장.
2. (INFO #7, 비차단) 세션 마무리 시 `plan/in-progress/spec-draft-nullable-notation-followups.md:4773` 트래커 항목에 `[x]` + 해소 각주를 남기고 `plan/in-progress/schedule-dup-delete.md` 를 `plan/complete/` 로 이동.
3. (INFO #6, 비차단) `spec/2-navigation/3-schedule.md §4` API 표에 트리거 목록 문서와 대칭되는 "동시 삭제 → 두 번째 404" 한 문장 추가는 `project-planner` 소관으로 별도 처리(이미 트래커 등재, 이번 PR 차단 사유 아님).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(단건 PK 기반 DELETE 판정 로직, 신규 쿼리·반복문 없음)에 성능 관점 관련성 낮음 |
  | architecture | 라우터 판단 — 기존 서비스 메서드 내부 판정 로직 수정으로 아키텍처 경계·모듈 구조 변경 없음 |
  | dependency | 라우터 판단 — 신규 의존성 추가 없음(`DeleteResult` 는 기존 `typeorm` export) |
  | api_contract | 라우터 판단 — `schedules.controller.ts`(공개 API 데코레이터) 변경 없음, 응답 코드 변화는 requirement/side_effect 가 커버 |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 문서 대상 변경 없음 |

  forced 전원(7명) 결과 확보되어 강제 화이트리스트 미이행 없음. database·concurrency 는 router 의 일반 선별로 포함된 정상 실행.

---

참고: `SUMMARY.md` 로의 Write 는 하네스 규칙(basename `SUMMARY.md` 정확 일치)에 의해 차단되었다(정상 동작). 개별 reviewer 파일(`security.md`, `requirement.md`, `scope.md`, `side_effect.md`, `maintainability.md`, `testing.md`, `documentation.md`, `database.md`, `concurrency.md`)은 모두 이미 디스크에 존재함을 확인했다(`/Volumes/project/private/clemvion/.claude/worktrees/schedule-dup-delete-6c81d4/review/code/2026/09/21/00_56_52/` 하위) — 별도 영속화 불필요. 호출자가 위 전문을 `SUMMARY.md` 에 멱등 기록해야 한다.
