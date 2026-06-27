# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-eia-seq-nfr.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-27

---

## 발견사항

### 1. **[INFO]** plan 문서 자체는 규약 준수 — plan frontmatter 필수 3필드 완비

- target 위치: `plan/in-progress/spec-draft-eia-seq-nfr.md` 1–5행 (frontmatter)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` / `spec/conventions/spec-impl-evidence.md §4.2`
- 상세: `worktree: eia-seq-nfr-spec-2845e7`, `started: 2026-06-27`, `owner: project-planner` 모두 존재하며 스키마 적합. build guard `plan-frontmatter.test.ts` 통과 요건 충족.
- 제안: 유지.

---

### 2. **[WARNING]** 문서 구조 규약 — plan 문서 내 "Rationale" 섹션 표제어 불일치

- target 위치: `spec-draft-eia-seq-nfr.md` 38행, 섹션 제목 `## 결정 근거 (이 draft 의 Rationale)`
- 위반 규약: CLAUDE.md "정보 저장 위치 — 결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"; `spec/conventions/spec-impl-evidence.md` 전반에서 spec 문서의 3섹션 구성 (Overview / 본문 / **Rationale**)을 규정
- 상세: 본 plan 문서는 이 draft 의 근거 섹션을 `## 결정 근거 (이 draft 의 Rationale)` 로 표기하고 있다. plan 문서 자체는 spec 이 아니므로 `## Rationale` 강제 대상은 아니지만, spec 변경안 본문(`## 변경안`)·rationale(`## Rationale 보강`) 이라는 두 표준 레이블을 혼용하여 plan 안에 두 가지 rationale-상당 섹션이 공존한다. `## Rationale 보강 (§R7 말미에 1문장 추가)` 은 *적용할 spec 텍스트 조각*이고, `## 결정 근거 (이 draft 의 Rationale)` 는 *이 draft 가 존재하는 이유*다. 두 섹션의 역할 구분은 내용상 명확하나 표제어가 비표준 자유형 한국어라 일관성 검토 자동화(NLP 섹션 파싱)에서 오분류될 수 있다. 실 Rationale 섹션이 반영될 spec(`spec/5-system/14-external-interaction-api.md`)에서는 `## Rationale` 라벨이 정확히 붙어야 한다.
- 제안: plan 문서 변경 불요. 단, 이 plan 이 spec 본문에 Rationale 텍스트를 삽입할 때 `## Rationale` (표준 레이블) 아래에 추가함을 명확히 해 두면 충분. 현 draft 에 `## Rationale 보강 (§R7 말미에 1문장 추가)` 라는 비표준 표제어를 쓴 것은 plan 내 작업 지시 섹션으로서의 의도이며, spec 편집 시점에는 실제 `## Rationale` 아래에 삽입될 것이므로 중간 단계 plan 문서에서의 WARNING 수준.

---

### 3. **[INFO]** NFR ID 연번 — 기존 §3.5 표의 최대 ID 확인 권장

- target 위치: `spec-draft-eia-seq-nfr.md` 24–27행, `EIA-NF-06` / `EIA-NF-07`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2`(id 고유성), CLAUDE.md 단일 진실 원칙
- 상세: 기존 `spec/5-system/14-external-interaction-api.md §3.5` 가 `EIA-NF-01`~`EIA-NF-05` 를 가지며 (`EIA-NF-04`, `EIA-NF-05` 확인됨), `EIA-NF-06`/`07` 이 중복 없이 다음 연번임은 spec 본문 조회로 확인됐다. 연번 갭·중복 없음.
- 제안: 현 상태 유지.

---

### 4. **[INFO]** spec 변경안 내부 링크 경로 — plan 문서 기준 상대 경로 표기

- target 위치: `spec-draft-eia-seq-nfr.md` 26행, `[실행 엔진 §9.2](./4-execution-engine.md#92-용도별-키-정의-및-ttl)` 및 `[WS §2.2](./6-websocket-protocol.md#22-서버--클라이언트-이벤트-래퍼)`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` 가 spec 파일의 in-repo 링크 타깃 실존·anchor slug 를 강제
- 상세: 본 plan 문서 안의 변경안 텍스트 블록에서 `./4-execution-engine.md`, `./6-websocket-protocol.md` 를 상대 경로로 참조한다. 이 링크는 plan 문서 내 텍스트이므로 plan 의 위치(`plan/in-progress/`) 기준 상대 경로로 해석되어 실제 spec 파일과 연결되지 않는다. `spec-link-integrity.test.ts` 가드는 **spec 파일** 의 링크만 검증하므로 plan 안의 링크는 가드 대상 밖이다. 단, 이 텍스트가 spec 본문에 그대로 복사·붙여넣기될 때 상대 경로가 spec 파일 위치(`spec/5-system/`) 기준으로 올바른지 재확인이 필요하다. `spec/5-system/` 에서 `./4-execution-engine.md` 는 `spec/5-system/4-execution-engine.md` 로 해석되어 유효하다 — 문제없음. 단 plan 에서 독립적으로 이 링크를 클릭하면 깨진 링크처럼 보이는 UX 혼란이 있을 수 있다.
- 제안: plan 문서의 변경안 텍스트 링크는 가드 대상 밖이므로 차단 사항 없음. spec 편집 시 그대로 복사해도 spec 위치 기준 올바른 상대경로이므로 사용 가능. 의식적 패턴으로 수용 가능.

---

### 5. **[INFO]** `spec_impact` 미선언 — 완료 시점 Gate C 요구사항

- target 위치: `spec-draft-eia-seq-nfr.md` 1–5행 (frontmatter)
- 위반 규약: `.claude/docs/plan-lifecycle.md §5 Gate C` / `spec/conventions/spec-impl-evidence.md §4.2`
- 상세: `spec_impact` 는 `plan/complete/` 이동 시점에만 의무 (`started ≥ 2026-06-04` 이면 Gate C 적용, 본 plan 은 `started: 2026-06-27`). 현재 `in-progress` 상태이므로 미선언은 정상. 완료 이동 시 `spec_impact: spec/5-system/14-external-interaction-api.md` 선언 필요.
- 제안: 완료(`complete/` 이동) 전 `spec_impact` 를 frontmatter 에 추가. 현 단계에서는 문제없음.

---

## 요약

`plan/in-progress/spec-draft-eia-seq-nfr.md` 는 plan frontmatter 필수 3필드(`worktree`·`started`·`owner`)를 완비하고, NFR ID 연번(`EIA-NF-06`/`EIA-NF-07`)이 기존 §3.5 와 중복 없이 연속된다. 제안하는 spec 변경 텍스트의 섹션 구성(변경안 표 + Rationale 보강 + 결정 근거)은 내용상 완결적이다. 주목할 사항은 하나: plan 내 "Rationale" 상당 섹션이 `## 결정 근거 (이 draft 의 Rationale)` 라는 비표준 자유형 제목을 쓰고 있어 spec 3섹션 명명 컨벤션(`## Rationale`)과 표제어가 다르지만, 이는 plan 문서의 작업 지시 맥락이고 실제 spec 삽입 시에는 표준 레이블 하에 배치될 것으로 예상된다. 정식 규약을 직접 위반하는 CRITICAL 항목은 없다.

## 위험도

LOW
