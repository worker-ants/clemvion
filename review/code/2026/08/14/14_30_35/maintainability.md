# 유지보수성(Maintainability) 리뷰

이번 라운드는 `12_06_21` consistency CRITICAL 1(REST 스냅샷 `getStatus` 가 fanout 과 달리 `llmCalls` 를 값 마스킹만 하고 필드 제거를 안 해 새고 있던 문제)에 대한 조치 커밋(`34e32e62f`)을 검토 대상으로 한다. 이 커밋은 (1) `stripDeep` 로직을 `websocket.service.ts` 에서 `shared/utils/strip-external-only-fields.ts` 로 승격, (2) `InteractionService.getStatus` 가 그 공유 유틸을 호출하도록 수정, (3) 양쪽에 회귀 테스트를 추가했다. `websocket.service.ts`/`.spec.ts` 자체 로직(재귀 strip·지연 할당·`__proto__` 방어·깊이 경계)은 이전 세 라운드(`10_32_27`/`11_02_16`/`12_06_20`)에서 이미 심층 검토·조치됐고 이번 diff 에서 그 부분의 실질 로직 변경은 없다(단순 위치 이동 + 호출부 파라미터화)는 점을 확인했다.

## 발견사항

- **[WARNING]** 공유 유틸의 "호출부가 같은 값·같은 경계 연산자를 쓴다" 는 계약이 새 REST 호출부에서는 검증되지 않은 채 참으로 서술돼 있다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:36-39`(JSDoc `@param maxDepth`) 및 `:46`(`if (depth > maxDepth) return value;`) ↔ 호출부 `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-354`(`stripExternalOnlyFields(deepRedactSecrets(...), MAX_REDACT_DEPTH)`) ↔ 자매 sanitizer `codebase/backend/src/shared/utils/sanitize-error-message.ts:134`(`if (depth >= MAX_REDACT_DEPTH) return '***';`)
  - 상세: JSDoc 은 "호출부의 자매 sanitizer 와 **같은 값·같은 경계 연산자**를 쓴다" 고 명시한다. 그런데 `stripDeep` 내부의 경계 연산자는 항상 `depth > maxDepth` 로 고정돼 있어 호출부가 실제로 통제할 수 있는 것은 `maxDepth` 값뿐이고, "같은 경계 연산자" 는 caller 가 강제할 수 있는 계약이 아니라 caller 의 자매 함수가 우연히 `>` 를 써야만 성립하는 암묵적 전제다. `websocket.service.ts` 쪽은 자매 `sanitizePayloadForWs` 가 `depth > MAX_SANITIZE_DEPTH`(`:252`)라 실제로 일치하지만(이전 라운드가 실측·통일한 결과), 이번에 새로 연결된 `interaction.service.ts` 쪽 자매 `deepRedactSecrets` 는 `depth >= MAX_REDACT_DEPTH`(`sanitize-error-message.ts:134`)로 **한 단계 이른 경계**를 쓴다. 직접 추적한 결과 이 불일치는 depth 10 노드가 `deepRedactSecrets` 단계에서 이미 문자열 `'***'` 로 collapse 되어 `stripDeep` 이 그 자리를 볼 때는 더 이상 object 가 아니므로(기능적으로는) 무해하다. 다만 이는 REST 경로에 대해 아무 데도 문서화·검증(테스트)돼 있지 않다 — `websocket.service.spec.ts` 쪽은 정확히 이 종류의 어긋남을 `11_02_16` 라운드에서 리뷰어 4명이 갈릴 정도로 심각하게 다뤄 깊이 sweep(`it.each`)으로 결론을 확정하고 연산자를 통일했는데(`websocket.service.spec.ts` 신규 `it.each` 블록), REST 경로에는 그 대응물이 없다. "같은 값·같은 경계 연산자" 라는 강한 계약 문구가, 실제로는 검증되지 않은 새 호출부에 대해서도 참인 것처럼 읽힌다.
  - 제안: JSDoc 문구를 "같은 값을 쓰고, 경계 연산자가 다르더라도 그 caller 의 자매 sanitizer 가 경계에서 subtree 를 scalar 로 collapse 한다면 무해하다" 는 식으로 정밀화하거나, `interaction.service.ts` 호출부 주석에 `deepRedactSecrets` 가 `>=` 를 쓰고 `stripDeep` 은 `>` 를 쓰지만 전자가 먼저 collapse 하므로 무해하다는 점을 `websocket.service.ts` 사례처럼 명시한다. 여력이 되면 `interaction.service.spec.ts` 에도 depth 경계 부근(예: `MAX_REDACT_DEPTH - 1`/`MAX_REDACT_DEPTH`) `llmCalls` 를 넣는 회귀 테스트를 최소 1개 추가해 계약을 실증하는 편이 좋다.

- **[WARNING]** 같은 커밋이 만든 위치 이동을, 그 커밋이 추가한 주석이 옛 위치로 잘못 가리키고 있다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:616`
  - 상세: 신규 테스트의 JSDoc 이 `` `stripDeep`(`websocket.service.ts`)은 SSE·webhook·chat-channel fanout 에서 `llmCalls` 를 깊이 무관으로 지운다. `` 라고 적는다. 그런데 바로 같은 커밋(`34e32e62f`)이 `stripDeep` 함수 자체를 `websocket.service.ts` 에서 `shared/utils/strip-external-only-fields.ts` 로 옮겼다(`websocket.service.ts` 는 이제 그 파일에서 `stripExternalOnlyFields` 를 import 만 한다). 즉 이 파일 참조는 작성 시점부터 이미 stale 하다. 이 저장소는 "같은 커밋이 고친 걸 JSDoc 이 현재형/구위치로 말한다" 는 정확히 같은 유형의 실수를 바로 이전 커밋(`da691b182`)에서도 지적·수정한 이력이 있어, 반복 패턴이다.
  - 제안: `` `stripDeep`(`shared/utils/strip-external-only-fields.ts`) `` 로 파일 참조를 갱신한다.

