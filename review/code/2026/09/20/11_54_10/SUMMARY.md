# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실 코드 변경은 e2e 테스트 1케이스(cron 리터럴 교체 + 시각창 단언 추가)에 국한되며 서비스 로직·인가·시크릿 변경은 없다. 다만 이 작업이 고치려던 "겹칠 수 없다"는 보장 자체가 완전히 참은 아니며(연말 1분 잔존 창), 신규 상한 단언의 지연 여유가 타이트해 새로운 타이밍 플레이크를 들여올 소지가 있고, 코드·plan 양쪽에 실측 인용 오류가 있다. forced whitelist 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Testing | "연 1회 cron 은 분 단위 cron 과 절대 겹칠 수 없다"는 문서화된 절대 보장이 완전히 참이 아니다 — `*/1 * * * *`는 모든 분 경계를 매치하므로, PATCH 처리 시각이 매년 마지막 1분(12/31 23:59:00~59.999 KST) 안이면 재계산된 `nextRunAt`이 PATCH 전 `originalNext`와 여전히 완전히 같아질 수 있다. 이는 이번에 고치려던 버그와 같은 메커니즘으로, 발생 빈도만 하루 1/1440 → 연 1/525600 로 낮아졌을 뿐 구조적으로 사라지지 않았다. 이 잔존 창의 유일한 발화 지점은 새로 추가한 "1분 이내" 단언이 아니라 **그대로 유지된** `not.toBe(originalNext)` 단언이며, 이 단언이 313~315행보다 먼저 실행돼 실패 시 즉시 throw 한다 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:286`(JSDoc), `:298`(인라인 주석), `:311`(`not.toBe(originalNext)`); `plan/in-progress/schedule-cron-flake.md:32` | JSDoc/인라인 주석·plan 서술의 "겹칠 수 없다"를 "거의 항상 겹치지 않는다(연 1분 잔존 창, 무시 가능한 수준)"로 정정하거나, 완전히 닫으려면 311행의 `not.toBe(originalNext)`를 제거/조건부화해 새 범위 단언(313~315행)만으로 판별 |
| 2 | Requirement | 신규 상한 단언(`patchedAt + 65_000`)의 65초 예산 중 60초는 cron 분 경계 반올림 몫이고 실질 지연 여유는 5초뿐이다 — PATCH 요청·DB 갱신·트리거 config lock 획득이 도커 e2e 부하 등으로 5초를 넘기면 정상 동작인데도 거짓 실패할 수 있다. 플레이크를 없애려다 새로운 종류의 타이밍 플레이크를 도입할 위험 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:312-315` | 여유를 15~30초 등으로 넉넉히 확대(상한 판정 취지는 "같은 분 경계 안"이 아니라 "새 cron 이 만드는 값"이므로 널널해도 판별력에 지장 없음) |
| 3 | Documentation | "실측" 인용이 실제 근거가 없는 문서를 가리킨다 — JSDoc·plan 문서 양쪽이 "`plan/complete/ssrf-catch-instanceof.md` 의 e2e 실행/TEST 결과에 기록"이라 인용하지만, 실제 그 문서에는 후속 항목 등재 한 줄만 있을 뿐 인용된 정확한 오류 문자열·타임스탬프는 없다. 진짜 상세 실측은 `plan/in-progress/spec-draft-nullable-notation-followups.md:4951-4952` 및 `review/code/2026/09/20/09_35_16/RESOLUTION.md:27`에 있다. `review-citations.md` 가 명시적으로 경고하는 "잘못 채운 경로는 bare 인용보다 나쁘다" 형태이며, `codebase/**`에 영구히 남는 테스트 주석이 다음 개발자를 잘못된 문서로 보낸다 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:286`; `plan/in-progress/schedule-cron-flake.md:21-22` | 두 인용 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md`(해당 라인) 또는 `review/code/2026/09/20/09_35_16/RESOLUTION.md`로 정정. "이 문제가 그 작업 중 발견됐다"는 문맥 서술은 정확하므로 그대로 두고 "TEST 결과에 기록" 부분만 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 새 "1분 이내" 단언이 결과값의 정합성(정확히 분 경계 `:00`인지)까지는 검증하지 않아 판별력이 느슨하다 — 재계산 로직이 분 경계가 아닌 임의 시각을 반환해도 통과할 수 있다 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:313-315` | `expect(new Date(nextRunMs).getSeconds()).toBe(0)` 류 추가 검토 |
| 2 | Testing | cron 변경 → `nextRunAt` 재계산 happy path 를 결정적 단위 테스트가 커버하지 않고 이 e2e 하나에 전적으로 의존한다 — 기존 단위 테스트는 `computeNextRuns` 를 `[]`로 mock 하는 방어 분기만 고정 | `codebase/backend/src/modules/schedules/schedules.service.spec.ts:384`; 대응 e2e `codebase/backend/test/schedule-trigger.e2e-spec.ts:291` | (선택, 스코프 밖) `computeNextRuns` spyOn 패턴으로 happy-path 단위 테스트 추가를 후속 백로그에 등재 |
| 3 | Testing | plan 의 "뮤턴트 둘 다 RED" 검증이 이번 수정의 핵심 시나리오만 다루고, 연말 경계 잔존 엣지케이스(위 WARNING #1)는 뮤테이션·시각 mock 어느 쪽으로도 검증되지 않았다 | `plan/in-progress/schedule-cron-flake.md` "## 테스트" 절 | 시간이 허락하면 `jest.useFakeTimers().setSystemTime(...)`로 연말 경계 재현 후 문서 정정, 급하지 않으면 위 WARNING 대체 가능 |
| 4 | Scope | 리뷰 대상에 harness 산출물(신규 plan 문서 1건 + `--impl-prep` consistency-check 산출물 7건)이 함께 포함됨 — 프로젝트 컨벤션이 요구하는 필수 절차 산출물로 저장 위치·명명 모두 일치, 스코프 위반 아님 | `plan/in-progress/schedule-cron-flake.md`; `review/consistency/2026/09/20/11_21_16/*`(7개) | 조치 불요 |
| 5 | Maintainability | 허용 오차 상수(5초·65초)가 이름 없는 인라인 리터럴 — 다만 근거 주석이 붙어 있고 같은 파일 기존 테스트(A, line 112)도 같은 스타일이라 새로운 결함 아님 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:314-315` | 세 번째 등장 시 `MINUTE_CRON_TOLERANCE_MS` 류 이름 있는 상수화 고려 |
| 6 | Maintainability | 연 1회 cron 리터럴 `'0 0 1 1 *'`이 D·E 두 케이스에서 중복 — plan 문서가 "E 케이스가 쓰는 값" 재사용을 명시적으로 근거로 남겼고, 각 `it()` 자기완결 fixture 패턴과 일치 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:298`(D), `:336`(E, 이번 diff 밖) | 조치 불요 |
| 7 | Documentation | 파일 최상단 JSDoc이 D 케이스의 과거 flake·수정 이력을 언급하지 않음 — 케이스별 JSDoc(283~290행)이 이미 맥락을 담고 있어 필수 아님 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:16-30` | 조치 불필요, 우선순위 낮음 |
| 8 | Side Effect | 신규 파일 9개(plan 문서 1 + consistency 산출물 8) 추가 — 워크플로 관례 부합, 의도치 않은 부작용 아님 | `plan/in-progress/schedule-cron-flake.md`; `review/consistency/2026/09/20/11_21_16/*` | 조치 불요 |
| 9 | Side Effect | `_retry_state.json`에 워크트리 절대경로 다수 하드코딩 — orchestrator 표준 포맷, 이번 작업이 새로 도입한 문제 아님 | `review/consistency/2026/09/20/11_21_16/_retry_state.json` | 조치 불요(기존 관례) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음 — 테스트 전용 변경, 인젝션·시크릿·인가 표면 없음 |
| requirement | LOW | "겹칠 수 없다" 보장 과장(연말 1분 잔존 창), 신규 상한 단언 5초 여유 타이트 |
| scope | NONE | cron 케이스 D 단일 블록에 국한, plan 지시와 정확히 일치, harness 산출물은 컨벤션 부합 |
| side_effect | NONE | 전역 상태·환경변수·네트워크·인터페이스 변경 없음, 신규 파일은 워크플로 관례 부합 |
| maintainability | NONE | 매직넘버·cron 리터럴 중복 모두 기존 파일 컨벤션과 일치 |
| testing | LOW | 연말 경계 잔존 창의 실제 발화 지점은 유지된 `not.toBe` 단언, happy-path 단위 테스트 부재 |
| documentation | LOW | JSDoc·plan 양쪽의 "실측" 인용이 실제 근거 없는 문서를 가리킴 |

## 발견 없는 에이전트

- security

## 권장 조치사항

1. JSDoc(`schedule-trigger.e2e-spec.ts:286`)과 plan 문서(`schedule-cron-flake.md:21-22`) 양쪽의 잘못된 실측 인용(`plan/complete/ssrf-catch-instanceof.md`)을 실제 근거(`plan/in-progress/spec-draft-nullable-notation-followups.md:4951-4952`, `review/code/2026/09/20/09_35_16/RESOLUTION.md:27`)로 정정한다.
2. "연 1회 cron 은 분 단위 cron 과 절대 겹칠 수 없다"는 표현을 완화하거나, 잔존 창을 완전히 닫으려면 311행의 `not.toBe(originalNext)` 단언을 제거/조건부화해 새 범위 단언만으로 판별하도록 한다.
3. 신규 상한 단언(`patchedAt + 65_000`)의 지연 여유를 15~30초 수준으로 확대해, 이번 수정이 다른 종류의 타이밍 플레이크를 도입하지 않도록 한다.
4. (선택, 후속 백로그) `nextRunMs` 검증에 초=0 단언 추가로 판별력 보강, `schedules.service.spec.ts`에 cron 재계산 happy-path 결정적 단위 테스트 추가를 검토한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 화이트리스트 미이행 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(e2e 테스트 단언 조정)과 관련성 낮음 |
  | architecture | 서비스 아키텍처 변경 없음 |
  | dependency | 신규 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 대상 변경 없음 |
