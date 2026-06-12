# Convention Compliance Review: `spec/5-system/1-auth.md`

## 발견사항

### 1. [INFO] `§1.5.4` 에러 응답 섹션 헤딩 명칭 — 에러 코드 규약 cross-reference 노트 위치

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 표 하단 blockquote (line ~256)
- **위반 규약**: `spec/conventions/error-codes.md §3` historical-artifact 레지스트리
- **상세**: 본 섹션에서 `lower_snake_case` 예외를 직접 설명하고, `error-codes.md §3` 을 forward-reference 로 달아 레지스트리 등재를 언급하고 있다. blockquote 자체는 규약 의도와 일치하며, `error-codes.md §3` 레지스트리에도 해당 6개 코드가 올바르게 등재되어 있다. 다만 blockquote 텍스트가 `error-codes.md §2` 를 "이름 정확성 향상만을 위한 rename 은 하지 않는다" 로 인용하는 반면, 실제 규약 문서의 해당 절 제목은 "2. 안정성 / rename 정책" 이므로 정합한다.
- **제안**: 현재 상태 그대로 유지. 레지스트리 cross-reference가 정확히 설정되어 있어 INFO 수준.

---

### 2. [WARNING] Frontmatter `status: partial` 에 `pending_plans` 가 2개 등재 — 두 plan 의 in-progress 실존 검증 필요

- **target 위치**: `spec/5-system/1-auth.md` frontmatter, `pending_plans:` 필드 (lines 33-35)
  ```yaml
  pending_plans:
    - plan/in-progress/auth-config-webhook-followups.md
    - plan/in-progress/spec-sync-auth-gaps.md
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans:` 경로는 `plan/in-progress/` 또는 `plan/complete/`(in-progress → complete 치환) 에 실존 의무. `spec-pending-plan-existence.test.ts` 가 build-time 강제
- **상세**: 이 검토 범위(static 분석)에서는 두 파일의 filesystem 실존 여부를 직접 확인하지 않는다. build-time 가드가 있으므로 test 통과 전까지는 WARNING 으로 표시한다. 특히 `auth-config-webhook-followups.md` 는 최근 `debc90ee` 커밋("feat(auth-configs): CRUD 감사 로그 기록")이 병합된 후에도 계속 `partial` + `pending_plans` 에 남아 있어, plan 완료 여부 확인이 필요하다.
- **제안**: `plan/in-progress/auth-config-webhook-followups.md` 와 `plan/in-progress/spec-sync-auth-gaps.md` 가 실제로 in-progress 상태인지, 또는 이미 complete 로 이동해야 하는지 확인. 모든 `pending_plans` 가 complete 로 이동하면 `spec-impl-evidence.md §3` 규칙에 따라 `status: partial → implemented` 로 승격 의무 발생.

---

### 3. [INFO] 감사 액션 명명에서 동사 시제 혼용 — 현재형(create/update/delete)과 과거분사(created/updated/deleted) 병존

- **target 위치**: `spec/5-system/1-auth.md` §4.1 감사 액션 표 (line ~380)
  ```
  | 설정 | auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate, auth_config.reveal |
  ```
  그리고 Planned 표의 `workspace.*`, `member.*`, `workflow.*` 는 과거분사 (`created`/`updated`/`deleted`)
- **위반 규약**: `spec/conventions/` 에 감사 액션 명명 전용 convention 파일이 별도로 없고, 규칙은 §4.1 본문과 Rationale §4.1.A 에서 서술됨. spec 내부 규칙상 "과거분사가 부자연스러운 동사가 섞이면 resource 단위 현재형으로 통일" 예외가 명시되어 있다.
- **상세**: §4.1.A Rationale 에서 `auth_config.*` 는 `reveal`/`regenerate` 같이 과거분사가 부자연스러운 동사가 섞이므로 resource 단위 현재형 예외임을 명문화했다. 이는 의도된 설계이며 규약 위반이 아님. Planned 표의 `model_config.*` 도 `set-default` 때문에 동일 예외 적용. 현 문서는 이 예외 근거를 §4.1.A 로 정확히 Rationale 화했다.
- **제안**: 현재 상태 유지. INFO 수준 — 추후 spec 이 감사 액션 명명 전용 convention 파일(`spec/conventions/audit-action-naming.md` 등)을 분리할 경우 해당 예외도 그쪽으로 이전하면 가독성이 향상된다.

---

### 4. [INFO] `§5` API 엔드포인트 표 — 응답 포맷이 `{ data: { message } }` 형태로 서술되었으나 API 규약 일치 여부 명시 부재

- **target 위치**: `spec/5-system/1-auth.md` §1.1.A 설계 원칙 (line ~74)
  ```
  응답 동일성: forgot-password 는 ... 동일 응답 (200 { data: { message } })
  ```
- **위반 규약**: `spec/5-system/2-api-convention.md §2.5` — TransformInterceptor 로 `{ data: ... }` 래핑. `spec/conventions/swagger.md §5-2` — 성공 응답 래퍼 구조.
- **상세**: `{ data: { message } }` 포맷은 `api-convention` 의 TransformInterceptor 래핑 규약과 정합한다. 그 자체는 규약 준수다. 다만 §5 엔드포인트 표에서 일부 엔드포인트 설명은 응답 스키마를 `{ data: { enabled: boolean } }` 처럼 명시하고, 일부는 단순히 "응답: `[{id, deviceName, ...}]`" 처럼 외부 래퍼를 생략하는 표기 불일치가 있다.
- **제안**: §5 표의 응답 컬럼 표기를 일관하게 맞추거나, `{ data: ... }` 래퍼를 항상 포함해 api-convention 과의 정합을 명시한다. 단, 이는 spec 가독성 개선이지 기능 오류는 아님.

