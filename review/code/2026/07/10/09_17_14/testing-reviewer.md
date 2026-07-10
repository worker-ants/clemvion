# 테스트 리뷰 — execution-engine sanitize-error-message secret 마스킹 (HEAD 277e6d314)

## 실행 결과

```
cd codebase/backend && npx jest execution-engine/sanitize-error-message background-execution execution-engine.service notifications
```

5 suites matched (execution-engine.service.spec.ts / background-execution.processor.spec.ts /
sanitize-error-message.spec.ts(module) / notifications.service.spec.ts /
notifications-channel-authorizer.spec.ts) — **Test Suites: 5 passed, 5 total / Tests: 437 passed, 437 total**.
추가로 `websocket.service.spec.ts`(30 passed) 도 별도 확인 — `sanitizeErrorMessage` 를 주석에서만
언급하고 실제 호출은 없어 영향 없음을 확인.

기존 exact-string assertion 중 확인한 것:
- `background-execution.processor.spec.ts:122` `expect(failedPayload.errorMessage).toBe('boom')` — `'boom'` 은 어떤 SECRET_LEAK_PATTERNS 에도 우연히 매치되지 않아 그대로 통과.
- `background-execution.processor.spec.ts:171-175` (`postgres://` redact 회귀) — 통과. redactSecrets 는 CONNECTION_STRING_PATTERN 이 이미 `[REDACTED_URI]` 로 치환한 *이후* 실행되므로 URI 내부의 `secret` 키워드가 이중 처리되어도 충돌 없음.
- `execution-engine.service.spec.ts:802-840` (`알림 메시지의 원본 예외를 새니타이징한다`) — 통과. `not.toContain('secret')` 도 URI 패턴이 먼저 전체를 삼켜 안전.

깨진 회귀 없음. 소비처(양쪽 call site: `execution-engine.service.ts:4533`, `background-execution.processor.ts:72`) 모두 단일 지점에서 `sanitizeErrorMessage` 를 호출하는 구조를 코드 상으로 확인.

## 발견사항

