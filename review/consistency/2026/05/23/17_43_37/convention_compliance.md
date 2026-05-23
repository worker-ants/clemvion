# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/4-nodes/` (Logic 카테고리 노드 스펙 문서 중심)
참조 규약: `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, CLAUDE.md

---

## 발견사항

### [INFO] `spec/4-nodes/0-overview.md` — Rationale 섹션 부재

- target 위치: `spec/4-nodes/0-overview.md` 전체
- 위반 규약: CLAUDE.md "정보 저장 위치 > 결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: `0-overview.md` 는 노드 아키텍처·카테고리·인터페이스·샌드박싱 등을 폭넓게 서술하지만 문서 끝에 `## Rationale` 섹션이 없다. 설계 결정(예: 컴포넌트 단위 co-location 선택, `spec/4-nodes/` 폴더 구조 자체, 메타데이터 API 응답 형태 등) 의 배경 근거가 문서 내에 산재하거나 누락되어 있다.
- 제안: 문서 말미에 `## Rationale` 섹션을 추가하고, 노드 컴포넌트 단위 분리 선택·`<type>.schema.ts` 단일 소스 결정·플러그인 인터페이스 방향 등의 근거를 이관한다.

---

### [INFO] `spec/4-nodes/1-logic/0-common.md` — Rationale 섹션 부재

- target 위치: `spec/4-nodes/1-logic/0-common.md` 전체
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: Logic 공통 규약 문서(`0-common.md`)에 ConditionGroup 구조·Pass-through 컨트랙트·컨테이너 패턴·errorPolicy 설계 등 다수의 설계 결정이 담겨 있으나 `## Rationale` 섹션이 없다. "왜 pass-through 인가" 설명이 §10 본문에 인라인으로 포함되어 있어 규약이 권장하는 섹션 분리를 따르지 않는다.
- 제안: 문서 말미에 `## Rationale` 섹션을 두고, `§10 Pass-through 컨트랙트`·`§4 errorPolicy` 등의 설계 근거를 이관한다. 기존 §10 의 "왜 pass-through 인가" 단락은 간단한 포워딩 문구로 교체한다.

---

### [WARNING] `spec/4-nodes/1-logic/12-background.md` — Rationale 섹션이 포트 정의(§3) 다음에 위치

- target 위치: `spec/4-nodes/1-logic/12-background.md` 의 `## Rationale` 섹션 위치 (§8 모니터링 API 끝 직후)
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 권장 (Overview / 본문 / Rationale)"; 관례적으로 Rationale 은 문서 **끝**에 위치
- 상세: `background.md` 는 실제로 `## Rationale` 섹션을 보유하고 있고 문서 끝에 배치되어 있어 이 점은 양호하다. 그러나 `## Rationale` 내부의 소절(URL 중첩 구조·페이지네이션·WebSocket 격리·AI Assistant 도구 노출)이 §8.1~§8.7 과 동등한 수준의 계층에서 인라인으로 혼용되어 Rationale 경계가 모호하다. 읽는 측에서 "구현 명세(§8)"와 "결정 근거(Rationale)"의 경계를 식별하기 어렵다.
- 제안: `## Rationale` 을 §8 뒤의 독립 H2 섹션으로 유지하되, 내부 소절 제목에 `### Rationale — URL 중첩 구조` 처럼 prefix 를 붙여 명세 소절과 구분한다. 또는 §8 본문의 인라인 결정 근거는 간략한 포워딩(`상세: § Rationale`)으로 교체하고 Rationale 에 집중한다.

---

### [WARNING] `spec/4-nodes/1-logic/2-switch.md` — `warningRule.when` 표현식이 블랙리스트 형태로 잔존 (§8.2 명시 follow-up 의 불일치)

- target 위치: `spec/4-nodes/1-logic/2-switch.md` §8.2, `warningRule.when` 관련 설명
- 위반 규약: `spec/conventions/node-output.md` Principle 0 (5필드 invariant 일관성), 규약의 "금지 패턴을 답습하지 않는가" 관점
- 상세: `§8.2 신규 mode 추가 가이드라인` 의 step 4 에 "현재 `'mode != expression && !switchValue'` 형태는 블랙리스트라 신규 mode 추가 시 의도와 다른 발화 가능"이라고 명시하면서도 별 follow-up 으로 미루고 있다. 이 상태에서 구현 착수 시 `warningRule.when` 의 실제 코드가 블랙리스트 형태로 구현될 위험이 있다.
- 제안: 구현 착수 전 `warningRule.when` 의 화이트리스트 전환 여부를 명확히 결정한다. 전환 예정이면 spec 본문에 "구현 시 `'mode in [value] && !switchValue'` 로 작성한다"고 명시하거나, 보류 결정이면 미구현 마킹(`⚠ P2`)으로 명확히 표기한다.

