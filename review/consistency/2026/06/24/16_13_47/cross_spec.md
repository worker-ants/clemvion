# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-m4-park-entry-sync.md`
검토 시각: 2026-06-24
검토 모드: `--spec`

---

## 발견사항

### 발견사항 없음 (충돌 부재)

아래에 관점별 검토 결과를 기술한다.

---

### [INFO] `interaction-type-registry.md §1.2` 노트 삽입 위치 — resume 노트와의 공간 관계

- target 위치: A2 "L54 resume 노트 blockquote **바로 다음**에 대칭 park-entry blockquote 추가"
- 충돌 대상: `spec/conventions/interaction-type-registry.md` L54 (현행 resume 노트 blockquote)
- 상세: 현행 `interaction-type-registry.md` L54 의 resume 노트 blockquote 는 `##1.2 값 → 처리 분기 매트릭스` 표 아래에 위치한다. target 이 기술하는 "L54 바로 다음" 삽입은 물리적으로 정합하며, 신규 park-entry 노트의 내용(`dispatchParkEntry` / `parkEntryRegistry` / first-match-wins form→buttons→ai / `ai_form_render` = `ai_conversation` 공유 / 세 사이트의 escape 차이 보존)이 현행 resume 노트의 패턴(`dispatchResumeTurn` / `resumeTurnRegistry`)과 대칭 구조로 기술됐다. 내용 모순 없음. "Backend emit 위치" 열의 **최초 waiting 진입** vs. **재개** 라는 관점 분리는 현행 §1.2 표 본문의 column 헤더 정의와 일치한다.
- 제안: 변경 없이 채택 가능. 삽입 후 §1.2 말미 두 blockquote 의 순서(resume → park-entry)가 "재개 전에 진입" 의미와 역순이지만, 기존 선례(resume 노트 먼저 등재)를 따르는 것이므로 혼동 위험 낮음.

---

### [INFO] `interaction-type-registry.md` frontmatter `code:` 등재 항목의 파일 순서