- **[WARNING]** 500자 cap 경계값(정확히 500 / 501)이 테스트되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.spec.ts:32-35` (`caps length at 500 chars with an ellipsis`)
  - 상세: 테스트는 `'x'.repeat(600)` 한 값만 검증한다 (`out.length === 501`). `stripped.length > ERROR_MESSAGE_MAX_LENGTH` 분기의 실제 경계(정확히 500 → 그대로/미변형, 501 → truncate)는 검증되지 않는다. 직접 실행해 확인한 결과 구현은 경계에서 올바르게 동작한다(500자 입력 → 500자 그대로, 501자 입력 → 500+'…'=501자로 truncate)지만, 이 경계 자체를 고정하는 회귀 테스트가 없어 `>` 를 `>=` 로 바꾸는 등의 향후 off-by-one 리팩터를 잡아내지 못한다.
  - 제안: `'y'.repeat(500)` (길이 그대로 유지·`…` 없음) 과 `'y'.repeat(501)` (truncate) 두 케이스를 추가.

- **[WARNING]** 마스킹(mask) 후 truncate 되는 상호작용(순서 의존성) 미검증
  - 위치: `sanitize-error-message.ts:19-30` (구현) / `sanitize-error-message.spec.ts` (테스트 부재)
  - 상세: 구현은 `redactSecrets` 를 truncate *이전에* 적용한다 — 이는 500자 근처/이후에 위치한 secret 이 truncate 되기 전에 이미 마스킹되어 안전함을 보장하는 의도적 순서다. 실제로 `'x'.repeat(490) + ' Bearer sk-live-...'` 를 수동 실행해 마스킹이 먼저 적용되어(`***` 로 축약) truncate 분기를 아예 타지 않음을 확인했다. 하지만 이 순서(mask-before-truncate)를 고정하는 회귀 테스트가 스펙에 없다 — 향후 성능 최적화 등으로 순서가 뒤바뀌어도(truncate-then-mask) 현재 스위트는 이를 감지하지 못한다. (순서가 바뀌어도 500자 밖으로 밀려난 secret 자체는 truncate 로 잘려나가 직접 유출되진 않지만, 500자 경계에 걸친 partial-token 잔존 등 미묘한 회귀는 가능하다.)
  - 제안: 500자 부근/이후에 시크릿이 위치한 케이스(리뷰 지시사항의 "마스킹 후 truncate" 엣지)를 추가해 마스킹이 truncate 이전에 실행됨을 명시적으로 고정.

- **[INFO]** URI + 토큰 동시 포함 케이스 미검증
  - 위치: `sanitize-error-message.spec.ts` 전체 (각 패턴이 개별 테스트로만 분리됨)
  - 상세: `CONNECTION_STRING_PATTERN` redact 와 `redactSecrets` 마스킹이 한 메시지에 동시에 등장하는 케이스(예: `"connect failed postgres://user:pw@db:5432/app and Authorization: Bearer sk-live-..."`)가 스펙에 없다. 수동 실행으로 두 치환이 서로 간섭하지 않음(`"connect failed [REDACTED_URI] and ***"`)을 확인했으나, 이 조합이 리그레션 스펙으로 고정돼 있지 않다. 리뷰 지시사항이 명시한 엣지 케이스이기도 하다.
  - 제안: 단일 테스트로 두 패턴 동시 발생 케이스를 추가해 상호 비간섭을 고정.

- **[INFO]** 신규 마스킹 기능의 소비처(call-site) 통합 테스트 부재 — unit 레벨에서만 검증
  - 위치: `background-execution.processor.spec.ts` / `execution-engine.service.spec.ts` (본 커밋에서 미변경)
  - 상세: 두 소비처의 기존 회귀 테스트(157-176행, 802-840행)는 여전히 connection-string redact 만 검증하고, 커밋 메시지가 명시한 실제 위협 시나리오(Bearer/api_key 가 담긴 예외가 알림·이메일 payload 로 노출)를 소비처 레벨에서 검증하는 테스트는 추가되지 않았다. `sanitizeErrorMessage` 자체는 신규 spec 으로 잘 커버되고, 두 호출부가 이를 호출하는 구조도 코드상 단일 지점임을 확인했지만, "호출부가 `sanitizeErrorMessage` 를 계속 사용한다"는 배선(wiring) 자체를 지키는 회귀 테스트는 URI 케이스로만 간접 검증된다 — 누군가 향후 호출부에서 `sanitizeErrorMessage(err)` 대신 `err.message` 를 직접 쓰는 실수를 해도 URI 가 없는 순수 토큰 누출 시나리오는 현재 소비처 스위트가 못 잡는다.
  - 제안: `background-execution.processor.spec.ts` 또는 `execution-engine.service.spec.ts` 중 한 곳에 Bearer/api_key 를 포함한 예외로 알림 payload 가 마스킹되는 통합 테스트 1건을 추가하면 배선 회귀까지 방어된다. (Critical 아님 — 현재 구조상 우회 경로가 없고 `redactSecrets` 자체는 견고히 테스트됨.)

- **[INFO]** `toContain('***')` assertion 은 우연 통과가 아님(대상 문자열에 원래 `***` 이 없음)이나, exact-output 검증은 아님
  - 위치: `sanitize-error-message.spec.ts:16-21`, `:23-28`
  - 상세: 입력 문자열 어디에도 리터럴 `***` 가 없으므로 이 assertion 이 실제 마스킹 발생을 반영하는 것은 맞다(우연 통과 아님). 다만 exact 값 비교가 아니라서 과잉 마스킹(예: 의도치 않게 주변 텍스트까지 삼키는 것 — 실제로 `redactSecrets` 의 `api_key=.../password:...` 패턴은 값 뒤의 구두점(`,`/`}`)까지 흡수하는 것으로 수동 확인됨, 이는 shared SoT 의 기존 동작이라 본 diff 의 결함은 아님)까지는 잡아내지 못한다.
  - 제안: 우선순위 낮음. 필요 시 한 케이스 정도는 exact 출력값(`toBe`)으로 강화하면 과잉 마스킹 회귀도 방어 가능.

## 요약

`sanitizeErrorMessage` 자체의 신규 마스킹 로직은 7건의 신규 spec 으로 stack strip·URI redact·Bearer/자격증명 키워드 마스킹·길이 cap·비-Error 입력·clean 메시지 무변형을 각각 독립적으로 잘 커버하며, 실행 결과 관련 5개 스위트(437 tests) 전부 통과해 두 소비처(`background-execution.processor` / `execution-engine.service`)의 기존 exact-string 회귀도 깨지지 않았다. 다만 (1) 500자 cap 의 정확한 경계(500/501)와 (2) 마스킹-후-truncate 순서 의존성, (3) URI+토큰 동시 포함이라는 세 가지 엣지 조합이 명시적으로 고정되어 있지 않고, (4) 이번 보안 하드닝의 실제 동기가 된 "알림/이메일 payload 로의 토큰 노출"을 소비처 레벨에서 직접 검증하는 통합 테스트가 없어 향후 호출부 배선 회귀를 잡을 안전망이 약하다. 수동 검증으로는 현재 구현이 이 모든 케이스에서 올바르게 동작함을 확인했으므로 기능적 결함은 없으나, 회귀 방지 관점에서 위 갭을 채우는 것을 권장한다.

## 위험도

LOW
