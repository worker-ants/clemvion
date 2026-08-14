### 발견사항

- **[INFO]** `llmCalls` 중첩 누출(원래 CRITICAL)이 field-name 기준·깊이 무관 strip 으로 올바르게 닫혔고, 두 출구(WS fanout·REST `getStatus` 스냅샷) 모두 같은 공유 헬퍼를 호출하도록 통일됐다 — 코드 검증 결과 결함 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`stripDeep`, 전체), `codebase/backend/src/modules/websocket/websocket.service.ts:450-453`(`emitExecutionEvent`)·`:524-527`(`emitNodeEvent`), `codebase/backend/src/modules/external-interaction/interaction.service.ts`(`stripAndRedact` 함수 정의 및 waiting/`result`/`error` 세 출구 호출부)
  - 상세: `git diff origin/main...HEAD` 로 실제 코드를 직접 열어 확인했다. `stripDeep` 은 재귀적으로 모든 깊이에서 `EXTERNAL_STRIPPED_FIELDS`(`llmCalls`) 를 이름 기준 제거하고, `maxDepth` 초과 서브트리는 손대지 않는다(그 아래는 자매 sanitizer(`sanitizePayloadForWs`/`deepRedactSecrets`)의 깊이 상한이 collapse). WS 두 emit 경로(`emitExecutionEvent`/`emitNodeEvent`)와 REST `stripAndRedact`(waiting `nodeOutput`/terminal `result`/terminal `error` 세 곳 모두)가 동일 헬퍼를 호출해, 종전에 "fanout depth-1 만 막고 REST 는 값 마스킹만" 이던 비대칭이 해소됐다. 회귀 테스트(`websocket.service.spec.ts` depth sweep `0`~`MAX+2`, `interaction.service.spec.ts` waiting/terminal 양쪽 raw-payload 부재 검증, `strip-external-only-fields.spec.ts` REST 순서(strip→redact) sweep)가 뮤테이션(strip 을 no-op 으로 만든 뮤턴트)으로 판별력까지 실측했다고 문서화돼 있고, 실제 코드에도 그 논리가 반영돼 있다.
  - 제안: 조치 불요. positive finding.

- **[INFO]** prototype pollution(CWE-1321) 방어가 스프레드(own-property shadowing) + `Object.defineProperty` 이중 방어로 올바르게 구현됨 — 코드 검증 결과 결함 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`stripDeep` 내부 `out ??= { ...obj }; Object.defineProperty(out, k, {...})` 블록)
  - 상세: `JSON.parse('{"__proto__": {...}}')` 로 만들어진 own-data-property `__proto__` 를 다루는 경로에서, `{...obj}` 스프레드가 `CreateDataProperty` 로 동작해 own `__proto__` 를 그대로 복제하고(접근자를 타지 않음), 이후 `Object.defineProperty(out, k, {value, enumerable, writable, configurable})` 로 대입해 bracket 대입(`out[k] = v`)이 유발할 수 있는 접근자 트리거링을 원천 차단한다. `EXTERNAL_STRIPPED_FIELDS` 삭제 분기(`delete out[k]`)는 `k` 가 항상 `'llmCalls'` 로 고정돼 있어 `__proto__` 를 건드리지 않는다. `websocket.service.spec.ts`/`strip-external-only-fields.spec.ts` 양쪽에 `__proto__` 값 안에 strip 대상을 넣어 실제로 대입 분기를 타게 만든 fixture(테스트 자체가 판별력 없는 뮤턴트에서 살아남았던 이력을 주석에 남김)로 고정돼 있다.
  - 제안: 조치 불요. positive finding.

- **[INFO]** 이미 노출됐을 수 있는 과거 데이터에 대한 잔여 운영 리스크 — 코드 변경으로 해소 불가능한 영역이며 이미 문서화돼 있음
  - 위치: `CHANGELOG.md:34-35`("영향 범위: 두 경로로 나간 데이터는 이미 전송된 것이다...")
  - 상세: 이번 fix 는 향후 emit/응답에 대해서만 유효하다. fix 이전에 external-interaction SSE·notification webhook·chat-channel 아웃바운드·REST 스냅샷으로 이미 전송된 `llmCalls.requestPayload`/`responsePayload`(시스템 프롬프트·대화 이력)는 코드 수정으로 회수되지 않는다. CHANGELOG 가 이를 이미 명시적으로 disclose 했고 `16_29_50` RESOLUTION INFO 12 도 "코드 조치 불요 — 운영 판단, plan 에 추적 항목으로 등재됨"으로 넘겼다 — 이번 라운드에서 새로 발견된 항목이 아니라 기존 처분을 재확인한다.
  - 제안: 코드 조치 불요. 영향받은 워크스페이스에 대한 외부 통합자 조회 로그 점검·필요 시 알림/안내는 운영 판단 영역(이미 plan 에 등재).

- **[INFO]** 하드코딩된 시크릿 없음 — 새 테스트 fixture 의 `'SECRET PROMPT ...'` 등은 leak 여부를 검증하기 위한 마커 문자열이며 실제 자격증명이 아님
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts`, `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`, `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts`
  - 상세: `grep` 으로 API key/password/private key 패턴을 전수 스캔했으나 diff 범위(`codebase/`) 안에 실제 자격증명으로 보이는 문자열은 없었다.
  - 제안: 조치 불요.

### 요약
이번 diff 의 핵심은 이전 라운드들에서 CRITICAL/WARNING 으로 지적된 raw LLM 프롬프트(`turnDebug.llmCalls[]`) 외부 유출을 field-name 기준·깊이 무관 strip 으로 닫고, WS fanout·REST `getStatus` 스냅샷 두 출구를 공유 헬퍼(`stripExternalOnlyFields`)로 통일한 보안 수정이다. 실제 소스 코드(`strip-external-only-fields.ts`, `websocket.service.ts`, `interaction.service.ts`)를 직접 열어 대조한 결과, 재귀 strip 로직·깊이 상한 처리·`__proto__` 오염 방어(스프레드+`defineProperty` 이중 방어)·순서 무관성(strip→redact vs redact→strip 동치 검증) 모두 올바르게 구현돼 있고, 다수의 뮤테이션 테스트로 판별력까지 실측·고정돼 있다. 새로 도입된 취약점(인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화)은 발견되지 않았다. 유일한 잔여 리스크는 코드로 해소 불가능한 "fix 이전에 이미 전송된 데이터"이며 이는 CHANGELOG·plan 에 이미 disclose·추적되고 있는 운영 판단 항목이다.

### 위험도
LOW
