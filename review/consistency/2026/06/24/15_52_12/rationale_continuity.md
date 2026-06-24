# Rationale 연속성 검토 결과

검토 대상: M-4 park-진입 dispatch 추출 (커밋 ecd70dd1)
관련 spec: spec/conventions/interaction-type-registry.md + spec/5-system/4-execution-engine.md
diff-base: origin/main

---

## 발견사항

### [INFO] park-entry-dispatch 추출이 resume-turn-dispatch 선례와 정합 — Rationale 기록 없음
- target 위치: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` (파일 전체), `execution-engine.service.ts` `dispatchParkEntry` getter
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale` "resume turn dispatch registry 추출 (#507, 2026-06-06)" 항
- 상세: `resume-turn-dispatch.ts` (#507) 의 Rationale 은 spec 에 명시돼 있다 — "동작 보존 리팩토링(핸들러 매핑·우선순위·에러코드 불변), 새 blocking 노드 타입은 registry 항목 1개 등록으로 plug-in 된다." 이번 M-4 가 동일 패턴(park 진입 측 대칭 registry 추출)을 재현하고 있으나, 실행 엔진 spec Rationale 에는 이 추출에 대한 새 항이 없다. `park-entry-dispatch.ts` 파일 헤더 JSDoc 에 상세 근거(shotgun surgery 방지, resume 측과의 대칭)가 기술돼 있고 e2e 214 통과로 behavior-preserving 이 검증됐으므로 기각 사유나 합의된 invariant 위반은 없다. 단 이 결정이 spec Rationale 에 기록되지 않으면 선례(#507 기록 방식)와 일관성이 어긋난다.
- 제안: `spec/5-system/4-execution-engine.md §Rationale` 에 "park-entry dispatch registry 추출 (M-4, ecd70dd1)" 항을 추가한다. 내용은 park-entry-dispatch.ts 파일 헤더 JSDoc 의 "동작 보존·삼중복 제거·plug-in seam" 을 옮겨 적으면 된다. (developer spec read-only 이므로 planner 위임 항목으로 plan 에 등록.)

---

### [INFO] interaction-type-registry §1.2 주석이 resume 측만 반영 — park 진입 측 대칭 미기록
- target 위치: `park-entry-dispatch.ts` 구현 전반
- 과거 결정 출처: `spec/conventions/interaction-type-registry.md §1.2` 의 "재개(resume) turn 라우팅 진입점 (backend)" 주석 — "park 후 재개 시 form/buttons/ai_conversation turn 라우팅은 … `dispatchResumeTurn`(ordered `resumeTurnRegistry`, first-match-wins: form → buttons → ai_conversation, `resume-turn-dispatch.ts`)으로 일원화돼 있다."
- 상세: spec §1.2 의 해당 주석은 resume 측(`dispatchResumeTurn`)만 기술하고 park 진입 측(`dispatchParkEntry`)을 언급하지 않는다. M-4 가 두 진입점을 대칭으로 완성했으므로 이 주석이 절반만 정확한 서술이 되었다. spec 에 기록된 내용이 단일 진실의 절반만 담은 상태가 되어 신규 blocking 노드 타입을 추가하는 개발자가 park 진입 측 registry 등록을 누락할 위험이 생긴다. (park-entry-dispatch.ts 파일 헤더에는 명시돼 있으나 spec 매트릭스에는 미기록.)
- 제안: spec/conventions/interaction-type-registry.md §1.2 의 "재개(resume) turn 라우팅 진입점" 주석에 "park 진입 측은 `dispatchParkEntry`(ordered `parkEntryRegistry`, first-match-wins: form → buttons → ai_conversation, `park-entry-dispatch.ts`)로 동등하게 일원화돼 있다" 를 대칭 문장으로 추가한다.

---

### [INFO] ai_form_render park 진입 처리 — resume 측 정책과 정합, 명시적 기록 없음
- target 위치: `park-entry-dispatch.ts` line 506–511 (`ai_conversation` selects 술어: `sel.interactionType === 'ai_conversation' || sel.interactionType === 'ai_form_render'`)
- 과거 결정 출처: `spec/conventions/interaction-type-registry.md §1.2` "재개(resume) turn 라우팅 진입점" — "`ai_form_render` 는 별도 registry 항목이 아니라 `ai_conversation` AI turn 경로(`isAiConversation`)를 공유해 재개된다"
- 상세: resume 측 Rationale 이 "ai_form_render 는 ai_conversation 경로를 공유" 로 명확히 기록돼 있고, park 진입 측 구현도 동일 정책을 따른다(ai_conversation 항목의 selects 술어가 ai_form_render 를 포함). 정합성은 유지되며 충돌이 없다. 다만 park 진입 측에서 이 정책을 적용했다는 명시적 근거가 spec 어디에도 없어 이를 별도 확인이 필요하다고 오인할 소지가 있다.
- 제안: 위 INFO #2 제안 적용 시 해당 대칭 주석 안에 "`ai_form_render` 는 resume 측과 동일하게 `ai_conversation` park 진입 경로를 공유한다" 를 한 문장으로 포함시키면 충분하다.

---

## 요약

M-4 park-entry-dispatch 추출은 resume-turn-dispatch(#507) 와 대칭 구조로 ordered registry + 단일 진입점(`dispatchParkEntry`)을 도입한 behavior-preserving 리팩토링이다. 검토된 spec Rationale 들(execution-engine.md §Rationale "resume turn dispatch registry 추출", "Phase B park 즉시 해제", interaction-type-registry.md §4 "3중 가드") 중 어느 것도 이번 변경이 명시적으로 기각·폐기한 대안을 재도입하거나 합의된 invariant 를 위반하는 요소를 담고 있지 않다. interaction-type-registry §4 Rationale 이 우려하는 "신규 type 누락"(shotgun surgery) 패턴은 park-entry-dispatch.ts 가 registry extension seam 으로 오히려 개선한다. 지적 사항은 모두 INFO 등급으로, 이번 추출에 대한 spec Rationale 항 부재 및 interaction-type-registry §1.2 park 진입 측 대칭 서술 누락이다. 이는 후속 spec-sync PR(planner 위임)으로 해소해야 한다.

---

## 위험도

LOW
