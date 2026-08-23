# 테스트(Testing) 리뷰 — `nodeOutput` fail-closed allowlist

## 발견사항

- **[INFO]** `allowlistNodeOutputKeys` 에 `__proto__`/prototype-pollution 회귀 테스트가 없다 — 자매 함수 관례와 어긋남
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts:189` (describe 블록), 구현은 `codebase/backend/src/shared/utils/strip-external-only-fields.ts:179-192` (`allowlistNodeOutputKeys`)
  - 상세: 같은 파일의 `stripExternalOnlyFields` 는 `__proto__` 키가 있어도 값 손실·프로토타입 오염이 없음을 명시적으로 고정하는 테스트 2건(`strip-external-only-fields.spec.ts:76`, `:95` — "`__proto__` 키가 있어도 값 손실·프로토타입 오염이 없다" / "배열 안의 `__proto__` 도 같은 방식으로 안전하다")을 가진다. `allowlistNodeOutputKeys` 도 동일하게 `{ ...obj }` 스프레드 + `delete out[k]` 로 객체를 재구성하는데(`strip-external-only-fields.ts:188-190`), 이 새 함수에는 대응하는 `__proto__` 케이스가 없다. 코드 검토상 `__proto__` 는 애초에 `NODE_OUTPUT_ALLOWED_KEYS` 에 없으므로 fail-closed 로 항상 제거돼 실질 위험은 낮지만("어떤 키든 목록에 없으면 지운다" 는 설계 자체가 방어), 이 파일이 이미 "CWE-1321 대비 스프레드 방어" 를 명문화한 컨벤션을 갖고 있어 신규 함수에도 같은 커버리지를 기대하게 된다. 회귀 없이는 향후 구현 방식이 스프레드+delete 에서 다른 구성(예: `Object.assign`/수동 대입)으로 바뀔 때 조용히 뚫려도 아무 테스트가 못 잡는다.
  - 제안: `strip-external-only-fields.spec.ts` 의 `allowlistNodeOutputKeys` describe 블록에 자매 테스트와 동일한 형태로 `JSON.parse('{"__proto__":{"llmCalls":["x"]},"config":{}}')` 류 입력을 하나 추가해 `Object.getPrototypeOf(out) === Object.prototype` 을 고정한다.

- **[INFO]** `buttons` variant 응답(`context.buttonConfig.nodeOutput`)에 대한 allowlist 적용 캐너리가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:424-435` (context 조립 분기), 관련 기존 테스트 `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:588-611`
  - 상세: 새 배선 캐너리(`interaction.service.spec.ts:617-642`)는 `node: { type: 'Form' }` 을 써서 `interactionType === 'form'` → `{ ...base, nodeOutput: out }` fallthrough 분기만 통과한다. `interactionType === 'buttons'` 분기(`{ ...base, buttonConfig: { buttons: bc.buttons, nodeOutput: out } }`)는 같은 `out` 참조를 재사용하므로 현재는 함수적으로 안전하지만, 이 분기를 직접 태우는 캐너리가 없다는 점에서 향후 두 분기가 각자 `out` 을 재가공하도록 리팩터링될 경우 `buttons` variant 의 `_retryState`/미지 키 누출을 즉시 잡을 회귀 테스트가 없다.
  - 제안: 기존 `waiting_for_input — buttons 노드 표면을 SSE wire 형식 context 로 복원` 테스트(`:588`)의 `outputData` fixture 에 `_retryState`(또는 미지 키) 를 추가해 `r.context.buttonConfig.nodeOutput` 에서 사라지는지 단언 한 줄만 보태면 저비용으로 닫힌다.

