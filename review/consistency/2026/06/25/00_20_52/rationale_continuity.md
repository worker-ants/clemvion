# Rationale 연속성 검토 결과

## 발견사항

- **[INFO]** 단계 번호 순서 역전(1.7 → 1.3/1.5)이 diff 내 설명으로만 처리됨
  - target 위치: `ai-turn-executor.ts` diff, `executeSingleTurn` 리팩토링 주석 (단계 1.3·1.5 블록 주석)
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 단계 순서 열거 (1.3 → 1.5 → 1.7 순)
  - 상세: spec §6.1 은 단계 번호로 "1.3 회수 → 1.5 주입 → 1.7 ai_user push → 2 LLM 호출" 순서를 열거한다. 이번 diff 는 `buildSingleTurnMessages`(1.7)를 먼저 호출한 뒤 `applySingleTurnMemoryInjection`(1.3/1.5)을 뒤에 호출하는 구조를 채택하고, 그 이유("getThreadExcludingNode 가 self 노드 제외라 동일 결과")를 코드 주석에만 기술했다. 스펙 본문이나 Rationale 에는 이 실행 역전이 의도적 행위 보존 임을 기록하는 항목이 없다. 행위는 동등하지만, spec 단계 순서와 코드 호출 순서가 불일치하는 채로 남는다.
  - 제안: spec §6.1 1.7 항에 괄호 주석 한 줄("구현상 1.7 ai_user push 는 1.3/1.5 메모리 주입보다 먼저 실행되나 getThreadExcludingNode self 제외로 행위 동등 — 단계 번호는 논리 순서") 또는 ai-agent.md ## Rationale 에 "단계 호출 역전의 불변식 근거" 항 추가를 권장. 필수 차단은 아님.

- **[INFO]** 공유 accumulator 및 memoryStrategy caller scope 유지 합의 이행 확인
  - target 위치: `ai-turn-executor.ts` diff, `executeSingleTurn` 및 `applySingleTurnMemoryInjection` 파라미터 설계
  - 과거 결정 출처: `plan/in-progress/refactor/03-maintainability.md C-2` ("공유 accumulator·memoryStrategy caller scope 유지")
  - 상세: plan C-2 가 명시한 합의 원칙("ragAcc, mcpDiagnosticsAcc, presentationPayloads 등 공유 accumulator 는 caller scope 유지, memoryStrategy 는 caller 에서 1회 resolve")이 diff 에서 그대로 이행됐다. applySingleTurnMemoryInjection 에는 accumulator 를 전달하지 않으며, memoryStrategy 는 executeSingleTurn 에서 resolve 후 args 로 전달한다. 위반 없음.
  - 제안: 이행 적합. 추가 조치 불요.

- **[INFO]** buildSingleTurnSystemPrompt 순수 함수 설계 — §11.4 ordering 분리 원칙 정합
  - target 위치: `ai-turn-executor.ts` diff, `buildSingleTurnSystemPrompt` 메서드 시그니처 및 반환 타입
  - 과거 결정 출처: `spec/4-nodes/3-ai/0-common.md §11.4` — [1]~[4] systemPrompt 조립 단계와 [5] thread injection 을 명시적으로 분리
  - 상세: §11.4 는 [1]~[4] systemPrompt 조립과 [5] thread/memory 주입을 별개 단계로 분리한다. buildSingleTurnSystemPrompt 가 [1]~[4] 만 담당하고 side-effect 없이 string 을 반환하는 것은 이 ordering 분리를 정확히 구현한 것이다. 위반 없음.
  - 제안: 이행 적합. 추가 조치 불요.

## 요약

이번 C-2 1차 슬라이스(executeSingleTurn setup 단계를 §6.1 정렬 private 메서드 3개로 분해)는 spec/4-nodes/3-ai/1-ai-agent.md 및 spec/4-nodes/3-ai/0-common.md §11.4 의 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 설계 변경을 포함하지 않는다. plan C-2 의 "accumulator·memoryStrategy caller scope 유지" 합의 원칙도 diff 에서 그대로 이행됐다. 유일한 지적 사항은 spec §6.1 단계 열거 순서(1.3 → 1.5 → 1.7)와 실제 구현 호출 순서(1.7 먼저, 1.3/1.5 뒤)의 불일치가 코드 주석 수준으로만 정당화돼 있다는 점이다. 이는 행위 동등성이 보장된 의도적 선택이지만 spec Rationale 에 기록이 없어 추후 유지보수자가 오해할 여지가 있다. 전체적으로 Rationale 연속성 위험은 낮다.

## 위험도

LOW