---

### [WARNING] `spec/4-nodes/1-logic/11-merge.md` §5 — `meta.durationMs` 가 JSON 예시에는 `0` 으로 포함되나 상세 표에서 누락

- target 위치: `spec/4-nodes/1-logic/11-merge.md` §5.1 필드 표
- 위반 규약: `spec/conventions/node-output.md` Principle 11 "출력 예시 문서화 규칙 — 선택적 필드는 표에 `?` 표기"; Principle 2 "`meta.durationMs` 는 공통 필수"
- 상세: §5.1 의 JSON 예시(`"durationMs": 0` 포함)와 달리, 바로 아래 필드 표에서 `meta.durationMs` 항목이 목록 상에 없다(나머지 `meta.inputCount`, `meta.strategy` 등은 있다). 엔진이 주입하는 공통 필드인데 표에서 빠져 있어 구현자가 이 필드를 핸들러에서 채워야 하는지 오해할 수 있다.
- 제안: §5.1 필드 표에 `meta.durationMs | number | engine inject | 실행 시간 (ms)` 행을 추가한다. `if-else.md`, `switch.md` 등 다른 Logic 노드들은 해당 행이 존재하므로 일관성 회복이다.

---

### [WARNING] `spec/4-nodes/1-logic/10-parallel.md` — `output.count` 제거 결정이 `spec/conventions/node-output.md` Principle 9.2 와 불일치

- target 위치: `spec/4-nodes/1-logic/10-parallel.md` §5.2 `output.count` 주석 및 §5.7
- 위반 규약: `spec/conventions/node-output.md` Principle 9.2 "Container 노드 최종 output 형태: `parallel` → `{ branches: [...], count: N }`"
- 상세: `parallel.md` §5.2 주석에 "`count` 필드는 제거됨 (P1.1 직교성 — `branches.length` 가 SSOT)"라고 선언했다. 그러나 `spec/conventions/node-output.md` Principle 9.2 의 표에는 여전히 `parallel → { branches: [branch_0_result, branch_1_result, ...], count: N }` 으로 `count` 가 포함되어 있다. 두 문서가 상충한다.
- 제안: `spec/conventions/node-output.md` Principle 9.2 의 `parallel` 행에서 `count: N` 을 제거하거나, `parallel.md` 의 "count 제거" 결정을 취소한다. 단일 진실 원칙 상 conventions 의 Principle 9.2 가 상위 규약이므로, conventions 를 갱신하면서 "parallel 만 count 를 제외한다" 근거를 `## Rationale` 또는 인라인 주석으로 명시하는 것이 권장된다. `project-planner` 역할에서 `spec/conventions/node-output.md` 를 수정해야 한다.

---

### [CRITICAL] `spec/conventions/node-output.md` Principle 9.2 와 `parallel.md` 의 충돌 — invariant 파손 위험

- target 위치: `spec/4-nodes/1-logic/10-parallel.md` §5.2, `spec/conventions/node-output.md` Principle 9.2
- 위반 규약: CLAUDE.md "정식 규약 → `spec/conventions/<name>.md`"; CLAUDE.md "단일 진실 원칙"
- 상세: conventions 는 모든 컨테이너 노드의 최종 output 에 `count: N` 이 포함된다고 선언(Principle 9.2)하며, 다운스트림이 이 invariant 를 가정한다. `parallel.md` 가 독자적으로 `count` 를 제거한 경우, 다운스트림 expression (`$node["P"].output.count`)을 사용하는 코드나 문서는 Parallel 에서 `undefined` 를 받게 된다. 이는 "채택 시 다른 시스템이 가정한 invariant 가 깨짐" 에 해당한다. 구현자가 `parallel.md` 만 보고 구현하면 `loop`, `foreach`, `map` 과 비대칭인 구현이 나온다.
- 제안: 구현 착수 전 반드시 둘 중 하나를 선택하고 양쪽 문서를 동기화해야 한다:
  - **(권장)** conventions Principle 9.2 에서 `parallel` 의 `count` 를 제외하는 예외를 명문화 + Rationale 에 "parallel 은 `branches.length` 가 SSOT" 기재 + `loop`, `foreach`, `map` 은 `count` 유지.
  - **(대안)** `parallel.md` 의 "count 제거" 결정을 철회하고 `{ branches: [...], count: N }` 으로 복원.
  - 어느 경우든 `project-planner` 가 `spec/conventions/node-output.md` 수정을 담당해야 하며, 개발자는 conventions 가 확정된 후 구현에 착수해야 한다.

