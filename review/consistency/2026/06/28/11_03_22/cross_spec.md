# Cross-Spec 일관성 검토 — `spec/5-system/12-webhook.md`

## 발견사항

### 1. **[WARNING]** §3.1 "요청 본문 최대 크기 | 1MB" — 내부 구현 현실과 불일치 및 다른 영역과의 세부 정책 충돌

- **target 위치**: `spec/5-system/12-webhook.md` §3.1 API 명세 표 "요청 본문 최대 크기 | 1MB"
- **충돌 대상**:
  - 동일 문서 WH-NF-02 (§4) — "**1MB 통일 임계는 미구현 (Planned)**"
  - 동일 문서 §8 보안 고려사항 — "1MB 통일 임계는 미구현 (WH-NF-02, Planned)"
  - `spec/in-progress/spec-sync-webhook-gaps.md` — 갭 추적 중
- **상세**: §3.1 표는 "요청 본문 최대 크기 | 1MB" 를 현재 스펙으로 기술하나, WH-NF-02 와 §8 은 현행 구현이 공개 webhook 에 한해 32KB (`PublicWebhookThrottleGuard`), 인증 webhook 에는 별도 게이트가 없음(express 기본값)임을 명시한다. 같은 문서 내에서 §3.1 은 1MB 를 확정된 사실로 서술하고 WH-NF-02 는 동일 수치를 "미구현/Planned" 로 표기해 독자가 다른 섹션을 보면 다른 결론을 내린다. 외부 독자 관점에서 §3.1 만 읽으면 1MB 가 현재 시행 중인 것으로 오독한다.
- **제안**: §3.1 표의 해당 행을 `32KB (공개 webhook, 현행) / 미설정 (인증 webhook, 현행). 1MB 통일 임계는 Planned — WH-NF-02 참조` 로 명시하거나, 이미 진행 중인 `plan/in-progress/spec-sync-webhook-gaps.md` 가 완료된 후 갱신. 두 섹션이 동일 사실을 다르게 기술하는 상태는 유지하지 않는다.

---

### 2. **[WARNING]** WH-MG-02 "endpoint_path 자동 생성" 주체 불명 — `spec/2-navigation/2-trigger-list.md` 가 클라이언트 생성으로 명시

- **target 위치**: `spec/5-system/12-webhook.md` §3.4 WH-MG-02 "생성 시 endpoint_path 자동 생성 (랜덤 UUID 기반)"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` §2.5 — "`endpointPath` 는 클라이언트가 `crypto.randomUUID()` 로 생성해 전송한다 (UUID 가 사실상 capability token)"
- **상세**: WH-MG-02 의 "자동 생성" 은 주체를 명시하지 않아 서버가 생성하는 것으로 오독 가능하다. trigger-list spec 은 **클라이언트**가 `crypto.randomUUID()` 로 생성해 POST body 에 포함해 전송한다고 명시한다. 두 spec 이 같은 메커니즘을 다르게 표현하면 webhook spec 만 보는 구현자가 서버에서 UUID 를 발급해야 한다고 잘못 판단할 수 있다. 기능적 모순은 아니나 "누가 생성하는가" 라는 계층 책임이 불명확하다.
- **제안**: WH-MG-02 를 "생성 요청 시 프론트엔드가 `crypto.randomUUID()` 로 `endpointPath` 를 생성해 전송한다 (서버는 중복 검사 후 수용, `(workspace_id, endpoint_path)` UNIQUE 위반 시 409)" 으로 보완하거나 trigger-list spec 을 cross-link 로 참조한다.

---

### 3. **[WARNING]** §5.2 400 에러 응답 형식이 `spec/5-system/3-error-handling.md` 표준 형식 및 `spec/4-nodes/7-trigger/1-manual-trigger.md` 기술과 불일치

- **target 위치**: `spec/5-system/12-webhook.md` §5.2 "400 응답 형식" JSON 예시
  ```json
  {
    "statusCode": 400,
    "message": "Invalid webhook payload",
    "errors": [...]
  }
  ```
- **충돌 대상**:
  - `spec/5-system/3-error-handling.md` §2.1 — 표준 에러 형식은 `{ "error": { "code": "...", "message": "...", "details": [...] } }`
  - `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표 — Webhook 어댑터 400 응답을 `code: INVALID_WEBHOOK_PAYLOAD` + `{ code, message, errors }` shape 로 기술
