# 정식 규약 준수 검토 보고서

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 대상: `spec/4-nodes/` (전체 하위 문서)
검토 기준: `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, CLAUDE.md 명명 컨벤션

---

## 발견사항

### [INFO] `spec/4-nodes/6-presentation/0-common.md` §6.2 — Table 출력 필드 오기재

- target 위치: `spec/4-nodes/6-presentation/0-common.md` §6.2 Run Results Drawer 렌더링 표
- 위반 규약: `spec/conventions/node-output.md` Principle 8.2 ("DB 쿼리 결과" 항목 참고 — 단, Presentation Table 에 대한 명시 규약)
- 상세: `§6.2` 의 렌더링 설명에서 `output.columns` 를 참조하고 있다 (`output.columns`와 `output.rows`를 테이블로 표시`). 그런데 `spec/conventions/node-output.md` Principle 1.1.1 에 따르면 `columns` 는 리터럴 config 값으로서 `config.*` 에만 존재해야 하고 `output` 에는 echo 하지 않는다. 동일 파일 §4 출력 포맷 규약에서도 "layout / mode / titleField / pageSize / chartType 등 리터럴 config 값은 echo 하지 않는다" 고 명시하고 있어, `output.columns` 가 실제로 output 에 존재하는지가 불명확하다. Principle 8.2 는 Table 을 `output.rows + output.totalRows` 로 정의하며 `output.columns` 는 명시되지 않는다.
- 제안: `§6.2` 렌더링 설명을 `config.columns 정의와 output.rows 를 테이블로 표시` 로 수정하거나, `output.columns` 가 실제로 런타임 생성값으로서 output 에 surface 된다면 해당 근거를 `spec/4-nodes/6-presentation/2-table.md` 의 출력 구조 §5 에 명시하고 Principle 1.1.1 예외로 등록해야 한다.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` §6.3 — Chart `output.rendered` 를 SVG 로 한정 서술

- target 위치: `spec/4-nodes/6-presentation/0-common.md` §6.3
- 위반 규약: `spec/conventions/node-output.md` Principle 4.3 및 8.2 (chart 는 `output.data` 가 런타임 필드, rendered 는 별도)
- 상세: §6.3 에서 `output.rendered SVG를 인터랙티브 차트로 표시` 라고 서술하고 있는데, Principle 8.2 에서 Chart 의 런타임 필드는 `output.data` 로 정의되어 있다. `output.rendered` 는 Template 노드의 런타임 필드다 (Principle 4.3 표: `template → { rendered }`). Chart 가 SVG 를 `output.rendered` 에 담는다면 이는 Principle 8.2 ("Chart: `output.data`") 와 충돌한다.
- 제안: Chart 노드의 SVG 표현이 `output.rendered` 에 저장된다면, `spec/4-nodes/6-presentation/3-chart.md` §5 출력 구조에 `output.rendered` 를 명시하고 Principle 4.3/8.2 와 정합화 여부를 확인한다. 그렇지 않다면 §6.3 을 `output.data 를 기반으로 인터랙티브 차트 렌더링` 으로 수정한다.

---

### [WARNING] `spec/4-nodes/1-logic/0-common.md` §9 — CONVENTIONS 참조 경로 접두 불일치

- target 위치: `spec/4-nodes/1-logic/0-common.md` §9 상단 (`[CONVENTIONS Principle 0](../../conventions/node-output.md)`)
- 위반 규약: CLAUDE.md 정보 저장 위치 — 정식 규약은 `spec/conventions/<name>.md`
- 상세: 링크가 `../../conventions/node-output.md` 로 되어 있다. `spec/4-nodes/1-logic/` 에서 상대 경로로 `../../conventions/` 는 `spec/conventions/` 를 가리켜 실제로는 올바르다. 그러나 `spec/4-nodes/6-presentation/0-common.md` 의 `../../conventions/conversation-thread.md` 도 동일 패턴이므로 일관성 자체는 있다. 다만 일부 문서(`1-if-else.md` 등)에서 같은 규약을 `[CONVENTIONS](../../conventions/node-output.md)` 처럼 접두어 없이 참조하는 반면, 다른 문서에서는 `CONVENTIONS Principle 0` 처럼 버전/섹션 참조를 인라인 본문에서 직접 서술한다. 링크 텍스트와 참조 깊이가 문서마다 달라 일관성이 낮다.
- 제안: spec 내 교차 참조 링크 텍스트를 `spec/conventions/node-output.md` (절대 경로 서술) 형태로 표기하거나, 최소한 같은 카테고리 문서군 내에서 동일 패턴을 사용하도록 정리한다. 규약 자체 변경이 아닌 표기 일관성의 문제이므로 INFO→WARNING 수준.

---

### [INFO] `spec/4-nodes/1-logic/2-switch.md` §8 Rationale — 섹션 넘버 방식 비일관

- target 위치: `spec/4-nodes/1-logic/2-switch.md` §8 Rationale
- 위반 규약: CLAUDE.md 문서 구조 규약 ("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")
- 상세: 문서 구조 권장 사항인 Overview / 본문 / Rationale 3섹션 구성에서 Rationale 는 비번호 `## Rationale` 로 두는 것이 관례인데, `2-switch.md` 는 `## 8. Rationale` 처럼 번호를 붙였다. 다른 문서(`12-background.md`)도 `## Rationale` (번호 없음) 로 표기한다. 동일 디렉터리 안에서 Rationale 섹션 표기가 통일되지 않아 문서 구조 규약의 "Rationale 마지막 섹션" 패턴과 부분 불일치.
- 제안: `2-switch.md` 의 `## 8. Rationale` 를 `## Rationale` 로 수정하여 다른 문서와 일관되게 맞춘다. (단, 해당 파일 내에서 `§8 Rationale` 로 내부 anchor 링크를 사용하고 있으므로 링크 동시 수정 필요)

