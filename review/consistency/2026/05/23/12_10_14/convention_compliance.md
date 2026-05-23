# 정식 규약 준수 검토 — spec/4-nodes/

검토 모드: --impl-prep (구현 착수 전)
검토 대상: `spec/4-nodes/` (scope: 프롬프트에 포함된 문서 전체)
검토 규약: `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, CLAUDE.md 명명 컨벤션

---

## 발견사항

### [INFO] `spec/4-nodes/2-flow/`, `spec/4-nodes/5-data/`, `spec/4-nodes/7-trigger/` 하위 파일 미포함
- target 위치: 프롬프트 payload의 "Target 문서" 섹션 — `spec/4-nodes/`로 선언했으나 Logic·AI·Integration·Presentation 노드 일부만 적재됨
- 위반 규약: 해당 없음 (orchestrator payload 범위 제한)
- 상세: 프롬프트에 포함된 파일 목록이 `1-logic/`, `3-ai/` (일부), `6-presentation/` (공통만)에 집중돼 있다. `2-flow/`, `5-data/`, `7-trigger/`, `4-integration/` 세부 파일은 불포함이므로 해당 파일 내 위반 여부는 본 검토에서 판단 불가.
- 제안: 검토 대상에 누락이 있어 완전성이 제한됨 — orchestrator가 추가 payload 제공 시 재검토 권고. 현재 검토는 포함된 파일 범위로 한정.

---

### [WARNING] `spec/4-nodes/1-logic/0-common.md` §9 — `meta.iterations?` / `meta.branches?` / `meta.matchedCount?` 가 Principle 2 `meta` 필드 목록과 불일치
- target 위치: `spec/4-nodes/1-logic/0-common.md` §9 "5필드 공통 규약" meta 행
- 위반 규약: `spec/conventions/node-output.md` Principle 2 — Container 카테고리 meta 필수/권장 필드는 `meta.iterations?`, `meta.branches?`, `meta.matchedCount?`로 나열
- 상세: Principle 2의 Container 행은 `meta.iterations?`, `meta.branches?`, `meta.matchedCount?`를 나열한다. 그런데 §5 "반복/분기 출력 구조" 및 §9.1 컨트랙트 표에서 Loop의 컬렉션 키는 `iterations`, ForEach는 `items`, Map은 `mapped`, Parallel은 `branches`다. Principle 2의 `meta.iterations?` 항목이 Loop 전용임은 문맥상 유추 가능하지만, ForEach의 `items` count, Map의 `mapped` count에 대응하는 `meta.itemsCount?` / `meta.mappedCount?` 항목이 Principle 2 표에 부재하다. §9 logic 공통 메타 표에서는 `meta.iterations? / branches? / matchedCount?`를 나열하여 컨테이너 종류별 메타 키가 일관되게 정렬되지 않는다 — `meta.matchedCount?`는 `filter` 노드 전용이나 컨테이너 목록에 섞여 있다.
- 제안: Principle 2의 Container 행을 `meta.iterations?` (Loop) / `meta.items?` 또는 `meta.itemCount?` (ForEach) / `meta.mappedCount?` (Map) / `meta.branches?` (Parallel) / `meta.matchedCount?` (Filter)로 노드별 대응 관계를 명시하거나, 공통 규약(0-common.md) §9 메타 표를 Principle 2와 용어 정렬. 규약 갱신이 적절하다.

---

### [WARNING] `spec/4-nodes/1-logic/12-background.md` §5.1 — `meta.durationMs` 출처 표기 불일치
- target 위치: `spec/4-nodes/1-logic/12-background.md` §5.1 출력 구조 표 — `meta.durationMs` 출처 컬럼이 `runtime — handler 측정`으로 표기됨
- 위반 규약: `spec/conventions/node-output.md` Principle 2 — "`meta.durationMs`는 엔진이 모든 노드에 공통 주입하는 값으로, 핸들러는 별도로 채우지 않는다"는 것이 `1-if-else.md` §5.1 주석 및 `1-logic/0-common.md` §9 표에서 일관되게 명시됨
- 상세: `if-else.md`, `switch.md`, `parallel.md`, `merge.md` 등 다른 모든 노드는 `meta.durationMs` 출처를 `engine inject`로 표기하고 핸들러가 채우지 않음을 명시한다. Background 노드 §5.1 표만 `runtime — handler 측정`으로 표기하고 설명란에도 "핸들러 자체의 즉시 처리 시간 (ms). fire-and-forget 이므로 보통 0~수 ms"라며 핸들러가 측정한다고 기술한다. Background 노드가 실제로 `durationMs`를 handler에서 직접 측정해 반환한다면 다른 노드와의 측정 주체 불일치가 발생하며, 엔진의 일관된 inject가 아닌 handler 자체 측정 값은 정밀도 및 측정 기준이 달라질 수 있다.
- 제안: Background 핸들러가 `durationMs`를 직접 채운다면 이 동작이 의도된 예외인지 Rationale에 명시하거나, 아니면 다른 노드와 동일하게 엔진 inject로 변경하고 표기를 `engine inject`로 통일. 규약 갱신(특수 케이스 명시) 또는 문서 수정 중 하나가 필요하다.

---

### [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md` §1 — `presentationTools` 필드 설명에서 참조하는 Presentation 공통 §10.x 앵커가 `spec/4-nodes/6-presentation/0-common.md`에 부재
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §1 PresentationToolDef 설명 — `[Presentation 공통 §10.1]`, `[Presentation 공통 §10.2]`, `[Presentation 공통 §10.3]` 링크 참조
- 위반 규약: CLAUDE.md "단일 진실 원칙" — 링크된 섹션이 실제로 존재해야 한다
- 상세: `spec/4-nodes/6-presentation/0-common.md`에서 검토한 범위(§1~§6)에 §10.1(schema 단일 진실), §10.2(도구 카탈로그), §10.3(defaults overlay 규칙) 섹션이 포함되어 있지 않다. 링크 참조 대상이 실제 파일에 없으면 구현자가 참조를 따라갈 수 없어 presentationTools의 schema 재사용 패턴, 도구 카탈로그, defaults overlay 규칙을 파악하기 어렵다.
- 제안: `spec/4-nodes/6-presentation/0-common.md`에 §10 "AI Agent presentationTools 연동" 절(§10.1 schema 단일 진실 / §10.2 도구 카탈로그 / §10.3 defaults overlay 규칙)을 추가하거나, 해당 내용이 다른 파일에 있다면 올바른 경로로 링크 수정. 문서 구조 규약상 해당 내용이 없으면 단일 진실 원칙 위반이다.

