# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` 변경 사항 (diff-base: `origin/main`)  
검토 모드: `--impl-done`  
검토 일시: 2026-06-28

---

## 발견사항

### [WARNING] spec/2-navigation/4-integration.md: `preview-test` body 필드명 오기재 (`serviceType` → `service`)

- **target 위치**: `spec/2-navigation/4-integration.md` §9.2 엔드포인트 표, `POST /api/integrations/preview-test` 행
- **충돌 대상**: `codebase/backend/src/modules/integrations/dto/integration.dto.ts` `PreviewTestDto.serviceType` (line 161)
- **상세**: 이번 PR 변경으로 integration spec 에서 preview-test body 기술이 `{ serviceType, authType, credentials }` → `{ service, authType, credentials }` 로 변경됐다. 그러나 실제 백엔드 DTO(`PreviewTestDto`)는 여전히 `serviceType` 필드를 사용하며, 서비스 레이어(`integrations.service.ts:593`, `:970`)도 `body.serviceType` 으로 접근한다. `service` 는 같은 파일 내 `OAuthBeginDto` 의 필드명으로, 두 DTO 의 필드명 차이를 명시하던 `※ 필드명 주의` 주석이 함께 삭제되면서 오히려 `OAuthBeginDto.service` 의 이름이 `PreviewTestDto` 에 기재된 것처럼 오해될 여지가 생겼다. spec 이 코드보다 빠르게 rename 된 상태이며, 코드는 미변경이다.
- **제안**: `spec/2-navigation/4-integration.md` 의 preview-test 행을 다시 `{ serviceType, authType, credentials }` 로 복원하거나, 코드 DTO 를 `service` 로 rename 하는 별도 PR 을 추적한다. 전자가 즉시 가능하고 위험이 없다. 삭제된 `※ 필드명 주의` 주석도 함께 복원해 혼동을 방지한다.

---

### [WARNING] spec/2-navigation/4-integration.md: `INTEGRATION_INVALID_SERVICE` 에러 코드 spec 삭제 — 코드 잔존

- **target 위치**: `spec/2-navigation/4-integration.md` §9.2 에러 코드 목록 (삭제된 `-  INTEGRATION_INVALID_SERVICE (400)` 행)
- **충돌 대상**: `codebase/backend/src/modules/integrations/integrations.service.ts:1449–1455` (`validateServiceAuthType` 메서드, `code: 'INTEGRATION_INVALID_SERVICE'` throw)
- **상세**: 이번 PR 에서 `INTEGRATION_INVALID_SERVICE (400)` 에러 코드 정의가 spec 에서 삭제됐다. 그러나 백엔드 코드에는 해당 코드가 여전히 throw 되고(`integrations.service.ts`), 테스트(`integrations.service.spec.ts`)도 이 코드를 검증한다. `spec/5-system/3-error-handling.md` 에도 이 코드가 등재돼 있지 않으므로, spec 과 코드 간 불일치가 발생했다. 이 코드가 실제로 폐기되지 않은 상황에서 spec 만 삭제된 상태다.
- **제안**: `INTEGRATION_INVALID_SERVICE` 코드를 코드에서도 함께 제거했거나 폐기 결정이 있다면 그 결정을 기록한다. 그렇지 않다면 spec 에서 삭제된 항목을 복원하거나 `spec/5-system/3-error-handling.md` §1 통합 에러 카탈로그에 신규 등재한다.

---

### [INFO] spec/data-flow/10-triggers.md: `PublicWebhookThrottleGuard` 설명에 공유 버킷 정책 미반영

- **target 위치**: `spec/data-flow/10-triggers.md` line 98 (진입 앞단 blockquote)
- **충돌 대상**: `spec/5-system/12-webhook.md` §6 (신규 공유 버킷 정책), `spec/7-channel-web-chat/4-security.md` §R6 (신규 추가)
- **상세**: `data-flow/10-triggers.md` 의 `PublicWebhookThrottleGuard` 기술은 "IP 단위 rate-limit" 만 언급하며 "IP 미식별 시 공유 sentinel 버킷" 동작을 기술하지 않는다. 12-webhook.md 와 4-security.md 가 R6 로 이 정책을 명문화했으나, data-flow 문서는 미갱신 상태다. SoT 포인터(`SoT: [Spec 웹채팅 보안 §4]`)가 있어 기능적 모순은 없지만, 독자가 data-flow 만 보면 공유 버킷 동작을 누락할 수 있다.
- **제안**: `spec/data-flow/10-triggers.md` line 98 의 설명에 "IP 미식별 시 단일 공유 버킷으로 완화 한도 적용([4-security R6])" 구절을 추가해 SoT 와 동기화한다.

---

### [INFO] 변경된 spec 영역들 간 상호참조 일관성 — 양호 (충돌 없음)

핵심 변경인 "공개 webhook IP 미식별 시 공유 버킷 완화 한도"는 세 spec 문서에 일관되게 반영됐다:

- `spec/5-system/1-auth.md` §2.3 클라이언트 IP 표·Rationale 2.3.B: `req.socket.remoteAddress` 폴백 기각 및 단일 공유 버킷 완화 한도 추가 — 양방향 일치
- `spec/5-system/12-webhook.md` WH-SC-05·§6·§8 보안 테이블: 공유 버킷 `UNIDENTIFIED_IP_BUCKET` 명시 — 4-security R6 와 일치
- `spec/7-channel-web-chat/4-security.md` §4·R3·R6(신규): 공유 버킷 채택 결정(D-12), fail-open 과의 차원 분리 명시 — 12-webhook 과 일치
- `spec/5-system/3-error-handling.md` §1.7: `PUBLIC_WEBHOOK_RATE_LIMIT`·`PUBLIC_WEBHOOK_HOURLY_LIMIT` 설명에 공유 버킷 경우 추가 — 나머지 spec 과 일치

ip_whitelist fail-closed vs 공개 webhook rate-limit 공유 버킷(완화)의 대비가 세 문서 모두에서 동일하게 기술된다.

---

## 요약

이번 PR 의 핵심 변경인 "공개 webhook IP 미식별 시 단일 공유 버킷 완화 한도(D-12)" 관련 수정은 `spec/5-system/1-auth.md`, `spec/5-system/12-webhook.md`, `spec/7-channel-web-chat/4-security.md`, `spec/5-system/3-error-handling.md` 에 걸쳐 내부 일관성이 잘 유지된다. 단, 함께 수정된 `spec/2-navigation/4-integration.md` 에서 두 가지 부수적 충돌이 발생했다: (1) `preview-test` body 필드명이 코드(DTO) 와 다르게 `service` 로 기재된 점, (2) 코드·테스트에 잔존하는 `INTEGRATION_INVALID_SERVICE` 에러 코드가 spec 에서 누락된 점. 이 두 항목은 spec-to-code API 계약 충돌로 정합 조치가 필요하다. `data-flow/10-triggers.md` 의 공유 버킷 설명 미반영은 INFO 수준으로 기능 충돌은 없다.

---

## 위험도

MEDIUM