- **[INFO]** 유사한 "재귀 트리 순회 + lazy clone-on-write" 스켈레톤이 이제 세 벌(`stripDeep`, `sanitizeInner`, `deepRedactObject`)로 늘었고, 변수 명명도 벌마다 다르다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:45-86`(`out`/`s`/`k`/`v`) vs `codebase/backend/src/modules/websocket/websocket.service.ts:266-292`(`sanitizeInner`, `result`/`sanitized`/`mutated`) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:127-160`대(`deepRedactObject`, `mutated`/`out`)
  - 상세: 세 함수 모두 "Array.isArray 분기 → 각 원소 재귀 → 변경 여부 추적(`out ??= …`/`if (!result) result = …`) → 변경 없으면 원본 참조 반환" 골격이 사실상 동일하다. 목적(필드 제거 vs 값 마스킹)이 달라 즉시 통합을 요구할 사안은 아니고, 이 프로젝트는 이미 "axes 발산 시 full-unification 은 defer, 짝점검 관례로 대체" 로 이 트레이드오프를 수용한 바 있다(`10_32_27`/`11_02_16` RESOLUTION INFO 7). 다만 이번 승격으로 세 번째 사본이 별도 파일에 독립 생겼으므로, 다음에 이 클래스의 결함(깊이 경계·`__proto__` 등)이 재발하면 세 곳을 각각 점검해야 한다는 점은 재확인해 둔다.
  - 제안: 즉시 조치 불필요. 프로젝트 관례대로 한쪽을 고칠 때 나머지 두 곳도 같은 결함 클래스가 없는지 짝점검하는 것으로 충분.

- **[INFO]** `interaction.service.ts` 가 "redact" 의미로 명명된 상수(`MAX_REDACT_DEPTH`)를 "strip" 연산의 `maxDepth` 로 재사용한다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-354`
  - 상세: 공유 유틸 JSDoc(`strip-external-only-fields.ts:28-29`, `:37-38`)이 명시적으로 "각 표면이 자기 자매 sanitizer 의 상한을 재사용하라" 고 권고하는 설계이므로 의도된 선택이다. 다만 이름만 보면 `MAX_REDACT_DEPTH` 가 strip 에도 쓰인다는 것이 즉시 드러나지 않아, 처음 읽는 사람은 별도 strip 전용 상수가 있어야 하지 않나 하고 잠깐 멈출 수 있다. 위 첫 WARNING 처방(호출부 주석에 두 상수/연산자 관계 명시)이 이 부분도 자연스럽게 해소한다.
  - 제안: 별도 조치 불필요 — 첫 WARNING 의 주석 보강으로 충분.

## 요약

이번 diff 의 핵심(REST `getStatus` 경로에 `stripExternalOnlyFields` 를 연결해 fanout 과 동일 수준으로 `llmCalls` 를 제거)은 실제로 남아 있던 정보 노출 갭을 정확히 메우고, 새 테스트(`interaction.service.spec.ts`)도 기존 파일의 `makeMocks`/`IEXT_CTX` 관례를 그대로 따르며 대조군(정상 필드 보존 확인)까지 갖춰 이 저장소의 "통째로 날려서 통과" 방지 패턴에 부합한다. `websocket.service.ts` 쪽 로직은 위치만 공유 유틸로 옮겨졌을 뿐 실질 로직·깊이 경계·`__proto__` 방어는 이전 라운드에서 이미 검증된 상태 그대로다. 다만 두 가지가 남는다 — (1) 공유 유틸이 선언하는 "같은 값·같은 경계 연산자" 계약이 새로 연결된 REST 호출부(`deepRedactSecrets` 의 `>=`)에서는 실제로 검증되지 않은 채 참으로 서술돼 있고 대응하는 깊이 경계 테스트도 없다 — 기능적으로는 무해함을 직접 추적해 확인했으나, WS 쪽에서 똑같은 유형의 불일치가 리뷰어 간 CRITICAL 분쟁까지 갔던 이력을 고려하면 문서·테스트로 명시해 둘 가치가 있다. (2) 같은 커밋이 함수를 새 파일로 옮기면서 그 커밋이 추가한 테스트 주석은 옛 파일 위치를 가리키고 있어 즉시 stale 하다. 둘 다 기능 결함은 아니고 문서 정확성/테스트 커버리지 성격의 WARNING 이다. 그 외 함수 길이·중첩 깊이·네이밍 컨벤션·매직 넘버는 문제 없다.

## 위험도

LOW
