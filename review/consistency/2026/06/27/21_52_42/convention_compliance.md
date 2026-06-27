# 정식 규약 준수 검토 결과

검토 대상: `spec/data-flow` (--impl-done, diff-base=origin/main)
검토 일시: 2026-06-27

---

## 발견사항

### **[WARNING]** 워크스페이스 초대 흐름의 `lower_snake_case` 에러 코드 4종이 예외 레지스트리에 미등재

- **target 위치**: `spec/data-flow/12-workspace.md` §1.2 (invitation 생성), §1.8 (재발송·취소)
- **위반 규약**: `spec/conventions/error-codes.md §1` — 에러 코드는 `UPPER_SNAKE_CASE` 의무. §3 Historical-artifact 예외 레지스트리에 명시적으로 등재된 코드만 lowercase 가 허용된다.
- **상세**:
  - `workspace_type_mismatch` (`403`) — `workspace-invitations.service.ts:91`에서 발행
  - `already_a_member` (`409`) — `workspace-invitations.service.ts:105`에서 발행
  - `invitation_already_pending` (`409`) — `workspace-invitations.service.ts:146`에서 발행
  - `invitation_already_accepted` (`409`) — `workspace-invitations.service.ts:189,354`에서 발행

  `error-codes.md §3` 레지스트리에 초대 흐름 한정으로 등록된 코드는 `invitation_not_found`·`invitation_expired`·`invitation_already_used`·`invitation_email_mismatch`·`forbidden`·`rate_limited` 6종이며, 위 4종은 누락됐다. 코드 확인: 4종 모두 실제 코드에서 해당 소문자 문자열로 발행 중 (grep 검증).

- **제안**: `spec/conventions/error-codes.md §3` 에 아래 4행을 추가해 레지스트리를 완성한다. `error-codes.md §2` 의 rename = breaking 정책상 UPPER_SNAKE 정규화는 프론트엔드 분기 여부 확인 후 결정.

  | 코드 | HTTP | 이름이 부정확한 이유 | 진실(의미) | 근거 |
  |---|---|---|---|---|
  | `workspace_type_mismatch` | 403 | `lower_snake_case` — invitation 흐름 v1 출하 시 정착 | personal 워크스페이스에 초대 불가 | `workspace-invitations.service.ts` |
  | `already_a_member` | 409 | `lower_snake_case` — invitation 흐름 v1 출하 시 정착. 동 모듈 직접 추가 경로의 `ALREADY_A_MEMBER`와 형식 불일치 | invitation 수신자가 이미 워크스페이스 멤버 | `workspace-invitations.service.ts` |
  | `invitation_already_pending` | 409 | `lower_snake_case` — invitation 흐름 v1 출하 시 정착 | 동일 (workspace, email) 대기 초대 중복 | `workspace-invitations.service.ts` |
  | `invitation_already_accepted` | 409 | `lower_snake_case` — invitation 흐름 v1 출하 시 정착 | 이미 수락된 초대에 재발송·취소 시도 | `workspace-invitations.service.ts` |

---

### **[WARNING]** 동일 "이미 멤버" 조건에 대해 두 API 경로가 서로 다른 케이스 규칙의 에러 코드를 발행

- **target 위치**: `spec/data-flow/12-workspace.md §1.2` vs `§1.9`
- **위반 규약**: `spec/conventions/error-codes.md §1` (의미 기반 명명 + UPPER_SNAKE_CASE). 동일 의미의 코드가 두 경로에서 다른 표기 체계로 발행되는 것은 클라이언트 계약의 단일 진실 원칙 위반.
- **상세**:
  - `§1.2` 초대 발급 경로: `409 code=already_a_member` (lowercase) — 초대 대상 이메일이 이미 멤버인 경우
  - `§1.9` 직접 추가 경로: `409 ALREADY_A_MEMBER` (UPPER_SNAKE_CASE) — 직접 추가 대상이 이미 멤버인 경우

  코드 검증:
  - `workspace-invitations.service.ts:105` → `code: 'already_a_member'`
  - `workspaces.service.ts:246` → `code: 'ALREADY_A_MEMBER'`

  개념적으로 동일한 "이미 멤버" 조건이 두 엔드포인트에서 표기가 다른 별개 코드로 발행된다. 클라이언트가 `already_a_member` 와 `ALREADY_A_MEMBER` 를 동일 분기로 처리해야 하는지 불명확하며, spec 문서가 이 불일치를 설계 의도(별개 코드)인지 historical artifact(동일 의미)인지 명시하지 않는다.

