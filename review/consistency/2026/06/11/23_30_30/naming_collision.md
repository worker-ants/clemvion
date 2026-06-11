# 신규 식별자 충돌 검토

검토 대상: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24, 5-makeshop)
검토 모드: `--impl-done`, scope=spec/4-nodes/4-integration/, diff-base=origin/main

---

## 발견사항

### [WARNING] `HTTP_TIMEOUT` — error-handling spec 과 http-request spec 의 코드 불일치
- **target 신규 식별자**: `HTTP_TRANSPORT_FAILED` (1-http-request.md §6 에러 코드 표, §5.3.2 케이스)
- **기존 사용처**: `spec/5-system/3-error-handling.md` 79행 및 222행 — HTTP 카테고리 코드 목록에 `HTTP_TIMEOUT` 이 여전히 열거되어 있음. `spec/conventions/chat-channel-adapter.md` 381행 — `HTTP_TIMEOUT` → `executionFailedTimeout` 분류 행이 존재
- **상세**: 1-http-request.md 는 타임아웃·abort·네트워크 실패를 `HTTP_TRANSPORT_FAILED` 한 코드로 통합(§5.3.2 케이스 및 §6 표)한다. 그러나 error-handling spec 은 별도 `HTTP_TIMEOUT` 코드를 여전히 목록에 포함하고, chat-channel-adapter spec 은 `HTTP_TIMEOUT` → `executionFailedTimeout` 매핑 행을 별도로 정의한다. `HTTP_TRANSPORT_FAILED` 가 실제 surface 코드라면 `HTTP_TIMEOUT` 행은 더 이상 emit 되지 않아 chat-channel-adapter 분류 행이 dead branch 가 된다.
- **제안**: 3-error-handling.md 및 chat-channel-adapter.md 의 `HTTP_TIMEOUT` 참조를 `HTTP_TRANSPORT_FAILED` (타임아웃 포함) 로 갱신하거나, 타임아웃을 별도 코드로 유지할 의도라면 1-http-request.md §5.3.2 에 `HTTP_TIMEOUT` 분기를 명시 분리한다. 두 문서 중 어느 쪽이 SoT 인지 결정 후 나머지를 정렬해야 한다.

---

### [WARNING] `INTEGRATION_AUTH_UNSUPPORTED` — 공통 에러 코드 표에 미등재
- **target 신규 식별자**: `INTEGRATION_AUTH_UNSUPPORTED` (1-http-request.md §4.1 표, §5.8, §6 표)
- **기존 사용처**: `spec/4-nodes/4-integration/0-common.md` §4.2 공통 에러 코드 표 — `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE`, `INTEGRATION_CALL_FAILED`, `INTEGRATION_SERVICE_UNAVAILABLE` 5개만 열거. `INTEGRATION_AUTH_UNSUPPORTED` 는 누락
- **상세**: `INTEGRATION_AUTH_UNSUPPORTED` 는 HTTP Request 전용 코드(지원하지 않는 `auth_type` 시 발생)로서 공통 에러 코드가 아니지만, 0-common.md §4.2 에 나열된 `INTEGRATION_*` prefix 패밀리의 일원으로 보일 수 있다. spec 독자가 0-common.md 를 보고 "모든 `INTEGRATION_*` 코드는 여기에 있다"고 가정할 경우 http-request 전용 코드를 놓치게 된다. 특히 `spec/2-navigation/4-integration.md` §10.8 에러 코드 표 및 error-handling.md 는 0-common §4.2 를 참조하는 패턴이라 gap 이 발생한다.
- **제안**: 0-common.md §4.2 에 `INTEGRATION_AUTH_UNSUPPORTED` 를 "HTTP Request 전용" 주석과 함께 추가하거나, §4.2 에 "HTTP Request 노드는 추가로 `INTEGRATION_AUTH_UNSUPPORTED` 를 정의한다 — 상세: 1-http-request §6" 형태의 forward-reference 를 추가한다.

---

