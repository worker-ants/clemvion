# 보안(Security) Review

대상 변경: Cafe24 HMAC raw-value 재정정 + 관련 spec/review 문서 갱신
검토 일시: 2026-05-16
세션: `review/code/2026/05/16/14_21_05/security/`

---

## 발견사항

### 발견사항 1
- **[WARNING]** `timingSafeEqual` 이 서로 다른 길이의 Buffer 를 받을 경우 예외를 던짐
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 코드 예시 — `verifyHmac` 함수 (파일 31, diff +2065~+2075)
  - 상세: 새 `verifyHmac` 코드 예시에서 `timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac))` 를 직접 호출한다. Node.js `crypto.timingSafeEqual` 은 두 Buffer 의 **길이가 다를 경우 TypeError 를 발생**시킨다. Base64 인코딩된 `computed` (HmacSHA256 → 44자)와 Cafe24 가 보내온 `receivedHmac` 가 길이가 다를 때 (예: URL 인코딩 여부, padding 여부, 조작된 hmac 파라미터) 스택 트레이스가 노출되거나 500 응답으로 에러 경로가 드러날 수 있다. 옛 구현에서도 동일 문제가 존재했다면 spec-only 문서 변경이므로 구현에서 먼저 수정되어야 하지만, spec 코드 예시가 이 패턴을 명시하면 향후 구현자가 그대로 복사할 위험이 있다.
  - 제안: spec 코드 예시에 길이 비교 선행 또는 `try/catch` 처리를 추가한다. 예: `if (computed.length !== receivedHmac.length) return false;` 를 `timingSafeEqual` 호출 전에 삽입. 단, 이 추가 자체도 길이 차이를 이용한 timing side-channel 이 될 수 있으므로, 실용적으로는 `crypto.timingSafeEqual(Buffer.from(computed, 'base64'), Buffer.from(receivedHmac, 'base64'))` 로 **같은 인코딩 기준**으로 비교하는 방법이 더 안전하다.

---

### 발견사항 2
- **[WARNING]** `receivedHmac` 의 URL 디코딩 여부가 spec 에서 명시되지 않음
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 알고리즘 단계 5 및 `verifyHmac` 코드 예시 (파일 31)
  - 상세: 알고리즘 단계 5가 "URL-decoded `hmac` 파라미터 값과 timing-safe 비교"라고 기술하나, 신규 `buildHmacMessage` 가 raw query string 을 분리하는 방식(`split('&')` → `split('=')`)에서 `hmac` 파라미터 값의 URL 디코딩이 명시적으로 이루어지지 않는다. `verifyHmac(rawQuery, ...)` 가 `rawQuery` 에서 `buildHmacMessage` 를 호출한 뒤 `receivedHmac` 를 직접 비교하는데, `receivedHmac` 가 URL 인코딩된 상태로 전달되면 (`hmac=abc%2Bdef...`) `computed` (순수 Base64) 와 불일치가 발생한다. Cafe24 가 `hmac` 파라미터를 URL 인코딩 없이 Base64 raw 로 보내는지, 혹은 `+` → `%2B` 등으로 인코딩해 보내는지 spec 에 명시가 없다.
  - 제안: spec §9.8 알고리즘 단계 5에 "Cafe24 는 `hmac` 파라미터 값을 percent-encoded 형태로 전달한다 (또는 그렇지 않다)" 를 명시하거나, 구현에서 `URLSearchParams.get('hmac')` 를 통해 URL 디코딩된 값을 추출하는 방법을 spec 코드 예시에 포함한다. 현재 코드 예시에서는 `receivedHmac` 의 출처(어떻게 추출됐는지)가 표현되지 않아 구현자에게 혼란을 줄 수 있다.

---

### 발견사항 3
- **[INFO]** `hmac` 키 필터링이 key 대소문자 구분 없이 이루어지는지 명시 없음
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 `buildHmacMessage` 코드 예시 (파일 31, `.filter((p) => p.key.length > 0 && p.key !== 'hmac')`)
  - 상세: `.filter((p) => p.key !== 'hmac')` 는 소문자 `hmac` 만 필터링한다. Cafe24 가 `HMAC` 또는 `Hmac` 등 대소문자 변형으로 파라미터를 보낼 경우 HMAC 파라미터가 메시지 빌드에 포함되어 검증이 항상 실패하게 된다. 실제 Cafe24 공식 동작상 소문자 `hmac` 가 표준이라면 무관하나, 방어적 코드 관점에서 확인이 필요하다.
  - 제안: 공식 문서 또는 실제 요청 로그를 통해 `hmac` 키 대소문자 형식을 확인하고 spec 에 명시한다. 방어적으로 `.toLowerCase()` 를 적용하는 것도 고려할 수 있다.

---

