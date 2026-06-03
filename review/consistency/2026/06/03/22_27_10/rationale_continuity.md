# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/`, diff-base=`origin/main`

---

## 발견사항

### 발견사항 1

- **[INFO]** `canvas.md §5.3.4` 요약 포맷 변경에 파일 내 Rationale 부재
  - target 위치: `spec/3-workflow-editor/0-canvas.md` §5.3.4 (Database Query / Send Email / Code / Template 행)
  - 과거 결정 출처: `canvas.md` 에 Rationale 섹션 없음 (origin/main 기준). 본 파일은 "각 노드 유형의 요약 포맷은 해당 노드 스펙 문서에 정의된다"고 위임을 명시했음.
  - 상세: Database Query 행 `{queryType} · {쿼리 첫줄}` → `{{queryType|upper}} · {{query}}`, Send Email 행 `to: {수신자} +N` → `{{to.length}} recipients · {{subject}}`, Code 행 `{language} · {N} lines` → `{{language|upper}}`, Template 행 2가지 변형 → 단일 `{{outputFormat}} · {{buttons.length}} buttons` 로 변경됐다. 변경 근거(summaryTemplate DSL 이 개행 카운트·배열 슬라이스·조건 분기를 지원하지 않아 downscope)는 각 노드 spec 파일(`2-database-query.md`, `3-send-email.md`, `5-data/2-code.md`, `6-presentation/5-template.md`)에 inline 노트 또는 Rationale 항목으로 기록되어 있다. `canvas.md` 자체에는 이 변경에 대한 설명이 없고, `canvas.md` 는 SoT 위임 선언("각 노드 스펙 문서")만 갖는다.
  - 제안: 현재 구조(SoT 위임 + 노드별 Rationale)는 수용 가능하나, `canvas.md §5.3.4` 에 "아래 DSL 표현식 형식은 각 노드 스펙의 summaryTemplate SoT 와 동기화됨 — 포맷 변경 근거는 해당 노드 Rationale 참조" 같은 한 줄 안내 노트를 추가하면 독자가 맥락을 잃지 않는다.

---

### 발견사항 2

- **[INFO]** `ForEach $itemIsFirst/$itemIsLast` — 과거 결정 번복이지만 Rationale 동반됨 (정합)
  - target 위치: `spec/4-nodes/1-logic/9-foreach.md §2 + §Rationale R-1`, `spec/5-system/4-execution-engine.md §contextVariables`, `spec/5-system/5-expression-language.md §4`
  - 과거 결정 출처: `spec/4-nodes/1-logic/9-foreach.md` (origin/main) — "`$item.isFirst`/`$item.isLast` 같은 first/last 플래그를 body 표현식에서 직접 읽는 surface 는 미구현(Planned), 현재는 `$itemIndex === 0` 등으로 직접 판별해야 한다."
  - 상세: origin/main 은 `isFirst`/`isLast` 를 expression 에 노출하지 않기로 명시했다. 이번 변경은 이를 `$itemIsFirst` / `$itemIsLast` top-level 변수로 노출한다. 이는 과거 결정의 번복이지만, `9-foreach.md §Rationale R-1` 에 번복 근거(가독성 한계, top-level 변수로 채택한 이유, 기각된 대안 2가지)를 명시적으로 작성했다. 연관 파일(`4-execution-engine.md`, `5-expression-language.md`, `1-node-common.md §컨테이너 스코프`, `4-nodes/1-logic/0-common.md`)도 일관되게 갱신됐다.
  - 제안: 이미 적절히 처리됨. 추가 조치 불필요.

---

### 발견사항 3

- **[INFO]** `node-common §2.5.2` 타입별 기본값 추론 → null 폴백으로 변경 — Rationale 동반됨 (정합)
  - target 위치: `spec/3-workflow-editor/1-node-common.md §2.5.1, §2.5.2 + Rationale R-1`
  - 과거 결정 출처: `spec/3-workflow-editor/1-node-common.md` (origin/main) §2.5.2 "사용자가 기본값을 직접 설정하지 않은 경우 노드 출력 타입에 따라 Object→`{}`/Array→`[]`/String→`""`/Number→`0`/Boolean→`false`/Null→`null` 자동 적용. 타입 추론은 노드의 마지막 정상 실행 출력에서."
  - 상세: origin/main 은 타입별 기본값 자동 추론을 구현된 기능처럼 명세했다. 이번 변경은 실제 엔진(`error-policy.handler.ts`)이 `defaultOutput ?? null` 단일 폴백만 사용함을 코드 동기화 결과로 명세하고, 타입 추론을 "(미구현 — Planned)" 로 격하했다. 이는 과거 spec 의 과도한 명세를 현실에 맞게 정정한 것으로, `1-node-common.md Rationale R-1` 에 명시적 근거가 있다.
  - 제안: 이미 적절히 처리됨. 추가 조치 불필요.