---

### [INFO] `spec/4-nodes/1-logic/3-loop.md` — 문서 끝이 payload 예시 중간에 잘림 (표시된 내용 한정)

- target 위치: `spec/4-nodes/1-logic/3-loop.md` 전체 (prompt_file 에서 truncation 으로 일부만 제공됨)
- 위반 규약: 검토 가능 범위 한정 사유 (payload truncation)
- 상세: 본 검토 payload 가 크기 제한으로 `loop.md` 를 일부만 포함한다. 실제 파일 전체에 대한 규약 준수 여부는 검토 완료되지 않았다. 특히 §5 출력 구조 및 `## Rationale` 유무는 현재 확인 불가.
- 제안: `loop.md` 전체를 별도 검토 패스에서 확인한다. 특히 `## Rationale` 섹션 유무 및 §5 출력 구조가 Principle 9 와 일치하는지 확인이 필요하다.

---

### [INFO] `spec/4-nodes/0-overview.md` §1.4 — 캔버스 요약 `summaryTemplate` 개요에 `## Overview` 섹션 미분리

- target 위치: `spec/4-nodes/0-overview.md` §1.4
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 권장 (Overview / 본문 / Rationale)"
- 상세: `0-overview.md` 에 `## 1. 노드 아키텍처`처럼 번호 붙은 섹션들이 바로 시작되며 권장하는 `## Overview` 섹션이 없다. 문서 최상단 링크 블록이 개요 역할을 하고 있으나, Overview / 본문 / Rationale 의 명시적 3섹션 구분이 보이지 않는다.
- 제안: 문서 서두에 `## Overview` 섹션을 추가하고 "노드 시스템의 역할, 이 문서의 범위, 하위 문서와의 관계"를 1~3문장으로 요약한다. 기존 `## 1. 노드 아키텍처`는 그대로 유지한다.

---

### [INFO] `spec/4-nodes/1-logic/12-background.md` §8.1 API endpoint — swagger.md 규약 부합 여부

- target 위치: `spec/4-nodes/1-logic/12-background.md` §8.1 엔드포인트 정의
- 위반 규약: `spec/conventions/swagger.md` §5-4 "경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용"
- 상세: spec 문서이므로 직접 데코레이터를 포함하지 않지만, `GET /api/executions/:executionId/background-runs/:backgroundRunId` 의 두 path 파라미터가 모두 UUID 임이 spec 에 명시되어 있다. 구현 시 swagger 규약에 따라 두 파라미터 모두 `@ApiParam({ format: 'uuid' })` 가 적용되어야 하는데, 이 요건이 spec 문서에 명시되지 않아 구현자가 누락할 수 있다.
- 제안: §8.1 엔드포인트 정의 하단에 "구현 시 두 path 파라미터에 `@ApiParam({ format: 'uuid' })` 적용 필요 (`spec/conventions/swagger.md` §5-4)" 주석을 추가한다.

---

## 요약

`spec/4-nodes/` 대상 Logic 카테고리 노드 스펙 전반의 정식 규약 준수 수준은 대체로 양호하다. Principle 0~11 의 5필드 invariant, config echo 원칙, Pass-through 컨트랙트, 에러 코드 정의, 출력 예시 문서화 등 핵심 규약은 충실히 반영되어 있다. 그러나 `spec/conventions/node-output.md` Principle 9.2 가 모든 컨테이너 노드의 최종 output 에 `count: N` 이 포함된다고 규정하는 반면, `parallel.md` 가 독자적으로 `count` 를 제거한 상태로 두 문서가 충돌하는 **CRITICAL** 문제가 존재한다. 이 불일치는 구현 착수 전 반드시 `project-planner` 역할에서 conventions 를 갱신하거나 `parallel.md` 를 복원하여 단일 진실로 수렴시켜야 하며, 그 전까지 개발자는 `parallel` 노드의 `count` 포함 여부에 대해 어느 문서를 따를지 확정 불가 상태다. 그 외 WARNING 수준으로는 `switch.md` 의 `warningRule.when` 블랙리스트 잔존 및 `merge.md` 의 `meta.durationMs` 표 누락이 있으며, INFO 수준으로 다수 문서에서 `## Rationale` 섹션 부재와 `## Overview` 섹션 미분리가 관찰된다.

---

## 위험도

**HIGH**

(CRITICAL 항목 1건 — conventions 와 노드 spec 간 `count` 필드 충돌로 구현 착수 시 다른 컨테이너 노드들과 비대칭 구현이 발생할 수 있으며, 다운스트림 expression 을 사용하는 코드에서 `parallel` 만 `undefined` 를 반환하는 silent 버그로 이어질 수 있음)
