# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-mail-send-status.md`
검토 모드: spec draft (--spec)
검토일: 2026-05-29

---

## 발견사항

### [INFO] preview-test "외부 호출 없음" 원칙의 적용 범위 명시 — 추가 보완 가능

- **target 위치**: 변경 1 (§5.5 테스트 설명), "**Cafe24 사전 검증이 외부 호출을 하지 않는 것(§5.8 / line 608)과 의도적으로 다르다**" 서술
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` §5.8 line 608 ("사전 검증(`POST /api/integrations/preview-test`): 저장 전 자격 증명의 구조적 유효성만 검증하며, 외부 네트워크 호출은 수행하지 않는다")
- **상세**: 현행 spec §5.8 line 608 의 "외부 네트워크 호출은 수행하지 않는다" 서술은 Cafe24 섹션의 sub-bullet 으로 위치하며, 그 이유로 "막 발급된 토큰이라 refresh 가 불필요"라는 Cafe24 고유 사유를 기술한다. target 이 이 서술을 "Cafe24 한정 원칙"으로 명시적으로 참조하고 SMTP 는 명시적 예외임을 Rationale 에 기록하는 방식(변경 6)은 과거 결정과 충돌하지 않는다. 다만 §9.2 API 표 (line 733) "저장 전 인증 정보로 연결 테스트" 설명은 service-agnostic 하게 기술되어 있어, SMTP 의 preview-test 가 실제 외부 호출을 수행한다는 사실이 본문에 반영되면 이 table 행 비고에도 보완이 필요할 수 있다. target 에서 이 table 행 갱신은 언급되지 않는다.
- **제안**: 변경 1 의 본문 반영 시, §9.2 표 `POST /api/integrations/preview-test` 행 비고에 "SMTP 서비스의 경우 실제 SMTP `verify()` 외부 호출을 수행한다 — §5.5 참조" 한 줄을 추가하면 API 표와 본문의 정합이 완결된다. 필수 차단 수준은 아니나 독자가 API 표만 보고 오해할 여지를 줄일 수 있다.

---

### [INFO] `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정과 기존 Rationale 부재

- **target 위치**: 변경 2, "`SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정 (stale. initial draft 잔재)"
- **과거 결정 출처**: `spec/5-system/3-error-handling.md §1.4`, `spec/4-nodes/4-integration/3-send-email.md §5.3`, `spec/2-navigation/4-integration.md` 에러 코드 vocabulary 표 (현재 `SMTP_SEND_FAILED` 로 잔재)
- **상세**: `EMAIL_SEND_FAILED` 는 이미 `3-error-handling.md §1.4`, `3-send-email.md §5.3`, `error-codes.ts` 에서 정식 이름으로 통용되고 있으며, target 이 이를 "initial draft 잔재" stale 정정으로 처리하는 것은 사실 관계가 맞다. 기존 Rationale 에 `SMTP_SEND_FAILED` 코드명 결정 항 자체가 없어, 이 정정은 기각된 대안의 재도입도 아니고 합의된 결정의 번복도 아닌 오탈자 수준 정합화다. Rationale 신규 작성 의무는 없다.
- **제안**: 별도 조치 불필요. 이미 target 의 변경 2 서술이 근거를 충분히 담고 있다.

---

### [INFO] SSRF 가드 "동일 메커니즘·플래그" — http-request.md §8 SoT 참조 정합성

- **target 위치**: 변경 1 ("SSRF 가드: HTTP Request 노드의 SSRF 가드([§8 SoT](../4-nodes/4-integration/1-http-request.md))와 **동일한 메커니즘·플래그**를 공유"), 변경 5 (§8 에 `ALLOW_PRIVATE_HOST_TARGETS` 공통 제어 한 줄 추가)
- **과거 결정 출처**: `spec/4-nodes/4-integration/1-http-request.md` §4 실행 로직 (line 92), §5.3 error table (line 328). 현재 http-request.md 에는 별도 `## Rationale` 섹션이 존재하지 않으며 SSRF 가드 설계 결정에 대한 Rationale 항목도 없다.
- **상세**: http-request.md 의 SSRF 가드(D4, 2026-05-17)는 Rationale 절이 없는 상태이므로 "공유 메커니즘" 을 채택하면서 기각된 대안이 있는지 확인할 과거 Rationale 기록이 없다. target 의 변경 5 가 env var `ALLOW_PRIVATE_HOST_TARGETS` 를 spec 에 최초 명시하면서 §8 에 한 줄 추가하는 방식은 적절하나, 이 추가로 인해 §8 이 SSRF 가드의 새로운 SoT 진입점이 되는지, 아니면 변경 4 의 `send-email.md §Rationale` 가 SoT 인지가 cross-reference 상 모호하다. target 이 `send-email.md §Rationale` 에 "http/db 와 동일 플래그 통일 결정" 항을 추가(변경 6)하고 변경 4 를 통해 `send-email.md §4` 에도 직접 기술하므로, send-email 관점 SoT 는 send-email.md 에 있다. http-request.md §8 의 추가 한 줄은 보완적 cross-reference 로 기능한다. 구조적 충돌은 없다.
- **제안**: 변경 5 의 "이 플래그는 HTTP / Database Query / Send Email(SMTP) 통합 노드 전반의 SSRF 가드를 공통 제어한다" 서술이 http-request.md §8 을 전체 SSRF 가드의 SoT 처럼 읽힐 수 있다. send-email.md §Rationale 가 SMTP SSRF 결정의 SoT 임을 명시하거나, 단순히 "send-email.md §Rationale 참조" 링크를 덧붙이면 독자 혼선을 방지할 수 있다.

---

## 요약

target 문서(spec-draft-mail-send-status.md)는 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 시스템 invariant 를 위반하지 않는다. 핵심 판단 세 가지: (1) preview-test "외부 호출 없음" 원칙은 spec §5.8 의 Cafe24 전용 sub-bullet 으로서 그 이유가 Cafe24 OAuth 토큰의 구조적 특성("막 발급된 토큰이라 refresh 불필요")에 기초하므로, target 이 SMTP 를 명시적 예외로 선언하면서 새 Rationale 항을 함께 추가(변경 6)하는 방식은 "무근거 번복"이 아닌 적법한 도메인 분리다. (2) `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED` 정정은 기존 세 문서와 코드에서 이미 `EMAIL_SEND_FAILED` 를 정식 사용하고 있는 상태에서 vocabulary 표만 stale 이었던 오탈자 수준 정합화로, Rationale 연속성 문제를 야기하지 않는다. (3) SSRF 가드의 `ALLOW_PRIVATE_HOST_TARGETS` 공유는 기존 http-request.md 에 Rationale 절이 없어 과거 기각 대안 확인이 불가하나, 새 결정 전용 Rationale 항(변경 6)을 send-email.md 에 추가하므로 결정의 근거 공백은 본 draft 에서 직접 해소된다. 발견된 사항은 모두 INFO 수준의 보완 제안이며 CRITICAL 또는 WARNING 등급 충돌은 없다.

---

## 위험도

NONE
