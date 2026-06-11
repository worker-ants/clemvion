# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 빌드/계약 차단 요인 없음. `spec/2-navigation/13-user-guide.md` frontmatter `code:` 배열에 삭제된 `ai-configs.tsx` 경로가 잔존하여 spec-impl 커버리지 도구 오진 가능성이 있으나 비차단.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Naming Collision | `spec/2-navigation/13-user-guide.md` frontmatter `code:` 배열이 삭제된 `ai-configs.tsx` 경로를 계속 참조 — spec-impl 커버리지 도구가 해당 경로에서 구현 증거를 찾을 때 false negative(미이행 오진) 유발 가능 | `spec/2-navigation/13-user-guide.md` line 115 | `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (삭제됨) | frontmatter `code:` 배열에서 해당 항목 제거 또는 `node-configs/override-registry.ts` 로 대체 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/2-navigation/13-user-guide.md` §4 예시 YAML 블록에 삭제된 `ai-configs.tsx` 경로 잔존 — 빌드 실패 아님, 문서 예시 stale | `spec/2-navigation/13-user-guide.md` line 115 예시 `code:` 블록 | 예시에서 `ai-configs.tsx` 제거 또는 `auto-form/schema-form.tsx` 로 교체 |
| I-2 | Rationale Continuity | R-3 에 "bespoke 폼 수정 후 유지하는 대안을 기각한 이유" 명시 없음 — 형식적 보완 가능하나 상황이 단방향이라 필수 아님 | `spec/3-workflow-editor/1-node-common.md` § Rationale R-3 | 선택: "bespoke 수정 후 유지 대안을 기각한 이유" 한 줄 추가 |
| I-3 | Plan Coherence | V-02 해소가 cross-audit plan 에 `[ ]`→`[x]` 로 정확히 반영됨 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-02 항목 | 없음 (정합) |
| I-4 | Plan Coherence | `node-output-redesign` plan 의 IE/TC 잔여 권고(backend output 구조)는 본 변경(frontend override UI 제거)과 직교 — 무효화 없음 | `plan/in-progress/node-output-redesign/information-extractor.md`, `text-classifier.md` | 필요 시 "IE/TC override UI 는 V-02 로 해소됨" 메모 추가 가능(필수 아님) |
| I-5 | Plan Coherence | `unified-model-mgmt-5af7ee` worktree 가 `spec/4-nodes/3-ai/*.md` 수정 중이나 본 branch 는 `spec/3-workflow-editor/1-node-common.md` 만 수정 — 파일 경합 없음 | `spec/3-workflow-editor/1-node-common.md` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `spec/2-navigation/13-user-guide.md` 예시 YAML 에 삭제된 `ai-configs.tsx` 잔존 (INFO). spec §2.6.3 및 R-3 는 구현과 일치. |
| Rationale Continuity | NONE | R-3 신규 Rationale 이 2-트랙 렌더 전략(R-2)을 정확히 따름. 기각 대안 재도입 없음. |
| Convention Compliance | NONE | frontmatter 완비, 문서 구조 준수, 명명·출력 포맷·API 문서 규약 위반 없음. |
| Plan Coherence | NONE | V-02 plan 반영 정확. 병렬 worktree 파일 경합 없음. stale worktree 0건. |
| Naming Collision | LOW | frontmatter `code:` 배열의 삭제 경로 잔존(WARNING). 신규 식별자 충돌·API endpoint 충돌 없음. |

## 권장 조치사항

1. **(W-1 해소 권장)** `spec/2-navigation/13-user-guide.md` line 115 의 frontmatter `code:` 배열에서 `"codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx"` 를 제거하거나, `"codebase/frontend/src/components/editor/settings-panel/node-configs/override-registry.ts"` 로 대체한다. 이는 spec-impl 커버리지 도구의 false negative 를 방지한다.
2. (선택) `spec/2-navigation/13-user-guide.md` §4 예시 YAML 블록의 `code:` 목록도 동일하게 갱신하면 문서 예시와 실제 파일 구조가 일치한다.
3. (선택) R-3 에 bespoke 수정 후 유지 대안을 기각한 이유를 한 줄 추가하면 후속 독자의 자문을 예방할 수 있다.

---

검토 일시: 2026-06-11 09:27:19
검토 모드: `--impl-done` (V-02 IE/TC auto-form 이행, diff-base=origin/main)