---

### 발견사항 4

- **[INFO]** `spec-impl-evidence.md §1` 제외 범위 확장 — 파일 내 Rationale 항목 미추가
  - target 위치: `spec/conventions/spec-impl-evidence.md §1 제외 조건`
  - 과거 결정 출처: 없음 (origin/main 에 이 제외 규칙에 대한 별도 Rationale 항목 없음). 단, §1 본문에 제외 근거("cross-cutting 진입 문서", "단순 overview 성격")가 inline 서술되어 있었다.
  - 상세: origin/main 은 `spec/0-overview.md` (경로 기준 특정 파일)를 제외로 기술했다. 이번 변경은 "basename `0-overview.md` 매칭" 으로 범위를 확장해 `spec/<영역>/0-overview.md` (예: `spec/4-nodes/0-overview.md`)도 면제한다. 이는 실제 가드 구현(`spec-frontmatter-parse.ts`)의 `EXCLUDE_BASENAMES` 방식을 반영한 코드 동기화지만, 이 scope 확장에 대한 Rationale 항목이 `## Rationale` 절에 추가되지 않았다. 확장이 의도된 것인지(모든 영역 진입 문서 면제), 아니면 구현 버그 반영인지 독자가 판단하기 어렵다.
  - 제안: `spec/conventions/spec-impl-evidence.md § Rationale` 에 "R-7. 제외 규칙을 basename 매칭으로 (경로 정확 매칭 대신)" 항목 추가 — 가드 구현이 basename 기반이므로 `spec/<영역>/0-overview.md` 도 면제된다는 근거와, 영역 진입 문서를 일괄 면제하는 원칙적 이유를 명시한다.

---

### 발견사항 5

- **[INFO]** `presentation/0-common.md §5` Template 요약 포맷 단일화 — 파일 내 Rationale 부재
  - target 위치: `spec/4-nodes/6-presentation/0-common.md §5 캔버스 요약 표`
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` (origin/main) — Template 을 "버튼 없음" / "버튼 있음" 두 변형으로 명세.
  - 상세: Template 두 변형 명세가 단일 행 `{{outputFormat}} · {{buttons.length}} buttons` 로 통합됐다. 상세 근거(summaryTemplate DSL 이 단일 정적 문자열이라 config 분기 불가)는 `spec/4-nodes/6-presentation/5-template.md Rationale R-1` 에 있다. `presentation/0-common.md` 자체에는 이 통합에 대한 Rationale 항목이 없다.
  - 제안: `presentation/0-common.md §5` 표 아래에 "Template 포맷 통합 근거는 `5-template.md Rationale R-1` 참조" 한 줄 노트를 추가하면 독자가 이유를 추적할 수 있다. 또는 `presentation/0-common.md Rationale` 에 간략한 항목을 추가한다.

---

## 요약

이번 변경은 전체적으로 Rationale 연속성이 양호하다. 과거에 명시적으로 기각·보류로 표시된 결정을 번복한 주요 2건 — `ForEach $itemIsFirst/$itemIsLast` 표현식 노출, `Use Default Output` 타입별 추론 → `null` 폴백 격하 — 은 각 파일의 `## Rationale` 절에 번복 근거와 기각된 대안을 갖추고 있어 연속성 위반이 없다. 나머지 발견사항 3건은 모두 INFO 수준으로, canvas/presentation summary 테이블 변경이 "SoT 위임 선언 + 노드별 Rationale" 모델에 의존하면서 집약 테이블 자체에 설명이 없다는 문서화 보완 제안이며, 합의된 원칙이나 invariant 를 위반하는 내용은 없다. `spec-impl-evidence.md` 제외 범위 확장은 코드 동기화 사실을 반영한 것이지만, 확장 원칙의 Rationale 항목이 없어 향후 독자 혼란 가능성이 있다.

---

## 위험도

LOW
