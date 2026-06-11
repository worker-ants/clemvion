# 신규 식별자 충돌 검토 — `spec/4-nodes/4-integration/1-http-request.md`

## 발견사항

### **[WARNING]** `HTTP_TIMEOUT` — target 에 없는 코드가 error-handling 카탈로그에 등재

- **target 신규 식별자**: target 문서(§6 에러 코드 표)에는 `HTTP_TIMEOUT` 이 없다. timeout/abort 는 `HTTP_TRANSPORT_FAILED` 로 통합 처리된다.
- **기존 사용처**: `spec/5-system/3-error-handling.md` line 77 (`§1.4`) 및 line 220 (`§3.2`) 두 곳 모두 HTTP 카테고리 에러 코드로 `HTTP_TIMEOUT` 을 명시한다.
  - line 77: `| HTTP | HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX · HTTP_TIMEOUT |`
  - line 220: `| HTTP | HTTP_TRANSPORT_FAILED, HTTP_4XX, HTTP_5XX, HTTP_TIMEOUT |`
- **상세**: `3-error-handling.md` 는 `HTTP_TIMEOUT` 이 별도 에러 코드로 존재하는 것처럼 기술하나, target(`1-http-request.md`)은 fetch reject(DNS / 연결 거부 / `AbortController` timeout)를 모두 단일 코드 `HTTP_TRANSPORT_FAILED` 로 라우팅한다. `HTTP_TIMEOUT` 코드가 실제 구현에 존재하는지, 또는 이미 삭제됐는데 카탈로그만 남은 것인지 불분명하다. 이 불일치로 인해 error 포트의 `output.error.code` 에 어떤 값이 올 수 있는지 다운스트림 노드 작성자가 혼동할 수 있다.
- **제안**: `3-error-handling.md` 의 HTTP 카테고리에서 `HTTP_TIMEOUT` 을 제거하고 `HTTP_TRANSPORT_FAILED` 만 남긴다. 또는 target 의 §6 에 "타임아웃은 `HTTP_TRANSPORT_FAILED` 로 surface 된다; `HTTP_TIMEOUT` 은 미사용" 주석을 추가해 카탈로그 갱신 전까지 혼동을 막는다.

---

### **[WARNING]** `INTEGRATION_NOT_FOUND` — target 이 참조하나 `0-common.md` 가 "코드 없음"으로 명시

- **target 신규 식별자**: `1-http-request.md` §5.8 및 §6 에러 코드 표의 `INTEGRATION_*` 행이 `INTEGRATION_NOT_FOUND` 를 integration resolve 실패 코드 중 하나로 열거한다.
  - §5.8: `INTEGRATION_NOT_FOUND / INTEGRATION_TYPE_MISMATCH / INTEGRATION_NOT_CONNECTED / INTEGRATION_INCOMPLETE ([공통 §4.2])`
  - §6: `INTEGRATION_*` 행 비고: `INTEGRATION_NOT_FOUND / ... 모두 본 경로로 surface`
- **기존 사용처**: `spec/4-nodes/4-integration/0-common.md` §4.2 (line 86) 는 명시적으로 반박한다:
  > "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 (`integrations.service.ts requireEntity`; `_base/integration-handler-base.ts toLogError`). requireEntity throw → `INTEGRATION_CALL_FAILED` (또는 send-email 의 경우 `EMAIL_SEND_FAILED`) 로 surface 된다."
- **상세**: target 이 인용하는 `[공통 §4.2]` 자체에 `INTEGRATION_NOT_FOUND` 가 없음에도, target 은 이를 "공통 §4.2 가 정의한" 코드로 제시한다. 이는 target 이 공통 spec 과 내부 모순을 가지는 것으로, HTTP Request 노드 사용자가 `INTEGRATION_NOT_FOUND` 를 실제로 받을 수 있다고 오해할 수 있다.
- **제안**: target §5.8 및 §6 의 `INTEGRATION_NOT_FOUND` 참조를 제거하거나 "(코드 없음 — 현재 `INTEGRATION_CALL_FAILED` 로 surface, Planned)" 비고로 교체한다. `0-common.md §4.2` 에 이미 이 사실이 명문화되어 있으므로 target 이 이를 따라야 한다.

---

