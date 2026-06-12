# 정식 규약 준수 검토 결과

**대상 문서**: `spec/5-system/1-auth.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-12

---

## 발견사항

### [INFO] §1.5.4 에러 코드 — historical-artifact 예외 등재 확인 및 자기 참조 일관성

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 주석 블록 (line 256)
- **위반 규약**: `spec/conventions/error-codes.md §3` (Historical-artifact 예외 레지스트리)
- **상세**: target 문서 §1.5.4 의 주석은 `invitation_*` / `forbidden` / `rate_limited` 코드들이 `lower_snake_case` 로 `UPPER_SNAKE_CASE` 위반임을 스스로 인지하고 `error-codes.md §3 historical-artifact` 레지스트리에 등재해 유지한다고 선언한다. 실제로 `spec/conventions/error-codes.md §3` 테이블에도 정확히 등재되어 있다. 형식적 위반은 의도된 예외로 처리되어 있어 규약을 올바르게 준수하고 있다. 단, target 문서가 `error-codes.md §2` 를 "이름 정확성 향상만을 위한 rename 은 하지 않는다"로 인용한 것과 `error-codes.md §3` 레지스트리 등재 선언이 일치하므로 이 자체는 문제없음. — 정보 공유 목적.
- **제안**: 변경 불필요. 현행 유지가 규약에 부합.

---

### [INFO] §4.1 감사 액션 명명 — `auth_config` 동사 형식 혼합 기술

- **target 위치**: `spec/5-system/1-auth.md` §4.1 (line 371, 380)
- **위반 규약**: `spec/conventions/` 내 감사 액션 명명 규약은 별도 파일이 없고 target 문서 §4.1 자체가 SoT. 단 `node-output.md` Principle 3.2 에서 `code` 는 `UPPER_SNAKE_CASE` 인 반면, audit action 은 `<resource>.<verb>` dot-notation 소문자 사용.
- **상세**: 문서 §4.1 이 "Action naming 규약: `<resource>.<verb>` — resource dot-prefix 가 필수" 라고 직접 정의하고 있으며, audit action 은 error code 와는 별개 도메인이므로 소문자 dot-notation 은 의도된 형식이다. `integration.created`, `auth_config.create` 등 현재 구현 액션 표는 이 규약을 일관되게 따른다. 단, Planned 항목 `password_change`, `2fa_enable/disable` (§4.1 Planned 표, 카테고리 "인증 (워크스페이스 컨텍스트)")는 `resource.verb` 형식이 아닌 resource prefix 없는 동사형만 사용하고 있다.
- **제안**: Planned 액션 `password_change`, `2fa_enable/disable` 를 `<resource>.<verb>` 패턴(`user.password_change`, `totp.enable` / `totp.disable` 또는 `mfa.enable` / `mfa.disable` 등)으로 보완하거나, 워크스페이스 컨텍스트 없는 인증 이벤트라 §4.3 LoginHistory 에서 처리됨을 주석으로 명시해 Planned 표에서 제외 여부를 명확히 할 것. 현재로선 규약 불명확 지점이나 미구현 planned 항목이라 BUILD-BLOCK 수준은 아님.

---

### [WARNING] §4.1 Planned 감사 액션의 dot-notation 위반 — resource prefix 누락

- **target 위치**: `spec/5-system/1-auth.md` §4.1 Planned 표, "인증 (워크스페이스 컨텍스트)" 카테고리 (line 389)
- **위반 규약**: `spec/5-system/1-auth.md §4.1` 자체 명명 규약 ("Action naming 규약: `<resource>.<verb>` — resource dot-prefix 가 필수다")
- **상세**: `password_change`, `2fa_enable/disable` 는 `resource.verb` 형식을 따르지 않는다. 이 규약을 문서 스스로 정의하고 있음에도 동일 섹션의 Planned 행에서 위반한다. 이는 현재 구현 액션(`integration.created`, `auth_config.create` 등) 이 일관되게 `resource.verb` 를 따르는 것과 대조된다.
- **제안**: `password_change` → `user.password_change` (또는 `auth.password_change`), `2fa_enable/disable` → `totp.enabled`/`totp.disabled` (또는 `mfa.enabled`/`mfa.disabled`) 로 수정. 단, §4.1 마지막 note("워크스페이스 컨텍스트가 없는 인증 이벤트는 AuditLog 가 아닌 §4.3 LoginHistory 에 기록됨")와 이 Planned 항목이 워크스페이스 컨텍스트 분류인지 재검토 필요. 만약 해당 이벤트가 실제로 LoginHistory 레이어라면 Planned 표에서 제거하는 것이 더 정확함.

---

### [INFO] 문서 구조 규약 — Overview / 본문 / Rationale 3섹션 구성 준수

- **target 위치**: `spec/5-system/1-auth.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: target 문서는 상단에 별도 `## Overview` 섹션 없이 `## 1. 인증 (Authentication)` 으로 바로 시작하고 `## Rationale` 로 마무리한다. `spec/conventions/node-output.md` 나 `spec/conventions/spec-impl-evidence.md` 처럼 `## Overview` 섹션이 있는 규약 문서들과 비교할 때 구조가 다르다. 그러나 CLAUDE.md 는 "각 SKILL.md 참고" 로 위임하며 절대 의무는 아니고 권장 수준. 진입 링크(관련 문서 블록)와 Rationale 섹션은 존재하므로 큰 문제는 없다.
- **제안**: 필요 시 상단에 `## Overview` 를 추가해 해당 섹션에 인증/인가 시스템의 목적·범위·구성 요약을 담으면 규약 3섹션 구조에 완전히 부합. 필수는 아니나 일관성 제고에 도움.

