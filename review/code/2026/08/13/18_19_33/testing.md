# 테스트(Testing) 리뷰

## 대상 및 검증 방법

실질 코드 변경 8개 파일(`assert-row-array.ts`/`.spec.ts` 신규, `execution-engine.service.ts`
+`.spec.ts`, `executions.service.ts`+`.spec.ts`, `executions-rerun.service.spec.ts`,
`chat-channel.dispatcher.spec.ts`). 나머지 다수 파일(`plan/**`, `review/**`)은 문서 커밋이라
테스트 관점 대상 아님. 프롬프트에서 diff 가 생략된 `chat-channel.dispatcher.spec.ts`/
`execution-engine.service.spec.ts` 는 `git diff origin/main -- <path>` 로 직접 재구성해 검토했다.

독립 검증을 위해 관련 5개 spec 파일을 직접 실행했다:

```
assert-row-array.spec.ts                                    8 passed
executions-rerun/executions.service/chat-channel.dispatcher 83 passed
execution-engine.service.spec.ts                            444 passed
```

전부 GREEN. `assertRowArray` 호출 지점(3곳 in `execution-engine.service.ts` — admission/
`lockNonTerminalExecutionRow`/`updateExecutionStatus`, 1곳 in `executions.service.ts` —
`computeChainDepth`)도 소스에서 직접 grep 대조해 `assert-row-array.spec.ts` 의 "자매 전수"
테스트가 고정한 카운트(`3`/`3`, `1`/`1`)와 일치함을 확인했다.

이 diff 는 이전 세 라운드(`14_01_46`→`17_15_21`→`18_00_11`)에서 이미 WARNING 전량을 조치하고
RESOLUTION.md 에 뮤테이션 결과(6/6 사살)까지 남긴 상태의 최종 정리판이다. `18_00_11` testing.md
INFO #2 가 제안한 "쿼리 수 vs 가드 수" 구조적 회귀 테스트가 이번 diff 에서 정확히 구현됐다
(`assert-row-array.spec.ts` `자매 지점 전수` describe) — 이전 라운드 제안이 이번 라운드에서
실제로 닫힌 것을 확인했다.

## 발견사항

- **[INFO]** `assertRowArray` 의 타입 좁히기(`asserts rows is unknown[]`)를 "확인한다"는 주석이
  실제 검증 메커니즘을 오귀속하고 있다 — 검증하는 것은 이 jest 테스트가 아니라 별도의
  `typecheck-ratchet` CI job 이다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:10-11`
    (`// assertion 이후 \`.length\` 접근이 타입 에러 없이 가능해야 한다(좁히기 확인).` +
    `expect(rows.length).toBe(1);`)
  - 상세: backend 는 `tsconfig.json` 에 `isolatedModules: true` 를 켰고(같은 저장소
    `assert-end-reason-domain.type-fixture.ts:11` 주석이 이를 명시), `.github/workflows/
    backend-checks.yml:17-19` 는 "`nest build`는 spec.ts 를 exclude하고 jest는 타입을
    strip하므로, **테스트 코드의 타입 오류를 보는 유일한 지점**은 `check-backend-typecheck-
    ratchet.py`" 라고 스스로 문서화한다. 즉 `assertRowArray` 의 `asserts` 시그니처가 깨져도
    (예: 잘못된 타입 서명으로 바뀌어도) `pnpm test`(jest)는 런타임 값만 보고 그대로 통과한다 —
    `rows.length` 접근이 "타입 에러 없이 가능"한지는 `tsc --noEmit` 전체 프로그램 체크에서만
    드러난다. 이 PR 의 RESOLUTION.md(`17_15_21`)가 "typecheck ratchet 199건/38파일 불변"을
    실제로 확인해서 안전망 자체는 작동하고 있지만, 이 저장소가 반복 겪은 "타입 가드 테스트가
    실제로 타입체크되는지 확인" 함정(project memory
    `feedback_type_guard_test_actually_runs.md`)과 정확히 같은 형태의 주석 오귀속이라, 이후
    로컬에서 `pnpm test` 만 돌리고 "narrowing 확인 완료"로 오인할 위험이 있다.
  - 제안: 주석을 "`.length` 런타임 접근이 정상 동작함을 확인(타입 좁히기 자체의 컴파일 검증은
    `tsc --noEmit`/typecheck-ratchet CI job 몫)" 정도로 명확히 하면 향후 오귀속을 방지할 수
    있다. 블로킹 사안 아님.

