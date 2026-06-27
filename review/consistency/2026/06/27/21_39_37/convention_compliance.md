# 정식 규약 준수 검토 결과

**대상**: `spec/5-system/` (1-auth.md, 10-graph-rag.md)
**모드**: `--impl-done`, diff-base=8c5fdf257c7d4a49e5d715e5414ccf643cfdc9f6
**검토 기준**: `spec/conventions/**`

---

## 발견사항

### [INFO] `spec/5-system/10-graph-rag.md` — `## Overview` 헤딩 변형
- **target 위치**: `10-graph-rag.md` 첫 번째 섹션 (`## Overview (제품 정의)`, line 29)
- **위반 규약**: `CLAUDE.md` 정보 저장 위치 표 — "제품 정의·요구사항 | `spec/<영역>/_product-overview.md` **또는 진입 문서의 `## Overview`**" (강조: 정확한 헤딩 형태 `## Overview`)
- **상세**: `1-auth.md`(line 21)는 `## Overview`를 사용하는 반면, `10-graph-rag.md`는 `## Overview (제품 정의)` 형태로 괄호 주석을 추가했다. CLAUDE.md 컨벤션은 헤딩을 `## Overview`로 명시한다. 기능 동작에는 영향 없지만 헤딩 링크(`#overview`) 앵커 슬러그가 `#overview-제품-정의`로 달라져 타 문서에서 `#overview` 앵커로 연결하는 경우 링크 무결성 가드(`spec-link-integrity.test.ts`)에서 miss 가 발생할 수 있다.
- **제안**: 헤딩을 `## Overview`로 변경. 제품 정의 맥락 설명이 필요하면 헤딩 바로 아래 인트로 문장으로 추가한다.

---

## 준수 확인 항목

### `spec/5-system/1-auth.md`

| 점검 항목 | 규약 출처 | 결과 |
|-----------|-----------|------|
| frontmatter `id`/`status`/`code`/`pending_plans` 완비 | `spec-impl-evidence.md §2` | PASS — `id: auth`, `status: partial`, `code:` ≥1, `pending_plans` 존재 |
| `status: partial` → `pending_plans` 의무 | `spec-impl-evidence.md §3` | PASS — `plan/in-progress/spec-sync-auth-gaps.md` 선언 |
| 감사 액션 `<resource>.<verb>` dot-prefix 필수 | `audit-actions.md §1` | PASS — 모든 action이 `integration.*`, `user.*`, `auth_config.*`, `execution.*`, `workspace.*` 형태 |
| 구현 감사 액션 시제 일치 | `audit-actions.md §3` | PASS — integration: 과거분사, user: 과거분사, auth_config: 현재형(§2.2), execution.re_run: 도메인 고유 동사(§2.3), workspace.transfer_ownership: 도메인 고유 동사(§2.3) |
| Planned 감사 액션 시제 일치 | `audit-actions.md §3` 레지스트리 | PASS — workspace/member/workflow/trigger/schedule: 과거분사, model_config: 현재형(§2.2, set_default 때문) — 모두 레지스트리와 일치 |
| 에러 코드 UPPER_SNAKE_CASE | `error-codes.md §1` + `node-output.md §3.2` | PASS — 신규 코드 전부 UPPER_SNAKE_CASE |
| historical-artifact lowercase 코드 등재 | `error-codes.md §3` | PASS — `invitation_not_found` 외 5종이 §3 레지스트리에 등재돼 있고 spec §1.5.4가 이를 명시적으로 참조 |
| 문서 구조 3섹션 | CLAUDE.md | PASS — `## Overview`, 본문(§1–§5), `## Rationale` 모두 존재 |
| `audit-actions.md` SoT 참조 | `audit-actions.md` Overview | PASS — §4.1 첫 문단에서 `audit-actions.md`를 명명·시제 SoT로 포인터 선언 |

### `spec/5-system/10-graph-rag.md`

| 점검 항목 | 규약 출처 | 결과 |
|-----------|-----------|------|
| frontmatter `id`/`status`/`code` 완비 | `spec-impl-evidence.md §2` | PASS — `id: graph-rag`, `status: implemented`, `code:` ≥1 매치 |
| `status: implemented` → `pending_plans` 없음 | `spec-impl-evidence.md §3` | PASS — `pending_plans` 없음 (implemented 에는 불필요) |
| 마이그레이션 명명 `V<번호>__<snake_case>.sql` | `migrations.md §1` | PASS — V025, V026, V027, V037 전부 단조 정수 + double underscore + snake_case |
| 에러 코드 UPPER_SNAKE_CASE | `error-codes.md §1` | PASS — `KB_REEXTRACT_IN_PROGRESS` (409) UPPER_SNAKE_CASE |
| `KB_REEXTRACT_IN_PROGRESS` 의미 기반 명명 | `error-codes.md §1` (의미 기반) | PASS — `KB`(Knowledge Base) + `REEXTRACT_IN_PROGRESS`(조건)로 의미가 명확 |
| 문서 구조 3섹션 | CLAUDE.md | PASS — `## Overview (제품 정의)`, 본문(§1–§8), `## Rationale` 존재. **헤딩 변형은 위 [INFO] 참조** |
| 금지 패턴 — prefix-없는 audit action | `audit-actions.md §1` | N/A — graph-rag spec은 audit action을 정의하지 않음 |

---

## 요약

`spec/5-system/1-auth.md`와 `spec/5-system/10-graph-rag.md` 모두 `spec/conventions/**` 정식 규약과 CLAUDE.md 명명 컨벤션을 대체로 준수한다. 특히 `1-auth.md §4.1` 감사 액션 카탈로그는 `audit-actions.md §3` 레지스트리와 완전히 일치하며, historical-artifact 에러 코드 예외 처리도 `error-codes.md §3`에 명시적으로 등재돼 있어 체계적으로 관리된다. 유일한 발견사항은 `10-graph-rag.md`의 `## Overview (제품 정의)` 헤딩 변형(INFO)으로, 기능 동작이나 다른 시스템의 invariant에는 영향이 없으나 앵커 슬러그 차이로 링크 무결성 가드의 false-miss 위험이 있다.

---

## 위험도

**NONE**

> 발견된 [INFO] 하나는 헤딩 텍스트 표기 차이로, 채택해도 어떤 시스템의 invariant도 깨지지 않는다. CRITICAL·WARNING 사항 없음.
