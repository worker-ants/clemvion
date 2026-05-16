---
worktree: cafe24-integration-a3f5e2
started: 2026-05-14
owner: developer (note for project-planner)
discovered_during: cafe24-implementation Phase 1 (consistency-check --impl-prep, review/consistency/2026-05-14_00-12-59/)
---

# Spec 갱신 제안 — `send_email` 성공 포트명 불일치

## 발견 경위

`cafe24-implementation` Phase 1 의 `consistency-check --impl-prep spec/4-nodes/4-integration/` 호출에서 **Critical** 로 검출됨 — 본 cafe24 작업과 무관한 기존 spec 불일치이지만, 같은 디렉토리이므로 BLOCK 발동.

## 불일치 내용

| 위치 | 명시값 |
|---|---|
| `spec/4-nodes/4-integration/0-common.md §7` 출력 구조 색인 | `send_email` 정상 케이스 = `§5.1` (다른 노드들과 동일하게 `success` 포트로 추정됨) |
| `spec/4-nodes/4-integration/3-send-email.md` §3.2, §5.1 | 성공 포트 = `'out'` |
| `backend/src/nodes/integration/send-email/send-email.schema.ts` | `port: z.enum(['out', 'error'])` |
| `backend/src/nodes/integration/send-email/send-email.schema.spec.ts` line 98 | `port: 'out'` |

**구현 실태**: send_email 핸들러는 `'out'` 포트 사용. 색인이 정정되어야 함.

## 권장 조치 (project-planner 영역)

두 옵션 중 (B) 채택을 권장:

- **(A) `success` 로 통일** — HTTP/DB/Cafe24 와 일관성. 다만 backend 핸들러/schema/test 코드 모두 변경 필요 (breaking, 운영 워크플로의 `$node["X"].port === 'out'` expression 모두 정정 필요).
- **(B, 권장) `out` 명시 + 색인 정정** — `0-common.md §7` 의 send_email 행을 `§5.1 ('out')` 로 정정. `0-common.md §6` port 행의 `'success'` (또는 default 단일 출력) 표현은 send_email 의 `out` 을 포함하는 의도였음을 명시. 코드 변경 0.

## 본 cafe24 작업에 미치는 영향

**없음** — cafe24 spec 은 `'success'` / `'error'` 포트를 명시적으로 채택했고, send_email 정정 방향과 무관하게 동작. 본 plan 의 BLOCK 은 우회하고 cafe24 작업을 계속 진행한다.

## 함께 정리 가능한 Warning

`review/consistency/2026-05-14_00-12-59/SUMMARY.md` 의 W1 도 같은 spec 정정 흐름에 포함 권장:

- `database_query.meta.rowCount` 삼중 불일치 — `2-database-query.md §5.1` 의 "복제 금지" 결정을 단일 진실로 채택하여 `node-output.md` Principle 2 와 `0-common.md §6` DB 행 정정.

## 처리 흐름

1. 사용자가 본 노트를 확인.
2. `project-planner` skill 진입하여 위 (B) 정정 + W1 동시 처리.
3. 정정 commit 후 본 plan 을 `plan/complete/` 로 이동.
4. cafe24-implementation 작업과는 독립적으로 진행 가능.
