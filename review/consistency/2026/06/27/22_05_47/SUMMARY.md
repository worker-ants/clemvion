# Consistency Check (--impl-done, 최종) 통합 보고서

**BLOCK: NO** — Critical 없음. 5/5 checker 성공. W-1 커밋(20771c845) 이후 시점으로
SPEC-CONSISTENCY 게이트 충족. scope=spec/5-system/, diff-base=107b7617c (W-1 delta).

## 전체 위험도
**LOW** — Critical 0. WARNING 2건은 **본 changeset 무관**(넓은 scope 로 로드된 타 spec
파일의 기존 위생 이슈), INFO 8건(다수 후속 추적 중).

## WARNING — 본 변경 무관 (out-of-scope, 비차단)
| # | 위배 | 처리 |
|---|---|---|
| W-1 | `1-auth.md §3.2` RBAC 매트릭스에 Agent Memory 행 누락 (기존 — 본 PR 미변경 파일) | 별건 spec 위생(본 PR 범위 밖). planner 트랙 이관 |
| W-2 | `10-graph-rag.md` Overview/body 섹션 번호 중복 (기존 — 본 PR 미변경 파일) | 별건 spec 위생(본 PR 범위 밖) |

## INFO — 본 변경 관련
- I-4: saveMemories 계약 가드(throw)가 graceful fallback 과 범주 다름을 §3 Rationale 에 1줄 명시 권장 → 별건 후속 spec PR 에 포함 가능.
- I-5: IE watermark 키 / node-output meta.memory 정정 → 이미 plan 후속 spec PR 로 추적 중(별건).
- 나머지 INFO(graph-rag Entity.type·API RBAC·WS 이벤트·webhook WH-NF-02): 본 변경 무관 기존 항목.

## Checker별
Cross-Spec LOW(무관 타 spec) · Rationale NONE · Convention LOW(무관 graph-rag) · Plan LOW(후속 추적) · Naming NONE(신규 식별자 0).

## 판정
BLOCK: NO. 본 Batch 2 변경은 spec 정합. 무관 WARNING 2건은 별건 spec 위생으로 이관. push 가능.
