# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실 코드 변경은 e2e 테스트 1개 케이스(`schedule-trigger.e2e-spec.ts` "D. PATCH cron → nextRunAt 재계산")에 국한되며 서비스 코드·보안 표면 변경은 없다. 다만 1라운드 리뷰가 지적한 "연 1회 cron 도 분 단위 cron 과 겹치는 1분이 있다"는 결함이 이번 조치에서 **형태만 바뀐 채(오히려 더 넓은 90초 창으로) 재도입**됐고(requirement·testing 중복 지적), 트래커 문서가 아직 끝나지 않은 `plan/complete/` 이동을 앞서 "해소"로 단언한다(requirement·documentation 중복 지적). forced 화이트리스트 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/requirement | 「D. PATCH cron」 케이스에 새로 추가된 `originalNext > patchedAt + 90_000` 단언이, JSDoc 이 "흔들리지 않는다"고 명시한 바로 그 연말 겹침 순간(12/31 23:58:30~23:59:59.999 KST, 연 1회 ~90초 창)에 재계산이 정상이어도 거짓 실패한다 — 1라운드가 제거하려던 결함(옛 `not.toBe(originalNext)`, ~60초/년 창)과 같은 클래스가 더 넓은 창(90초/년)으로 재발했다. 작성자 자신의 뮤턴트 검증 결과상 316~319행("새 cron 이 만드는 값" 범위 단언)만으로 이미 판별력이 충분해, 이 단언은 새 위양성 창만 추가하고 얻는 것이 없다. | `codebase/backend/test/schedule-trigger.e2e-spec.ts:320-323` (단언), `:283-291`/`:289` (모순되는 JSDoc) | 320-323행 단언을 제거(316-319행만으로 회귀 판별 충분, 자체 뮤턴트 검증으로 확인됨)하거나, 유지하려면 JSDoc의 "흔들리지 않는다" 확언을 정정하거나 wall-clock 비교 대신 `computeNextRuns` 호출 spy 등 원인에 가까운 신호로 대체 |
| 2 | documentation/requirement | 트래커가 이 항목을 "2026-09-20 해소 `plan/complete/schedule-cron-flake.md`"로 인용하지만 그 경로에 파일이 없다 — plan 은 아직 `plan/in-progress/schedule-cron-flake.md`에 있고, 그 plan 자신의 체크리스트(`/ai-review` 수렴·`--impl-done`·트래커 해소·`plan/complete/` 이동)가 전부 미완이다. 같은 트래커 파일의 다른 "해소" 인용 3건은 모두 이동이 끝난 뒤에 적힌 선례라 이 항목만 관례를 벗어난다. | `plan/in-progress/spec-draft-nullable-notation-followups.md:4954`(체크박스), `:4960-4962`(해소 인용); `plan/in-progress/schedule-cron-flake.md:56-58`(체크리스트 미완) | `--impl-done` + 실제 `plan/complete/` 이동이 끝난 뒤에 "해소" 문장을 확정하거나, 지금 커밋해야 한다면 시제를 "진행 중"으로 낮추거나 현재 실재 경로(`plan/in-progress/`)로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `NAV-WF-02`를 "planner 항목으로 등재한다"고 적었으나 실제 planner 트래커(`spec-draft-nullable-notation-followups.md` 등)에서 그 문자열로 된 등재 항목을 찾지 못함(자기 자신만 일치) | `plan/in-progress/schedule-cron-flake.md:51` | `plan/complete/` 이동 전에 실제 등재 여부 확인, 안 됐으면 지금 등재하거나 문구를 "등재 예정"으로 |
| 2 | maintainability | 반대 방향 경계 두 곳(`:318` 상한, `:322` 하한)에 같은 매직 넘버 `90_000`이 독립적으로 박혀 있어, 한쪽만 조정되면 판별력이 조용히 깨질 수 있음 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:318,322` | `const windowMs = 90_000` 같은 지역 상수로 추출해 관계를 코드로 강제 |
| 3 | requirement | `getUTCSeconds() === 0` 검증이 초 단위까지만 보고 밀리초는 보지 않음 | `:319` | 완전성 원하면 `getUTCMilliseconds() === 0` 추가 (우선순위 낮음) |
| 4 | requirement | spec fidelity — `spec/data-flow/10-triggers.md` §1.4는 "재계산이 일어난다"만 규정하고 타이밍 세부는 침묵. spec 위반 아님(회색지대) | `spec/data-flow/10-triggers.md` §1.4 | 조치 불요, 참고용 |
| 5 | side_effect | D 케이스가 PATCH 로 등록한 실제 매분(`*/1 * * * *`) cron 트리거를 정리(DELETE)하지 않음 — 다만 이번 diff 이전부터 있던 기존 패턴이며 이번 수정이 새로 도입한 것 아님 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:293-326`, `afterAll`(55행) | 조치 불요(스코프 밖, 기존 패턴) |
| 6 | side_effect | `_retry_state.json`에 워크트리 절대경로가 다수 하드코딩되어 커밋 대상에 포함 | `review/code/2026/09/20/11_54_10/_retry_state.json` 등 | 조치 불요(orchestrator 표준 포맷, 기존 관례) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실 코드 변경은 e2e 테스트뿐, 인증/인가/암호화/입력검증 표면 없음 |
| requirement | LOW | originalNext 창-밖 단언 재도입 플레이크(W1 재발) + 트래커 조기 "해소" 인용 |
| scope | NONE | diff 22개 파일이 프롬프트 목록과 정확히 일치, 무관한 파일 수정 없음 |
| side_effect | NONE | 새로운 부작용 없음(전역상태·env·네트워크 호출 불변), D케이스 cron 잔존은 기존 패턴 |
| maintainability | NONE | 구조·가독성 문제 없음, 매직넘버 중복(INFO)만 |
| testing | LOW | originalNext 단언이 JSDoc "흔들리지 않는다" 확언과 모순, 같은 클래스 플레이크 재도입 |
| documentation | LOW | 코드 JSDoc은 정확하나 트래커 "해소" 표기가 미존재 `plan/complete/` 경로를 시기상조로 인용 |

## 발견 없는 에이전트

security, scope

## 권장 조치사항

1. `codebase/backend/test/schedule-trigger.e2e-spec.ts:320-323`의 `originalNext > patchedAt + 90_000` 단언을 제거한다(316-319행 범위 단언만으로 회귀 판별력이 이미 충분함이 자체 뮤턴트 검증으로 확인됨). 유지할 경우 JSDoc의 "흔들리지 않는다" 확언을 정정한다.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md`의 "2026-09-20 해소 `plan/complete/schedule-cron-flake.md`" 인용을 실제 `--impl-done` + `plan/complete/` 이동 완료 후로 미루거나, 현재 실재 경로·진행중 시제로 정정한다.
3. (낮은 우선순위) `NAV-WF-02`가 실제 planner 트래커에 등재됐는지 확인하고, 안 됐으면 등재하거나 문구를 "등재 예정"으로 낮춘다.
4. (낮은 우선순위) `90_000` 매직 넘버를 로컬 상수로 추출해 상한/하한 두 단언의 관계를 코드로 명시화한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 diff 는 e2e 단언 로직 교체뿐 — 성능 특성 변경 없음 |
  | architecture | 서비스/모듈 구조 변경 없음 |
  | dependency | 의존성 파일(package.json 등) 변경 없음 |
  | database | DB 스키마·쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 경로 미포함 |
  | api_contract | API 계약(엔드포인트·요청/응답 스키마) 변경 없음 |
  | user_guide_sync | 사용자 문서 동기화 대상 UI/기능 변경 없음 |
