# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실 코드 변경은 e2e 테스트 1케이스(schedule-trigger D)에 국한되고 CRITICAL 은 없으나, 3라운드에 걸친 수정 이력 중 코드는 갱신되고 JSDoc·인라인 주석·plan 문서가 그 갱신을 따라가지 못해 자기모순 3건이 남았고, 판정 로직 자체도 연 1회 약 2분 구간에서 false GREEN(뮤턴트 이탈) 가능성이 testing 리뷰로 새로 지적됐다. forced 화이트리스트 7명(security·requirement·scope·side_effect·maintainability·testing·documentation) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 2라운드 조치(옛 값 비교 완전 제거)가 「거짓 실패(false RED)」는 막았지만, 판정이 순수 wall-clock 창(하한 -30s/상한 +90s + 초=0)에만 의존하게 되어 생성 cron(`0 0 1 1 *`)의 다음 실행값과 우연히 겹치는 연 1회 약 2분 구간(KST 12/31 23:58:30~01/01 00:00:30 근방)에서는 재계산이 전혀 일어나지 않아도(서비스 회귀 상태에서도) 모든 단언이 통과한다 — false GREEN(뮤턴트 이탈). 1라운드 RESOLUTION 이 "이 경계가 판정에서 빠졌다"고 결론 내린 것과 배치되는 실측 가능한 반증 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:290, 296-321, 319-320` | `jest.useFakeTimers().setSystemTime(...)` 로 연말 경계를 직접 재현해 뮤턴트 판별을 확인하거나, 최소한 JSDoc:290 의 "이 창 밖으로 떨어진다"는 절대 진술을 "거의 항상"으로 낮추고 잔존 창을 명시. 근본 해법은 이미 백로그에 있는 `computeNextRuns` spy 기반 단위 테스트(`plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4937`) |
| 2 | Documentation | 클래스 JSDoc 290행("재계산이 아예 없었다면 값은 생성 cron 의 것 ... 이 창 밖으로 떨어진다")이 바로 두 줄 뒤 292-294행("옛 값과 비교하지 않는다 ... 두 cron 의 다음 실행이 같아지는 순간이 있으면 그 순간에 거짓 실패한다")과 정면으로 모순 — 삭제된 `originalNext` 단언의 반증된 전제가 같은 커밋(`b40b5b98f`)에 그대로 남음 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:290` vs `:292-294` | 290행을 "그 비교 자체가 신뢰할 수 없어 하지 않는다"는 취지로 정정하거나 292-294행과 중복되므로 삭제 |
| 3 | Documentation | 인라인 주석 315-317행("판별 대상인 생성 cron 값은 몇 달 뒤라 여유를 넓혀도 갈린다")이 2라운드에서 완전히 삭제된 `originalNext > patchedAt + 90_000` 단언의 근거였는데, 그 단언이 사라진 지금 가리키는 코드가 없는 채로 남음 — 현재 두 `expect()`는 `patchedAt` 기준으로만 판정하고 생성 cron 값과 비교하지 않음 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:315-317` | 해당 절 삭제, "여유 30초는 e2e 부하 몫이다. 초 자리가 0인지도 본다" 로 좁혀 실제 남아있는 두 단언만 설명하도록 정정 |
| 4 | Requirement / Documentation | plan 「## 할 것」 §2("생성 cron 의 값은 그 창 밖임을 함께 단언한다")와 체크리스트 (2)("새 «1분 안» 단언 홀로 잡는다")가 1라운드 중간 설계를 그대로 남겨, 2라운드에서 그 단언 자체가 반증되어 완전히 제거된 사실(코드 JSDoc:292 "옛 값과 비교하지 않는다")과 정면으로 어긋남. 이 plan 은 완료 시 `plan/complete/` 에 그대로 보존되므로 지금 정정하지 않으면 모순이 완료 기록으로 고착 | `plan/in-progress/schedule-cron-flake.md:33-34, 52-53` | `--impl-done` 전에 「생성 cron 값과 비교」 절을 삭제하거나, 취소선+각주로 "2라운드에서 같은 결함 클래스 재발로 폐기(근거: `review/code/2026/09/20/12_17_18/testing.md` WARNING 1, RESOLUTION W1)" 로 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | spec 문서(`spec/2-navigation/3-schedule.md` §2.1/§4, `5-system/4-execution-engine.md`, `data-flow/10-triggers.md`) 어디에도 PATCH 후 nextRunAt 재계산의 타이밍 허용오차(1분 이내·초 자리 0 등)를 규정하는 문장이 없음 — spec 위반은 아닌 회색지대 | `spec/2-navigation/3-schedule.md` §4 API 표(PATCH 행) | planner 판단 시 참고, 조치 불요 |
| 2 | Testing | `SchedulesService.update()` 의 cron/timezone 변경 → nextRunAt 재계산 happy-path 에 결정적 단위 테스트가 없어 이 e2e 케이스 하나에 전적으로 의존(이미 트래커 등재, 이번 라운드 신규 지적 아님) | `codebase/backend/src/modules/schedules/schedules.service.spec.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4937` | 백로그 항목 그대로 진행, 재등재 불요 |
| 3 | Side Effect | D 케이스가 PATCH 로 등록한 실제 매분(`*/1 * * * *`) cron 트리거를 정리(DELETE)하지 않아 e2e 컨테이너 생존 기간 계속 발화 — 1·2라운드부터 있던 기존 패턴, 이번 diff 신규 아님, plan 비대상 범위 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:296-332`, `afterAll`(55행) | 조치 불요(스코프 밖) |
| 4 | Side Effect | `review/code/2026/09/20/{11_54_10,12_17_18}/_retry_state.json` 에 워크트리 절대경로 다수 하드코딩 — orchestrator 표준 포맷, 1·2라운드도 동일 처분(조치 불요) | 두 `_retry_state.json` 의 `session_dir`/`prompt_file`/`output_file`/`router_*` 필드 | 조치 불요(기존 관례) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음 — 인젝션·시크릿·인증/인가·의존성 표면 모두 해당 없음 |
| requirement | LOW | plan 「## 할 것」 stale directive(WARNING 4) + spec 타이밍 회색지대(INFO 1). 핵심 결함 클래스(연말 겹침 거짓 실패)는 최종 코드에서 해소 확인 |
| scope | NONE | 발견사항 없음 — diff 33개 파일이 D 케이스 단일 리팩터 + plan/review 산출물로 정확히 국한됨을 재확인 |
| side_effect | NONE | 실질 위험 없음 — 전역 상태·네트워크·인터페이스 변화 없음. 기존 패턴 2건은 INFO 로 재확인만 |
| maintainability | NONE | 2라운드에서 지적된 매직넘버 중복 해소 확인, 신규 발견 없음. 오히려 단언 구조가 이전보다 단순해짐 |
| testing | LOW | wall-clock 창 기반 판정이 연 1회 약 2분 구간에서 false GREEN(뮤턴트 이탈) 가능(WARNING 1) — 발생 확률 극히 낮으나 방향이 반전된 같은 결함 클래스 |
| documentation | LOW | JSDoc·인라인 주석 자기모순 2건(WARNING 2,3) + plan stale directive(WARNING 4, requirement 와 중복 통합). 1·2라운드가 잡은 인용 오류·조기 완료 선언은 실제로 정정됐음을 재확인 |

## 발견 없는 에이전트

security, scope, maintainability

## 권장 조치사항

1. `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 JSDoc(290행)과 인라인 주석(315-317행)을, 실제로 존재하는 코드(옛 값과 비교하지 않는다)와 일치하도록 정정한다 — 반증된 전제("생성 cron 값은 창 밖")를 삭제/수정 (WARNING 2, 3).
2. `plan/in-progress/schedule-cron-flake.md` 「## 할 것」§2 및 체크리스트 (2)를 2라운드 최종 구현과 일치하도록 갱신한다 — 폐기된 접근("생성 cron 값과 비교")을 취소선/각주로 명시하고 폐기 근거를 인용한다. `plan/complete/` 이동 전 필수 (WARNING 4).
3. testing WARNING 1(연 1회 ~2분 false GREEN 창)을 `jest.useFakeTimers` 로 재현해 뮤턴트 판별을 검증하거나, 최소한 JSDoc 의 절대 진술("이 창 밖으로 떨어진다")을 완화한다. 근본 해법인 `computeNextRuns` spy 기반 단위 테스트(이미 백로그 등재)의 우선순위를 검토한다.
4. (선택, 낮은 우선순위) spec 문서에 PATCH 재계산 타이밍 허용오차를 명시할지 planner 가 판단한다 (INFO 1).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 표 (아래, 7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원, 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff(e2e 테스트 비교 로직 + 문서) 범위 밖 |
  | architecture | router 판단 — 아키텍처 변경 없음 |
  | dependency | router 판단 — 신규/변경 의존성 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 로직 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음(서비스 코드 불변) |
  | user_guide_sync | router 판단 — 사용자 가이드 대상 변경 없음 |