---

### [INFO] `spec/4-nodes/1-logic/10-parallel.md` §5.2 — `count` 필드 제거 선언과 Principle 9.2 불일치 가능성

- target 위치: `spec/4-nodes/1-logic/10-parallel.md` §5.2 note ("**`count` 필드는 제거됨** (P1.1 직교성)")
- 위반 규약: `spec/conventions/node-output.md` Principle 9.2 (`parallel → { branches: [...], count: N }`)
- 상세: CONVENTIONS Principle 9.2 는 `parallel` 노드의 최종 output 을 `{ branches: [...], count: N }` 으로 명시하고 있다. 그런데 `10-parallel.md` §5.2 에서는 `count` 필드가 제거되었음을 명시하며, 이유로 "branches.length 가 SSOT" 를 든다. 이 결정이 CONVENTIONS Principle 9.2 를 갱신해야 함을 시사하지만, `spec/conventions/node-output.md` Principle 9.2 의 `parallel` 행은 아직 `count: N` 을 포함한 채로 유지되고 있다.
- 제안: `spec/conventions/node-output.md` Principle 9.2 의 `parallel` 행을 `{ branches: [...] }` (count 없음) 으로 갱신하거나, `10-parallel.md` §5.2 에 "CONVENTIONS Principle 9.2 갱신 필요 — count 제거 결정 반영" 주석을 달아 두 문서 간 drift 를 명시한다. 이는 구현자가 어느 쪽이 진실인지 혼동할 수 있는 지점이다.

---

### [WARNING] `spec/4-nodes/1-logic/12-background.md` §8.2 — API 응답 스키마가 규약 래퍼(`{ data: ... }`) 미명시