---

### [INFO] `spec/4-nodes/1-logic/2-switch.md` §1 — `hasDefault` schema 기본값과 핸들러 거동 비대칭이 schema 규약 위반처럼 읽힐 수 있음
- target 위치: `spec/4-nodes/1-logic/2-switch.md` §1 `hasDefault` 필드 설명
- 위반 규약: 직접적 conventions 위반 아님 — 단, Principle 7 "config echo" 관점에서 schema 기본값(`false`)과 핸들러 실제 동작(`hasDefault !== false` 즉 undefined도 default 사용) 간의 비대칭이 문서화는 되어 있으나 `rawConfig` echo 시 `undefined`가 echo된다는 점을 명시하지 않음
- 상세: `config.hasDefault`가 사용자가 UI에서 명시적으로 설정하지 않으면 `undefined`로 echo되지만, 핸들러 동작은 default 폴백이 발생한다. 후속 노드가 `$node["X"].config.hasDefault`를 참조해 동작을 예측할 때 `undefined`와 `true`를 동일하게 취급해야 하는데, 이 점이 §5.2 예시 JSON에서는 `"hasDefault": true`로 echo되어 있어 config echo 규칙(Principle 7)과의 관계가 명확하지 않다. §5.1 케이스 JSON에는 `hasDefault`가 없으므로 undefined echo 여부가 불분명하다.
- 제안: §5.1 JSON 예시에 `"hasDefault": undefined` 또는 해당 필드 생략 시 핸들러 동작을 설명 주석으로 추가. 또는 §1 `hasDefault` 설명란에 "config echo 시 미설정이면 undefined로 echo — 다운스트림은 undefined를 true로 취급해야 한다"를 명시. Principle 11 (출력 예시 문서화 규칙)과 정합성 제고.

---

### [INFO] `spec/4-nodes/1-logic/10-parallel.md` §5.2 — `count` 필드 제거 결정이 Principle 9.2와 불일치
- target 위치: `spec/4-nodes/1-logic/10-parallel.md` §5.2 주석 "`count` 필드는 제거됨 (P1.1 직교성 — `branches.length`가 SSOT)"
- 위반 규약: `spec/conventions/node-output.md` Principle 9.2 — Parallel의 최종 output은 `{ branches: [...], count: N }`으로 명시됨
- 상세: Principle 9.2 표에서 Parallel의 엔진 오버라이트 output은 `{ branches: [branch_0_result, branch_1_result, ...], count: N }`이다. 그러나 `10-parallel.md` §5.2는 `count` 필드가 제거되었고 `branches.length`가 SSOT라고 선언한다. Logic 공통 `0-common.md` §5 표에서도 Parallel의 컬렉션 키는 `branches`이며 `{ <컬렉션>, count }` 형태를 따른다고 명시하여 `count`가 있어야 한다. 두 문서 간에 `count` 존재 여부가 충돌한다.
- 제안: Principle 9.2와 `0-common.md` §5가 `count: N` 포함을 규정하므로, `10-parallel.md`의 `count` 제거 결정이 규약 변경이라면 Principle 9.2와 `0-common.md` §5도 동시에 갱신해야 한다. 아니면 `10-parallel.md` §5.2를 `count` 포함 형태로 복원. 현재 상태에서 conventions 문서(Principle 9.2)와 노드 개별 문서가 상충한다.

