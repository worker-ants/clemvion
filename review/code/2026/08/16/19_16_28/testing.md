# 테스트(Testing) Review

## 사전 확인 (독립 재현)

이 changeset 은 이미 `17_12_34` ~ `18_58_22` 6라운드 리뷰·fix 사이클을 거쳤고 코드는
`9f870fb00` 이후 동결(review/consistency/plan/spec 문서만 추가)되어 있다. 리포트를
액면가로 받지 않고 아래를 직접 재현했다:

- `npx jest executions.service.spec.ts background-runs.service.spec.ts redact-stored-error.spec.ts`
  → **3 suites / 68 tests 전부 PASS** (RESOLUTION `18_58_22` 의 "68 tests" 주장과 일치).
- `npx tsc --noEmit -p tsconfig.json` → 저장소 전역에는 이 PR 과 무관한 기존 tsc 오류가
  있으나(다른 모듈의 spec 파일들), 이번 changeset 대상 3파일
  (`executions.service.ts`/`.spec.ts`, `background-runs.service.ts`/`.spec.ts`,
  `redact-stored-error.ts`/`.spec.ts`) 관련 오류는 **0건** — grep 으로 직접 확인.
- 컨트롤러가 서비스 반환값을 그대로 pass-through 하는지 확인
  (`executions.controller.ts:88` `findById`, `:145` `stop`, `:311` `getChain`,
  `background-runs.controller.ts:60` `getBackgroundRun`) — 단위 테스트가 검증하는
  서비스 반환값이 실제 HTTP 응답과 같은 형태임을 확인.
- `reRun` 이 `findById` 를 재사용한다는 CHANGELOG 주장도 직접 확인
  (`executions.service.ts:493` `const detail = await this.findById(newExecutionId);`) —
  마스킹 표면 전수 테스트가 별도 reRun 케이스 없이도 이 경로를 transitively 덮는 근거가 맞다.
- `buildSingleQB` 중복 정의(1라운드 fix 대상)가 재발하지 않았음을 grep 으로 재확인 —
  `executions.service.spec.ts` 안에 정의가 **한 곳**뿐.

## 발견사항

새로 발견된 CRITICAL/WARNING 급 결함은 없다. 아래 두 건은 **이미 3라운드 이상에 걸쳐
논의·판정된 기존 INFO 항목**이며, 재확인 결과 여전히 유효한 관찰이라 재기재한다(새 지적 아님).

