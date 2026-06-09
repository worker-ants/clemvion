# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

매트릭스 18개 trigger 행 전수 검토 결과, 아래 1건의 INFO 를 제외하고 유저 가이드 동반 갱신 누락이 없다.

### [INFO] `06-integrations-and-config/knowledge-base.{mdx,en.mdx}` — 재임베딩 불가 상태 안내 미포함

- 변경 파일:
  - `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (`skipReason: 'kb_unsearchable'` 추가)
  - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts` (`not_searchable` 봉투 반환)
  - `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` (목록 카드 경고 배지)
- 매트릭스 항목: `node-schema-change` (trigger glob: `codebase/backend/src/nodes/**`) — target "codebase/frontend/src/content/docs/02-nodes/<cat>.mdx 의 FieldTable"
- 상세: 이번 변경은 AI 에이전트 노드의 `meta.ragDiagnostics.skipReason` enum 에 `kb_unsearchable` 값을 추가하고, KB 검색 불가 시 에이전트가 수신하는 `tool_result` 봉투(`status:"not_searchable"`, `reason:`, `note:`)를 신설한다. 사용자가 KB 모델을 변경한 뒤 재임베딩을 실행하지 않으면 에이전트 응답이 조용히 비어버리던 문제를 해소하는 동작 변경이다. 현재 `06-integrations-and-config/knowledge-base.{mdx,en.mdx}` 에는 이 신호가 언급되지 않는다.
- 무매칭 근거: `node-schema-change` 의 target 은 `02-nodes/<cat>.mdx` FieldTable + dict + backend-labels 이며, 이번 변경은 노드 입력 스키마·필드 추가가 아닌 내부 진단 메타 필드 enum 확장이다. `integration-provider-change` trigger 는 신규/변경 통합 제공자에 해당하며 이번 변경은 KB 검색 동작 보강이다. plan 작성자도 "user-guide 동반 갱신 매트릭스 trigger 무매칭" 으로 사전 판단(`plan/in-progress/kb-unsearchable-warning.md` 체크리스트 §DOCUMENTATION)했으며, 이는 타당하다.
- 제안: 엄격한 trigger 무매칭이지만, KB 통합 가이드(`06-integrations-and-config/knowledge-base.{mdx,en.mdx}`) 의 "임베딩 모델 변경" 절에 "모델 변경 후 재임베딩을 실행하지 않으면 목록 카드에 경고가 표시되며 에이전트 KB 검색이 동작하지 않습니다" 1~2 문장 보강을 후속으로 검토 권장(강제 아님). 필요 시 `plan/in-progress/kb-model-change-reembed-followup.md` 의 후속 작업 항목에 포함 가능.

---

## i18n Parity 확인 (new-ui-string trigger)

- `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` 에 신규 한국어 리터럴 없음 — `t()` 키 참조 방식 사용.
- `dict/ko/knowledgeBases.ts`: `reembeddingRequired`, `reembeddingInProgress` 추가 (ko).
- `dict/en/knowledgeBases.ts`: `reembeddingRequired`, `reembeddingInProgress` 추가 (en).
- **KO/EN parity 충족** — CRITICAL 없음.

## backend-labels.ts 확인 (new-warning-code / new-error-code trigger)

- 이번 변경은 `warningRules` (backend warning code) 및 `error-codes.ts` `ErrorCode` enum 변경을 포함하지 않는다.
- `skipReason: 'kb_unsearchable'` 은 `meta.ragDiagnostics` 내부 진단 메타 필드이며, `WARNING_KO` / `ERROR_KO` 매핑 대상인 backend warning/error code 와 다른 레이어다.
- `backend-labels.ts` 동반 갱신 의무 없음 — CRITICAL/WARNING 없음.

## 신규 섹션 디렉토리 확인 (new-userguide-section-dir trigger)

- 이번 변경에 `codebase/frontend/src/content/docs/<NN>-<name>/` 신규 디렉토리 없음 — 해당 없음.

---

## 요약

매트릭스 18개 trigger 행 중 변경 파일이 매칭되는 trigger: `node-schema-change` (glob `codebase/backend/src/nodes/**`), `new-ui-string` (semantic, TSX). 매칭 2개 중 누락 0개. i18n parity (KO/EN) 는 같은 변경 set 에서 완성됐고, backend warning/error code 신규 발행 없음, 신규 섹션 디렉토리 없음. INFO 1건 — KB 통합 가이드의 재임베딩 경고 동작 미기술(trigger 무매칭으로 강제 아님, 후속 권장). 전체 유저 가이드 동반 갱신 관점에서 CRITICAL/WARNING 발견 없음.

## 위험도

NONE
