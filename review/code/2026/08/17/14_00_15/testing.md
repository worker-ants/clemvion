# 테스트(Testing) 리뷰 — `token` 계열 값·키 패턴 마스킹 확장

## 발견사항

- **[WARNING] `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 미러 확장에 회귀 테스트가 없다 — 뮤테이션으로 실증**
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` (신규 `it.each` 계열 테스트 부재). 대응 production 변경: `codebase/backend/src/modules/websocket/websocket.service.ts:74-75`(`CREDENTIAL_KEY_PATTERN` → `[a-z0-9_-]*token`)
  - 상세: `websocket.service.ts:67-73` 의 신규 JSDoc 은 "`shared/utils/sanitize-error-message.ts` 의 동명 상수와 **의도된 미러**이므로 한쪽만 고치면 그쪽 JSDoc 의 '같은 클래스를 방어한다' 서술이 거짓이 된다 — **함께 갱신한다**" 라고 명시한다. 실제로 `sanitize-error-message.ts` 쪽은 `CREDENTIAL_KEY_PATTERN` 확장과 함께 `sanitize-error-message.spec.ts` 에 `token` 계열 FAMILY(`token`/`access_token`/`refresh-token`/`id_token`/`csrf_token`/`csrfToken`/`session_token`/`x-auth-token`) 8종을 값 축·키 축 양쪽에서 `it.each` 로 고정하고 오탐 경계 캐너리까지 추가했다. 반면 **미러 대상인 `websocket.service.ts` 쪽은 프로덕션 정규식만 바뀌고 `websocket.service.spec.ts` 에는 대응 테스트가 전혀 추가되지 않았다.** 기존 테스트(`websocket.service.spec.ts:119-150` `'redacts the full credential key pattern set...'`)는 이번 변경 이전부터 있던 `accessToken`/`refresh_token` 만 다루고, 이번에 새로 커버되는 접두형(`csrf_token`/`csrfToken`/`session_token`/`x-auth-token` 등)은 검증하지 않는다.
    직접 뮤테이션 검증(scratch 사본으로 복원 후 원복 완료): `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 을 이번 PR 이전 커밋의 정확한 옛 정규식(`/^(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization|cookie)$/i`)으로 되돌린 뒤 `npx jest src/modules/websocket/websocket.service.spec.ts` 를 실행하면 **48개 테스트 전원 GREEN** — 이번 수정이 되돌려져도 이 spec 파일은 전혀 신호를 주지 못한다. plan 체크리스트가 주장하는 "뮤테이션 검증: 값-축 되돌리면 6 RED, 키-축 되돌리면 8 RED" 는 `sanitize-error-message.spec.ts` 만 대상으로 한 것이고, 정작 "함께 갱신한다"고 선언한 미러 파일(`websocket.service.ts`)의 회귀 안전망은 검증되지 않은 채 남아 있다. 프로덕션 수정 자체는 두 미러 모두에 올바르게 적용됐으므로 지금 당장 데이터가 새는 결함은 아니지만, 이 저장소가 반복적으로 겪어 온 "자매 중 하나만 하드닝/테스트가 미적용" 클래스의 재발 소지다 — 다음에 누군가 `websocket.service.ts` 쪽만 실수로 좁히거나 되돌려도 CI 는 통과한다.
  - 제안: `sanitize-error-message.spec.ts:367-417` 의 `FAMILY` 배열과 동일한 형태(또는 공유 fixture)로 `websocket.service.spec.ts` 에도 `it.each(FAMILY)` 회귀 테스트를 추가해 `sanitizePayloadForWs`/`emitBackgroundRunEvent` 경로에서 접두 `token` 계열 키가 `[REDACTED]` 로 마스킹되는지 확인하고, 오탐 경계 캐너리(`tokenizer` 류)도 함께 이식한다.

- **[INFO] 값-축 쿼리스트링 테스트가 비-시크릿 파라미터 보존을 단언하지 않는다 — 자매 테스트 대비 약함**
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (`'token 계열 — 값 축과 키 축을 같은 표로 고정'` describe 안 `'값 축: 따옴표·쿼리스트링 형태도 잡는다'` 케이스, `redactSecrets('cb?token=sk-live-abc123&state=x')` 단언부)
  - 상세: 이 케이스는 `sk-live-abc123` 이 사라졌는지만 확인하고 `state=x` 가 보존되는지는 단언하지 않는다. 같은 패턴 변경을 검증하는 자매 테스트 `mcp-error-codes.spec.ts` (`'쿼리스트링 bare token 을 마스킹하고 비-시크릿 파라미터는 보존'`)는 `redactMcpSecrets('GET /rpc?token=abc123&foo=bar failed')` 에 대해 `expect(out).toContain('foo=bar')` 로 인접 파라미터 보존까지 명시적으로 고정한다. `[A-Za-z0-9_-]*token` 이 그리디하게 확장돼 `&` 뒤 파라미터까지 삼키는 회귀가 나도 이 특정 케이스는 잡지 못한다(다른 케이스들이 간접적으로 커버할 가능성은 있으나 이 테스트 자체의 의도가 흐려짐).
  - 제안: `expect(redactSecrets('cb?token=sk-live-abc123&state=x')).toContain('state=x')` 한 줄을 추가해 `mcp-error-codes.spec.ts` 와 동일한 보존 단언을 맞춘다.

- **[INFO] ReDoS 벤치마크가 자동화된 회귀 테스트로 커밋되지 않음**
  - 위치: `plan/in-progress/eia-secret-pattern-token-family.md` 체크리스트 (`- [x] ReDoS 벤치마크 — 2배씩 늘려 배율 정확히 2배(선형)`), 대응 코드: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS`
  - 상세: 이번에 넓어진 `[A-Za-z0-9_-]*token` 대안은 단일 `*` 정량자 + 리터럴이라 구조상 중첩 정량자로 인한 이차 백트래킹 위험은 낮아 보이고, 실측(선형 배율)도 plan 에 기록돼 있다. 다만 이 측정은 개발 중 1회성 수기 벤치마크로 보이며, `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts`·`websocket.service.spec.ts`·`mcp-error-codes.spec.ts` 어디에도 이 벤치마크를 고정하는 자동 회귀 테스트(예: 서브프로세스+timeout 로 큰 입력에 대해 처리시간 상한 단언)가 없다. 이후 이 대안에 정량자가 추가되는 식으로 패턴이 다시 넓어지면 회귀를 잡을 안전망이 없다.
  - 제안: 필수는 아니나, 다른 정규식(예: `condition-evaluator.util.spec.ts`)이 쓰는 "입력 크기를 2배씩 늘려 처리시간 배율이 임계 이하인지" 패턴을 캐너리로 하나 추가하면 향후 정규식 확장 시 안전망이 된다.