### [INFO] `meta.duration` → `meta.durationMs` breaking rename — cross-spec 참조 파급 범위
- **target 신규 식별자**: `meta.durationMs` (0-common.md §6.1 통일 선언, 1-http-request.md §5.1 표)
- **기존 사용처**: 변경 전 `meta.duration` 이 참조되는 곳이 있는지는 target 외부 spec 에서 직접 grep 가능하지 않았으나, 0-common.md §6.1 에 `⚠ Breaking change` 주석이 명시되어 있으며, 실제 데이터-플로우 spec(`spec/data-flow/`) 및 error-handling spec 의 메트릭 기술 부분이 `meta.durationMs` 를 이미 사용하고 있어 신규 이름 자체의 충돌은 없다.
- **상세**: `meta.durationMs` 로의 통일은 식별자 자체로서의 충돌은 없다. 다만 `spec/3-workflow-editor/3-execution.md` 또는 `spec/5-system/4-execution-engine.md` 에 노드 output 메트릭 예시가 `meta.duration` 으로 남아 있다면 breaking rename 의 파급 미갱신이 될 수 있으므로 확인이 권장된다.
- **제안**: 전체 spec 트리에서 `meta\.duration[^M]` 패턴 grep 을 수행하여 old name 잔재 여부를 확인한다.

---

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` — spec/5-system/1-auth.md 참조 범위 확인
- **target 신규 식별자**: `ALLOW_PRIVATE_HOST_TARGETS` 의 적용 범위 확대 — 기존 Database Query·Send Email 에서 HTTP Request `none`/`custom` 인증 경로까지 공통 적용 (1-http-request.md §8.2 Rationale)
- **기존 사용처**: `spec/5-system/11-mcp-client.md` 139행 — "정당한 self-host 용도가 있는 `ALLOW_PRIVATE_HOST_TARGETS`(http-request §4)는 throw 가 아닌 warn" 으로 명시. `spec/5-system/1-auth.md` 587행 — `ALLOW_PRIVATE_HOST_TARGETS` 는 throw 가 아닌 warn 으로 분류. `spec/2-navigation/4-integration.md` 505행 및 1118행 — 기존 HTTP Request/DB Query/Send Email 공유 플래그로 이미 기술.
- **상세**: 환경변수 이름 자체의 충돌은 없다. 기존 참조들이 이미 "통합 노드 전반 공유" 정의를 갖고 있으며, target 의 확대 적용 선언과 일치한다. 의미 차이 없음.
- **제안**: 해당 없음. 단, 1-auth.md §생산 가드 섹션이 `ALLOW_PRIVATE_HOST_TARGETS` 에 대해 "http-request §4" 만 참조하고 있다면, 적용 범위 확대(DB Query·Email·HTTP none/custom 전부)가 auth spec 주석에도 반영되어 있는지 확인한다.

---

### [INFO] `integration:cache:invalidate` Redis 채널명 — 신규 도입 아님, 기존 SoT 와 일치
- **target 신규 식별자**: 2-database-query.md §4 에서 `integration:cache:invalidate` 채널명 상세 서술
- **기존 사용처**: `spec/0-overview.md` §2.6, `spec/5-system/4-execution-engine.md` Redis 채널 목록, `spec/data-flow/5-integration.md` 71행 — 동일 이름으로 이미 등록
- **상세**: 충돌 없음. 모든 참조가 동일 채널명과 동일 의미(integration 자격증명 rotate/remove 시 캐시 무효화)를 사용하고 있다.
- **제안**: 해당 없음.

---

### [INFO] 파일 경로 — 기존 명명 컨벤션과 일치
- **target 신규 파일**: 검토 범위 내 파일은 `0-common.md`, `1-http-request.md`, `2-database-query.md`, `3-send-email.md`, `4-cafe24.md`, `5-makeshop.md` 로 기존 `spec/<N-name.md>` 컨벤션(`spec/0-overview.md §8 문서 컨벤션`)을 준수하며, 기존 파일 목록과 이름 중복 없음.
- **제안**: 해당 없음.

---

## 요약

target(`spec/4-nodes/4-integration/`)이 도입·확정하는 신규 식별자 중 동일 이름이 다른 의미로 기존에 사용 중인 경우(CRITICAL)는 발견되지 않았다. 가장 주의가 필요한 것은 `HTTP_TIMEOUT` 과 `HTTP_TRANSPORT_FAILED` 의 관계로, error-handling spec 과 chat-channel-adapter spec 이 아직 `HTTP_TIMEOUT` 을 독립 코드로 열거하고 있어 target 의 "타임아웃도 `HTTP_TRANSPORT_FAILED` 로 통합" 선언과 불일치한다. 이 두 문서가 갱신되지 않으면 chat-channel-adapter 의 `HTTP_TIMEOUT → executionFailedTimeout` 분기가 dead branch 가 되고, 운영 알림 분류에 잠재적 gap 이 생긴다. `INTEGRATION_AUTH_UNSUPPORTED` 가 공통 코드 표(0-common §4.2)에 누락된 것은 혼동 가능성 수준의 WARNING 이다.

---

## 위험도

MEDIUM
