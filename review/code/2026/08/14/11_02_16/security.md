# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/websocket/websocket.service.ts` — `stripExternalOnlyFields`/`stripDeep` 를 top-level(depth-1) shallow strip 에서 깊이-무관 재귀 strip 으로 교체한 보안 수정. 직전 라운드(`10_32_27`) 리뷰에서 지적된 `__proto__` 오염(W1)·깊이 상한 부재(W4)를 이번 diff 가 이미 처방했다(코드에 반영된 상태를 직접 열어 확인).
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 중첩 `llmCalls` 두 경로 leak 회귀 테스트 + identity 테스트 추가.
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` 신규 파일 — 문서/산출물. 보안 표면(인젝션·인증·시크릿) 없음. `websocket.service.spec.ts` 의 `'SECRET PROMPT A/B'` 는 테스트 리터럴이며 실제 시크릿 아님.

## 발견사항

- **[WARNING]** `stripDeep` 의 깊이 상한이 형제 함수 `sanitizePayloadForWs`/`sanitizeInner` 와 **비교 연산자가 다르다** (`>=` vs `>`) — "형제와 같은 상한을 쓴다"는 문서 주장과 실제 경계가 1-level 어긋난다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387` (`stripDeep`: `if (depth >= MAX_SANITIZE_DEPTH) return value;`) — 대조: 함수 `sanitizePayloadForWs` 의 depth 체크(`if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`, 이번 diff 로 변경되지 않은 기존 코드라 게이트 없음, 실제 파일 250~251행)
  - 상세: `stripDeep` JSDoc(게이트 360~364)은 "깊이 상한은 형제와 같은 `MAX_SANITIZE_DEPTH` 를 쓴다"고 명시하지만, 실제 비교 연산자가 다르다. `sanitizePayloadForWs` 는 `depth > 10` 일 때만(즉 depth 11+) 객체를 `'[REDACTED_DEPTH]'` 로 대체하므로 depth 0~10 은 "실제 구조"로 남는다. 반면 `stripDeep` 은 `depth >= 10` 이면(즉 depth 10 부터) 아무 처리 없이 즉시 원본을 반환한다 — 자신이 지금 순회 중인 객체가 `llmCalls` 라는 키를 직접 갖고 있어도 그 키 검사 자체를 건너뛴다. 이는 wireEnvelope 이 `sanitizedPayload` 를 top-level spread 하는 구조라 depth 번호가 두 함수 사이에서 정합적으로 대응하므로 실제로 재현 가능한 경계 조건이다: `llmCalls` 를 직접 담은 객체 O 가 정확히 depth 10 에서 만나지면, `stripDeep` 은 O 를 stripping 없이 그대로 통과시킨다.
    실측으로 영향 범위를 좁혀 확인했다 — 이 경계에서 O.llmCalls 값 자체(객체/배열)는 depth 11 이 되어 `sanitizePayloadForWs` 가 이미(=`stripDeep` 이전 단계에서) `'[REDACTED_DEPTH]'` 문자열로 대체해 둔 상태이므로, **현재 데이터 구조(항상 object-래핑된 `LlmCallRecord[]`)에서는 실제 raw prompt 내용까지 새지는 않는다.** 다만 (a) `llmCalls` 라는 **키 이름 자체**는 `"[REDACTED_DEPTH]"` 값과 함께 외부 fanout envelope 에 노출될 수 있어 "필드명 자체가 문서화된 비밀 마커이므로 이름으로 막는다"는 이번 diff 의 설계 의도(주석 313~314행)를 정확히 어긴다. (b) 더 중요하게는, 이 정합성이 "우연히 안전"한 것이지 `stripDeep` 자신의 방어가 아니다 — 향후 `llmCalls` 값이 primitive(예: 요약 문자열)로 바뀌거나 depth 10 이 아니라 depth 9(=아직 protected)/11(=이미 sanitize 로 제거됨) 사이의 미묘한 경계가 재조정되면, 또는 `stripDeep` 이 sanitize 를 거치지 않은 경로에 재사용되면(형제 함수 JSDoc·이번 diff 자체가 "호출 순서에 기대는 불변식은 함수 자신의 방어가 아니다" 라고 명시적으로 경고한 바로 그 시나리오) 실제 내용 유출로 이어질 수 있다. 이 프로젝트가 반복적으로 지적받아 온 "방어의 정의를 한 칸 좁게 잡는다" 패턴과 동일한 형태다.
    현재 테스트(`websocket.service.spec.ts:199` 의 `MAX_SANITIZE_DEPTH` 경계 테스트)는 `sanitizePayloadForWs` 자체의 경계만 검증하고, `stripExternalOnlyFields`/`stripDeep` 의 경계(특히 두 함수 간 정합성)는 어떤 테스트도 커버하지 않는다 — 이번 회귀가 조용히 들어올 수 있었던 이유다.
  - 제안: `stripDeep` 의 경계 연산자를 `sanitizePayloadForWs` 와 동일하게 `depth > MAX_SANITIZE_DEPTH` 로 맞추거나(가장 단순), 현재 `>=` 를 유지한다면 최소한 JSDoc 에 "depth 10 에서는 key 이름만 노출될 수 있고 내용은 이미 sibling 이 redact 했다"는 전제를 정확히 적어 "형제와 같다"는 과장된 문구를 정정한다. 회귀 가드로 `llmCalls` 를 정확히 depth 10(부모 객체 기준)에 배치한 payload 로 fanout 결과에 `llmCalls` 키가 남아 있지 않은지 확인하는 테스트를 `websocket.service.spec.ts` 의 nested-strip 블록에 추가할 것을 권고.

