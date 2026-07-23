# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 2건은 병합 전 또는 즉각 후속으로 반영 권고.

## 전체 위험도
**MEDIUM** — target 자체(4곳 `previousOutput` 정정 + 동반 정정 A/B)는 실측 검증상 정확하고 기존 SoT(`node-output.md` §4.2, `execution-engine.md` §7.4/§9.3)와 정합하나, sibling plan(`node-output-redesign/`)이 target 이 지금 고치는 것과 동일한 오류를 여전히 서술해 정정 직후 plan 레이어에서 drift 가 재생산될 위험(plan_coherence WARNING)과, 트리거 근거 링크가 이 worktree 에서 dangling 인 문제(convention_compliance WARNING)가 있음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | sibling plan `node-output-redesign/`(chart.md:46, form.md:73-77, README.md:263)이 target 이 정정하려는 "previousOutput 완전 폐기/완료" 서술을 그대로 반복 — target 병합 후 plan 레이어에서 동일 유형 drift 재발 | target §체크리스트 (`spec/4-nodes/6-presentation` 4곳 + 동반 정정 A/B만 포함) | `plan/in-progress/node-output-redesign/chart.md:46`, `form.md:73-77`, `README.md:263` | target 체크리스트에 이 3개 sibling plan 문서 동기 정정 항목 추가 — "폐기(완료)" → "신규 소비 금지 — 과도기 보존, `node-output.md §4.2` 참조" (각주 수준으로 충분) |
| 2 | convention_compliance | target 상단이 인용하는 트리거 근거(`review/consistency/2026/07/23/15_33_52/ADJUDICATION.md`)가 이 worktree 에 존재하지 않아 dangling | target 상단 인용문 ("트리거: `--impl-done` … CRITICAL 1건", "귀속 판정: [`ADJUDICATION.md`]…") | `review/consistency/2026/07/23/15_33_52/`(이 worktree 부재, 커밋 여부 미확인) | 원 리뷰 산출물이 커밋됐는지 확인 후 경로 교정하거나, 핵심 문구를 target 본문에 self-contained 인용으로 대체 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance (중복 수렴) | "동반 정정 A" 위치 수 "3곳" 표기가 실측(§10.9 본문 내부 2곳: line 394, 426)과 다름 — `## Rationale` 절엔 해당 문구 없음 | target §동반 정정 표 A행 | 착수 시 "본문 2곳(§10.9 서술 + 4-layer SSOT 정렬 불릿)"으로 정정해 3번째 지점을 헛되이 찾거나 과잉 수정하지 않게 함 |
| 2 | cross_spec | `node-output.md` §4.2(목록 유지+캐비어)와 target 제안 문구(목록에서 분리+각주)가 서로 다른 문서 구조 관용구 사용 — 사실은 동일, 구조만 상이 | target §개선 방침 제안 문구 1·2·4 vs `node-output.md` §4.2 | (선택) Rationale 에 구조 선택 근거 1줄 추가 |
| 3 | cross_spec | target Rationale/비목표에 `previousOutput` 의 기존 frontend consumer(`presentation-renderers.tsx:526-550`) 미언급 | target §비목표/§Rationale | (선택) Rationale 에 "frontend 도 기존 consumer — Phase 3 시 3자 동시 정리 필요" 1줄 추가 |
| 4 | rationale_continuity | "6종" 정정 근거를 `execution-engine.md:1162` 의 기존 명시적 "6종" 라벨로 직접 인용하면 근거가 더 강함 | target §동반 정정 A | 실 편집 시 §9.3 앵커 포함 인용 권고 (반대 아님, 강화 제안) |
| 5 | plan_coherence | 코드 주석이 가리키는 "Phase 3 precondition" 추적처(`memory/node-specs-improvement-progress.md`)가 저장소에 부재 — dangling 참조를 target 이 presentation 4곳에 신규 확산 | target 제안 문구 "Phase 3 정리 시 코드·spec 동시 제거" | (선택) Rationale 에 "Phase 3 는 별도 plan 미존재, 코드 주석 참조가 dangling 임을 인지" 1줄 추가 또는 추적 plan stub 생성 |
| 6 | naming_collision | `previousOutput` 이 `loop-executor.ts:69,92,94` 의 완전 무관한 로컬 변수명과 동명이의 (spec 미문서화, 도메인 분리로 실질 위험 낮음) | 코드 참고 (target 범위 밖) | 조치 불요 |
| 7 | naming_collision | 같은 `0-common.md` 안에서 "5종"이 서로 다른 두 개념(Continuation Bus 메시지 타입 vs Presentation 노드 타입)을 가리킴 — blind 문자열 치환 위험 | `0-common.md:14`(무관 "5종") vs `:394,426`(정정 대상 "5종") | 실 편집 시 §10.9 라인 범위로 좁혀 치환 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 4곳 정정·동반 정정 A/B 사실관계 전수 검증 통과. 위치 카운트 오차 1건 + 구조 차이 1건 + consumer 미언급 1건 (모두 INFO) |
| rationale_continuity | NONE | 기존 Rationale·SoT(node-output.md §4.2 Phase 3 예외, execution-engine.md 6종, 0-common.md §10.9 processAiResumeTurn)와 완전 정합. 기각 대안 재도입·무근거 번복 없음. 인용 강화 제안 2건 INFO |
| convention_compliance | LOW | anchor 포맷·SoT 인용·frontmatter 스키마 모두 규약 준수. 트리거 근거 dangling WARNING 1건 + INFO 2건 |
| plan_coherence | MEDIUM | target 자체는 다른 in-progress plan 과 충돌 없으나, sibling `node-output-redesign/` 이 target 이 고치는 오류를 그대로 서술 중 — 정정 직후 plan 레이어 재drift 위험 WARNING 1건 + Phase 3 dangling 참조 INFO 1건 |
| naming_collision | NONE | 신규 식별자·요구사항 ID·엔티티·endpoint·이벤트명·ENV 도입 없음(순수 서술 정정). 무관 동명이의 2건 INFO(target 범위 밖) |

## 권장 조치사항
1. (WARNING #1 해소) target 체크리스트에 `plan/in-progress/node-output-redesign/chart.md:46`, `form.md:73-77`, `README.md:263` 동기 정정 항목 추가 — "폐기(완료)" 서술을 "신규 소비 금지 — 과도기 보존, `node-output.md §4.2` 참조"로 교정.
2. (WARNING #2 해소) 트리거로 인용한 `review/consistency/2026/07/23/15_33_52/ADJUDICATION.md` 의 커밋 여부 확인 — 미커밋이면 경로 대신 핵심 판정 문구를 target 본문에 직접 인용해 self-contained 화.
3. (INFO #1) "동반 정정 A" 위치 수를 "3곳" → "본문 2곳(§10.9 서술 + 4-layer SSOT 정렬 불릿)"으로 정정.
4. (선택, INFO #5) Phase 3 dangling 참조(`memory/node-specs-improvement-progress.md` 부재)를 Rationale 에 인지 문구로 남기거나 추적 plan stub 생성.
5. (선택, INFO #7) 실 편집 시 "5종"→"6종" 치환을 §10.9 라인 범위로 좁혀 적용(같은 문서 내 무관 "5종" 표현과 혼동 방지).
6. (선택, INFO #2·#3·#4) Rationale 보강 — 문서 구조 선택 근거, frontend 기존 consumer 사실, execution-engine.md §9.3 앵커 직접 인용.