- **[INFO]** "자매 지점 전수" 회귀 가드의 대상 범위(`FILES` 상수)가 이 PR 이 손댄 2개 파일로
  하드코딩돼 있어, 테스트 docstring 이 표방하는 "가드를 한 곳에만 적용하고 자매를 안 세는 것을
  막는다"는 목표를 프로젝트 전역이 아니라 이 두 파일 내부로만 좁혀 달성한다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:45-48`
    (`const FILES = ['modules/execution-engine/execution-engine.service.ts',
    'modules/executions/executions.service.ts']`)
  - 상세: `grep -rln "\.query(" src --include="*.service.ts"` 로 확인한 결과, backend 에는
    이 두 파일 외에도 raw `.query()` 소비 지점을 가진 서비스가 최소 7개 더 있다
    (`health.service.ts`, `integration-oauth.service.ts`, `knowledge-base.service.ts`,
    `embedding.service.ts`, `graph-extraction.service.ts`, `rag-search.service.ts`,
    `agent-memory.service.ts`). 그중 `integration-oauth.service.ts` 의
    `consumeOAuthState`(약 838-849행)는 구조적으로 거의 동일한 패턴이다 —
    `this.dataSource.query<[IntegrationOAuthState[], number]>(...)` 의 반환 shape 을
    검증 없이 `queryResult[0]`/`.length` 로 바로 소비한다. 다행히 이 지점은 실패 방향이
    fail-closed(`!consumed` → `null` 반환 → 콜백 거부)라 이번에 고친 `computeChainDepth`
    같은 fail-open 결함은 아니지만, "raw query 결과를 검증 없이 배열로 신뢰"하는 동일한 취약
    형태이고 이 형태에 대한 전용 테스트도 없다. `assert-row-array.spec.ts` 의 "자매 전수" 라는
    이름이 실제로는 이 PR 스코프의 두 파일에 한정된 전수라는 점을 인지해 둘 필요가 있다 —
    향후 세 번째 서비스에 같은 하드닝을 적용할 때 `FILES` 목록을 수동으로 늘리지 않으면
    이 회귀 가드가 조용히 범위 밖에 머문다.
  - 제안: (선택, 이번 diff 스코프 밖) `FILES` 목록에 코멘트로 "왜 이 두 파일만인가"(execution
    상태 머신 안전성 관련 지점으로 한정)를 명시하거나, 후속 작업으로 `integration-oauth.service.ts`
    등 나머지 raw query 소비 지점에 대한 유사 감사를 백로그에 남기는 것을 고려.

