---
worktree: cafe24-spec-followup-c5b7a9
started: 2026-05-16
owner: project-planner
---

# spec/data-flow/ 12 파일 명명 규약 정합화 (F-1)

PR #76 consistency-check W-4 / I-5 후속. `spec/data-flow/` 12 파일이 plain-named 로 `spec/<영역>/N-name.md` 규약 (CLAUDE.md 명명 컨벤션 표) 위반. 알파벳 순으로 1- ~ 12- prefix 부여.

## Rename 매핑 (알파벳 순)

| 기존 | 새 이름 |
| --- | --- |
| `0-overview.md` | `0-overview.md` (그대로) |
| `audit.md` | `1-audit.md` |
| `auth.md` | `2-auth.md` |
| `execution.md` | `3-execution.md` |
| `file-storage.md` | `4-file-storage.md` |
| `integration.md` | `5-integration.md` |
| `knowledge-base.md` | `6-knowledge-base.md` |
| `llm-usage.md` | `7-llm-usage.md` |
| `notifications.md` | `8-notifications.md` |
| `observability.md` | `9-observability.md` |
| `triggers.md` | `10-triggers.md` |
| `workflow.md` | `11-workflow.md` |
| `workspace.md` | `12-workspace.md` |

알파벳 순 채택 이유: (a) 의사결정 없이 mechanical, (b) 기존 ls 출력 순서 그대로 유지, (c) 영역 중요도 순서는 추가 의견 충돌 가능.

## Cross-link 갱신 대상 (전수 — consistency-check 후 보강)

총 **27 파일** 갱신 (Python 스크립트로 일괄 처리):

- `spec/data-flow/` 내부 7 파일 — `0-overview.md` 인덱스 표 + 다른 도메인 파일의 `./*.md` 상호참조 (총 34건)
- `spec/` 외부 4 파일 — `spec/1-data-model.md:352`, `spec/2-navigation/4-integration.md:797`, `spec/5-system/13-replay-rerun.md:379`, `spec/5-system/8-embedding-pipeline.md:158`
- `plan/in-progress/` 6 파일 — 살아있는 작업·미완 항목들의 경로도 갱신 (cafe24-pending-polish-followup.md:54 등 — consistency-check W-4/W-5)
- `plan/complete/` 10 파일 — 역사 기록이지만 future 읽기 편의를 위해 일괄 갱신

전수 재검증 완료: `grep -rEn "data-flow/(audit|auth|...|workspace)\.md|\./(audit|...|workspace)\.md" spec/ plan/` 결과 **dangling 0건**.

## Doc map 갱신

`spec/0-overview.md` §8 문서 맵의 `spec/data-flow/` 행 진입 문서 설명을 "`1-audit` ~ `12-workspace`, 알파벳 순 숫자 prefix" 로 정정.

## 진행 순서

- [x] 1. 본 draft commit (v1).
- [x] 2. `/consistency-check --spec plan/in-progress/spec-draft-data-flow-rename.md` (1회차 BLOCK: YES, Critical 1 — 0-overview.md 인덱스 12건 누락).
- [x] 3. Critical 해소 — 전수 grep 후 일괄 갱신 (Python 스크립트로 27 파일 변경).
- [x] 4. 전수 재검증 — dangling 0건 확인.
- [x] 5. doc map 갱신.
- [ ] 6. plan/complete/ 이동 + PR.

## 후속 follow-up

- 없음. Mechanical rename 으로 완결.