- target 위치: `spec/4-nodes/1-logic/12-background.md` §8.2 응답 스키마
- 위반 규약: `spec/conventions/swagger.md` §2-5 ("TransformInterceptor 로 모든 성공 응답을 `{ data: ... }` 로 감쌉니다")
- 상세: §8.2 의 응답 JSON 예시가 `backgroundRunId`, `executionId`, `status` 등 필드를 최상위로 나열하고 있어 `{ data: { backgroundRunId, ... } }` 래퍼가 생략된 형태로 표기되어 있다. 프로젝트는 `TransformInterceptor` 로 모든 성공 응답을 `{ data: ... }` 로 감싸는데, spec 응답 스키마 예시는 이를 반영하지 않았다. 다른 API spec 문서도 일관되게 래퍼 없이 작성된 경우가 있다면 허용 관행이지만, swagger.md 는 명시적으로 Swagger 응답 스키마 표기 시도 이 구조를 반영할 것을 요구한다.
- 제안: §8.2 응답 스키마 예시를 `{ "data": { "backgroundRunId": ..., ... } }` 형태로 수정하거나, spec 응답 예시는 payload 내용(raw resource shape)을 보여주는 것이고 래퍼는 인프라 레이어라는 관례를 CONVENTIONS 에 명시하여 양쪽을 정합화한다.

---

### [INFO] `spec/4-nodes/0-overview.md` §1.2 — `status?` 필드 누락

- target 위치: `spec/4-nodes/0-overview.md` §1.2 노드 정의(Definition) 속성 표
- 위반 규약: `spec/conventions/node-output.md` Principle 0 (5필드 invariant: `{ config, output, meta?, port?, status? }`)
- 상세: `0-overview.md` §1.2 는 `NodeHandlerOutput` 의 `status?` 필드 (`waiting_for_input`, `resumed`, `ended` 등)를 노드 정의 속성 표에 기재하고 있지 않다. Principle 0 은 `status?` 를 5필드 중 하나로 명시하고 있고, Presentation 노드에서 이 필드는 핵심 계약이다.
- 제안: §1.2 표 또는 별도 서술에서 `NodeHandlerOutput` 의 `status?` 필드를 언급하거나, §4.3 실행 인터페이스 항목에서 출력 5필드를 참조하도록 보강한다.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` §3 — `__continue__` ID 언급이 규약 예약어와 충돌 가능성

- target 위치: `spec/4-nodes/6-presentation/0-common.md` §6.1 ("link 전용 시 `[Continue →]` 암시적 버튼 표시 → `__continue__` ID로 WS 명령")
- 위반 규약: `spec/conventions/node-output.md` Principle 6 ("시스템 포트 예약어: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`")
- 상세: Principle 6 는 `continue` 를 시스템 포트 예약어로 열거하고 있다. `§6.1` 에서 언급한 `__continue__` WS 명령 ID 는 포트 ID 가 아닌 WS 이벤트 식별자이므로 Principle 6 의 직접 적용 대상은 아니다. 그러나 포트 이름이 `continue` (§2 포트 토폴로지 "Continue | 출력 | `continue`") 인 점과 `__continue__` WS ID 가 혼재하면 독자가 실제 포트 ID 가 `continue` 인지 `__continue__` 인지 혼동할 수 있다.
- 제안: §6.1 의 WS 명령 ID 가 `__continue__` 라면 이를 포트 ID `continue` 와 구분하는 설명을 명시한다. 예: "WS 명령의 `buttonId` 는 `__continue__` 이며, 이는 포트 ID `continue` 와 구분되는 내부 식별자다."

---

## 요약

`spec/4-nodes/` 전반은 `spec/conventions/node-output.md` 의 5필드 invariant(Principle 0)·출력 구조(Principle 1/7/9/11)·에러 컨트랙트(Principle 3)를 충실히 반영하고 있으며, Logic 노드 군은 Pass-through 규약, 컨테이너 오버라이트 컨트랙트, 포트 ID 불변성 등을 일관되게 서술하고 있다. 주요 위험 지점은 두 가지다: (1) `10-parallel.md` 가 `count` 필드 제거를 결정했음에도 `spec/conventions/node-output.md` Principle 9.2 가 갱신되지 않아 두 진실이 병존하는 drift, (2) `12-background.md` §8.2 의 API 응답 예시가 TransformInterceptor 래퍼(`{ data: ... }`)를 반영하지 않아 `spec/conventions/swagger.md` §2-5 와 표면적 불일치가 있는 점이다. 나머지 항목은 표기 일관성·설명 정확성 수준의 INFO 사안이며, 구현 착수를 차단할 Critical 위반은 없다.

## 위험도

LOW