- **제안**:
  - `spec/data-flow/12-workspace.md` §1.2 주석에 "`already_a_member` 는 invitation 흐름 전용 historical artifact (lowercase) — §1.9 의 `ALREADY_A_MEMBER` (직접 추가 경로)와는 별개 코드" 임을 명시
  - `error-codes.md §3` 등재 시 이 설계 의도 차이를 명시
  - 또는 `already_a_member` 를 `ALREADY_A_MEMBER` 로 통일하는 마이그레이션 계획을 수립 (프론트엔드 분기 확인 후)

---

## 규약 준수 확인 (위반 없음)

다음 항목은 검토 결과 규약과 부합함을 확인했다.

| 관점 | 확인 내용 | 결과 |
|---|---|---|
| 문서 구조 규약 | `0-overview.md` 및 모든 도메인 문서가 Overview / 본문 / Rationale 3섹션 구조를 준수 | ✓ |
| `0-` prefix 명명 | `spec/data-flow/0-overview.md` 는 `spec-impl-evidence.md §1` 이 `0-overview.md` basename 을 영역 진입 문서로 면제 처리 — 올바른 패턴 | ✓ |
| frontmatter 부재 | `spec/data-flow/**` 는 `spec-impl-evidence.md §1` 의 의무 적용 대상 디렉토리 목록에 없음 — frontmatter 미작성이 정상 | ✓ |
| 감사 액션 명명 | `1-audit.md §1.1` 의 action 전수가 `audit-actions.md §1` (`<resource>.<verb>`), §2 (verb 시제 3분류), §3 (도메인별 레지스트리)를 준수. 기등록 historical artifact (`invitation_expired` 등)는 `error-codes.md §3` 참조 경로로 올바르게 처리됨 | ✓ |
| 에러 코드 케이스 (등록된 코드) | `invitation_already_used`, `invitation_expired`, `invitation_email_mismatch` 등 `error-codes.md §3` 에 이미 등재된 코드는 spec 에서 올바르게 그 사실을 반영 | ✓ |
| 에러 코드 케이스 (신규 코드) | `10-triggers.md`, `11-workflow.md`, `13-agent-memory.md` 등이 언급하는 에러 코드는 모두 `UPPER_SNAKE_CASE` | ✓ |
| convention 상호 참조 | `secret-store.md`, `audit-actions.md`, `cross-node-warning-rules.md`, `conversation-thread.md`, `chat-channel-adapter.md` 등 관련 convention 을 SoT 로 올바르게 위임 | ✓ |
| 도메인 인덱스 정합 | `0-overview.md §2` 의 15개 도메인 표와 실제 파일 목록이 1:1 대응 | ✓ |
| BullMQ 큐 카탈로그 | `0-overview.md §4` 의 16개 큐가 `0-overview.md §1.2` 핵심 사실란에 명시된 16개 큐와 일치 | ✓ |
| Mermaid custom theme | 사용 없음 (`0-overview.md Rationale §Mermaid 사용` 방침 준수) | ✓ |

---

## 요약

`spec/data-flow` 문서군은 전반적으로 정식 규약을 준수하고 있다. 문서 구조(3섹션), 명명 prefix, 감사 액션 표기, 에러 코드 케이스(신규 코드)는 모두 규약과 부합한다. 주요 이슈는 워크스페이스·초대 흐름에서 실제 코드가 발행하는 `lower_snake_case` 에러 코드 4종(`workspace_type_mismatch`, `already_a_member`, `invitation_already_pending`, `invitation_already_accepted`)이 `error-codes.md §3` 예외 레지스트리에 누락된 것이며, `spec/data-flow/12-workspace.md` 가 이 코드들을 정확히 반영하고 있음에도 해당 spec 이 convention 위반임을 명시하지 않는다. 아울러 동일 "이미 멤버" 조건에 대해 초대 경로(`already_a_member`)와 직접 추가 경로(`ALREADY_A_MEMBER`)가 서로 다른 케이스 체계를 사용하는 불일치가 spec 내에서 설명되지 않고 있다. 두 건 모두 `error-codes.md §3` 레지스트리 갱신과 spec 내 주석 보강으로 해소 가능하다.

## 위험도

**LOW**
