# 테스트(Testing) 리뷰 — `nodeOutput` fail-closed allowlist (누적 diff, 5커밋)

## 검증 방법 (재현 완료)

산문 주장을 코드 재실행으로 직접 재검증했다 (모두 `cp` 백업 → 뮤테이션 → 재실행 → `cp` 복원,
`git checkout`/`reset` 미사용, 매 단계 후 `git status --short` 로 clean 확인):

1. `npx jest interaction.service.spec.ts node-output-allowlist.spec.ts` → **81/81 GREEN** (원본).
2. `npx tsc --noEmit` — `node-output-allowlist.{ts,spec.ts}` 관련 오류 0건. `interaction.service.spec.ts`
   의 사전 존재 오류 4건(734/761/1030/1291행, 이 PR 이전부터 있던 `as Record<string, unknown>`
   단일 캐스트, `git show a3c9b3578^:...` 로 대조해 PR 이전부터 존재함을 확인)은 이번 diff 범위
   밖이라 재론하지 않음.
3. `NODE_OUTPUT_ALLOWED_KEYS` 에서 `'status'` 제거 → **`TS2322`** (CHANGELOG/JSDoc 이 주장하는
   컴파일타임 결속 실증, 문서 주장과 일치).
4. `Object.freeze(` → `(` 로 뮤테이션 → **`[캐너리] 목록이 런타임에도 불변이다`** 테스트가
   정확히 RED (`21건 중 1건 실패`), 나머지 GREEN. 신규 캐너리가 실제 판별력을 가짐을 직접 확인.