## 요약

이번 변경의 핵심 테스트 자산(`sanitize-error-message.spec.ts` 의 신규 `token` 계열 FAMILY 테이블)은 값 축·키 축을 나란히 고정하고 오탐 경계·받아들이는 오탐(opaque cursor)까지 캐너리로 문서화해 품질이 높다. `mcp-error-codes.spec.ts` 도 케이스를 삭제하지 않고 "이관됐다"는 사실을 주석과 새 테스트명으로 남겨 characterization 성격을 잘 보존했다. 그러나 production 코드가 "의도된 미러"라고 명시적으로 선언한 `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` 확장은 `websocket.service.spec.ts` 에 대응 회귀 테스트가 전혀 없고, 옛 정규식으로 되돌려도 그 spec 파일의 48개 테스트가 전부 GREEN 으로 남는 것을 직접 뮤테이션으로 확인했다 — 프로덕션 수정 자체는 올바르지만 이 저장소가 반복적으로 겪어 온 "자매 중 하나만 테스트/하드닝이 붙는" 패턴의 재발 소지이므로 WARNING 으로 분류한다. 그 외에는 값-축 쿼리스트링 테스트의 보존 단언 누락, ReDoS 벤치마크의 미자동화 등 경미한 완결성 갭만 남아 있다.

## 위험도

MEDIUM — CRITICAL 급 결함은 없음(프로덕션 마스킹 자체는 두 미러 모두 정확히 확장됨). 다만 "의도된 미러" 라고 스스로 선언한 파일 한쪽에 회귀 테스트가 전무하다는 점(뮤테이션으로 실증됨)은 이 저장소의 반복 결함 클래스와 정확히 일치해 단순 완결성 이슈보다 무겁게 본다.
