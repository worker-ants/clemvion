# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 없음. 실제 코드 diff는 presentation 영역과 무관한 JSDoc 재작성 한 건뿐이며, `spec/4-nodes/6-presentation/**` 는 이미 origin/main 대비 diff 0(안정 상태).

## 전체 위험도
**LOW** — cross_spec/convention_compliance/plan_coherence 가 LOW, rationale_continuity/naming_collision 은 NONE. 실질 위반 없이 residual 문서 정합성 이슈(stale 참조 1건, Rationale 섹션 부재 1건, plan lifecycle housekeeping 1건)만 존재.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | execution-engine.md "후속 항목"이 이미 확정된 1MB cap 결정을 여전히 미결로 서술하며 다른 값(256KB)을 암시 | `spec/4-nodes/6-presentation/0-common.md` §4/§10.4 (1MB 확정) | `spec/5-system/4-execution-engine.md` §Rationale "후속 항목" 마지막 bullet (라인 1460, "Carousel/Table 256KB cap 적용 정책 결정" 미결 서술) | `project-planner`가 해당 bullet을 제거하거나 "해결됨 — 1MB, [0-common.md §4/§10.4] 참조"로 갱신 |
| 2 | convention_compliance | `3-chart.md`에 형제 문서(`0-common`/`1-carousel`/`2-table`/`4-form`/`5-template`)와 달리 `## Rationale` 섹션 부재. chartType enum 5종 vs 3종 drift 배경이 §6 표 아래 캐주얼 산문으로만 존재 | `spec/4-nodes/6-presentation/3-chart.md` (352줄 종료, Rationale 헤딩 없음) | CLAUDE.md / `.claude/skills/project-planner/SKILL.md` "spec 문서 3섹션(Overview/본문/Rationale)" 규약 | `## Rationale` 섹션 신설해 §6 caveat(chartType A/B 해소안) 이관, 또는 의도적 부재라면 그 사유를 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §10.9 layer(3) 표 "4값 중 하나" 서술인데 괄호 열거는 3개(`message_received` 누락) | `0-common.md` §10.9 vs `node-output.md` §4.4/§4.5 | 괄호 표기를 "presentation 관련 3값(전체 4값 중)"으로 명확화 |
| 2 | cross_spec | `interaction_data.interactionType`(data-model §2.14, 3값) vs `output.interaction.type`(node-output §4.5, 4값) 이름 동일·값 집합 상이 (target이 새로 만든 문제 아님) | `spec/1-data-model.md` §2.14 vs `spec/conventions/node-output.md` §4.4/§4.5 | 낮은 우선순위 백로그: data-model.md §2.14 비고에 대응관계 한 줄 추가 검토 |
| 3 | convention_compliance | `0-common.md` 섹션 번호가 §8 → §10로 건너뜀(§9 없음). dangling 링크는 없음 | `spec/4-nodes/6-presentation/0-common.md` (§8 line 277, §10 line 289) | §10을 §9로 재정렬하거나 예약 사유 명시 (낮은 우선순위) |
| 4 | plan_coherence | 완료된 두 선재-drift plan(`previousOutput`, §4.6 opt-out)이 `plan/in-progress/`에 잔존 — 체크리스트 전항목 완료, 대응 커밋(3d0bcd69b/PR#997, c3998e6cd/PR#1004)도 이미 병합됨 | `plan/in-progress/presentation-previousoutput-spec-drift.md`, `plan/in-progress/presentation-thread-optout-drift.md` | `plan-lifecycle.md` 규칙대로 `plan/complete/`로 이관 |
| 5 | plan_coherence | `node-output-redesign/ai-agent.md`의 "AI 메시지 경로 resumed emission 통일 여부" 미결정이 target §10.9 dispatch 표와 같은 코드 경로(`handleAiMessageTurn`) 공유 — 현재는 충돌 없음, 향후 해소 시 §10.9 갱신 필요 가능 | `0-common.md` §10.9 dispatch 표 vs `plan/in-progress/node-output-redesign/ai-agent.md:217` | 차단 아님. ai-agent.md에 §10.9 cross-ref 후속 메모만 추가 |
| 6 | naming_collision | `'form_submitted'` 문자열이 DB enum/NodeOutput interaction/LLM tool_result/internal bus sentinel 4-layer에서 재사용 — target §10.9가 이미 명시적으로 layer 구분 표를 두어 방어 | `0-common.md` §10.9 "4 layer 분리" 표 | 조치 불요, 향후 편집 시 이 표를 SoT로 유지 |
| 7 | naming_collision | BullMQ 큐명 `execution-continuation`(하이픈) ↔ 폐기된 pub/sub 채널명 `execution:continuation`(콜론) 시각적 유사 — 모든 언급처가 "폐기" 라벨 동반 | `spec/5-system/4-execution-engine.md:1162` 등 | 조치 불요, 신규 도입 아님 |
| 8 | naming_collision | `interaction.type` "4값 중 하나" 서술에 3개만 나열 (cross_spec INFO#1과 동일 이슈, naming-collision 스코프 밖으로 판단해 정보성 기록) | §10.9 layer(3) | 상단 #1과 통합 처리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | execution-engine.md의 stale "후속 항목" bullet이 이미 확정된 1MB cap과 모순(WARNING). 나머지는 문서 열거 완결성 INFO 2건. Continuation Bus 메시지 타입, 대기 표면 매트릭스, WS wire 계약, AI Agent 가드 필드, Conversation Thread 필드 등 폭넓게 정합 확인 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복·invariant 우회 전혀 없음. `previousOutput`/§10.9 sentinel wrap/§4.6 opt-out 모두 과거 Rationale과 문구 수준까지 정합, 정정 시 새 Rationale 항목 동반하는 패턴 일관 |
| convention_compliance | LOW | `3-chart.md` Rationale 섹션 부재(WARNING) — 형제 문서 관례 이탈. 5필드 출력 계약·interaction payload shape·에러 코드 표기·파일 명명은 정확히 규약 준수. §9 번호 스킵은 INFO |
| plan_coherence | LOW | HEAD==origin/main(spec/codebase diff 0)인 재확인 라운드. 완료된 두 drift-fix plan이 `plan/complete/`로 미이관(INFO, housekeeping). ai-agent.md 미결정 항목과 target §10.9의 forward-dependency 관계 기록(INFO). 미해결 결정과의 충돌 없음 |
| naming_collision | NONE | 신규/재확인 식별자(함수명·상수·필드·클래스·도구명) 전수 grep 대조 결과 의미 충돌 없음. 오히려 target이 잠재 혼동 토큰마다 선제적으로 "4-layer 정렬"/"무관" 각주를 붙여 방어적 |

## 권장 조치사항

1. (WARNING #1) `project-planner`가 `spec/5-system/4-execution-engine.md` §Rationale "후속 항목"의 256KB/carousel-table cap 관련 bullet을 제거하거나 "해결됨 — 1MB, 0-common.md §4/§10.4 참조"로 갱신 — 독자가 이미 확정된 결정을 미결로 오독하는 것을 방지.
2. (WARNING #2) `spec/4-nodes/6-presentation/3-chart.md`에 `## Rationale` 섹션을 신설해 §6의 chartType enum 5종/3종 drift caveat(해소안 A/B)를 이관, 또는 의도적 부재 사유를 명시.
3. (INFO #4, housekeeping) `plan/in-progress/presentation-previousoutput-spec-drift.md` · `plan/in-progress/presentation-thread-optout-drift.md`를 `plan/complete/`로 이관 — 이미 완료·병합됐음에도 in-progress에 남아 향후 checker의 재오판을 유발할 수 있음.
4. (INFO #1/#8, 선택) §10.9 layer(3) 표의 "4값 중 하나" 괄호 열거를 `message_received` 언급 포함 또는 "presentation 관련 3값"으로 명확화.
5. (INFO #3, 선택, 낮은 우선순위) `0-common.md` §9 번호 스킵 재정렬 또는 예약 사유 명시.
6. (INFO #5) `plan/in-progress/node-output-redesign/ai-agent.md`의 "AI 메시지 경로 resumed emission 통일" 미결정 항목에 target §10.9 dispatch 표 cross-ref 후속 메모 추가(해소 시점에 함께 갱신하도록).