- target 위치: A1 "L9 `resume-turn-dispatch.ts` 바로 다음에 추가"
- 충돌 대상: 현행 frontmatter `code:` 목록 (L4~L13)
- 상세: 현행 frontmatter 는 8개 파일을 열거한다. `resume-turn-dispatch.ts` 는 L9 에 위치한다. `park-entry-dispatch.ts` 를 그 바로 다음(L10 삽입)에 추가하는 것은 "resume 측 등재 선례와 대칭" 원칙과 일치하며, 다른 `code:` 항목들과 충돌하지 않는다. 파일은 origin/main 에 존재(커밋 `ecd70dd1`, #688 머지 확인)하므로 spec-code-paths 가드 통과 조건이 충족됐다.
- 제안: 변경 없이 채택 가능.

---

### [INFO] `4-execution-engine.md §Rationale` 삽입 위치 — L1372 "resume turn dispatch registry 추출 (#507)" 항목과의 연속성

- target 위치: A3 "L1372 #507 기록 바로 다음 추가"
- 충돌 대상: `spec/5-system/4-execution-engine.md` Rationale 섹션 L1372~L1373
- 상세: 현행 L1372 는 `resume turn dispatch registry 추출 (#507, 2026-06-06)` 항목이고, L1373 은 `runNodeDispatchLoop 반환 계약 (PR-B1, SPEC-DRIFT W3)` 항목이다. target 이 추가하는 park-entry 항목(`buildParkEntryRegistry`/`dispatchParkEntry` 추출, 세 사이트 행동 보존, `ai_form_render` = `ai_conversation` 공유, escape 사이트별 유지)은 L1372 의 resume 항목과 1:1 대칭 패턴이며 L1373 과 충돌하지 않는다. "§4 런타임 플러그인 로딩 미구현 invariant 유지"라는 단서도 현행 §4 내용과 정합한다(spec 미언급 신설 invariant 아님). 항목 자체가 behavior-invariant doc-sync 범주여서 §Rationale 의 "왜 이 선택인가" 성격과 부합한다.
- 제안: 변경 없이 채택 가능.

---

### [INFO] A4 plan 갱신 — M-5 체크박스 정정

- target 위치: A4 "02-architecture.md §M-5 line 247 체크박스 `[ ] 미착수` → `[x]` 정정"
- 충돌 대상: `plan/in-progress/refactor/02-architecture.md` §M-5 항목
- 상세: target 은 "M-5 레이어1 은 이미 #652 머지 완료(stale 체크박스)"라고 주장한다. 현행 plan 파일에서 M-5 항목이 실제로 레이어1 관련 체크박스가 미완료로 남아 있는지는 target 이 명시하는 line 247 에서 확인이 필요하다. target 의 주장("node-components.module.ts(NODE_COMPONENT DI provider)·bootstrap @Inject 주입·spec §1.0 sync(7283a216) 완료")이 사실이라면 plan 갱신은 stale 정정이며 다른 spec 과 충돌하지 않는다. 단, developer 가 plan 을 갱신하는 것이 developer 쓰기 권한 범위(`plan/**`)에 포함되므로 RBAC 관점에서 문제없다. 단 본 target 문서는 project-planner 가 작성한 spec-draft 이므로 plan 갱신도 포함되어 있는 것은 적합하다.
- 제안: 변경 전 `plan/in-progress/refactor/02-architecture.md` L247 실제 체크박스 상태를 확인해 stale 여부를 실측 후 적용하면 충분하다. 타 spec 과의 직접 충돌은 없음.

---

## 관점별 요약

1. **데이터 모델 충돌**: target 은 새 엔티티·필드를 정의하지 않는다. 기존 `NodeExecution.interaction_data`, `Execution.resume_call_stack` 등과 무관하며 doc-sync 만 수행한다. 충돌 없음.

2. **API 계약 충돌**: target 은 새 endpoint·HTTP method 를 정의하지 않는다. `dispatchParkEntry` / `parkEntryRegistry` 는 backend 내부 함수이며 외부 API 계약과 무관하다. 충돌 없음.

3. **요구사항 ID 충돌**: target 은 새 요구사항 ID 를 부여하지 않는다. 충돌 없음.

4. **상태 전이 충돌**: target 이 기술하는 park-entry dispatch (`dispatchParkEntry`) 는 `waiting_for_input` 진입 경로를 일원화하는 것이며, `4-execution-engine.md §1.1` 의 `running → waiting_for_input` 전이 정의와 일치한다. 상태 머신 자체 변경이 아니라 진입 routing 의 extract 이므로 상태 전이 충돌 없음.

5. **권한·RBAC 모델 충돌**: target 은 RBAC 관련 정의를 변경하지 않는다. 충돌 없음.

6. **계층 책임 충돌**: target 이 기술하는 `dispatchParkEntry` 의 책임 위치(execution-engine 내 단일 진입점)는 현행 `4-execution-engine.md §Rationale "C-1 god-class strangler-fig 분할"` 의 `EngineDriver` 협력 서비스 구조와 일치한다. `park-entry-dispatch.ts` 는 순수 factory 로 service 경계를 넘지 않으며, "§4 런타임 플러그인 로딩 미구현" invariant 를 번복하지 않는다고 target 이 명시하는 것도 `4-execution-engine.md §4` 와 정합한다. 충돌 없음.

---

## 요약

target 문서(`spec-draft-m4-park-entry-sync.md`)는 이미 머지된 구현(커밋 `ecd70dd1`, #688)을 기술하는 behavior-invariant doc-sync 3건(frontmatter `code:` 등재 / §1.2 park-entry 라우팅 노트 / §Rationale park-entry registry 추출 기록)과 plan 갱신 1건으로 구성된다. 모든 변경은 `resume-turn-dispatch.ts`(#507)의 기존 선례와 대칭 패턴을 따르며, 관련 spec(`interaction-type-registry.md`, `4-execution-engine.md`) 의 기존 상태 머신·API 계약·데이터 모델·RBAC·계층 책임 정의와 어떠한 직접 모순도 없다. 식별된 항목 3건은 모두 INFO 등급(물리적 삽입 위치 명세 확인·파일 순서 대칭성·plan 체크박스 실측 권고)으로 채택 차단 요인이 없다.

---

## 위험도

NONE