5. `interaction.service.ts` 의 waiting 출구에서 `allowlistNodeOutputKeys(...)` 배선을 제거
   (`stripAndRedact(...) ?? {}` 로 되돌림) → **정확히 2건 RED**(`[캐너리] buttons 분기의
   buttonConfig.nodeOutput 도 allowlist 를 지난다`, `[캐너리] waiting nodeOutput 이 엔진 내부
   _retryState 를 싣지 않는다`), 나머지 57건 GREEN. plan 문서가 기록한 M1 뮤테이션 결과("1
   RED — 배선 캐너리")와 정확히 일치.
6. `__proto__` 방어 테스트의 전제(object spread 가 `JSON.parse` 로 만든 own `__proto__` 프로퍼티를
   accessor setter 를 타지 않고 그대로 복사한다)를 `node -e` 로 별도 재현 — 참.
7. `grep` 으로 `makeExecution({ error: ... })` 형태 잔존 여부 확인 — 0건. `overrides:
   Partial<ExecutionFixture>` 로 좁힌 뒤에도 tsc 신규 오류가 없어, 좁히기가 기존 6개 호출부
   (`conversationThread` 를 넘기는)만 통과시키고 `error` 는 여전히 막는다는 plan 서술과 일치.

7개 항목 모두 문서(CHANGELOG/JSDoc/`plan/complete/nodeoutput-allowlist.md`)의 주장과 실측이
일치했다 — 반증된 것이 없다.

## 발견사항

- **[INFO]** `allowlistNodeOutputKeys` 의 "객체가 아니면 통과" 분기가 `null`/숫자/배열은
  개별 테스트로 덮지만 `undefined` 는 별도 케이스가 없다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts` — `it('객체가
    아니면 그대로 통과한다 ...')` 블록 (파일 4 diff 게이트 120~125행)
  - 상세: 구현(`typeof value !== 'object'` 분기, `node-output-allowlist.ts` 게이트 99행)에서
    `undefined` 는 `42` 와 같은 코드 경로를 타므로 실질 커버리지 갭은 아니다. 다만 실제 호출부
    (`interaction.service.ts:393`, `stripAndRedact(nodeExec.outputData) ?? {}`)가 `??` 로
    `undefined` 유입을 원천 차단하고 있어, 이 분기가 방어하는 대상이 "호출부가 이미 막고 있는
    입력"이라는 점도 테스트에 드러나 있지 않다.
  - 제안: 우선순위 낮음. `expect(allowlistNodeOutputKeys(undefined)).toBeUndefined();` 한 줄
    추가로 닫을 수 있으나, 같은 분기를 재확인하는 것 이상의 실익은 적다.

- **[INFO]** 값-마스킹(`deepRedactSecrets`, `stripAndRedact`)과 키-allowlist(`allowlistNodeOutputKeys`)
  가 **같은 payload** 안에서 함께 동작하는지를 직접 검증하는 테스트는 없다 — 두 관심사가
  각각 별도 테스트로만 덮인다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` —
    secret 마스킹은 `conversationConfig` 를 다루는 테스트(게이트 없음, 원본 파일 1039행
    `'waiting_for_input — nodeOutput.conversationConfig 의 secret 도 마스킹 ...'`)가, allowlist
    드롭은 새 캐너리(파일 2 diff 게이트 90~123행)가 각각 별도 payload 로 검증한다.
  - 상세: 호출 체인이 `allowlistNodeOutputKeys(stripAndRedact(nodeExec.outputData) ?? {})` 로
    합성돼 있고, 두 필터는 서로 다른 축(최상위 키 존재 vs 값 내용)이라 순서를 바꿔도 이론상
    독립적으로 안전해야 한다. 다만 이 합성 자체를 한 테스트가 단언한 적은 없어, 향후 리팩터링이
    두 필터의 순서·중첩을 바꿀 때(예: allowlist 를 먼저 걸고 그 결과에 마스킹을 건다면 드롭된
    키 안의 secret 은 애초에 마스킹 대상에서 빠지므로 결과적으로 안전하지만, 반대로 "허용된 키
    안에 남은 secret 이 실제로 마스킹됐는가"를 보는 테스트가 없으면 이 축이 조용히 깨질 수 있다)
    회귀를 잡아줄 단일 지점이 없다.
  - 제안: 우선순위 낮음(현재 두 축 모두 개별적으로는 확실히 덮여 있고, 별개 테스트로도 실질
    회귀 방지 효과는 충분). 여력이 있다면 `_retryState`(drop 대상)와 `Bearer sk-...`(mask
    대상)를 한 payload 에 같이 넣어 두 결과를 한 테스트에서 동시 단언하면 합성 지점 자체를
    캐너리로 고정할 수 있다.

## 강점 (실측 기반)

- 3라운드 리뷰에 걸쳐 지적된 테스트 갭(`__proto__` 방어, buttons 분기 캐너리, terminal
  result/error 경계 명시, `Object.freeze` 런타임 불변 캐너리, `makeExecution` fixture 타입
  구멍)이 이번 누적 diff에서 **전부** 해소돼 있고, 각각을 뮤테이션으로 재확인한 결과 전부
  판별력을 가진 채로 GREEN/RED 를 정확히 오간다.
- "생성 입력 vs 큐레이션 코퍼스" 함정(`it.each([...NODE_OUTPUT_ALLOWED_KEYS])` 가 목록이 줄면
  케이스도 줄어 조용히 통과하던 문제, `formConfig` 제거 뮤턴트로 91→90건 GREEN 을 낸 이력)이
  리터럴 대조 캐너리로 정확히 완화돼 있고, 취약한 파생 `it.each` 도 그 사실을 아는 주석과 함께
  의도적으로 남아 있다(제거 시 개별 키 통과 검증 소실 — 유지가 정당한 이유가 코드에 있음).
- 테스트 격리: `interaction.service.spec.ts` 신규 케이스 전부가 `makeMocks()`/`makeExecution()`
  으로 매 `it` 마다 독립 mock 인스턴스를 새로 만든다(`beforeEach`/공유 mutable state 없음,
  `grep` 확인). 실행 순서 의존 없음.
- `makeExecution` 의 `overrides` 타입을 반환 타입(`ExecutionFixture`)과 동일 집합으로 좁힌 것은
  실제로 발생했던 사고(19_24_24 라운드에서 `execution.error` 에 넣어야 할 fixture 를 존재하지
  않는 필드에 넣어 캐너리가 처음엔 RED 였던 이력)의 재발을 **컴파일 타임**으로 차단한다 — 런타임
  단언에 의존하지 않는 구조적 해법.
- `getStatus` wiring 캐너리(`_retryState`/`__unknownFutureKey` 드롭 + `config`/`meta`/`output`
  보존을 한 테스트에서 동시 단언)는 "헬퍼는 초록인데 호출부가 안 걸려 있었다"는 이 시리즈가
  반복 겪은 실패 모드를 정확히 겨눈다 — 뮤테이션으로 직접 확인(§검증 방법 5).

## 요약

`nodeOutput` fail-closed allowlist 의 테스트 커버리지는 3라운드 `/ai-review`(CRITICAL 0 수렴,
19_00_23→19_24_24→19_43_33)를 거치며 성숙한 상태이고, 이번 최종 누적 diff 는 그 세 라운드가
남긴 테스트 관점 INFO(freeze 런타임 불변 캐너리 부재, `makeExecution` fixture 타입 구멍) 를
모두 반영했다. 7가지 핵심 주장(컴파일타임 결속·freeze 캐너리 판별력·배선 캐너리 판별력·
`__proto__` 방어 전제·fixture 좁히기 효과 등)을 전부 직접 재실행/뮤테이션으로 재검증했고 전부
일치했다 — 문서가 구현보다 넓게 주장하는 지점이 없다. 새로 지적할 CRITICAL/WARNING 급 테스트
갭은 발견하지 못했다. 남은 두 건은 저비용·저우선순위 INFO(`undefined` 입력 케이스 부재,
마스킹+allowlist 합성 지점을 직접 단언하는 테스트 부재)로, 둘 다 개별 축은 이미 확실히
커버돼 있어 실질 회귀 위험은 낮다.

## 위험도

NONE
