# Rationale 연속성 검토 — spec/5-system/ (EIA 내부 읽기 경로 마스킹 followup)

## 검토 방법 메모
prompt_file 번들이 컨텍스트 예산 초과로 diff 원문·`4-execution-engine.md`·`1-auth.md` 등 다수 파일을 절단했으므로, 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서 `git diff origin/main` 을 직접 실행해 실제 target diff 를 확보하고, 관련 spec 의 `## Rationale` 원문과 구현 코드(`executions.service.ts`, `redact-stored-error.ts`)를 절대경로로 직접 열어 대조했다. 이번 diff 범위: `spec/5-system/14-external-interaction-api.md`(§R17) · `spec/5-system/6-websocket-protocol.md`(§4.1 이벤트 표) · `spec/1-data-model.md`(§2.14) · `spec/2-navigation/14-execution-history.md`(R-5) · `spec/4-nodes/1-logic/12-background.md`(§8.2) · `spec/conventions/secret-store.md`(§1, working-tree 미커밋분 포함).

## 발견사항

- **[INFO]** R17 "갈리는 축은 REST↔WS 가 아니었다" 서술의 자기-인용 부정확
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17, "내부 읽기 경로도 같은 마스킹을 적용한다" 불릿의 "**갈리는 축은 REST↔WS 가 아니었다**" 하위 항목
  - 과거 결정 출처: 같은 §R17 의 직전(수정 전) 문구 — "**내부 REST 와의 비대칭은 미결이다**: `GET /api/executions/:id` 는 `Execution.error` 원문을 반환하므로 같은 컬럼을 두 표면이 다른 값으로 말한다."
  - 상세: 새 문구는 "종전 서술이 이 갭을 '내부 REST vs WS' 라 불렀는데" 라고 인용하지만, 실제 이전 문구는 "내부 REST 와의 비대칭" 이라고만 했고 "vs WS" 라는 명시적 이분법을 쓰지 않았다. 실질적 의미(=이 문서의 종결 emit 4곳은 이미 마스킹되어 있어 독자가 "WS 는 이미 안전"이라 오인하기 쉬웠던 맥락)는 합리적 해석이라 조작된 이력은 아니지만, 인용 자체는 원문과 축자적으로 일치하지 않는다.
  - 제안: "종전 서술이 이 갭을 '내부 REST vs WS' 라 불렀는데" → "종전 서술은 이 갭을 'REST 표면' 으로만 좁혀 불렀는데(§R17 구판, 미결 표기)" 등으로 인용을 원문에 맞게 정정. 판정을 막는 수준은 아니라 INFO.

## 정합성 확인 — 위반 없음 (근거 기록)

아래는 "충돌일 수 있어 보이나 실측 결과 위반이 아님"을 확인한 항목이다 (오탐 방지 목적으로 기록):

