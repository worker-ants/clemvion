# Consistency Check 통합 보고서 (M-4 park-entry spec-sync, Option A)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 3(draft 문서 권고), Critical 0, INFO 6. 모두 spec 편집 전 처리 가능.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING) — 처리

| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| W-1 | Rationale | draft A3 주석의 "§4 런타임 플러그인 로딩 미구현 invariant" 참조가 잘못된 섹션(실제 SoT 는 `4-nodes/0-overview.md §4`) | **적용 시 회피**: 실제 §Rationale 편집(A3 bullet)에는 §4 참조 없음 — draft 주석일 뿐. behavior-preserving + resume #507 대칭으로만 서술 |
| W-2 | Convention | draft frontmatter `status: draft` lifecycle enum 혼용 | **moot** — draft 삭제(transient) |
| W-3 | Convention | draft `spec_area:` 비공식 키 | **moot** — draft 삭제 |

## 참고 (INFO) — 처리

| # | 항목 | 처리 |
|---|------|------|
| I-1 | §1.2 park-entry blockquote 삽입 위치(resume→park 순서) | 변경 불요(혼동 낮음, resume 노트 직후 sibling) |
| I-2 | M-5 L247 체크박스 실측 후 적용 | **적용 시 verify** |
| I-3 | A2 에 `getInteractionType` 함수명 노출 | **유지** — §54 resume 노트도 `dispatchResumeTurn`/`resumeTurnRegistry`/`isAiConversation` impl명 사용. 대칭 일관성 우선 |
| I-4 | A3 ↔ #507 cross-link | **반영** — "resume 측(#507)과 대칭" 명시 |
| I-5 | 파일명 slug 관례 | 무관(다음부터) |
| I-6 | `refactor-m5-node-di-layer1.md` in-progress 잔류(layer1 #652 완료) | **A4 에 plan 정리 노트** — layer1 plan complete 이동은 별 plan-lifecycle 작업(체크박스 정정은 본 PR) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터모델·API·상태전이·RBAC·계층 충돌 없음 |
| Rationale Continuity | LOW | W-1(draft 주석 §4 참조 — 실제 편집 무관), INFO 2 |
| Convention Compliance | LOW | draft frontmatter 비공식 키(draft 삭제로 해소) |
| Plan Coherence | LOW | layer1 plan in-progress 잔류(I-6, 노트) |
| Naming Collision | NONE | resume 대칭 명명, 충돌 없음 |

## 권장 조치사항 (처리 반영)
1. (W-1) A3 §Rationale 편집에 §4 참조 미포함 — resume #507 대칭 behavior-preserving 으로만 서술.
2. (W-2/W-3) draft 삭제(transient).
3. (I-2) M-5 L247 체크박스 실측 후 정정.
4. (I-6) A4 에 layer1 plan complete 이동 노트.
