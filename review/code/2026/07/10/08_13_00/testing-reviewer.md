# 테스트 리뷰 — EIA §R17 잔여 하드닝 (HEAD 8d39d65ee)

리뷰 대상: `codebase/backend/src/shared/utils/sanitize-error-message.ts`(+spec),
`codebase/backend/src/modules/external-interaction/interaction.service.ts`(+spec),
`codebase/backend/test/external-interaction.e2e-spec.ts`

## 실행 결과

```
cd codebase/backend && npx jest src/shared/utils/sanitize-error-message.spec.ts \
  src/modules/external-interaction/interaction.service.spec.ts --silent
Test Suites: 2 passed, 2 total
Tests:       63 passed, 63 total
```

느슨한 패턴(`sanitize-error-message interaction.service.spec`)으로도 재확인:
button/form-interaction.service.spec 포함 4 suites / 104 tests 전부 pass.

추가로 확인한 것(요청 범위 밖이지만 회귀 안전성 확인차):
- `npx tsc --noEmit -p tsconfig.json` — 변경 파일(`sanitize-error-message.ts`, `interaction.service.ts`
  및 각 spec) 관련 에러 0건. (carousel/chart/table 쪽 pre-existing `TS18046` 다수는 이 diff 와 무관 —
  `git diff HEAD~1 HEAD --stat -- codebase/backend/src/nodes` 공집합으로 확인, 미변경 파일.)
- `npx eslint <5개 변경 파일>` — 경고/에러 0건.
- e2e(`test/external-interaction.e2e-spec.ts`)는 docker `backend-e2e` 컨테이너가 기동돼 있지 않아
  (`docker ps` 확인) 이번 리뷰에서 실행하지 않음 — 정적 리뷰로 대체. 커밋 메시지의 "248 e2e pass" 는
  별도 세션 결과로, 이 리뷰에서 재검증하지 않았음을 명시.

## 발견사항