- **[INFO]** "자매 지점 전수" 가드의 `CONSUMING_QUERY` 정규식(`/const\s+\w+[^=\n]*=\s*\n?\s*
  await\s+[\w.]*\.query[<(]/g`)이 `const X = await Y.query(` 형태만 매치한다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:51-52`
  - 상세: 향후 새 소비형 raw query 호출이 `let`, 구조분해(`const { rows } = await ...`),
    또는 중간 변수 없이 바로 체이닝하는 형태로 추가되면 `CONSUMING_QUERY` 매치 수 자체가
    늘지 않는다 — 그러면 가드 없이 추가돼도 "쿼리 수 == 가드 수" 등식이 그대로 유지돼(둘 다
    안 늘어남) 이 회귀 테스트가 GREEN 을 유지한 채 새 미가드 지점을 놓칠 수 있다. 테스트
    자체 주석(39-41행)은 "정확히 어느 줄인지는 안 본다"는 부정밀함만 밝히고 있고, 이 구문
    형태 이탈 가능성은 명시돼 있지 않다. RESOLUTION.md(`18_00_11`)의 뮤테이션 M-B("가드
    없는 새 소비형 `.query()` 추가")는 기존 파일 관례(`const x = await ...`)를 따르는 뮤턴트로
    검증했을 가능성이 높아, 이 정규식 사각지대 자체는 뮤테이션으로 아직 가른 적이 없어 보인다.
  - 제안: (선택) 정규식을 소비 패턴(`let`/구조분해)까지 넓히거나, 최소한 "이 정규식이 매칭하지
    못하는 구문 형태로 새 지점을 추가하면 이 가드를 우회한다"를 주석에 남겨 다음 사람이
    맹점을 알고 있게 한다.

## 검증된 양호 사항

- 신규 `assertRowArray` 헬퍼의 boundary/타입 케이스(빈 배열은 정상, `undefined`/`null`/객체
  (`{rowCount:1}` — 실제 pg 드라이버 API 오용을 정확히 겨냥한 픽스처)/숫자/문자열 5종은 모두
  던짐)가 `it.each` 로 조밀하게 고정돼 있고, 에러 메시지 정규식(`/배열이 아님.*computeChainDepth
  재귀 CTE/s`)이 호출부 문맥 문자열까지 포함해 검증한다.
- `lockNonTerminalExecutionRow` 테스트는 `true`/`false`/throw 세 경로를 모두 고정해 "가드가
  정상 판정을 바꾸지 않는다"까지 함께 검증한다 — 예외 케이스만 보는 대신 정상 회귀까지 같이
  잠근 설계다 (`execution-engine.service.spec.ts` 신규 `it`).
- `admission 이 throw → routing release 후 그대로 재전파` 테스트는 `registerExecutionRouting`/
  `releaseExecutionRouting` 호출과 원본 에러 객체(`boom`)로의 정확한 reject, `runExecution`
  미호출을 모두 확인해 "삼키면 BullMQ 가 성공으로 오판한다"는 실제 회귀를 가른다.
- `computeChainDepth` 가드 테스트(`executions-rerun.service.spec.ts`)는 private 메서드 직접
  호출이 아니라 공개 API `service.reRun(...)` 을 통해 검증하고, "제한 우회의 실제 결과"(새
  실행이 시작되는지)를 `engine.execute` 미호출로 직접 확인해 가장 자기완결적인 설계다. 기존
  경계값 테스트(depth 31 허용/32 거부)와 함께 놓고 보면 "정상 경계 + 방어적 실패" 양쪽을 모두
  잠근 좋은 커버리지 조합이다.
- `chat-channel.dispatcher.spec.ts` 는 `makeDispatcherHarness` 공통 헬퍼로 리팩터되면서(이전
  라운드 WARNING 2 조치) `buildDispatcher`/신규 null-분기 describe 가 fixture 를 공유해도 매
  호출 새 mock 인스턴스를 반환해 상태 누수가 없다. debug/warn 두 스파이를 모두 세워 "한쪽
  호출 + 다른 쪽 미호출"을 동시에 단언해 삼항이 한쪽으로 굳는 회귀를 절반만 잡는 함정을 피했다.
- `executions.service.spec.ts` 의 LRU 경계값+방향 테스트(257번째 삽입 시 가장 오래된 키
  evict, 직전 읽기로 LRU 를 갱신한 키는 살아남음)는 방향성 있는 단언으로 "무언가 하나 지운다"만
  고정하면 통과했을 반전 회귀를 실제로 가른다.
- 5개 spec 파일을 직접 실행(535건)해 전부 GREEN 임을 재확인했고, 기존 회귀 테스트(예:
  `admitExecutionOrDefer` admitted/deferred/cancelled 3분기, `updateExecutionStatus` 누적
  RUNNING 진입/이탈 다수 테스트)가 이번 diff 로 깨지지 않음을 확인했다 — 새 가드가 정상 배열
  경로의 기존 판정을 바꾸지 않는다는 뜻이다.
- Mock 이 실제 타입 계약과 일치한다 — `EntityManager.query`/`Repository.query` 가 선언상
  `Promise<any>` 인 현실을 반영해 `undefined` 를 돌려주는 mock 으로 "배열 아님" 케이스를
  만드는 방식이 적절하다.

## 요약

이 diff 는 이전 세 리뷰 라운드가 남긴 WARNING·INFO 를 정리하는 최종판으로, 신규 `assertRowArray`
헬퍼와 그 4개 호출 지점 각각에 대응 테스트가 있으며 뮤테이션(이전 라운드 기록상 6/6 사살)과
직접 실행(이번 라운드 535건 GREEN 재확인)으로 vacuous pass 가 아님이 뒷받침된다. 경계값(LRU
256/257, chain depth 31/32)·양방향 분기(debug/warn)·정상/예외 양쪽(`lockNonTerminalExecutionRow`
true/false/throw)을 모두 방향성 있게 고정해 테스트 설계 품질이 높다. CRITICAL/WARNING 급 결함은
발견되지 않았다. 남은 지적은 전부 INFO 다 — (1) 타입 좁히기 검증 주체가 jest 가 아니라 별도
typecheck-ratchet CI job 이라는 사실이 스펙 파일 주석에 오귀속돼 있고(안전망 자체는 실재),
(2) "자매 전수" 회귀 가드의 실제 범위가 이 PR 의 두 파일로 하드코딩돼 있어 codebase 전역의
유사 패턴(`integration-oauth.service.ts` 등)까지는 못 미치며, (3) 그 가드의 정규식이 특정
구문 형태(`const X = await Y.query(`)만 인식해 다른 형태의 새 미가드 지점을 놓칠 사각지대가
남아 있다. 셋 다 이번 diff 의 병합을 막을 사안은 아니고, 향후 유사 하드닝 확장 시 참고할 항목이다.

## 위험도

LOW
