# 테스트(Testing) 리뷰

## 사전 검증 (직접 실행)

리뷰 대상 diff 는 이미 2라운드 리뷰(`17_12_34`, `17_35_49`)를 거쳐 CRITICAL/WARNING 을 반영한 상태다.
프롬프트가 파일 7·8(`executions.service.spec.ts`/`executions.service.ts`)의 diff 를 크기 제한으로
생략해, 실제 소스 파일을 `Read`/`Grep`으로 직접 열어 확인했고 추가로 다음을 실행했다.

- `npx jest executions.service.spec.ts background-runs.service.spec.ts redact-stored-error.spec.ts`
  — **3 suites / 67 tests 전부 PASS**.
- 직전 라운드 RESOLUTION 이 주장한 **copy-on-change 참조 동일성 뮤턴트**(삼항 조건 제거 →
  무조건 spread)를 스크래치 사본에 재적용해 재현: `⑤-c` 테스트가 정확히 **RED**
  (`expect(received).toBe(expected)` 실패)로 떨어지는 것을 확인했다. `git checkout --` 로
  원복 후 40/40 PASS 재확인 — 주장이 실측과 일치한다.

## 발견사항

- **[INFO]** `stop()` 의 `WAITING_FOR_INPUT` 분기가 "표면 전수" 테스트 그룹 밖에 있고, 그 분기 전용
  테스트에는 마스킹 대상 값(자격증명 포함 `error`)이 주입되지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` — `queued=true 면
    cancel 후 갱신된 execution 을 반환` 테스트(730행, `describe('stop — WAITING_FOR_INPUT cancel
    (C-1)')` 안). 구현은 `executions.service.ts` `stopInternal` 의 `WAITING_FOR_INPUT` 분기
    (850행, `return updated ?? execution;` 869행).
  - 상세: `stop()` 의 JSDoc 은 "`stopInternal` 은 반환 지점이 **넷**"이라 명시하고, 신설
    `describe('Execution.error 응답 마스킹 — 표면 전수', ...)` 블록의 `④`/`④-b` 테스트는 그중
    RUNNING 경로의 `affected=1`/`affected=0` 두 반환 지점만 `LEAKY`/`MASKED` fixture 로 마스킹을
    직접 단언한다. `WAITING_FOR_INPUT` 분기(세 번째 반환 지점, `updated ?? execution`)를 도는
    730행 테스트는 `afterCancel = baseFake({ id: 'eW-ok', status: ExecutionStatus.RUNNING })`
    로 `error` 필드를 아예 채우지 않아, 이 분기가 실제로 마스킹 관문(`toResponseExecution`)을
    통과하는지 이 테스트만으로는 확인되지 않는다. 마스킹이 `stop()` 레벨의 단일 관문
    (`toResponseExecution`)에서 걸리므로 기능적 위험은 낮지만("모든 반환이 같은 문을 통과"하도록
    설계된 구조 자체가 이 분기 누락의 blast radius 를 이미 줄여 두었다), 이 항목은 직전 라운드
    (`17_35_49` testing INFO)에서 이미 지적됐고 이번 라운드에도 **그대로 남아 있다** — "표면
    전수" 를 자처하는 describe 블록의 문서화된 범위(반환 지점 넷)와 실제 검증 범위(둘) 사이의
    간극이 아직 닫히지 않았다.
  - 제안: `eW-ok` fixture 의 `waiting`(최초 lookup)에 `error: null`, `afterCancel`(재조회)에
    `error: { ...LEAKY }` 를 채우고 `expect(result.error).toEqual(MASKED)` 한 줄을 추가하면
    "반환 지점 넷" 주장과 테스트 커버리지가 정확히 일치한다. 필수는 아니다 — 단일 관문 설계상
    회귀 시 다른 세 표면 테스트가 이미 잡을 것이므로 이 분기만 놓쳤을 때 실제로 새는 경로는
    "이 분기가 유일하게 마스킹을 건너뛰도록 별도 코드가 추가되는" 시나리오뿐이다.

- **[INFO]** 응답 마스킹의 HTTP 레벨(e2e) 검증이 없다 — 전부 서비스 유닛 레벨 mock 이다
  - 위치: `codebase/backend/test/` 하위에 `Execution.error`/마스킹 관련 e2e 스펙 없음(grep 확인,
    `execution-*.e2e-spec.ts` 7개 파일 전부 무관). 컨트롤러는 얇은 pass-through
    (`executions.controller.ts:88` `return this.executionsService.findById(id);`,
    `:145` `return this.executionsService.stop(id);`, `:311` `return
    this.executionsService.getChain(...)`)라 서비스 유닛 테스트가 실질적으로 응답 바디를
    결정하므로 위험은 낮다.
  - 상세: 이 PR 의 동기는 "종결 emit 은 마스킹, 읽기 경로는 원문"이라는 **표면 간 비대칭**이었고,
    같은 클래스의 결함이 이번 라운드에서도 반복 발견됐다(형제 필드 `nodeExecutions[].error`
    우회, `stop()` 반환 계약 등). 컨트롤러가 단순 pass-through 라 유닛 테스트로 충분히 방어되긴
    하나, 이 계열 변경이 보안 하드닝(CWE-209 봉쇄)이라는 점을 고려하면 실 HTTP 응답
    (`GET /api/executions/:id` 등)에서 `error.message` 가 실제로 마스킹된 문자열로 나가는지를
    확인하는 e2e 스모크 테스트 1개가 있으면, 향후 `ClassSerializerInterceptor`/커스텀
    직렬화·응답 스키마 변경이 이 관문을 우회해도(예: 컨트롤러가 더 이상 순수 pass-through 가
    아니게 되는 리팩터) 놓치지 않는 방어선이 된다.
  - 제안: 필수는 아니다. 트래커에 낮은 우선순위 항목으로 기록해 두는 정도로 충분 — 이번 PR 을
    막을 사유는 아니다.

- **[INFO]** (양호, 조치 불요) `redact-stored-error.spec.ts` 의 캐너리 테스트 설계가 모범적
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` 84-98행
    (`[캐너리] 자격증명 없는 연결 문자열은 통과한다`, `[캐너리] 평범한 에러 메시지는 손상하지
    않는다`)
  - 상세: "보장의 경계"(자격증명 패턴만 겨냥, 나머지는 무변화)를 캐너리로 고정해 향후
    `deepRedactSecrets` 의 `SECRET_LEAK_PATTERNS` 가 조용히 넓어지는 것을 이 테스트가 RED 로
    막는다. JSDoc 이 약속한 "레거시 문자열/숫자 통과"도 59-74행에서 런타임 캐스트로 실제
    검증한다(직전 라운드 W1 반영) — 문서한 보장이 구현보다 넓은 이 저장소의 반복 형태를
    정확히 겨냥했다.
  - 제안: 없음.

- **[INFO]** (양호) `⑤-c` 참조 동일성 테스트가 값-비교 테스트로는 못 잡는 회귀를 실제로 판별한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` 1067-1097행
    (`⑤-c` error 가 없는 행은 원본 참조 그대로 돌려준다)
  - 상세: 위 "사전 검증" 절에서 직접 뮤테이션으로 재현 확인. `⑤-b`(값 비교만)는 같은 뮤턴트에서
    GREEN 이었을 것 — `toBe`/`not.toBe` 조합이 정확한 선택이다.
  - 제안: 없음.

## 요약

이 changeset 은 이미 3라운드 리뷰(포함: 이번 라운드)를 거치며 테스트 관점 CRITICAL·WARNING 이
전부 해소됐다. 직전 라운드가 지적한 "copy-on-change 최적화가 값 비교만으로 검증돼 회귀를 못
잡는다"는 결함은 참조 동일성 단언(`⑤-c`)으로 수정됐고, 스크래치 사본에 뮤턴트를 직접 재적용해
RED 를 재현함으로써 그 주장을 독립적으로 재검증했다. `redact-stored-error.spec.ts` 는 null 정규화,
비변이, 레거시 타입 보존, 보장의 경계(캐너리)까지 고르게 커버하고, `executions.service.spec.ts`
의 "표면 전수" describe 블록은 4개 표면(`findById`/`findByWorkflow`/`getChain`/`stop`) + 형제
필드(`nodeExecutions[].error`) + 캐시 경유 재조회까지 독립적으로 겨냥해 "자매 중 하나만 마스킹"
재발을 구조적으로 막는다. 남은 갭은 전부 INFO 수준이다 — `stop()`의 `WAITING_FOR_INPUT` 분기가
"반환 지점 넷" 이라는 문서 주장 대비 테스트에서 마스킹 값으로 직접 검증되지 않는 점(직전 라운드
INFO 가 아직 미해소로 남음, 단일 관문 설계상 기능 위험은 낮음)과, 보안 하드닝 성격을 고려한
e2e 레벨 스모크 테스트의 부재(컨트롤러가 얇은 pass-through 라 위험은 낮음) 뿐이다. 둘 다 이번
PR 을 막을 사유는 아니다.

## 위험도

LOW