1. **§R17 구판의 "미결(open item)"을 이번에 확정** — 과거 Rationale 은 "내부 REST 마스킹 여부는 아직 정하지 않았다" 는 명시적 **미결** 상태였지 기각된 대안이 아니었다. 이번 target 은 그 미결을 결정으로 전환하면서 근거(형제 필드 우회·R-5 원용·잔여 3가지 명시)를 **같은 커밋 안에** 함께 기술했다 — 검토 관점 3("결정의 무근거 번복")의 요구를 충족한다.
2. **`egress-only` invariant 준수 확인** — §R17 기존 원칙("내부 소비처는 faithful 텍스트 유지, DB 는 원문 보존")을 이번 확장이 우회하지 않는다: 코드 확인 결과 `redactStoredErrorForResponse` 는 `ExecutionsService.findById`/`getChain`/`stop`/`toExecutionDto` 4개의 **API 응답 조립 지점에서만** 호출되고, DB write 경로·재시도/체인 판단 등 내부 로직에는 적용되지 않는다(`toResponseExecution` 이 응답 직전 관문, `findById` 결과는 재-run 응답 조립·WS snapshot emit 등 **모두 egress 용도**로만 소비됨을 grep 으로 확인). "DB 는 여전히 원문" 문구와 실제 구현이 일치한다.
3. **R-5(`spec/2-navigation/14-execution-history.md`) 원칙 원용의 스코프 오염 방지** — target 은 "R-5 의 boundary masking parity 원칙은 근거로 원용됐을 뿐, R-5 가 `Execution.error`/`nodeExecutions[].error` 를 이미 규정하진 않았다" 고 명시적으로 선을 그어, 두 정책(Config echo=write-time 마스킹 vs error=egress-time 마스킹)을 혼동하지 않도록 방어한다. 이는 프로젝트가 반복 겪은 "넓게 읽으면 잘못된 결론" 실패 패턴을 스스로 경계한 선례(§R17 자신의 "적용 범위는 총칭이 아니라 열거" 문구와 같은 계열)와 일치한다.
4. **`secret-store.md` 신규 비대상 예외(`Trigger.config.interaction.triggerToken`)** — 문서 서두 원칙("모든 도메인 모듈은 SecretResolver 를 경유")에 대한 예외 신설이지만, (a) 기존 `AuthConfig.config` 예외와 "같은 종류가 아님"을 명시 구분하고, (b) 근거 a/b/c 를 독립적으로 세우고, (c) "평문 보관 일반의 선례로 인용 금지" 캐비엇까지 두었다 — 검토 관점 1(기각 대안 재도입)·2(원칙 위반)에 해당하는 실패 패턴을 이 문서 스스로 명시적으로 막아 놓았다. 인용된 review 세션(`17_12_34`, `18_14_50`)도 `review/code/2026/08/16/` 하위에 실재해 이력 조작이 아님을 확인했다.
5. **`spec/4-nodes/1-logic/12-background.md` §8.4 권한 정책과의 정합** — "역할 기반 추가 제한 미구현, workspace 멤버면 viewer 도 조회 가능"이라는 기존 문서화된 정책이 새 마스킹 근거("viewer 포함 전원이 조회하고 프런트가 배너에 원문을 렌더")와 정확히 부합한다 — 새 결정이 기존 §8.4 서술을 뒤집지 않는다.
6. **잔여 갭의 정직한 열거** — target 은 "적용 범위는 총칭이 아니라 열거"라며 잔여 3가지(① WS `execution.node.*` emit 원문 ② `inputData`/`outputData` 비대칭 미해결 ③ workflow-assistant LLM 도구의 키-기반 마스킹과 값-마스킹 단순 합성 금지 + 그 이유)를 명시했다. 이는 "문서화된 보장이 구현보다 넓으면 안 된다"는 이 저장소의 반복 실패 패턴을 스스로 예방한 것으로, Rationale 연속성 관점에서 모범적이다.

## 요약

이번 target(§R17 "내부 읽기 경로" 마스킹 확장·WS `execution.snapshot` 캐비엇·`1-data-model.md` §2.14 신규 행·`12-background.md` §8.2 캐비엇·`secret-store.md` 신규 명시적 비대상 예외)은 과거 Rationale 에서 **명시적으로 기각된 대안을 재도입하지 않았고**, 오히려 이전에 "미결"로 남아 있던 항목을 결정으로 전환하면서 근거·기각 사유·잔여 스코프를 같은 변경 안에 충실히 기술했다. `egress-only`/`boundary masking parity`/`Roles 게이트 없음` 등 기존에 박혀 있던 설계 원칙과도 충돌 없이 정합했으며, 코드 확인 결과 문서 서술과 구현이 일치했다(과대 서술 없음). 유일한 발견은 §R17 안에서 자기 자신의 구판 문구를 인용할 때 축자적으로 정확하지 않은 표현 하나이며, 판정을 막을 수준은 아니다.

## 위험도
LOW
