# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 모든 변경은 기존 spec 과의 정합 방향.

## 전체 위험도
**LOW** — 발견된 위배는 모두 WARNING/INFO 수준이며, 병렬 worktree rebase 순서 조율 한 건과 코드 문서 스타일 이슈 두 건이 전부.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | `unified-model-mgmt-5af7ee` worktree 가 동일 파일(`create-knowledge-base.dto.ts`)을 병렬 편집 중 — 편집 라인 범위는 다르나(L98 vs L151/L193) rebase 순서 미지정 시 CI 통과 책임 모호 | `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` | `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`) | `rag-webchat-doc-strings` 를 먼저 머지 후 `unified-model-mgmt-5af7ee` 가 rebase 진행. `unified-model-management.md` plan note 에 순서 명시 권장. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Convention Compliance | Swagger description 길이 권장(10~40자) 초과 — `rerankMode` ~110자, `topK` ~74자, `rerankLlmConfigId` ~49자. `spec/conventions/swagger.md §3` 은 "내외(guidance)" 표현으로 hard limit 아님 | `create-knowledge-base.dto.ts` L38-39, `rag-search.dto.ts` L68-70, `update-knowledge-base.dto.ts` L84-85 | enum/mode 설명은 기술 맥락상 예외 인정 가능. 즉각 수정 불필요. 규약 개정 시 "enum/mode 예외" 단서 추가 검토. |
| I-2 | Convention Compliance | JSDoc `/** ... */` 과 `@ApiPropertyOptional({ description: '...' })` 인라인 이원화 — CLI 플러그인 `introspectComments:true` 환경에서 중복/충돌 가능성 | `rag-search.dto.ts` L64-75 | JSDoc 을 단일 진실로 유지하거나 인라인 description 이 override 함을 확인 후 하나 제거. 기능 버그 아님. |
| I-3 | Plan Coherence | V-17 수정이 `webchat-eager-start.md` 비차단 backlog 첫 항목을 해소하지만 plan 체크박스 미갱신 | `plan/in-progress/webchat-eager-start.md` (비차단 backlog 첫 항목) | 해당 체크박스를 `[x]` 처리하거나 "rag-webchat-doc-strings PR 에서 해소(V-17)" 주석 추가. |
| I-4 | Plan Coherence | V-16/V-17 에 대응하는 `plan/in-progress/` 파일 미존재 — spec-coverage SUMMARY 에만 원천 등재 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 해당 파일에 V-16·V-17 항목 추가 및 PR 완료 시 체크 처리 권장. 비차단. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | V-16/V-17 변경 전체가 기존 spec 과의 정합 수정. 데이터 모델·API 계약·상태 전이·RBAC 충돌 없음. |
| Rationale Continuity | NONE | `cross_encoder_llm` stale 제거, `topK default:5` 제거, `firstMessage` → `submit_message` 전환 모두 spec Rationale(D1·§R6) 결정 방향과 일치. 기각된 대안 재도입 없음. |
| Convention Compliance | LOW | 규약 핵심 요건 위반 없음. Swagger description 길이 초과(guidance) 및 JSDoc/인라인 이원화 2건이 INFO. |
| Plan Coherence | LOW | `webchat-eager-start.md` backlog 미갱신(INFO), plan 추적 가시성 낮음(INFO), `unified-model-mgmt-5af7ee` 병렬 편집(WARNING — rebase 순서 조율 필요). |
| Naming Collision | NONE | 신규 식별자 도입 없는 순수 문서 교정. 변경된 모든 기술 용어(`conditional escalate`, `inject-cap`, `profile`, `submit_message`)가 기존 spec 정의와 충돌 없이 일치. |

## 권장 조치사항
1. (W-1 해소) `plan/in-progress/unified-model-management.md` 에 "rag-webchat-doc-strings 먼저 머지 후 rebase" 를 note 로 기재하고, 머지 순서를 PR 설명에 명시한다.
2. (I-3) `plan/in-progress/webchat-eager-start.md` 비차단 backlog 첫 항목을 `[x]` 처리 또는 V-17 해소 주석 추가.
3. (I-4) `spec-code-cross-audit-2026-06-10.md` 에 V-16·V-17 항목 추가 및 완료 체크.
4. (I-2, 선택) `rag-search.dto.ts` 의 JSDoc/인라인 description 이원화를 단일 진실로 정리. 기능 버그 아니므로 다음 리팩터링 주기에 처리 가능.