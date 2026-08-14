# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `stripDeep` 의 JSDoc 이 약속하는 "no allocation on the common path" 가 실제 구현과 다르다 (문서한 보장이 구현보다 넓다)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:325-331` (JSDoc), `:349-374` (`stripDeep` 구현, 특히 object 분기 `:363` `const out: Record<string, unknown> = {};`)
  - 상세: JSDoc 은 "Clone-on-write: a subtree with nothing to strip is returned by reference, so the common path (no stripped field anywhere) **allocates nothing** and returns the original envelope identity" 라고 명시한다. 그러나 `stripDeep` 의 object 분기는 순회를 시작하기 **전에** `out = {}` 를 무조건 만들고, 모든 key 를 다 채운 뒤에야 `changed` 로 버릴지 결정한다(`:363-372`). array 분기도 `value.map(...)` 로 매 호출마다 새 배열을 무조건 만든다(`:352-357`). 즉 트리의 **모든 중첩 레벨**에서 strip 대상이 하나도 없어도 임시 객체/배열이 할당됐다가 버려진다 — 최상위 반환 객체의 참조 동일성(테스트가 검증하는 대상)은 보존되지만, "allocates nothing" 이라는 문구 자체는 사실이 아니다. 같은 파일의 `sanitizeInner` 의 object 분기(`:276-289`)는 `result` 를 `null` 로 시작해 실제로 바뀌는 key 를 만났을 때만 `{...obj}` 를 할당하는 **진짜** lazy clone-on-write 라, 같은 파일 안에서 "no allocation" 을 주장하는 두 구현의 실제 동작이 다르다.
  - 제안: JSDoc 문구를 실제 동작에 맞게 낮추거나(예: "no allocation **at the top level** when nothing is stripped"), object 분기를 `sanitizeInner` 처럼 `out: Record<string, unknown> | null = null` 로 시작해 첫 제거/변경이 발생할 때만 얕은 복사하도록 바꿔 문서와 구현을 일치시킨다. hot path(모든 execution 이벤트 emit)에서 도는 함수라 GC 압력 관점에서도 실익이 있다.

- **[INFO]** `stripDeep` 에는 `sanitizeInner`/`sanitizePayloadForWs` 가 갖는 `MAX_SANITIZE_DEPTH` 같은 깊이 캡이 없고, 이 함수 자체의 시그니처/JSDoc 도 그 전제를 명시하지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349` (`stripDeep` 선언), 비교 대상 `:249-251` (`sanitizePayloadForWs` 의 `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`)
  - 상세: 지금은 `emitExecutionEvent`/`emitNodeEvent` 양쪽 모두 `sanitizePayloadForWs` 로 depth 10 이하로 이미 잘린 `wireEnvelope` 에만 `stripExternalOnlyFields`(`stripDeep`)를 호출하므로 실제로는 안전하다(우연이 아니라 두 호출부가 동일 순서를 지키기 때문). 하지만 이 불변식은 `stripDeep`/`stripExternalOnlyFields` 자체의 계약이 아니라 **호출 순서에만 암묵적으로 의존**한다. 향후 sanitize 를 거치지 않은 원본 payload 에 `stripExternalOnlyFields` 를 직접 호출하는 경로가 추가되면 방어가 없다.
  - 제안: 최소한 JSDoc 에 "caller 는 이 함수를 호출하기 전에 `sanitizePayloadForWs` 로 depth 를 제한해야 한다" 는 전제를 명시하거나, `stripDeep` 자체에도 `MAX_SANITIZE_DEPTH` 와 동일한 캡을 두어 두 함수의 방어 수준을 맞춘다.

- **[INFO]** `stripDeep` 과 `sanitizeInner` 가 사실상 동일한 "재귀 트리 순회 + clone-on-write" 알고리즘을 별도로 두 벌 구현하고 있다 (변경 여부 플래그 이름도 `changed` vs `mutated` 로 갈린다)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349-374` (`stripDeep`) vs `:265-291` (`sanitizeInner`)
  - 상세: 하나는 이름 기반 필드 삭제(strip), 하나는 키 패턴 기반 값 마스킹(redact) 이라 목적은 다르지만, "Array.isArray 분기 → 각 원소 재귀 → 변경 여부 추적 → 변경 없으면 원본 참조 반환" 이라는 트리 순회 스켈레톤 자체는 거의 동일하다. 이번 PR 이 고친 버그(`stripExternalOnlyFields` 가 원래 top-level 전용이라 새고 있었던 것)가 재발한다면, 같은 유형의 실수가 `sanitizeInner` 에도 독립적으로 존재할 수 있고 두 곳을 따로 고쳐야 한다.
  - 제안: 프로젝트 관례상("axes 발산 시 full-unification 은 defer") 즉시 통합을 요구하진 않지만, 두 함수 중 하나를 수정할 때 다른 하나도 같은 클래스의 결함(depth 미처리 등)이 없는지 짝지어 점검하는 관례를 남겨두는 편이 안전하다.

- **[INFO]** `EXTERNAL_STRIPPED_FIELDS` 를 배열로 두고 `.includes(k)` 로 멤버십을 검사한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:365`
  - 상세: 지금은 원소가 `'llmCalls'` 하나뿐이라 문제 없지만, hot path(모든 execution/node 이벤트 emit 마다 모든 키에 대해 호출)에서 필드가 늘어나면 `.includes` 는 O(n) 이다.
  - 제안: 필드가 2개 이상으로 늘어날 계획이 있으면 `Set` 으로 바꿔 `has()` O(1) 조회를 쓰는 편이 확장에 안전하다. 지금 시점엔 우선순위 낮음.

## 요약

핵심 변경(`stripExternalOnlyFields` 를 depth-1 shallow delete 에서 재귀적 `stripDeep` 으로 교체)은 실제로 새고 있던 중첩 `llmCalls` 를 정확히 막는 필요한 수정이고, JSDoc·SoT 링크·테스트(중첩 두 경로 동시 커버 + no-op 시 참조 동일성)가 잘 갖춰져 기존 코드베이스의 무거운 주석 관례와도 일치한다. 다만 `stripDeep` 이 선언하는 "공통 경로는 할당이 없다" 는 성능 보장이 실제 구현(모든 중첩 레벨에서 임시 객체/배열을 만들고 버림)보다 넓게 쓰여 있어, 이 프로젝트가 반복적으로 지적해 온 "문서한 보장이 구현보다 넓다" 패턴이 재현됐다. 이는 정확성 버그는 아니지만 향후 유지보수자가 문서만 보고 성능 특성을 오판할 수 있는 지점이며, 같은 파일에 이미 존재하는 진짜 lazy clone-on-write(`sanitizeInner`)와 나란히 있어 대비가 뚜렷하다. 그 외에는 네이밍·함수 길이·중첩 깊이·매직 넘버 등에서 심각한 문제가 없고, 새 테스트도 describe 블록 배치·명명 컨벤션을 잘 따른다. `plan/`·`review/` 하위 마크다운 파일(파일 3~12)은 코드가 아니라 계획/검토 산출물이라 본 관점(가독성/네이밍/함수 길이 등)의 적용 대상이 아니다.

## 위험도

LOW