- **[INFO]** (확인 완료, 문제 없음) 직전 라운드(`10_32_27`)에서 지적된 CWE-1321 프로토타입 오염(W1)은 실제로 닫혀 있다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:400-419` (`stripDeep` 의 object 분기)
  - 상세: `out ??= { ...obj }` (spread-먼저) 뒤 `Object.defineProperty(out, k, {...})` 로 값을 쓰므로, `k === '__proto__'` 인 경우에도 (1) spread 가 이미 own data property 로 `__proto__` 를 옮겨 놓아 상속 accessor 를 shadow 하고, (2) `Object.defineProperty` 는 `[[DefineOwnProperty]]` 를 사용해 애초에 accessor 를 타지 않는다(스프레드 없이 `{}` 로 시작했어도 `defineProperty` 단독으로 안전했을 것 — JSDoc 이 "중복 방어"라 부르는 것이 정확하다). `delete out[k]`(llmCalls 제거 경로, 게이트 405) 는 키가 항상 `'llmCalls'` 리터럴이라 `__proto__` 오염 경로와 무관해 안전하다. 배열 분기(`stripDeep` 게이트 389-397)도 `value.slice()` 기반 clone-on-write 로 인덱스 대입만 하므로 프로토타입 오염 표면이 없다.

- **[INFO]** (확인 완료, 문제 없음) 깊이 상한 도입(`depth >= MAX_SANITIZE_DEPTH`) 자체는 스택 오버플로/DoS 방어로서는 유효하게 동작한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387`
  - 상세: 위 WARNING 은 "형제와 정확히 같은 경계인가"에 대한 지적이지, 상한이 전혀 없다는 뜻은 아니다 — 무제한 재귀로 인한 `RangeError` 가능성은 이번 diff 로 실제로 닫혔다(직전 라운드 W4 처방 유효).

## 요약

핵심 변경(`EXTERNAL_STRIPPED_FIELDS` strip 을 top-level shallow 에서 깊이-무관 재귀로 하드닝)은 실제로 존재했던 raw LLM 프롬프트/대화 이력 정보 노출을 정확히 막는 정당한 보안 수정이며, 직전 라운드에서 지적된 CWE-1321 프로토타입 오염(스프레드 우선 + `Object.defineProperty`)과 무제한 재귀 깊이(depth cap 부재)는 코드를 직접 열어 확인한 결과 실제로 처방돼 있다. 다만 이번에 새로 추가된 depth cap 자체가 형제 함수의 경계 연산자(`>`)와 미묘하게 다른 연산자(`>=`)를 써서, "형제와 같은 상한을 쓴다"는 문서 주장이 정확히는 사실이 아닌 1-level 어긋난 경계를 만든다 — 현재 데이터 구조상 실제 raw content 유출로는 이어지지 않지만(내용은 sibling `sanitizePayloadForWs` 가 한 단계 안쪽에서 이미 redact), `llmCalls` 라는 필드명 자체가 특정 깊이(정확히 10)에서 stripping 을 우회할 수 있어 "이름 기반으로 위치 무관하게 막는다"는 이번 수정의 설계 의도를 부분적으로 어기고, 어떤 테스트도 이 경계를 커버하지 않는다. CRITICAL 급 활성 유출은 없으나, 이 저장소에서 반복된 "방어 경계를 한 칸 좁게 잡는" 패턴이 재현된 것이라 WARNING 으로 기록한다. 그 외 파일(`CHANGELOG.md`, `plan/**`, `review/**`)은 문서/산출물로 보안 관점 특기사항이 없다.

## 위험도

MEDIUM
