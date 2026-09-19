# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 최고 위험도 LOW)

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(문서 내 잔여 모순 1건, 신규 backlog 항목 트래커 미등재 1건)은 모두 정정/등재로 해소 가능한 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | draft 가 §3.2(154행)·Rationale(1346행) 두 곳에서 "🔄 는 아이콘, attempt/max 유무로 `autoResumedHint`/`autoResumedHintShort` 두 문구가 갈린다"는 사실을 정정하지만, 같은 사실을 서술하는 §5.3.2(570행) "동일 divider"·§5.3 이벤트 표(536행)·§6(605행)은 정정 대상에서 빠져, draft 적용 후 570행이 정정된 §3.2 와 직접 모순됨 | `spec/3-workflow-editor/4-ai-assistant.md` §3.2(154행)·Rationale(1346행) — draft 의 diff 범위 | 같은 파일 §5.3.2(570행) "동일 divider", §5.3(536행), §6(605행) | 이번 턴에 570행·605행도 함께 정정하거나(draft 자신의 "여러 곳이 같은 사실을 적으면 전부 고쳐야 한다" 원칙을 §13 표 밖에도 적용), 정정하지 않는다면 draft 의 "비대상" 절에 이 모순을 명시적으로 등재해 다음 라운드가 재검출하도록 트래킹 |
| 2 | plan_coherence | draft 가 새로 발견해 "트래커에 올린다"고 서술한 두 항목(사전 키 3종 기능 서술 부재, `0-canvas.md` §8.1 자동생성 서술 오류)이 실제로는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 등 어떤 트래커에도 등재되지 않음(grep 0건) | `plan/in-progress/spec-draft-assistant-i18n-table-sync.md` §"비대상 — 트래커에 올린다" | `plan/in-progress/spec-draft-nullable-notation-followups.md` | plan 을 `complete/` 로 이동하기 전에 (a) 두 항목을 `spec-draft-nullable-notation-followups.md` 에 `- [ ]` 로 실제 등재하거나, (b) 이 plan 자체에 `## 체크리스트` 를 추가해 "트래커 등재"를 완료 조건으로 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 773행 근거 칸이 "글로서리 §2" 를 인용하지만 "워크플로"(우 탈락형) 자체를 금지어로 명시한 것은 §2 요약 서술("Workflow → 워크플로우")이고 §5 금지어 표에는 이 형태가 직접 나열돼 있지 않음 — 결론은 맞지만 인용 정밀도가 낮음 | draft 표 A, 773행 근거 칸 | 근거 칸에 "사전이 이미 워크플로우로 통일 (원칙 문단 참고)" 를 §2 인용에 덧붙여 다음 검토자가 §5 표에서 헛수고하지 않도록 보강 |
| 2 | convention_compliance | Principle 3-C(제목상 backend 동적 메시지 `ERROR_KO`/`GRAPH_WARNING_KO` 전용)를 순수 frontend dict 키(`opAdded`/`exploreLookup` 등)의 이중 중괄호 근거로 인용 — 결론(값 변경)은 정확하나 조문 스코프보다 넓게 원용 | "변경" 표 765~772행 근거 컬럼 | 근거 문구를 "Principle 3-C(보간 계약; `core.ts` `interpolate()` 는 P1/2 dict 값에도 동일 적용)" 로 스코프를 명시하거나, `i18n-userguide.md` 쪽에서 이중 중괄호 요구를 Principle 2 근처로 승격 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §13 표 13행·41행 전수 대조 전부 일치. §3.2/Rationale 정정은 코드(`assistant-message.tsx`, `core.ts`)와 부합. 단 같은 사실을 다루는 §5.3.2(570행) 등이 정정 후 모순으로 남음(WARNING) |
| rationale_continuity | NONE | 인용 규약(Principle 3-C·6, 글로서리 §2·§5) 전부 실재·정합. "결정 번복 아닌 사실 정정"이라는 자기 서술과 실측이 일치. 기각된 대안 재도입·암묵적 invariant 우회 없음 |
| convention_compliance | LOW | 13행 값·신규 키·보간 정규식·아이콘 분리 전부 코드와 문자 단위 일치. Principle 3-C 인용 스코프가 다소 넓음(INFO) 외 위반 없음 |
| plan_coherence | LOW | 핵심 결정은 다른 in-progress plan·`entity-schema-declaration-drift.md` 의 `--impl-prep` 선행조건과 정합. 단 이번 턴이 발견한 신규 backlog 2건이 트래커에 미등재(WARNING) |
| naming_collision | NONE | 유일한 신규 식별자 `assistant.autoResumedHintShort` 는 이미 코드(사전 2곳+컴포넌트)에 동일 값으로 존재 — spec 이 실재를 뒤늦게 반영. 충돌 없음 |

## 권장 조치사항
1. (WARNING #2 우선) `plan/in-progress/spec-draft-assistant-i18n-table-sync.md` 가 `complete/` 로 이동하기 전에 신규 backlog 2건(사전 키 3종 기능 서술 부재, `0-canvas.md` §8.1 서술 오류)을 `spec-draft-nullable-notation-followups.md` 에 실제 등재하거나 자체 체크리스트로 못 박기.
2. (WARNING #1) `spec/3-workflow-editor/4-ai-assistant.md` §5.3.2(570행) "동일 divider" 서술을 draft 의 §3.2 정정과 함께 고치거나, 최소한 draft 의 "비대상" 절에 이 잔여 모순을 명시적으로 등재.
3. (INFO, 선택) 773행 근거 칸과 Principle 3-C 인용 문구의 스코프를 조금 더 정밀하게 표기.
