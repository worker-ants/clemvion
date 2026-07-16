# User Guide Sync Review

## 점검 절차 요약

1. `.claude/config/doc-sync-matrix.json` (SSOT, 21개 row) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (§112-140) 을 Read 하여 매트릭스 적재.
2. 리뷰 대상은 단일 파일 `spec/conventions/cross-node-warning-rules.md` (frontmatter `status: partial → implemented`, `code:` 글로브에 `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` 추가, `pending_plans:` 제거, §8 표의 `ai_agent:tool-payload-budget` rule 설명을 "Planned" 서술에서 구현 완료 서술로 교체).
3. `git log --oneline -- spec/conventions/cross-node-warning-rules.md` 로 이 diff 가 이미 커밋된 상태(HEAD = `7231f7006 docs(ai-agent): config-time payload 경고 구현 완료 마킹`)임을 확인. `git show --stat 7231f7006` 로 같은 커밋에 `spec/4-nodes/3-ai/1-ai-agent.md` + `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 가 함께 갱신됐음을 확인 — 이 리뷰 payload 에는 3개 파일 중 1개만 발췌돼 전달됨.
4. 코드 파일(`codebase/**`) 변경은 이 diff 자체에 없음 — 실제 구현(`tool-payload-save-warning.ts`, `WorkflowsService.getGraphWarnings`/`saveCanvas` 배선, `GRAPH_WARNING_KO` 매핑, `backend-labels.test.ts` backend-only ruleId 등록)은 선행 커밋 `2ccc442eb` / `ad24261af` 에서 이미 완료됐고, 본 diff 는 그 사실을 spec frontmatter 에 사후 반영하는 순수 문서 정정.

## 매트릭스 매칭 결과

- `new-node` / `node-schema-change` (trigger: `codebase/backend/src/nodes/**`) — **미매칭**. 이 diff 에 `codebase/backend/src/nodes/**` 신규 파일 없음(spec 문서만 변경).
- `new-ui-string` (trigger: `*.tsx`) — **미매칭**. TSX 변경 없음.
- `new-warning-code` (신규 warningCode 발행, semantic) — **미매칭 (기존 rule)**. `ai_agent:tool-payload-budget` 는 이 diff 이전부터 §8 표에 이미 등재돼 있던 rule (diff 는 그 설명 문구만 교체) — 신규 발행이 아님. 검증 결과 `codebase/frontend/src/lib/i18n/backend-labels.ts:643` 의 `GRAPH_WARNING_KO["ai_agent:tool-payload-budget"]` 매핑과 `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:304` 의 `BACKEND_ONLY_GRAPH_WARNING_RULE_IDS` 등록이 이미 존재함을 확인 — 매핑 누락 없음.
- `expression-language-change` / `run-debug-flow-change` / `auth-session-flow-change` / `integration-provider-change` / `new-userguide-section-dir` — **미매칭**. 해당 경로/의미 변경 없음.
- `spec-major-change` (trigger glob: `spec/conventions/**`, PROJECT.md §138) — **매칭**. targets: (a) frontmatter `code:`/`status:`/`pending_plans:` 정합 갱신, (b) `status: partial` 이면 `pending_plans:` 신설, (c) `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장.
  - (a) 충족 — `status: partial → implemented`, `pending_plans:` 블록 제거, `code:` 목록에 신규 파일 1건 추가.
  - (b) 해당 없음 — `status` 가 `implemented` 로 전환됐으므로 `partial` 케이스 아님.
  - (c) 충족 — `ls codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts` 로 실존 확인(2026-07-16 08:56 수정). `code:` 글로브의 다른 항목들(`graph-warning-rule.ts`, `workflows.service.ts` 등)도 기존에 실존.
  - **결론: 이 trigger 는 매칭되지만 요구 사항을 모두 충족 — 갱신 누락 없음.**

## 발견사항

없음. 매트릭스 21개 row 중 `spec-major-change` 1건만 매칭됐고, 검증 결과 위반 없음(frontmatter 정합 + code 글로브 실존 + 선행 커밋에서 이미 완료된 backend-labels/GRAPH_WARNING_KO 매핑 확인).

참고로 이 spec 파일이 참조하던 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 는 (같은 커밋에서) `pending_plans:` 참조가 제거됐음에도 `plan/in-progress/` 에 그대로 남아있다 — 플랜 본문을 확인한 결과 항목 A 의 마지막 체크박스(`[ ] PR (항목 A 단독)`)가 아직 미완료 표시이고 항목 B(resume 턴 timeoutMs+signal)가 후속 작업으로 명시돼 있어 in-progress 유지가 의도된 상태로 보인다. 이는 doc-sync-matrix 의 어떤 row 대상도 아니고(plan lifecycle 은 별도 가드 영역) 본 리뷰어의 점검 범위(유저 가이드 MDX/i18n dict/backend-labels) 밖이라 정보 제공 목적으로만 언급하며 CRITICAL/WARNING 으로 분류하지 않는다.

## 요약

매트릭스 21개 trigger row 중 이 diff(`spec/conventions/cross-node-warning-rules.md` 단독)에 매칭된 것은 glob 기반 `spec-major-change` 1건뿐이며, frontmatter 정합성(`status`/`code:`/`pending_plans:`) 검증 결과 완전히 충족됐다. 실제 사용자 가시 표면(도구 payload 예산 경고의 ko 메시지)에 필요한 `GRAPH_WARNING_KO` 매핑과 `backend-labels.test.ts` backend-only ruleId 등록은 선행 커밋(`2ccc442eb`, `ad24261af`, 그리고 같은 turn 의 `7231f7006`)에서 이미 반영되어 있었고, 이 diff 는 그 완료 사실을 spec 문서에 사후 정합화한 순수 문서 갱신이다. 노드/TSX/expression-engine/auth/docs 섹션 디렉토리 관련 trigger 는 전부 미매칭이라 해당 영역 갱신 의무도 없다. CRITICAL 0건, WARNING 0건.

## 위험도

NONE
