# Cross-Spec 일관성 검토 결과

**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)  
**변경 spec 파일**: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/7-channel-web-chat/4-security.md`, `spec/data-flow/10-triggers.md`

---

## 변경 요약

이번 변경의 핵심은 **WH-NF-02 인증 webhook 1MB body-parser 게이트 구현 완료**에 따른 spec 동기:

1. `spec/5-system/12-webhook.md` — status `partial` → `implemented`, `pending_plans` 제거, WH-NF-02 "Planned" → "구현" 갱신, Rationale 섹션 추가, 신규 코드 파일(`hooks-body-parser.ts`) 등록.
2. `spec/5-system/2-api-convention.md` — HTTP 413 → `PAYLOAD_TOO_LARGE` 매핑 추가.
3. `spec/5-system/3-error-handling.md` — `PAYLOAD_TOO_LARGE`(413) 코드를 §1.3 에 등재.
4. `spec/7-channel-web-chat/4-security.md` — 인증 webhook 1MB body-parser gate 명시 주석 추가.
5. `spec/data-flow/10-triggers.md` — `PublicWebhookThrottleGuard` "무제한 통과" 설명에 1MB 게이트 단서 추가.

---

## 발견사항

발견된 CRITICAL 또는 WARNING 등급의 충돌이 없습니다. 검토 결과는 INFO 항목만 존재합니다.

### INFO-1: `PAYLOAD_TOO_LARGE`(413) 를 §1.3 "유효성 검증 에러" 에 분류 — 사전 선례와 일치
- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/5-system/3-error-handling.md` §1.3
- **충돌 대상**: 없음 (INFO 수준)
- **상세**: §1.3 "유효성 검증 에러" 테이블은 이미 400 외의 코드(`RESOURCE_NOT_FOUND`=404, `RESOURCE_CONFLICT`=409, `INVALID_STATE`=422)를 혼재 등재한 확장 분류표로 사용 중이다. `PAYLOAD_TOO_LARGE`(413)을 동 섹션에 추가한 것은 기존 패턴과 일치하며 모순이 없다.
- **제안**: 현행 유지. §1.3 이 "요청-수준 클라이언트 에러 카탈로그"로 묵시적 확장된 상태이며 이번 추가가 그 패턴을 따른다.

### INFO-2: `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(413)와 `PAYLOAD_TOO_LARGE`(413) 두 코드의 동일 HTTP 상태 공유
- **target 위치**: `spec/5-system/3-error-handling.md` §1.3 (`PAYLOAD_TOO_LARGE`) + §1.7 (`PUBLIC_WEBHOOK_BODY_TOO_LARGE`)
- **충돌 대상**: `spec/5-system/12-webhook.md` WH-NF-02 / §8 보안
- **상세**: 두 코드가 모두 HTTP 413을 반환하지만, 발행 주체·경로·임계가 다르다(공개 32KB → `PUBLIC_WEBHOOK_BODY_TOO_LARGE`, 인증/전역 → `PAYLOAD_TOO_LARGE`). spec이 이 이중 구조를 WH-NF-02, §6, §8, error-handling §1.3/§1.7에 걸쳐 일관되게 문서화했으므로 모순은 없다. 소비자(클라이언트)가 HTTP status 만 보고 분기할 경우 세부 코드를 추가로 확인해야 함을 주의.
- **제안**: 현행 유지. 두 코드의 의미 분리가 spec 여러 위치에서 명시적으로 설명돼 있다.

### INFO-3: `spec/7-channel-web-chat/4-security.md` §4 주석 — SoT 포인터 방향 확인
- **target 위치**: `spec/7-channel-web-chat/4-security.md` L143
- **충돌 대상**: `spec/5-system/12-webhook.md` WH-NF-02
- **상세**: 추가된 문장이 `spec/5-system/12-webhook.md#비기능-요구사항`을 SoT 링크로 올바르게 지정했고, 역방향 충돌은 없다. webhook spec이 channel-web-chat spec을 rate-limit 정책 수치 출처(`publicWebhook.startupPerMinute`/`hourlyNewMax`)로 포인팅(`Spec 웹채팅 보안 §4`)하고, channel-web-chat이 body size SoT를 webhook으로 포인팅하는 상호 참조 구조다. 순환 참조이지만 각 문서가 담당 SoT가 명확히 다르므로(rate-limit 수치 vs body size 정책) 충돌이 없다.
- **제안**: 현행 유지.

---

## 요약

이번 변경은 WH-NF-02 인증 webhook 1MB body-parser 게이트 구현 완료를 spec에 동기화한 것으로, CRITICAL 또는 WARNING 등급의 cross-spec 충돌은 발견되지 않았다. `PAYLOAD_TOO_LARGE`(413)가 API 규약·에러 핸들링·webhook spec·data-flow 4개 문서에 걸쳐 일관되게 추가됐으며, 기존 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(413)와의 이중 구조도 각 도메인에서 명확히 구분·문서화돼 있다. 채널 웹챗 보안 spec과 data-flow 트리거 spec의 부가 설명도 webhook spec을 SoT로 올바르게 포인팅하고 있어 정합적이다.

---

## 위험도

NONE
