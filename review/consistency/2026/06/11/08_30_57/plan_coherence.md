# Plan 정합성 검토 결과

검토 대상: V-16/V-17 코드측 문서 문자열 정정 (KB rerank DTO Swagger stale 제거, web-chat-sdk firstMessage 폐기 패턴 교체)
worktree: `rag-webchat-doc-strings` (branch `claude/rag-webchat-doc-strings`)
검토일: 2026-06-11

---

## 발견사항

### [INFO] V-17 수정이 webchat-eager-start.md "비차단 backlog" 항목을 해소함 — plan 갱신 권장
- target 위치: `codebase/packages/web-chat-sdk/README.md` 및 `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`
- 관련 plan: `plan/in-progress/webchat-eager-start.md` 비차단 backlog 첫 항목 — "M2 SDK firstMessage 잔재(impl-done W1): `codebase/packages/web-chat-sdk/README.md`·`examples/byo-ui-headless.ts` 가 폐기된 `firstMessage` 참조 — M2 BYO-UI 예제. 별도 패키지/경로라 본 M1 PR 범위 밖. submit_message 패턴 예제로 교체 후속."
- 상세: target 이 정확히 해당 backlog 항목을 구현한다. `webchat-eager-start.md` 의 backlog 체크박스는 미갱신 상태.
- 제안: `plan/in-progress/webchat-eager-start.md` 비차단 backlog 첫 항목을 `[x]` 로 처리하거나, "rag-webchat-doc-strings PR 에서 해소(V-17)" 주석 추가.

### [INFO] V-16/V-17 수정의 추적 plan 파일 미존재 — spec-coverage SUMMARY 에만 등재
- target 위치: 변경 전체
- 관련 plan: `review/spec-coverage/2026/06/10/12_32_46/SUMMARY.md` §V-16 / §V-17 (원천 발견)
- 상세: target 변경은 spec-coverage SUMMARY 에서 직접 도출된 "코드 수정" 권고를 이행한다. 그러나 이 변경에 대응하는 `plan/in-progress/` 파일이 없고, `spec-code-cross-audit-2026-06-10.md` 는 V-16/V-17 을 명시적으로 열거하지 않는다(`spec-code-cross-audit-2026-06-10.md` 본문에는 V-16/V-17 번호가 없음). 미해결 결정 우회나 충돌은 없으나, 추적 가시성이 낮다.
- 제안: `spec-code-cross-audit-2026-06-10.md` 에 V-16·V-17 항목을 추가하고 PR 완료 시 체크 처리하거나, 해당 plan 파일에 "[x] V-16 / V-17 — rag-webchat-doc-strings PR 해소" 한 줄을 기재. (비차단 — 구현 자체는 옳다.)

### [WARNING] unified-model-mgmt-5af7ee worktree 가 동일 파일(`create-knowledge-base.dto.ts`)을 병렬 편집 중
- target 위치: `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` (rerank 섹션 L151~L200)
- 관련 plan: `plan/in-progress/unified-model-management.md` (worktree: `unified-model-mgmt-5af7ee`, started: 2026-06-10)
- 상세: `unified-model-mgmt-5af7ee` 는 같은 파일의 L98 (임베딩 섹션)에 `embeddingModelConfigId` 신규 필드 및 `llmConfigId` LEGACY 레이블을 추가하고 있다. target 은 L151 (rerankMode) 및 L193 (rerankLlmConfigId) Swagger 설명을 수정한다. 두 편집은 **서로 다른 line range** 이므로 내용상 충돌은 없으나, 동일 파일에 대한 두 개의 독립 커밋이 rebase/merge 시 git 3-way merge 대상이 된다. 후행 PR 이 rebase 할 때 conflict hunk 없이 자동 병합될 가능성이 높지만, 두 PR 이 동시에 열려 있으면 CI 통과 순서·rebase 책임이 모호해진다.
- 제안: 머지 순서를 명시할 것 — `rag-webchat-doc-strings`(doc-string only, 영향 최소) 를 먼저 머지하고, `unified-model-mgmt-5af7ee` 가 rebase 후 진행하는 것이 안전하다. `unified-model-management.md` PR 본문 또는 plan note 에 "rag-webchat-doc-strings 먼저 머지 후 rebase" 를 기재 권장.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보(§5번 검토): 현재 활성 worktree 9개 전원에 대해 Step 1 ancestor 검사 수행. 결과:

- `deps-security-hygiene` — Step 1: ACTIVE (ancestor 아님)
- `health-probe-status-d9a184` — Step 1: ACTIVE
- `integration-expiry-fixes-1d7c7d` — Step 1: ACTIVE
- `kb-reembed-banner-ecfe2b` — Step 1: ACTIVE
- `kb-reembed-banner-impl-31d0c8` — Step 1: ACTIVE
- `kb-unsearchable-groom-cbe34e` — Step 1: ACTIVE
- `makeshop-catalog-labels` — Step 1: ACTIVE
- `unified-model-mgmt-5af7ee` — Step 1: ACTIVE (→ §5 분석 대상, WARNING 위 보고)

stale 로 skip 된 worktree: **0건** — 모든 worktree 가 origin/main ancestor 아님(active).

---

## 요약

target 변경(V-16/V-17 doc-string 정정)은 spec-coverage audit 에서 권고된 내용을 그대로 이행하며, 미해결 결정 우회 없음. V-17 수정은 `webchat-eager-start.md` 비차단 backlog 항목을 해소하므로 해당 plan 의 체크 갱신이 권장된다(INFO). `create-knowledge-base.dto.ts` 를 병렬 편집 중인 `unified-model-mgmt-5af7ee` worktree 와의 file-level 공존이 발견됐으나 편집 영역이 서로 다른 라인이라 내용 충돌은 없고 rebase 순서 조율로 충분히 해소 가능하다(WARNING). worktree stale 후보 8건 중 stale 0건, active 8건 분석.

## 위험도

LOW

STATUS: OK