---

### [INFO] `spec/4-nodes/1-logic/0-common.md` §9 meta 표 — `meta.durationMs`가 Logic 카테고리 공통 설명에서 "모든 노드 공통: `meta.durationMs` (엔진 inject)"로 올바르게 명시되나 §9 표의 `meta` 행에는 포함 안 됨
- target 위치: `spec/4-nodes/1-logic/0-common.md` §9 "5필드 공통 규약" 표 `meta` 행
- 위반 규약: `spec/conventions/node-output.md` Principle 2 — `meta.durationMs`는 공통 필수 필드
- 상세: §9 표 `meta` 행에 "실행 메트릭만 (Principle 2). 컨테이너: `meta.iterations? / branches? / matchedCount?`. 분기: `meta.conditionResult? / matchedConditions?`. **모든 노드 공통: `meta.durationMs` (엔진 inject)**"라고 문자 설명이 있으나, 표 형식의 `meta` 행 내용에는 각 범주별 optional 필드만 나열하고 `durationMs`는 문장으로만 언급된다. 개별 노드 문서(if-else, parallel 등)의 §5 표에는 `meta.durationMs`가 명시적으로 포함되어 있으므로 일관성 문제는 아니나, 공통 표가 이 필드를 별도 행으로 나열하면 가독성이 향상된다.
- 제안: 사소한 형식 개선 — 공통 §9 meta 행 설명에서 `durationMs`를 명시적으로 표의 첫 행으로 분리하거나 "(+ 공통 `durationMs`)" 접미 형태로 표기.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` §6.2 Table 렌더링 — `output.columns`와 `output.rows` 참조
- target 위치: `spec/4-nodes/6-presentation/0-common.md` §6.2 Table 렌더링 행 "`output.columns`와 `output.rows`를 테이블로 표시"
- 위반 규약: `spec/conventions/node-output.md` Principle 8.2 — DB 결과와 Presentation 노드의 rows 키 구분 — 단, Presentation Table 노드의 경우 `output.rows` 는 허용된 키임 (Principle 8.2 마지막 행)
- 상세: Principle 8.2에서 프레젠테이션 뷰 런타임 필드로 `output.rows`(table)는 명시적으로 허용한다. 그러나 `output.columns`는 Table 노드의 런타임 생성값인지 config echo인지 불분명하다. Principle 1.1에 따르면 `columns` 정의는 사용자가 설정한 리터럴 config이므로 `config.columns`에만 있어야 하며 `output.columns`로 echo는 금지다. §6.2의 "`output.columns`" 표기는 이 규칙과 충돌할 수 있다.
- 제안: Table 노드 §6.2 렌더링 설명에서 "`output.columns`"를 "`config.columns`"(컬럼 정의) + "`output.rows`"(런타임 행 데이터) 형태로 정정하거나, Table 노드의 상세 스펙(`2-table.md`)에서 `output.columns` echo가 의도된 런타임 구조인지 확인 후 Principle 1.1 준수 여부를 명시. 단, 이 항목은 `2-table.md`가 프롬프트에 포함되지 않아 단언하기 어려우므로 INFO로 분류.

---

## 요약

`spec/4-nodes/` 내 검토 대상 문서들은 전반적으로 `spec/conventions/node-output.md`(Principle 0~11)을 충실히 따르고 있으며, 5필드 invariant, config echo, pass-through 계약, 컨테이너 오버라이트 컨트랙트, 출력 문서화(Principle 11 JSON 포맷) 등 핵심 규약이 각 노드 문서에 일관되게 적용되어 있다. 다만 Parallel 노드의 `count` 필드 제거 결정(§5.2)이 Principle 9.2 및 Logic 공통 §5와 명시적으로 충돌하며, Background 노드의 `meta.durationMs` 측정 주체 표기가 다른 모든 노드와 상이하고, `presentationTools` 참조 대상 섹션(`6-presentation/0-common.md` §10.x)이 실제 파일에 부재한 점이 구현 착수 전 해소가 필요한 WARNING 항목이다. 문서 구조 규약(Overview / 본문 / Rationale 3섹션, `_product-overview.md` prefix, `0-overview.md` 진입점) 은 `spec/4-nodes/`가 올바르게 준수하고 있다.

## 위험도

MEDIUM

`count` 제거와 Principle 9.2 충돌은 구현자가 Parallel 노드 output에 `count`를 포함해야 하는지 여부를 혼동할 수 있어 런타임 output 계약 불일치로 이어질 수 있다. `presentationTools` §10.x 참조 링크 불존재는 `render_*` 도구 관련 구현 시 단일 진실 부재로 이어질 수 있다.