### 발견사항 4
- **[INFO]** `client_secret` 로깅 금지 정책이 spec 에 참조로만 언급되고 구현 강제 수단이 없음
  - 위치: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" (파일 30, +1955행) — "`client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 정책과 일관"
  - 상세: spec 이 `client_secret` 비로깅을 명시하고 `SECRET_LEAK_PATTERNS` 정책을 참조하나, 해당 정책의 spec 문서화가 "별도 plan"으로 남아 있다. 구현 단계에서 `logger.warn` 호출 시 `client_secret` 이 spread 연산자나 JSON.stringify 로 의도치 않게 포함될 위험이 있다.
  - 제안: 구현 시 `buildHmacMessage` 및 `handleInstall` 의 `logger.warn` 호출에서 명시적으로 `client_secret` 을 제외하고 있는지 코드 리뷰에서 확인한다. `SECRET_LEAK_PATTERNS` 정책을 `spec/conventions/` 에 정식 문서화하는 follow-up 을 우선 처리한다.

---

### 발견사항 5
- **[INFO]** App URL 에 `install_token` 이 path segment 로 포함되어 노출됨 — 적절한 처리 여부 확인 필요
  - 위치: `spec/2-navigation/4-integration.md` §4.2 표, "App URL 카드 (Cafe24 Private 한정)" (파일 30, +1920행), `${APP_URL}/api/3rd-party/cafe24/install/:installToken`
  - 상세: `IntegrationDto.appUrl` 이 `install_token` 을 URL path segment 로 포함한 채 API 응답으로 내려간다. spec 은 "`install_token` 자체는 응답에 별도 필드로 노출되지 않고 App URL path segment 안에만 포함된다"고 명시하며, 이 결정의 이유로 "식별자 분산 방지" 를 든다. 그러나 capability-token 으로 기능하는 `install_token` 이 API 응답에 포함되면, 권한이 있는 어떤 클라이언트든 이 URL 을 조회할 수 있다. access control 이 충분히 구현되어 있는지 (즉, 해당 integration 의 소유자만 `GET /api/integrations/:id` 를 호출할 수 있는지) spec 에서 명시적으로 다루지 않는다.
  - 제안: `GET /api/integrations/:id` API 가 호출자의 workspace/organization 소속 여부를 검증하는 guard 를 반드시 갖추고 있는지 구현 단계에서 확인한다. spec 에서도 이 endpoint 의 authorization 요건을 명시적으로 기술할 것을 권장한다. 이는 신규 도입이 아닌 기존 endpoint 에 필드가 추가되는 것이지만, 민감한 식별자가 포함된다는 점에서 재확인이 필요하다.

---

### 발견사항 6
- **[INFO]** 구 HMAC 알고리즘(`formUrlEncode`) 이 아직 backend 코드에 잔존 — spec-코드 불일치 상태
  - 위치: `review/consistency/2026/05/16/14_06_49/cross_spec/review.md` CRITICAL 2·3 항 (파일 24), `backend/src/modules/integrations/integration-oauth.service.ts`
  - 상세: 본 PR 은 spec 변경을 포함하며, consistency review 에서 이미 CRITICAL 로 식별된 사안이다 — backend 코드는 아직 `URLSearchParams` decode + `formUrlEncode` 방식을 사용하고, `formUrlEncodeForTest` 헬퍼가 self-fulfilling 테스트를 만들고 있다. PR 설명에서 "developer skill 이 후속해서 코드+테스트 동기화" 예정임을 명시하나, spec 과 코드가 서로 다른 알고리즘을 정의하는 상태가 일정 기간 공존하면 오인 배포 위험이 있다.
  - 제안: spec 변경 commit 과 backend 구현 변경 commit 을 동일 PR 또는 동일 배포 단위로 묶어 spec-코드 불일치 상태가 main 에 장기 잔존하지 않도록 한다.

---

### 발견사항 7
- **[INFO]** HMAC 검증 실패 에러 응답이 분기 별로 동일한 코드를 반환하는 정책 — timing oracle 완화 여부
  - 위치: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" (파일 30, +1955행) — "응답 코드 단일화 정책 유지 — capability-token 가정 보호"
  - 상세: mall_id 불일치 / client_secret 부재 / HMAC 자체 불일치의 세 분기가 모두 `CAFE24_INSTALL_INVALID_HMAC` 를 반환하는 정책은 열거 공격 방어 측면에서 적절하다. 단, 세 분기의 **처리 시간 차이** 가 timing side-channel 이 될 수 있다 (예: HMAC 연산을 수행하지 않는 분기가 훨씬 빠르면 공격자가 분기를 식별). spec 에서 이 타이밍 동일화에 대한 요구사항이 명시되지 않았다.
  - 제안: 구현 단계에서 mall_id 불일치 분기에서도 dummy HMAC 연산을 수행해 응답 시간을 균등화하는 것을 고려한다. 현재 spec 에는 이 요건이 없으므로 구현 수준에서 결정이 필요하다.

---

## 요약

본 PR 의 핵심 보안 변경인 HMAC 알고리즘 재정정(raw URL-encoded 값 보존)은 Cafe24 공식 Java 샘플 분석 및 운영 재현 증거에 기반한 적절한 수정이다. `timingSafeEqual` 사용, `client_secret` 비로깅 정책, 응답 코드 단일화 등 주요 보안 결정은 올바른 방향을 취하고 있다. 그러나 spec 코드 예시에서 `timingSafeEqual` 이 서로 다른 길이의 Buffer 를 받았을 때의 예외 처리가 누락되어 있고(WARNING), `receivedHmac` 의 URL 디코딩 여부가 spec 에서 불명확하여(WARNING) 향후 구현자가 오용할 수 있는 여지가 있다. `install_token` 을 App URL path segment 로 포함한 API 응답에 대한 authorization guard 명시, 타이밍 동일화 요건, 구 HMAC 코드의 신속한 교체도 구현 단계에서 반드시 확인되어야 한다. spec 자체의 cryptographic design 은 타당하며, 발견된 WARNING 2건은 spec 코드 예시의 방어적 표현 부재에 해당하고 구현 시 주의를 요하는 수준이다.

---

## 위험도

MEDIUM
