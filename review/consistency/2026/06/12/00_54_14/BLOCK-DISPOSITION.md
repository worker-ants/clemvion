# impl-done BLOCK 처분 노트

- 세션: `review/consistency/2026/06/12/00_54_14/` (`--impl-done spec/5-system`)
- 결과: **BLOCK: YES** (Critical 1, Warning 7, INFO 12)
- 처분: **PR 진행** (사용자 승인 — "PR 진행 (권장)")

## 판정 근거

impl-done 게이트가 BLOCK: YES 를 냈으나, **Critical 및 모든 Warning·권장조치(10건)가
본 PR 의 diff 와 무관한 pre-existing spec-vs-spec 드리프트**다. 본 PR 의 변경은
7개 파일 전부 `codebase/backend/` (audit 위생) 이고 `spec/`·`plan/` 변경이 0 이다
(`git diff --name-only origin/main..HEAD` 로 확인).

| 항목 | 영역 | 본 PR 관련성 |
|------|------|-------------|
| **Critical-1** `ragSources "chunk"` vs `"content"` | `spec/5-system/10-graph-rag.md §4.3` (graph-rag) | **무관** — audit 과 무관한 RAG 검색 spec |
| W-1 2fa availability data 봉투 | `spec/5-system/1-auth.md §5` | 무관 |
| W-2 Planned 감사액션 dot-prefix (`password_change` 등) | `spec §4.1` Planned (미구현) | 무관 — 내 `AUDIT_ACTIONS` 는 구현된 액션만 포함, 전부 dot-prefix 준수. Planned 는 spec-only. **인수인계 §범위 밖 명시** |
| W-3 `document:graph_error` dead-declared | knowledge-base/websocket spec | 무관 |
| W-4 reveal 엔드포인트 §5 누락 | `spec §5` | 무관 — **인수인계 §범위 밖 (project-planner 별건)** |
| W-5 prod-guards SPEC-DRIFT | `spec §Rationale` | 무관 |
| W-6 webhook IP 추출 정책 | `spec/5-system/12-webhook.md` | 무관 — **인수인계 §범위 밖 (auth-config-webhook-followups §2~4)** |
| W-7 Integration Org RBAC 2-layer | `spec §3.2` | 무관 |

impl-done 모드는 scope(`spec/5-system`) 전 영역의 내부 정합성을 스캔하므로,
본 PR 이 건드리지 않은 영역의 **기존 spec 부채**를 surface 한 것이다. developer 는
`spec/` read-only 라 이 Critical 을 고칠 수 없고, 고치는 것이 본 위생 PR 의 범위도
아니다 (인수인계가 동일 항목들을 project-planner 별건으로 사전 명시).

## 후속 (project-planner)

BLOCK 의 spec Critical/Warning 은 별도 project-planner 작업으로 처리한다. 본 audit
PR 과 독립적이며, 핵심은 SUMMARY 권장조치 #1 (graph-rag `ragSources` `"chunk"`→
`"content"`, **최우선**) 및 인수인계 §범위 밖에 이미 적시된 항목들이다.

## 동일 PR 직접 관련 후속 (라운드2 리뷰에서 식별)

- `spec/5-system/1-auth.md §4.1` 에 action 자유 문자열·레거시 캐비엇 명문화
  (본 PR 의 `AuditLogDto.action` description 과 정합).
- `spec/2-navigation/4-integration.md §14.3` OAuth reauthorize 분기 기록 명문화.