---

### [INFO] frontmatter `pending_plans` — 파일 실존 여부

- **target 위치**: `spec/5-system/1-auth.md` frontmatter `pending_plans` (lines 33-35)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` (`spec-pending-plan-existence.test.ts` 가드)
- **상세**: frontmatter 에 `plan/in-progress/auth-config-webhook-followups.md` 와 `plan/in-progress/spec-sync-auth-gaps.md` 가 등재되어 있다. 빌드 가드 `spec-pending-plan-existence.test.ts` 가 이 파일들이 `plan/in-progress/` 또는 `plan/complete/` 에 실존하는지 검증한다. 실존 여부는 파일시스템 확인이 필요하나, 이는 자동 가드가 담당하므로 spec 문서 자체의 규약 준수 측면에서는 올바른 형식.
- **제안**: 변경 불필요. 빌드 가드가 실존을 강제.

---

### [INFO] API 엔드포인트 표 — 응답 포맷 일관성 (`data` 래핑)

- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 및 §1.1 (line 74), §1.4.3 (line 154)
- **위반 규약**: `spec/conventions/node-output.md` 는 노드 출력 규약이며, API 응답 포맷 규약은 `spec/5-system/2-api-convention.md §5` 가 SoT. 직접 적용되는 node-output 규약은 없으나 일관성 관점.
- **상세**: §1.1 에서 `200 { data: { message } }` 로 응답 래핑을 명시한다. §1.4.3 에서 `/auth/2fa/webauthn/availability` 응답을 `{ data: { enabled: boolean } }` 으로 명시한다. 이 패턴은 프로젝트의 API 응답 봉투 규약(`spec/5-system/2-api-convention.md`)을 따르는 것으로 보인다. 다만 §5 API 엔드포인트 표의 응답 컬럼에는 일부 엔드포인트만 상세 응답 형식을 기재하고 나머지는 설명 문장으로 대체하고 있어 일관성이 다소 떨어진다.
- **제안**: 검토 대상이 spec/conventions 준수라면 api-convention 파일을 별도 확인 권장. 현 수준에서는 major 이슈 없음.

---

## 요약

`spec/5-system/1-auth.md` 는 정식 규약 준수 관점에서 전반적으로 양호하다. frontmatter `id`/`status`/`code`/`pending_plans` 가 `spec/conventions/spec-impl-evidence.md §2` 규약을 준수하고, `lower_snake_case` 초대 에러 코드들은 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 명시적으로 등재되어 있다. 주요 위반 사항은 §4.1 Planned 감사 액션 표에서 문서 자신이 정의한 `<resource>.<verb>` 명명 규약을 `password_change`/`2fa_enable/disable` 항목이 따르지 않는 점이다 (WARNING). 나머지 사항은 INFO 수준의 구조 권장 또는 자동 가드가 처리하는 영역이다.

## 위험도

LOW
