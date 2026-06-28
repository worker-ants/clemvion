# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/12-webhook.md` (문서 규약 준수) + `codebase/backend/migrations/V103__trigger_endpoint_path_uuid_validate.sql` (구현 diff)
**검토 모드**: impl-done, diff-base=origin/main

---

## 발견사항

### [INFO] spec/12-webhook.md §6 내 Rate Limiting SoT 귀속 표현이 다소 혼재
- **target 위치**: `spec/5-system/12-webhook.md` §6 구현 파일 구조, 320번 줄
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 단일 진실 원칙" (SoT 소유자 혼동 가능성)
- **상세**: `PublicWebhookThrottleGuard`/`PublicWebhookQuotaService` 의 rate-limit 정책 SoT 를 `(SoT: [Spec 웹채팅 보안 §4](../7-channel-web-chat/4-security.md))` 로 명기하고 있으나, `spec/5-system/12-webhook.md` §8(보안 고려사항)에도 동일 Rate Limiting 항목을 서술하고 있다. 두 문서가 동일 내용을 기술하는 구조로 단일 진실 원칙에 주의가 필요하다. 단, 현재 `4-security.md` §4 가 실제 수치·제어 정책의 SoT 이고 본 문서는 cross-link 참조 형태로 기술하고 있어 직접 규약 위반이라기보다는 형식 일관성 이슈다.
- **제안**: §8 Rate Limiting 행의 설명 끝에도 `(SoT: Spec 웹채팅 보안 §4)` 앵커를 일관 추가하거나, §6 의 SoT 표기를 §8 의 설명으로 통합하여 중복 기술 위치를 하나로 수렴시킨다.

### [INFO] Migration 파일 설명자 명명 — 권장 집합 내, 단 문서 단조성 표현 확인
- **target 위치**: `codebase/backend/migrations/V103__trigger_endpoint_path_uuid_validate.sql`
- **위반 규약**: `spec/conventions/migrations.md §1` (명명 규약)
- **상세**: `V103__trigger_endpoint_path_uuid_validate` — 번호 단조 증가(V102 다음 V103), 설명자 `snake_case` 영문 소문자+숫자+언더스코어 권장 집합 완전 준수, `.conf` 페어 없음(executeInTransaction 옵션 불필요한 DDL이므로 적합). `alphanumeric suffix` 없음. 규약 전 항목 준수. 발견사항 없음 — 이상 없음을 확인 목적으로만 기재.

### [INFO] spec/12-webhook.md 에 이모지 사용 (§10 프론트엔드 연동)
- **target 위치**: `spec/5-system/12-webhook.md` §10, 391번 줄: `URL 복사 버튼 (📋)`
- **위반 규약**: CLAUDE.md 일반 작성 지침 "Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked."
- **상세**: 이 지침은 Claude 출력 파일 작성 시 적용되는 규칙이고, 이미 기존 spec 문서에 포함된 이모지 표현이므로 신규 차분(diff)과 무관하다. 본 변경 diff에 이모지가 추가된 것이 아니므로 INFO 수준으로만 기재. 신규 편집 시 해당 이모지를 텍스트 설명으로 교체하는 것을 권장한다.

---

## 요약

`spec/5-system/12-webhook.md` 는 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 스키마(`id: webhook`, `status: partial`, `code:` ≥1 매치, `pending_plans:` 의무 기재)를 모두 충족한다. `V103__trigger_endpoint_path_uuid_validate.sql` 는 `spec/conventions/migrations.md §1·§2·§3` 의 명명 규약(단조 V번호, snake_case 설명자, alphanumeric suffix 없음, append-only 원칙)을 정확히 준수한다. 에러 코드 `AUTH_FAILED`·`PUBLIC_WEBHOOK_BODY_TOO_LARGE`·`PUBLIC_WEBHOOK_RATE_LIMIT`·`PUBLIC_WEBHOOK_HOURLY_LIMIT` 는 `spec/conventions/error-codes.md §1` 의 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙을 준수하며, `spec/conventions/error-codes.md §3` 의 historical-artifact 레지스트리에 충돌하지 않는다. 문서 구조는 Overview / 본문 / Rationale 3섹션 권장(CLAUDE.md)을 준수하고, 파일 명명(`12-webhook.md`)은 `spec/5-system/` 영역의 숫자 prefix 컨벤션을 따른다. 발견된 사항은 모두 INFO 수준의 형식 일관성 개선 제안이며 규약 직접 위반은 없다.

---

## 위험도

NONE
