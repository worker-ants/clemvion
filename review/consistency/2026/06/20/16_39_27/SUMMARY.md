# Consistency Check (--spec) 통합 보고서 — port-id 모델 명확화 draft (rev)

**BLOCK: NO** — Critical 0. 코드 정합 방향 정확. WARNING 3(비차단, 정제 지침) — 적용 시 반영.

## 전체 위험도
**LOW** — 모순 없음. spec 계층 책임 경계·Rationale 동시 등재 경고 2+1건.

## Critical
해당 없음.

## 경고 (WARNING) — 적용 시 반영

| # | Checker | 지침 |
|---|---------|------|
| 1 | Cross-Spec | `1-logic/0-common.md §7`(Logic 문서)에 AI Agent UUID 생성 혼재 말 것 → Logic(Switch/Filter) slug 범위만, AI Agent·생성 상세는 "SoT 노드 §1.3 / `port-id.util.ts`" 위임 |
| 2 | Cross-Spec | `3-workflow-editor/1-node-common.md §1.5` 노드별 열거 말 것(Parallel/Merge/Text Classifier 누락 위험) → 에디터 공통 불변성 원칙만, 생성 방식은 "노드별 — SoT 노드 §1.3" 위임 |
| 3 | Rationale | 변경안 #1(§1.3 본문 교정)과 #6(`0-overview.md ## Rationale` 신설)을 **동일 커밋**에 — 번복 근거가 spec 에 잔존 |

## 참고 (INFO) — 적용 시 반영
- §1.3 **최소 증분**: "(UUID v4 는 사용하지 않는다.)"만 제거 + 생성 출처 1문장 순증(기존 slug-regex/fallback/불변성 유지).
- ConditionDef.id 타입 `UUID` → `String (UUID v4)` (ButtonDef.id 표기 통일) + slug-valid 괄호.
- carousel:429 무수정 = `§1 ButtonDef.id`·§10.5 backfill 과 완전 정합 — 확인됨.
- ND-AG-17 도구명 제외 정확. Rationale 에 §1.3 자기모순(button slug 예시인데 UUID) 명시 권장.
- ai-agent-tool-connection-rewrite.md 활성화 시 ConditionDef parenthetical 보존 메모(선택).

## Checker별 위험도
Cross-Spec LOW(계층 책임 범위 좁히기) · Rationale-Continuity LOW(번복 근거 동일 커밋) · Convention NONE · Plan-Coherence NONE · Naming NONE

## 결론
**BLOCK: NO — 적용 진행.** 위 WARNING/INFO 정제 반영: §1.3 최소증분+Rationale(동일커밋), §7·§1.5 는 위임 서술로, ND-AG-20/ConditionDef UUID 유지+slug-valid 명료화, carousel 무수정.