- **[WARNING]** 이 커밋의 핵심 변경(P1-2, terminal `result`/`error` outputData 마스킹)이 e2e 레벨에서
  검증되지 않음 — mock 기반 unit 만 존재
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` 신규 `it('I. ...')`
    (`interaction.service.ts:331-346` 이 실제 변경 대상)
  - 상세: 이번 diff 의 실제 신규 로직은 `getStatus` 의 `result`(COMPLETED)/`error`(FAILED) 마스킹이다.
    그런데 새로 추가된 e2e 케이스 `I.`는 `status: 'waiting_for_input'` execution 을 seed 해
    `conversation_thread`·`nodeOutput.conversationConfig` 마스킹(PR #876 에서 이미 강제된 기존 경로)만
    실 DB round-trip 으로 검증한다. `result`/`error` 마스킹은 `interaction.service.spec.ts`의
    `makeMocks()`(TypeORM repo 전체 mock, `execution.outputData` 는 순수 JS 객체 literal)로만 커버돼,
    실제 Postgres JSONB 컬럼 → TypeORM entity 역직렬화 경로를 한 번도 거치지 않는다. 로직 자체는
    단순(`deepRedactSecrets` 위임)해 실제 버그 가능성은 낮지만, plan 문서(P3-7)가 명시한 "e2e 로
    wire 마스킹 검증"의 대상에서 정작 이번 커밋의 헤드라인 변경 경로가 빠져 있다.
  - 제안: 기존 `I.` 테스트에 COMPLETED(또는 FAILED) execution 케이스를 하나 더 추가(또는 별도
    `it('J. ...')`) — `outputData` 에 secret 을 심어 `res.body.data.result`(혹은 `.error`) 가 실 DB
    round-trip 후에도 `***` 로 마스킹되는지 확인.

- **[INFO]** e2e `I.` 의 어서션이 whole-wire substring 방식이라 "필드 누락"과 "마스킹됨"을 구분 못 함
  - 위치: `test/external-interaction.e2e-spec.ts:401-408`
  - 상세: `JSON.stringify(res.body)` 통짜 문자열에 `not.toContain(secret)` / `toContain('***')` /
    `toContain('msg')` 로 검증한다. 만약 회귀로 `context.nodeOutput` 또는 `context.conversationThread`
    필드 자체가 응답에서 누락된다면(마스킹이 아니라 필드가 빠지는 버그), `not.toContain(secret)` 은
    trivial 하게 통과해 버그를 못 잡는다. `toContain('***')`/`toContain('msg')` 가 부분적으로 이를
    완화하지만("뭔가는 마스킹됐다"만 증명), 어느 필드가 마스킹됐는지는 증명하지 못한다.
    다만 이 패턴은 기존 `F.`(`expect(JSON.stringify(res.body)).not.toContain('10000')`) 등과 동형이라
    이 프로젝트의 기존 e2e 관용구이며, 새로 도입된 약점은 아니다.
  - 제안(선택적 강화): `res.body.data.context.conversationThread.turns[0].text` 와
    `res.body.data.context.nodeOutput.conversationConfig.message` 를 직접 참조해 `toContain('***')`
    로 필드 단위 검증을 추가하면 vacuous-pass 리스크를 없앨 수 있음. 우선순위는 낮음(기존 컨벤션과
    일관되고, 코드 경로상 필드가 조용히 사라질 가능성은 낮음).

- **[INFO]** FAILED 케이스에 "정상 데이터 보존" 양성 체크가 비대칭적으로 빠짐
  - 위치: `interaction.service.spec.ts:706-719` (`COMPLETED result / FAILED error 의 outputData secret 도 마스킹`)
  - 상세: COMPLETED 분기는 `expect(rblob).toContain('ok')` 로 "정상 결과 데이터 보존"을 명시적으로
    검증하지만, FAILED 분기(`outputData: { message: 'boom', api_key: '...' }`)는 대응하는
    `expect(eblob).toContain('boom')` 이 없다. 같은 `deepRedactSecrets` 경로를 타므로 실질 리스크는
    낮지만, 리뷰 요청의 "과잉 마스킹 아님도 검증되나" 관점에서 FAILED 쪽만 비대칭.
  - 제안: `expect(eblob).toContain('boom')` 한 줄 추가로 대칭 확보.

- **[INFO]** `deepRedactSecrets` 캐시의 "서로 다른 입력 간 독립성" 명시적 테스트 없음(구조적으로는 안전)
  - 위치: `sanitize-error-message.spec.ts:150-156`
  - 상세: 추가된 캐시 테스트는 "동일 참조 재호출 → 동일 결과 reference"만 검증한다. `WeakMap` 키가
    객체 identity 이므로 서로 다른 리터럴 객체가 충돌할 수 없어 구조적으로 안전하고, 같은 describe
    블록의 다른 `it()`들이 각기 다른 객체로 올바른 마스킹 결과를 얻는 것으로 간접 반증되긴 한다.
    다만 "캐시가 정확성을 깨뜨리지 않는지"를 직접 겨냥한 테스트(예: 서로 다른 두 입력을 연속 호출해
    각각 올바르게 마스킹되는지)는 없음 — 리뷰 필요성 평가상 낮은 우선순위(WeakMap identity 의미론상
    거의 불가능한 실패 모드).
  - 제안(선택적): `const a = { note: 'Bearer sk-A' }; const b = { note: 'Bearer sk-B' };` 두 개를
    연속 호출해 각각의 마스킹 결과가 서로 오염되지 않는지 1건 추가하면 캐시 키가 실수로 상수/얕은
    키로 바뀌는 미래 리팩터링 회귀를 더 직접적으로 잡음.

- **[INFO]** 캐시의 "재호출 사이 입력 mutation" staleness 케이스 미검증(현재 호출부 기준 저위험)
  - 위치: `sanitize-error-message.ts:117-124` (`DEEP_REDACT_CACHE`)
  - 상세: 동일 object reference 로 `deepRedactSecrets` 를 호출한 뒤, 그 사이 caller 가 원본 객체를
    in-place mutate 하고 다시 호출하면 캐시가 stale(구 내용 기준 마스킹 결과)을 반환한다.
    `deepRedactSecrets` 자체는 입력을 mutate 하지 않음이 테스트로 보장되지만("does not mutate the
    input"), *caller* 가 mutate-then-recall 하는 패턴은 계약 밖이라 테스트 대상도 아니다. 실제 호출부
    3곳(`ai-turn-orchestrator.service.ts`, `interaction.service.ts`, `thread-renderer.ts`)을 확인한
    결과 전부 매 호출마다 새 object literal 또는 fresh DB 조회 결과를 넘겨 캐시 hit 이 사실상 발생하지
    않는 패턴이라, 이 staleness 리스크가 실제로 트리거될 호출부는 현재 없음. sibling
    `sanitizePayloadForWs`(`websocket.service.ts` `SANITIZE_CACHE`)가 이미 동일한 캐시 계약을 갖고
    있어 이번 변경이 새로 도입한 리스크는 아님. 액션 불요, 참고로만 기록.

- **[INFO]** COMPLETED/FAILED + `outputData: null`(또는 `undefined`) 조합이 서비스 레벨에서 명시 테스트되지 않음
  - 위치: `interaction.service.ts:333-345` (`execution.outputData ?? null`)
  - 상세: `deepRedactSecrets(null)` 자체는 `sanitize-error-message.spec.ts`("passes through non-string
    primitives")에서 이미 커버되어 크래시 위험은 없음. 다만 `getStatus` 서비스 레벨에서 COMPLETED/FAILED
    이면서 `outputData` 가 null 인 케이스(예: 엔진 버그로 output 누락)를 직접 찌르는 테스트는 없어,
    타입 캐스트(`as Record<string, unknown> | null`)가 실제로 `result: null` 을 만들어내는지 회귀 보호가
    간접적(다른 스펙 파일의 patterns 재사용)에 그침. 우선순위 낮음.

## 회귀 확인

- `deepRedactObject` 추출은 순수 리팩터링(로직 이동, 동작 불변)이며 `deepRedactSecrets` 를 통해서만
  도달 가능한 private 함수다. 기존 `deepRedactSecrets` 테스트 스위트(중첩 문자열 마스킹, credential-키
  전체 마스킹, 배열, JSON leaf, depth cap, no-mutation, copy-on-change reference 보존)가 그대로
  `deepRedactObject` 의 로직을 exercise 하며 전부 pass — 회귀 보호 충분.
- 기존 `getStatus` 회귀 테스트(`execution 존재 시 핵심 필드만 반환` — `result: { final: 'value' }`,
  `failed status 면 outputData 가 error 필드로` — `error` 에 `NODE_FAILED`/`message` 포함)는 secret-shape
  이 아닌 데이터라 `deepRedactSecrets` 래핑 후에도 `toMatchObject`가 통과함을 실행으로 확인(deep-equal
  이므로 copy-on-change 의 참조 동일성 여부와 무관하게 값 비교로 안전). 새 마스킹 도입으로 인한 기존
  테스트 파손 없음.

## 요약

핵심 요구사항(COMPLETED result / FAILED error 마스킹의 양방향 unit 커버리지, 정상 데이터 보존 검증,
캐시 hit 검증, e2e 로 conversation_thread·nodeOutput 두 표면 모두 실 DB round-trip 검증, 기존
`deepRedactSecrets`/`getStatus` 회귀 테스트 보존)는 모두 충족되며 63/63(target) 및 104/104(느슨한
패턴) unit 테스트가 실제로 pass 했다. tsc/eslint 도 변경 파일 기준 클린. 다만 이번 diff 의 실제 신규
로직인 terminal `result`/`error` 마스킹은 e2e 레벨에서 검증되지 않고(신규 e2e `I.` 는 PR #876 에서
이미 닫힌 conversationThread/nodeOutput 경로만 실 DB 로 재확인) mock 기반 unit 에만 의존한다는 갭이
있어 WARNING 하나로 표시했다. 그 외는 전부 INFO 수준의 선택적 보강 항목(대칭성, 캐시 독립성 명시화,
필드 단위 e2e 어서션 강화)으로, 어느 것도 머지를 막을 수준은 아니다.

## 위험도

LOW