### **[INFO]** `INTEGRATION_AUTH_UNSUPPORTED` — target 고유 코드, 공통 spec `0-common.md §4.2` 에 미등재

- **target 신규 식별자**: `1-http-request.md` §5.8, §6 에서 `INTEGRATION_AUTH_UNSUPPORTED` 를 지원하지 않는 `auth_type` 시 surface 되는 코드로 정의한다.
- **기존 사용처**: `spec/4-nodes/4-integration/0-common.md §4.2` 에 해당 코드가 없다. Database Query / Send Email / Cafe24 / MakeShop 의 에러 코드 표에도 보이지 않는다.
- **상세**: `INTEGRATION_AUTH_UNSUPPORTED` 는 HTTP Request 노드 전용 코드로, 공통 에러 코드 표(`0-common.md §4.2`)에 등재되지 않았다. D4 결정 이후 모든 `IntegrationError` 가 `port: 'error'` 로 라우팅되므로, 이 코드가 실제로 `output.error.code` 로 노출되는지 확인이 필요하다. 코드 자체는 다른 노드와 충돌하지 않지만, 공통 spec 과의 등재 누락으로 전체 에러 코드 카탈로그(`spec/5-system/3-error-handling.md`) 에서도 빠져 있다.
- **제안**: `0-common.md §4.2` 의 공통 에러 코드 표에 `INTEGRATION_AUTH_UNSUPPORTED` 를 추가하거나, target 에 "(HTTP Request 전용, 공통 표 외)" 명시를 추가한다. `spec/5-system/3-error-handling.md` §1.4 의 INTEGRATION 카테고리에도 등재를 검토한다.

---

### **[INFO]** `INTEGRATION_SERVICE_UNAVAILABLE` — target 이 D4 코드로 도입, `0-common.md §4.2` 에 미등재

- **target 신규 식별자**: `1-http-request.md` §5.8, §6 이 D4 결정과 함께 `INTEGRATION_SERVICE_UNAVAILABLE` 을 새 경로로 정의한다.
- **기존 사용처**: `spec/4-nodes/4-integration/0-common.md §4.2` 에 없다. Database Query(`2-database-query.md` line 323, 344), Cafe24(`4-cafe24.md` line 332, 353), MakeShop(`5-makeshop.md` line 189) 에는 이미 동일 코드가 D4 코드로 등재되어 있다.
- **상세**: 다른 integration 노드 spec 에서는 이미 사용 중이므로 코드 자체의 신규 도입은 아니다. 다만 `0-common.md §4.2` 의 공통 에러 코드 표에서는 여전히 누락되어 있어 각 노드 spec 이 개별적으로 반복 정의하는 상황이다. 충돌은 없으나 일관성 보완이 필요하다.
- **제안**: `0-common.md §4.2` 에 `INTEGRATION_SERVICE_UNAVAILABLE` 을 D4 공통 에러 코드로 정식 등재한다 (다른 노드 spec 이 이미 같은 조건으로 사용 중).

---

## 요약

target 문서(`spec/4-nodes/4-integration/1-http-request.md`)가 도입하는 주요 식별자(`HTTP_BLOCKED`, `ALLOW_PRIVATE_HOST_TARGETS`, `INTEGRATION_SERVICE_UNAVAILABLE`, `INTEGRATION_AUTH_UNSUPPORTED`)는 기존 spec 과 의미적 충돌 없이 사용되거나 다른 노드에서 이미 같은 의미로 사용 중이다. 그러나 두 건의 주의 사항이 있다. 첫째, `spec/5-system/3-error-handling.md` 가 `HTTP_TIMEOUT` 을 HTTP 에러 코드 카탈로그에 열거하지만 target 은 이를 `HTTP_TRANSPORT_FAILED` 로 통합해 별도 코드를 두지 않아, 다운스트림 사용자가 실제로 받을 수 있는 코드 목록이 카탈로그와 어긋난다. 둘째, target 이 인용하는 `공통 §4.2` 에 `INTEGRATION_NOT_FOUND` 코드가 존재하지 않음에도 target 본문이 이를 유효한 코드로 열거해 내부 모순이 발생한다. 두 건 모두 명명 자체의 새로운 충돌보다는 기존 spec 과의 카탈로그 불일치에 해당한다.

## 위험도

MEDIUM