- **[INFO]** `stop()` 의 `WAITING_FOR_INPUT` 취소 분기는 masking 값 자체를 직접 단언하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` `describe('stop — WAITING_FOR_INPUT cancel (C-1)')` (약 732~761행, `it('queued=true 면 cancel 후 갱신된 execution 을 반환 (throw 없음)')`)
  - 상세: 이 테스트는 `result.id`/`result.status` 만 `toMatchObject` 로 단언하고 `error` 필드는 검증하지 않는다. `error` 마스킹을 직접 겨냥한 "표면 전수" describe 블록(`Execution.error 응답 마스킹 — 표면 전수`, 857행~)의 ④/④-b 는 `RUNNING`→원자 UPDATE 경로만 커버하고 `WAITING_FOR_INPUT`→`cancelWaitingExecution` 경로는 포함하지 않는다. 다만 `stop()` 이 `stopInternal()` 의 반환값을 바깥 단일 지점(`toResponseExecution`, `executions.service.ts:814`)에서 감싸므로, 어느 내부 분기를 타든 같은 마스킹 관문을 지난다 — 기능적 위험은 낮다(이전 3라운드 연속 동일 판정).
  - 제안: 조치는 선택 사항. `waiting` fixture 에 `error` 값을 채우고 `cancelWaitingExecution` 성공 후 재조회 결과에 `error` 를 실어 마스킹까지 단언하는 케이스를 추가하면 "표면 전수" 커버리지 주장과 테스트가 정확히 일치한다.

- **[INFO]** 응답 egress 마스킹을 검증하는 e2e(HTTP 레벨) 테스트가 없다
  - 위치: `codebase/backend/test/` 하위에 `redactStoredErrorForResponse`/자격증명 마스킹 관련 e2e 없음 (grep 확인, 0건)
  - 상세: 전부 unit(mock repository) 레벨 검증이다. 컨트롤러가 얇은 pass-through 라 실제 리스크는 낮고(직접 확인함, 위 참조), "DB 원문 보존"을 단언하는 기존 e2e 가 그대로 통과하는 것이 egress-only 원칙의 반대편 증거로 작용한다는 논거도 이전 라운드에서 확인됐다. 그러나 HTTP 직렬화 단계(Nest 의 인터셉터·`class-transformer` 등)에서 마스킹된 값이 실제로 wire 로 나가는지를 검증하는 계층은 여전히 비어 있다.
  - 제안: 필수는 아님. 우선순위가 낮다면 트래커에 유지, 필요 시 `GET /executions/:id` 를 겨눈 e2e 1건에 `error.message` 가 마스킹된 형태로 오는지 단언을 추가.

## 강점 (참고)

- `redact-stored-error.spec.ts`: null/undefined 정규화, 비변이(non-mutation) 보장,
  JSDoc 이 약속한 레거시 문자열·숫자 타입 보존, 그리고 **보장의 경계**(자격증명 없는
  연결 문자열·평범한 에러 메시지는 무변화)를 캐너리로 고정 — 패턴이 조용히 넓어지는
  회귀를 막는 설계.
- `executions.service.spec.ts` `Execution.error 응답 마스킹 — 표면 전수` describe 블록:
  4개 독립 표면(`findById`/`findByWorkflow`/`getChain`/`stop`, `stop` 은 정상 UPDATE·
  `affected=0` 경쟁 분기 둘 다) + 형제 필드 우회(`nodeExecutions[].error`) + DB 원문
  불변 + 캐시 히트 경로에서도 마스킹 유지 + null 형태 보존을 각각 독립 테스트로 겨냥.
  "한 헬퍼를 한 번만 검증하면 자매 표면 하나가 빠져도 초록"이라는 이 저장소의 반복
  결함 형태를 정확히 겨냥한 구조.
- `⑤-c` (copy-on-change 참조 동일성): 값 비교만으로는 "무조건 spread" 회귀를 못 잡는다는
  점(2라운드 testing WARNING)을 반영해 `toBe`/`not.toBe` 로 참조 동일성을 직접 단언 —
  뮤테이션 검증까지 별도 라운드에서 독립 재현됨.
- `background-runs.service.spec.ts`: 자매 표면 대칭(`error: null` 통과 케이스,
  `18_14_50` testing INFO 로 추가)까지 맞춰져 있고, IDOR 차단·cursor 검증·페이지네이션
  등 기존 커버리지도 함께 유지.
- 테스트 격리: `beforeEach` 에서 모든 mock(`executionRepo`/`nodeExecutionRepo`/
  `executionNodeLogRepo`/`engine`)을 매 테스트마다 새로 생성 — 테스트 간 상태 누수 없음.
- Mock 충실도: `createQueryBuilder` 체이닝을 실제 TypeORM API 형태(`where`/`andWhere`/
  `getOne`/`getMany`/`getRawOne` 등)로 스텁해 서비스 코드와의 계약 불일치를 피함.
  `buildSingleQB` 중복 정의(1라운드 발견)도 최상위로 hoist 되어 재발하지 않음.

## 요약

이 changeset 은 이미 6라운드의 리뷰-수정 사이클을 거쳐 테스트 관점 결함(uncapped spread ·
null-hiding 캐스트 · copy-on-change 미검증 · 자매 대칭 누락 등)이 전부 수정·독립
재현으로 확인된 상태다. 이번 라운드에서 코드는 추가로 바뀌지 않았고(동결), 직접 재실행한
결과 대상 3개 spec 68 tests 전부 PASS, 대상 파일 tsc 오류 0을 확인했다. 새로 발견된
CRITICAL/WARNING 은 없다. 남은 것은 이전 라운드부터 반복 확인된 두 개의 저위험 INFO
(`WAITING_FOR_INPUT` 분기의 직접 마스킹 미단언, e2e 레벨 부재)뿐이며 둘 다 마스킹 관문이
단일 지점(`toResponseExecution`)에 있어 기능적 위험이 낮다는 근거가 유지된다.

## 위험도

NONE