- **상세**: 세 문서가 같은 400 에러의 response body 를 세 가지 다른 형태로 기술한다.
  - webhook spec §5.2: `{ statusCode, message, errors: [{ field, reason }] }`
  - error-handling spec: `{ error: { code, message, details: [{ field, message, code }] } }`
  - manual-trigger spec: `{ code: INVALID_WEBHOOK_PAYLOAD, message, errors }`
  세 shape 중 어느 것이 실제 wire 응답인지 불명확하다. `code` 필드 존재 여부, top-level 키가 `error`/`statusCode`/`code` 중 무엇인지, 배열 키가 `errors`/`details` 인지 모두 다르다. 구현자가 세 문서 중 하나만 보고 구현하면 클라이언트와 불일치가 생긴다.
- **제안**: `spec/5-system/3-error-handling.md` §2.1 을 "단일 진실" 로 확정하고 webhook spec §5.2 와 manual-trigger spec §6 표의 에러 shape 를 그에 맞춰 정합화한다. 특히 `code: INVALID_WEBHOOK_PAYLOAD` 포함 여부, `errors` vs `details` 키, `statusCode` top-level 여부를 단일 source 로 정리한다.

---

### 4. **[INFO]** §6 공개 webhook rate-limit SoT 참조 방향 혼재

- **target 위치**: `spec/5-system/12-webhook.md` §6 "Rate Limiting (공개 webhook 전용 추가)" 주석 — `(SoT: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md))`
- **충돌 대상**: `spec/5-system/12-webhook.md` Rationale "본 spec 을 webhook 도메인 SoT 로 확정한다"
- **상세**: webhook spec Rationale 는 "본 spec 을 webhook 도메인 SoT 로 확정한다" 고 선언하지만, §6 에서는 공개 webhook rate-limit 정책의 SoT 를 `spec/7-channel-web-chat/4-security.md` 로 지정한다. 공개 webhook rate-limit 은 web-chat 맥락에서 등장했지만 webhook 도메인 전체의 공개 인입 제어이므로, "webhook SoT" 와 "web-chat security SoT" 가 동일 메커니즘에 대해 SoT 주장을 동시에 하고 있는 구조다. 현재 두 spec 의 수치와 정책 자체는 일치하므로 기능 충돌은 없으나, SoT 위치 결정이 명시적으로 기록돼 있지 않으면 향후 수치 변경 시 어느 문서를 업데이트해야 하는지 불명확해진다.
- **제안**: webhook spec §6 의 주석을 "수치 상세는 [Spec 웹채팅 보안 §4] 가 원안, 본 webhook spec 이 webhook 도메인 적용 정책의 SoT" 와 같이 명확히 하거나, web-chat security 에서 수치를 제거하고 webhook spec 단일 SoT 로 이관한다. 어느 방향이든 명시적으로 결정을 기록해야 한다.

---

### 5. **[INFO]** WH-SC-05 rate-limit 주석 "§6 참조" — §6 과 §8 에 중복 기술

- **target 위치**: `spec/5-system/12-webhook.md` §3.2 WH-SC-05 "§6 참조"
- **충돌 대상**: 동일 문서 §6, §8 — 동일 내용이 세 곳에 부분적으로 반복 기술
- **상세**: 동일 문서 내 문제로 cross-spec 충돌은 아니나, 수치 변경 시 세 곳을 모두 갱신해야 한다. 현재는 일치하므로 CRITICAL/WARNING 이 아니라 INFO 로 분류.
- **제안**: WH-SC-05 에서 수치 대신 §6 으로 위임 참조하고, §6 이 단일 수치 SoT 가 되도록 구조화한다.

---

## 요약

`spec/5-system/12-webhook.md` 는 webhook 도메인의 주요 정책(AuthConfig 단일 인증 경로, CORS, POST 전용, URL 정본, TransformInterceptor 래핑)을 다른 spec 과 충분히 정합하게 기술하고 있다. 데이터 모델(`1-data-model.md §2.8 Trigger`, `§2.17 AuthConfig`), RBAC(`1-auth.md §3.2 Auth Config | CRUD | CRUD | R | R`), chat-channel 비활성 트리거 202 처리(`15-chat-channel.md §5.5`)는 모두 일관된다. 그러나 세 가지 WARNING 이 존재한다. 첫째, §3.1 "요청 본문 최대 크기 1MB" 가 같은 문서의 WH-NF-02·§8 과 충돌하는 내부 불일치로, 1MB 가 미구현(Planned) 임을 §3.1 에도 반영해야 한다. 둘째, WH-MG-02 "자동 생성" 이 `2-trigger-list.md` 의 "클라이언트 생성" 사실과 충돌하는 계층 책임 불명확이다. 셋째, §5.2 400 에러 응답 shape 가 `3-error-handling.md` 표준 및 `1-manual-trigger.md` 기술과 세 가지 다른 형태로 모순돼 있어 구현자의 혼동 소지가 있다. 이 세 WARNING 은 실행 불가 수준의 CRITICAL 은 아니나, 미방치 시 구현 divergence 로 발전할 수 있다.

## 위험도

MEDIUM
