# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상 범위: M-4 park-진입 dispatch 추출 (`park-entry-dispatch.ts`, `buildParkEntryRegistry` factory)
관련 spec/conventions: `spec/conventions/interaction-type-registry.md`, `spec/5-system/4-execution-engine.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `interaction-type-registry.md` frontmatter `code:` 에 `park-entry-dispatch.ts` 미등재
  - target 위치: `spec/conventions/interaction-type-registry.md` frontmatter `code:` 블록 (line 4–12)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2` — `code:` 는 해당 spec/convention 을 구현하는 파일 목록. `resume-turn-dispatch.ts` 는 등재되어 있으나(line 9), 이와 대칭 관계인 `park-entry-dispatch.ts` 는 등재되지 않았다.
  - 상세: `interaction-type-registry.md §1.2` 의 재개 turn 라우팅 주석은 `resume-turn-dispatch.ts` 를 명시적으로 열거하고, 코드의 JSDoc 은 "resume 측 `ResumeTurnDispatch`(PR #507) 와 대칭" 임을 선언한다. `park-entry-dispatch.ts` 는 동일 registry 패턴을 최초 park 진입 측에서 구현하므로 동일 convention 의 코드 증거다 — `code:` 에 등재되어야 spec-impl 가드(`spec-impl-evidence.md §4`)가 파일 존재를 검증할 수 있다.
  - 제안: 구현 PR(또는 후속 spec-sync PR)에서 frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 를 추가. 범위 선택: `spec-sync` PR 에서 함께 처리하기로 의도한 경우 현재 상태는 수용 가능하나, 구현 PR 이 `park-entry-dispatch.ts` 를 신설한 경우 같은 PR 안에 frontmatter 갱신을 포함하는 것이 규약의 intent 에 부합한다.

### 발견사항 2

- **[WARNING]** `interaction-type-registry.md §1.2` 에 park-entry 진입점 기술 누락
  - target 위치: `spec/conventions/interaction-type-registry.md §1.2` 끝 주석 (line 54)
  - 위반 규약: `spec/conventions/interaction-type-registry.md §1.2` 자체 규칙 — "새 blocking 노드 타입은 registry 항목 1개 등록으로 plug-in 되므로, §1.1 enum 추가 시 이 registry 도 함께 점검한다". 재개(resume) 측 `dispatchResumeTurn`/`resumeTurnRegistry` 는 §1.2 주석에 명시됐으나, **최초 park 진입** 측 `buildParkEntryRegistry`/`ParkEntryDispatch`(`park-entry-dispatch.ts`) 는 언급이 없다.
  - 상세: §1.2 끝 주석은 "재개 turn 라우팅 진입점 (backend)" 를 설명하며 `resume-turn-dispatch.ts` 를 열거한다. 동일 패턴의 park-entry 측(form/buttons/ai 선택 분기 일원화)도 "최초 waiting 진입" 의 처리 분기 매트릭스에 해당하므로, `§1.2 Backend emit 위치` 컬럼 설명 또는 별도 주석으로 `buildParkEntryRegistry`(`park-entry-dispatch.ts`)를 대칭으로 언급해야 spec 가 완결된다.
  - 제안: 목표 spec-sync PR 에서 §1.2 끝 주석에 "최초 park 진입 turn 라우팅" 에 대한 대칭 기술("`buildParkEntryRegistry`(ordered `parkEntryRegistry`, first-match-wins: form→buttons→ai, `park-entry-dispatch.ts`)으로 일원화됐다")을 추가한다. 이는 구현 PR 범위 밖이므로 현재 상태는 scope note("spec 노트는 후속 planner spec-sync PR") 로 이미 명시돼 있다.

### 발견사항 3

- **[INFO]** `spec/5-system/4-execution-engine.md` Rationale 에 park-entry registry 추출 기록 부재
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale, line 1372 ("resume turn dispatch registry 추출 (#507, 2026-06-06)") 인근
  - 위반 규약: CLAUDE.md "Rationale — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`". `resume-turn-dispatch` 추출(#507)은 Rationale line 1372 에 기록됐으나, 대칭 작업인 M-4 park-entry dispatch 추출은 Rationale 에 기록 항목이 없다.
  - 상세: 사소한 일관성 사항. 후속 spec-sync PR 에서 함께 처리하는 것이 적절하다.
  - 제안: spec-sync PR 에서 "park-entry dispatch registry 추출 (M-4, 202X-XX-XX)" 항목을 Rationale 에 추가한다.

---

## 요약

M-4 의 구현 파일(`park-entry-dispatch.ts`, `buildParkEntryRegistry`) 자체는 새 명명을 도입하지 않고 기존 `WaitingInteractionType` 값(form/buttons/ai_conversation/ai_form_render)의 선택 분기를 registry 로 추출하는 behavior-preserving 리팩토링이다. 정식 규약(`interaction-type-registry.md`, `spec-impl-evidence.md`)의 직접 위반은 없으나, 대칭 관계인 `resume-turn-dispatch.ts`가 frontmatter `code:` 와 §1.2 주석에 등재된 데 반해 `park-entry-dispatch.ts`는 양쪽 모두 등재되지 않아 spec-impl 증거 gap 이 발생했다. 이는 구현 범위가 "spec 노트는 후속 planner spec-sync PR" 로 명시적으로 미루었으므로 의도된 deferred 상태이다. 단, 구현 PR 이 `park-entry-dispatch.ts` 를 신설한 이상 spec-impl-evidence 관점에서 frontmatter `code:` 갱신은 같은 PR 에 포함하는 것이 규약 intent 에 더 부합하며, 현재 누락은 WARNING 수준이다.

---

## 위험도

LOW
