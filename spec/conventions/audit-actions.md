---
id: audit-actions
status: implemented
code:
  - codebase/backend/src/modules/audit-logs/audit-action.const.ts
---

# 감사 액션 명명 규약 (Conventions)

## Overview

감사 로그 `action` 식별자(`AuditLog.action`)의 **명명·시제 규율**만 정의한다. 책임 경계:

- **액션 카탈로그(구현됨/Planned 목록)·workspace 귀속·읽기측 계약**: [`5-system/1-auth.md §4.1`](../5-system/1-auth.md#41-기록-대상-액션) (SoT).
- **감사 로그 적재·조회 파이프라인·커버리지 추적**: [`data-flow/1-audit.md §1.1`](../data-flow/1-audit.md) (SoT).
- **명명·시제 결정의 배경·기각 대안·역사**: [`5-system/1-auth.md §Rationale 4.1.A`](../5-system/1-auth.md#41a--planned-감사-액션의-user-dot-prefix-통일).
- **구현 단일 SoT (union 타입 강제)**: `code:` 의 `AUDIT_ACTIONS` (`audit-action.const.ts`).

본 문서가 **유일하게 소유**하는 것: ① `<resource>.<verb>` 구조 규칙, ② verb 시제 3분류 taxonomy, ③ 도메인별 분류 레지스트리.

## 1. 구조 — `<resource>.<verb>`

모든 action 은 `<resource>.<verb>` 형식이며 **resource dot-prefix 가 필수**다 (조회 필터·그룹의 기준). prefix 없는 표기(과거 `re_run_initiated` 등)는 금지하며 cross-audit G-02 에서 `execution.re_run` 으로 정정됐다. 새 action 은 반드시 `AUDIT_ACTIONS` union 에 추가한 뒤 사용한다 (인라인 문자열 금지) — `AuditLogsService.record({ action })` 가 타입으로 강제한다.

**토큰 구분자**: resource·verb 토큰 내부의 다중 어절은 **언더스코어**로 잇는다 (`scope_changed`·`transfer_ownership`·`role_changed`·`re_run`·`password_changed`). 하이픈·camelCase 는 쓰지 않는다.

> **읽기측은 닫힌 enum 으로 단정하지 않는다.** 쓰기측은 union 으로 강제되지만 `AuditLog.action` 은 DB 자유 문자열 컬럼이라 과거 row 에 레거시 값이 존재할 수 있다. 상세 계약은 [1-auth §4.1](../5-system/1-auth.md#41-기록-대상-액션).

## 2. verb 시제 3분류

audit 는 "일어난 일" 의 기록이다. verb 시제는 아래 세 패턴 중 하나를 따른다. **분류 기준은 resource 이름이 아니라 verb 의 성격**이다 — 따라서 같은 resource 라도 verb 에 따라 패턴이 갈릴 수 있다 (예: `workspace.transfer_ownership` 은 §2.3, `workspace.created/updated/deleted` 은 §2.1). 단 **같은 성격의 CRUD 생애주기 verb 끼리는** 한 resource 안에서 §2.1/§2.2 중 하나로 일관 표기하고 혼용하지 않는다 (§2.3 도메인 고유 동사는 그와 별개로 공존 가능).

### 2.1 과거분사 (기본)

"발생한 사건" 을 그대로 기록하는 도메인은 과거분사를 쓴다 — `created`/`updated`/`deleted`/`changed`/`enabled`/`disabled` 등. **기본값**이며, 새 도메인은 특별한 사유가 없으면 이 패턴을 따른다. `scope_changed`·`reauthorized` 같은 **합성 과거분사**(목적어/부사 + 과거분사)도 본 범주다 — 핵심은 verb 말미가 과거분사형인지다.

### 2.2 resource 단위 현재형 (CRUD 예외)

한 resource 의 액션 집합에 **과거분사가 부자연스러운 동사**(`reveal`·`regenerate`·`set_default` 등)가 섞이면, 혼용을 피하기 위해 그 resource 의 전 CRUD 액션을 **현재형으로 통일**한다 (`create`/`update`/`delete`/...).

### 2.3 도메인 고유 동사 (불규칙)

단순 CRUD 도, 과거분사 변환도 부자연스러운 **도메인 고유 단일 행위**는 그 도메인 용어를 `<resource>.<verb>` 로 그대로 쓴다. 행위 자체가 도메인 명사/동사라(재실행·소유권 이전 등) 위 두 패턴에 억지로 끼워맞추면 의미가 흐려지는 경우다.

## 3. 도메인별 분류 레지스트리

| resource | 패턴 | 액션 | 상태 |
|---|---|---|---|
| integration | 과거분사 (§2.1) | `created`, `updated`, `deleted`, `rotated`, `scope_changed`, `reauthorized` | 구현 |
| user | 과거분사 (§2.1) | `password_changed`, `2fa_enabled`, `2fa_disabled` | 구현 |
| auth_config | 현재형 (§2.2) | `create`, `update`, `delete`, `regenerate`, `reveal` | 구현 |
| execution | 도메인 동사 (§2.3) | `re_run` | 구현 |
| workspace | 도메인 동사 (§2.3) | `transfer_ownership` | 구현 |
| workspace | 과거분사 (§2.1) | `created`, `updated`, `deleted` | 미구현 |
| member | 과거분사 (§2.1) | `invited`, `role_changed`, `removed` | 미구현 |
| workflow | 과거분사 (§2.1) | `created`, `updated`, `deleted`, `executed` | 미구현 |
| trigger | 과거분사 (§2.1) | `created`, `updated`, `deleted` | 미구현 |
| schedule | 과거분사 (§2.1) | `created`, `updated`, `deleted` | 미구현 |
| model_config | 현재형 (§2.2) | `create`, `update`, `delete`, `set_default` | 미구현 |

> `model_config` 에 `reveal` 이 없는 것은 ModelConfig 에 평문 reveal 엔드포인트가 없기 때문이다(`auth_config.reveal` 과 대비). `set_default` 는 과거분사가 부자연스러워 §2.2 현재형으로 묶이며, 토큰 구분자는 §1 규약대로 언더스코어다.

> **`workspace` 가 두 패턴에 걸치는 이유**: `transfer_ownership` 은 소유권 이전이라는 **단일 트랜잭션 행위**(§2.3)이고, `created`/`updated`/`deleted` 은 일반 CRUD 생애주기(§2.1)다. 같은 resource 라도 행위 성격에 따라 패턴이 다를 수 있다 — 분류 기준은 resource 이름이 아니라 **그 verb 가 어느 패턴에 속하는가**다.

> 구현 여부·커버리지 갭의 ground truth 는 [data-flow/1-audit.md §1.1](../data-flow/1-audit.md). 미구현 액션은 `AUDIT_ACTIONS` 에 아직 없으며, 구현 시 위 표기 그대로 추가한다.

## Rationale

### 왜 시제를 한 규약으로 묶는가
감사 액션 명명·시제 규칙은 원래 [`5-system/1-auth.md §4.1`](../5-system/1-auth.md#41-기록-대상-액션) 본문에 산문으로 흩어져 있었고, `workspace.transfer_ownership`(verb_noun 형)이 그 산문의 어느 시제 범주에도 분류되지 않은 채 남아 있었다 (refactor 04 후속 일관성 검토 WARNING). 도메인이 늘수록(member·workflow·trigger·schedule·model_config …) 산문 규약은 누락·표류하기 쉬워, 전 도메인 시제 규칙을 **단일 conventions 문서**로 통합하고 §4.1 은 카탈로그(어떤 액션이 존재하며 구현/미구현인지)만 소유하도록 책임을 분리했다. `error-codes.md` 가 명명 규약과 카탈로그를 분리한 것과 같은 패턴이다.

### 왜 2분류가 아니라 3분류인가
초안은 "과거분사 기본 / CRUD 현재형 예외" 2분류였으나, `execution.re_run`·`workspace.transfer_ownership` 은 둘 중 어디에도 맞지 않는다 — 생애주기 CRUD 가 아니고(현재형 예외 부적합), 억지 과거분사화(`re_run`→`re_ran`, `transfer_ownership`→`ownership_transferred`)는 도메인 용어의 의미를 흐리고 이미 적재된 append-only row·`AUDIT_ACTIONS` 표기를 깨뜨린다. 이 둘을 정상 범주로 포섭하기 위해 §2.3 "도메인 고유 동사" 를 두었다. 결과적으로 분류 기준이 resource 가 아니라 **verb 의 성격**이 되며, 같은 `workspace` 가 §2.1(생애주기)과 §2.3(소유권 이전)에 동시에 나타나는 것은 이 기준의 자연스러운 귀결이다 (모순이 아니라 설계 의도).

### 기각된 대안
- **`workspace.transfer_ownership` → `workspace.ownership_transferred` 로 과거분사 정규화**: 표기 일관성은 얻지만 이미 구현·적재된 액션이라 `re_run_initiated`→`re_run`(cross-audit G-02)과 달리 정정의 실익이 없고, append-only row 와의 불일치만 남긴다. 도메인 고유 동사로 분류해 현 표기를 보존한다.
- **시제 규약을 §4.1 본문에 그대로 두고 workspace 예외만 추가**: 단기 비용은 낮으나 도메인 증가 시 산문 규약의 표류 문제(본 검토가 드러낸)가 재발한다. 단일 SoT 문서로 승격하는 편이 장기적으로 싸다.

> 명명·시제 **결정의 인증 도메인(`user.*`) 측 배경**(dot-prefix 통일·과거분사 확정·Planned 정규화)은 [`1-auth §Rationale 4.1.A`](../5-system/1-auth.md#41a--planned-감사-액션의-user-dot-prefix-통일) 가 소유한다. 본 Rationale 은 taxonomy 구조 자체의 설계 근거를 소유한다.
