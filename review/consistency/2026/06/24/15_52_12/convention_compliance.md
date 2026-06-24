# 정식 규약 준수 검토 — M-4 park-진입 dispatch 추출

검토 기준: `spec/conventions/interaction-type-registry.md`, `spec/conventions/spec-impl-evidence.md`
검토 대상 diff: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` (신규), `park-entry-dispatch.spec.ts` (신규), `execution-engine.service.ts` (수정)

---

## 발견사항

### [WARNING] `interaction-type-registry.md` frontmatter `code:` 에 `park-entry-dispatch.ts` 미등재

- target 위치: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` (신규 파일)
- 위반 규약: `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록 (§1.2 재개(resume) turn 라우팅 진입점 주석 블록 및 본문 §1.1 단일 진실 위치 참조)
- 상세: `interaction-type-registry.md` 는 `code:` 필드에 `WaitingInteractionType` 분기 로직의 **구현 SoT 파일 목록**을 나열한다. `resume-turn-dispatch.ts` 가 이미 등재돼 있으며, §1.2 하단 주석("재개(resume) turn 라우팅 진입점")은 `resume-turn-dispatch.ts` 와 대칭인 park-entry 측 일원화를 명시적으로 기술한다. 이번 M-4 로 신규 파일 `park-entry-dispatch.ts` 가 `form / buttons / ai_conversation` park 진입 분기를 보유하는 **단일 파일**이 됐으나 `code:` 에 누락돼 있다. `spec-impl-evidence.md §2.1`은 `code:` 를 "본 spec 이 약속한 surface 의 구현 경로"로 규정하고, 신규 SoT 경로 추가 시 갱신 의무가 있다.
- 제안: `interaction-type-registry.md` frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 를 추가한다. 단, `developer` 는 `spec/` read-only 이므로 spec-sync 는 후속 `project-planner` PR 로 처리한다. 검토 모드 메모에 이미 "spec frontmatter code:·§1.2 park-entry 노트는 후속 planner spec-sync PR" 이 명시돼 있어, 의도된 defer 임이 확인됨 — Critical 이 아닌 WARNING 으로 분류.

---

### [INFO] `interaction-type-registry.md` §1.2 하단 주석 — park-entry 측 진입점 참조 문구 미갱신

- target 위치: `spec/conventions/interaction-type-registry.md` §1.2 하단 블록쿼트("재개(resume) turn 라우팅 진입점") 의 "새 blocking 노드 타입은 registry 항목 1개 등록으로 plug-in 되므로 …" 문장
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" + `interaction-type-registry.md` §1.2 단일 진실 의무(spec 내 SoT 문구가 구현 현실을 정확히 기술해야 함)
- 상세: 현 §1.2 주석은 resume 측 `dispatchResumeTurn`(`resume-turn-dispatch.ts`)만 언급하고 park 진입 측 대칭 함수 `dispatchParkEntry`(`park-entry-dispatch.ts`)는 언급하지 않는다. spec 이 resume 측 일원화 완료를 기술하면서 park-entry 측 일원화를 누락하면, 이후 독자가 park-entry 분기가 여전히 3곳에 하드코딩돼 있다고 오해할 수 있다.
- 제안: 후속 spec-sync PR 에서 §1.2 주석에 `dispatchParkEntry`(`park-entry-dispatch.ts`, M-4) 를 추가해 resume 측과 대칭 기술. 이 역시 defer 가 이미 승인된 상태이므로 INFO.

---

### [INFO] `park-entry-dispatch.ts` JSDoc spec 참조 경로 — 스타일 일관성

- target 위치: `park-entry-dispatch.ts` 라인 427: `spec: 5-system/4-execution-engine.md §7.5 · conventions/interaction-type-registry.md §1.2.`
- 위반 규약: 없음 (강제 규약 아님). 참고: 동일 파일군의 `resume-turn-dispatch.ts` JSDoc 에 동일 패턴 존재 여부를 확인하지 못함.
- 상세: `spec:` 참조 경로가 루트 기준 상대경로가 아닌 `5-system/...` 형식(앞에 `spec/` 없음). 코드 내 spec 링크 표기가 파일 간 불일치할 경우 혼동을 초래하나, 컨벤션 문서에 코드 JSDoc 의 spec path 표기 형식에 대한 강제 규약은 없다.
- 제안: 선택적. 표기를 `spec/5-system/4-execution-engine.md §7.5` 로 통일하거나 현행 유지 — 어느 쪽이든 규약 위반 아님.

---

## 요약

M-4 `park-entry-dispatch.ts` 신규 추출은 명명(`ParkEntryDispatch`, `ParkEntrySelector`, `ParkEntryContext`, `buildParkEntryRegistry`, `dispatchParkEntry`)·파일 구조·API 출력 형식(ProcessTurnResult, PARK_RELEASED 패턴) 모두 기존 대칭 파일 `resume-turn-dispatch.ts` 의 패턴을 그대로 따르며, `interaction-type-registry.md §1.2` 규칙(form → buttons → ai 순서, first-match-wins, `ai_form_render` 는 `ai_conversation` 경로 공유)을 코드 레벨에서 충실히 구현하고 있다. 정식 규약 직접 위반(CRITICAL)은 없다. `interaction-type-registry.md` `code:` 의 `park-entry-dispatch.ts` 미등재가 WARNING 이나, 검토 모드 메모에 "spec-sync 는 후속 planner PR" 로 이미 명시된 인지된 defer 이므로 실질 위험도는 낮다.

## 위험도

LOW