---

### 5. [INFO] 문서 구조 — `## Rationale` 섹션이 존재하며 내용도 풍부하나, Overview 섹션 명시 미비

- **target 위치**: `spec/5-system/1-auth.md` 전체 구조
- **위반 규약**: `CLAUDE.md` "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 문서 최상단에 `> 관련 문서:` 블록과 본문(§1~§5)이 있고 `## Rationale` 이 존재하지만, `## Overview` 라는 명시적 섹션 헤딩이 없다. CLAUDE.md 는 3섹션을 "권장"으로 표기해 강제 위반은 아니다. 유사한 다른 spec 파일들도 `_product-overview.md` 를 Overview 역할로 두고 본 파일에는 헤딩 없이 바로 본문으로 진입하는 패턴을 따른다.
- **제안**: 현재 패턴(관련 문서 blockquote + 바로 본문 진입)은 `spec/5-system/` 영역의 일관된 관례이므로 변경 불필요. INFO 수준.

---

### 6. [CRITICAL] `§1.5.4` 에러 코드 표 — `forbidden` 과 `rate_limited` 가 `error-codes.md §3` historical-artifact 레지스트리에 초대 API 한정으로 명시되어 있으나, spec 본문 표에 해당 한정 맥락 주석이 없음

- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 (line ~247-254)
  ```
  | 권한 부족 (발송·재발송·취소) | 403 | `forbidden` |
  | Rate limit 초과           | 429 | `rate_limited` |
  ```
- **위반 규약**: `spec/conventions/error-codes.md §3` historical-artifact 레지스트리 — `forbidden`/`rate_limited` (lowercase) 는 "초대 API 한정" 임을 레지스트리에 명시.
- **상세**: `error-codes.md §3` 레지스트리는 `forbidden`(lowercase)가 "초대 흐름 전용 historical artifact 로, 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개"임을 명시한다. 그러나 `1-auth.md §1.5.4` 표에는 `lower_snake_case` 에 대한 어떤 주석도 없고, 바로 아래에 있는 blockquote(§1.5.4 후반)가 `invitation_not_found` 등의 예외만 설명하고 `forbidden`/`rate_limited` 코드의 lowercase 이유는 언급하지 않는다.

  실제로 §1.5.4 blockquote 는 `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` 4개 코드에 대한 예외를 설명하지만, 같은 표에 있는 `forbidden` 과 `rate_limited` 의 lowercase 예외는 누락되어 있다. `error-codes.md §3` 레지스트리에는 6개 코드 모두 등재되어 있지만, spec 의 독자가 표만 보고 `forbidden` (lowercase)가 왜 기존 `FORBIDDEN` (UPPER_SNAKE_CASE, error-handling §1.2) 와 다른지 파악할 수 없다.

  이는 두 문서 사이의 정보 불일치는 아니지만, spec 읽기 독립성 측면에서 오해 소지가 있다. 더 구체적으로, 다른 개발자가 `forbidden` (lowercase) 를 새 코드 작성의 선례로 삼을 수 있으며 이것이 `error-codes.md §1 신규 코드는 예외를 선례로 삼지 않는다` 를 위반하게 될 위험이 있다.
- **제안**: §1.5.4 blockquote 에 `forbidden` 과 `rate_limited` 의 lowercase 이유도 명시한다:
  ```
  **명명 — historical-artifact 예외 (전체 6개 코드)**: 위 코드들은 error-codes.md §3 historical-artifact 레지스트리에 등재. `forbidden`·`rate_limited` (lowercase) 도 동일 예외에 해당 — 다른 영역의 `FORBIDDEN`(UPPER_SNAKE_CASE, error-handling §1.2) 와 별개로, 초대 흐름 v1 출하 시 이 형태로 정착한 초대 API 전용 예외. 신규 코드는 이를 선례로 삼지 않는다.
  ```
  단, 현재 blockquote 가 이미 "신규 코드는 본 예외를 선례로 삼지 않고 처음부터 UPPER_SNAKE_CASE 를 쓴다"를 명시하고 있으므로, 실질적인 계약 위반은 아님. CRITICAL 등급 부여는 다른 개발자가 `forbidden`/`rate_limited` 의 lowercase 이유를 찾지 못하고 잘못된 선례를 따를 수 있는 구조적 위험 때문임.

---

## 요약

`spec/5-system/1-auth.md` 는 전반적으로 정식 규약을 준수하고 있다. Frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)가 `spec-impl-evidence.md §2` 규약을 따르고, 에러 코드 historical-artifact 예외도 `error-codes.md §3` 레지스트리에 정확히 cross-reference 되어 있다. 감사 액션 명명의 동사 시제 혼용은 Rationale §4.1.A 로 명문화된 의도적 예외이며 규약 내에서 처리되고 있다. 주요 위험은 §1.5.4 에러 코드 표에서 `forbidden`/`rate_limited` (lowercase) 두 코드에 대한 예외 근거 주석이 빠져 있어, 독자가 나머지 4개 초대 코드와 달리 이 두 코드의 lowercase 이유를 spec 내에서 추적하기 어렵다는 점이다. `pending_plans` 파일 실존 여부는 build-time 가드(`spec-pending-plan-existence.test.ts`)가 강제하므로 문서 자체의 규약 위반은 아니나, 최근 audit-log 구현 커밋 이후 plan 완료 여부 검토가 필요하다.

## 위험도

MEDIUM

STATUS: SUCCESS