- **[INFO]** terminal `result`/`error` 출구가 allowlist 를 받지 않는다는 설계 결정이 "의도 명시 캐너리" 가 아니라 기존 무관 테스트의 부수 효과로만 커버된다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:509-527` (`execution 존재 시 핵심 필드만 반환` 테스트), 구현은 `codebase/backend/src/modules/external-interaction/interaction.service.ts:459-466` (`result`/`error` 는 `stripAndRedact` 만 통과, `allowlistNodeOutputKeys` 미적용)
  - 상세: `outputData: { final: 'value' }` 가 `r.result` 에 그대로 나가는 이 테스트는 `final` 이 `NODE_OUTPUT_ALLOWED_KEYS` 에 없는 키이므로, 만약 `result`/`error` 조립에도 실수로 `allowlistNodeOutputKeys` 가 걸리면 이 테스트가 깨져 실제로 회귀를 잡는다. 다만 테스트 이름/의도가 "이 필드는 작성자 데이터라 allowlist 를 걸면 안 된다" 를 말하고 있지 않아, 다음 사람이 이 테스트를 다른 이유로 고치다 그 보증을 조용히 잃을 수 있다. 이 파일의 다른 캐너리들이 채택한 관례(`[캐너리]` 접두사 + "지금 이걸 지킨다" 명시)와 결이 다르다. 같은 boundary 를 consistency-check(`18_30_40`) 도 WARNING #1 로 별도 지적했다(spec 문서 미기록) — 테스트 쪽도 같은 경계를 명시하면 spec 문서화와 짝을 이룬다.
  - 제안: 위 테스트 근처에 `it('[캐너리] terminal result 는 nodeOutput allowlist 를 받지 않는다 — 작성자 워크플로 출력이다', ...)` 형태로 별도 캐너리를 하나 추가하거나, 기존 테스트 주석에 그 의도를 한 줄 보탠다.

## 강점 (참고)

- 뮤테이션 검증이 실제로 수행됐고(M1/M2/M2b, `plan/in-progress/nodeoutput-allowlist.md`), 그 과정에서 `it.each([...NODE_OUTPUT_ALLOWED_KEYS])` 가 **구현 상수에서 fixture 를 파생**해 목록이 줄어도 조용히 통과하는 vacuous 케이스(91→90건, 전부 GREEN)를 스스로 발견하고 리터럴 대조 테스트(`strip-external-only-fields.spec.ts:235-257`)로 보강한 점은 이 저장소가 반복 지적해 온 "생성 입력 vs 큐레이션 코퍼스" 함정을 정확히 재현·수정한 모범 사례다.
- "배선 캐너리"(`interaction.service.spec.ts:617`)와 "유틸 캐너리"(`strip-external-only-fields.spec.ts:190-216`)를 의도적으로 분리해, 헬퍼는 맞는데 호출부가 실제로 부르지 않는 이 시리즈의 반복 결함 형태를 정확히 겨냥했다. `M1` 뮤테이션(호출부 배선 제거)이 배선 캐너리만 RED 를 내고 유틸 캐너리는 GREEN 을 유지한다는 관측까지 기록해, 두 테스트가 서로 다른 것을 지킨다는 근거를 남겼다.
- `allowlistNodeOutputKeys` 자체의 계약(참조 동일성 copy-on-change, 비변형, non-object 통과, 최상위만 필터링)이 순수 함수 단위로 촘촘히 커버됐고, `interaction.service.spec.ts` 는 배선만 확인해 책임을 분리했다 — 테스트 가독성·격리 모두 양호.
- 모든 신규 테스트가 `makeMocks()` 로 매 케이스 독립 인스턴스를 생성해 테스트 간 상태 공유가 없다. 기존 테스트는 diff 상 전부 `+`(추가)이고 기존 단언을 건드리지 않아 회귀 위험이 낮다.
- `assertAllowlistCoversHandlerContract` 컴파일타임 결속은 `nest build`(jest 는 타입을 strip) 로만 검증되는데, 이를 인지하고 실제로 `status` 제거 뮤턴트로 `TS2322` 를 실측 확인한 점(`plan/in-progress/nodeoutput-allowlist.md` 뮤테이션 표)은 "타입 가드가 실제로 실행되는지" 를 스스로 검증한 좋은 관례다.

## 요약

새 fail-closed allowlist(`allowlistNodeOutputKeys`)와 그 호출부 배선에 대한 테스트는 캐너리 3종(엔진 내부 필드 누출·미지 키 차단·폼 폴백 보존) + 유틸 단위 계약(참조 동일성·비변형·non-object·최상위-only) + 배선 캐너리로 핵심 경로를 잘 덮었고, 저자 스스로 뮤테이션 검증에서 vacuous 테스트(구현 상수 파생 fixture)를 발견해 리터럴 대조로 보강한 점이 특히 견고하다. 남은 갭은 모두 CRITICAL/WARNING 급은 아니고, (1) 신규 함수의 `__proto__` 안전성이 자매 함수와 달리 명시적으로 고정되지 않음, (2) `buttons` variant 에 임베드된 `nodeOutput` 에 대한 직접 캐너리 부재(현재는 공유 참조로 사실상 안전), (3) terminal `result`/`error` 가 allowlist 를 받지 않는다는 설계 경계가 의도 표명 없이 기존 테스트의 부수 효과로만 지켜지는 점 — 세 가지 모두 저비용 보강이 가능한 INFO 수준이다.

## 위험도

LOW
