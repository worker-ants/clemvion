# Rationale 연속성 검토 — interaction-type-registry.md (--impl-done)

## 점검 배경

target 변경은 `spec/conventions/interaction-type-registry.md` §1.2 매트릭스·rule 3·`REGISTRY_SITES` 목록 갱신뿐이다 (`git diff origin/main -- spec/conventions/`: 1 파일, 6 라인 변경). 배경 구현: `use-result-detail-waiting.ts` 신규 hook 이 drawer(`run-results-drawer.tsx`)와 실행 상세 page(`.../executions/[executionId]/page.tsx`) 양쪽이 각자 유도하던 `WaitingInteractionType` 4값(`form`/`buttons`/`ai_conversation`/`ai_form_render`) exhaustive 파생을 `deriveFlags` 단일 함수로 흡수한 리팩터(V-05 후속, ai-review W-1 후속 fix 포함, 커밋 `b6a9c6cf5`+`358f12ca1`).

> 주의: orchestrator 가 준 `_prompts/rationale_continuity.md` payload(2141라인)는 `spec/conventions/` 전체를 번들링했으나 실제로는 `cafe24-api-catalog/**` 등 무관 파일만 담겼고, 정작 대상 파일 `interaction-type-registry.md` 는 payload 안에 존재하지 않았다(grep 0건). 이는 orchestrator 측 payload 조립 버그로 보이나, 본 검토는 절대경로 워킹트리에서 대상 파일·diff·구현 코드를 직접 재확인해 진행했다(위 "impl-done" 경고 규칙 준수).

## 검토 관점별 확인

### 1. 기각된 대안의 재도입
없음. 이번 변경은 §4 Rationale 이 명시한 "기각된 대안" 을 재도입하지 않는다 — §4 Rationale 자체는 이번 diff 에서 **한 글자도 변경되지 않았다** (`git diff` 확인: 변경 라인은 §1.2 표 4행 + rule 3 + resume 노트 참조번호뿐, §4 "Rationale" 섹션은 그대로).

### 2. 합의된 원칙 위반
없음. §4 Rationale 이 못박은 **3중 가드**(① 매트릭스 SoT, ② AST 가드 `REGISTRY_SITES`, ③ TS exhaustive switch)는 이번 변경 후에도 전부 유지된다:
- 매트릭스: §1.2 4행이 그대로 존재, 소비처 표기만 drawer/page 분리 표기(d)/(e) → hook 단일 표기(d)로 갱신.
- AST 가드: `interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 가 4개→3개 파일로 축소됐지만, 축소된 이유는 **동일 파생 로직이 물리적으로 한 파일(`use-result-detail-waiting.ts`)로 합쳐졌기 때문**이며 가드 자체가 약화된 것이 아니다 — 실제 코드(`REGISTRY_SITES` 배열, 3개 항목: `use-execution-events.ts`, `apply-execution-snapshot.ts`, `use-result-detail-waiting.ts`)로 직접 확인.
- TS exhaustive: `deriveFlags` 는 여전히 4값 전체(`form`/`buttons`/`ai_conversation`/`ai_form_render`)를 다루며 `isWaitingConversation` 이 `ai_conversation`·`ai_form_render` 를 합집합으로 흡수하는 기존 뉘앙스(§1.2 `ai_form_render` 행의 "별도 formPreview stack 아님")를 코드(`use-result-detail-waiting.ts` 주석 + 로직)와 spec 문서가 정확히 일치시켜 기술한다.

### 3. 결정의 무근거 번복
없음. 이번 변경은 결정 자체(무엇을 3중 가드로 지킬 것인가)를 뒤집는 것이 아니라 **소비처 구조**(drawer+page 개별 파생 → hook 단일 파생)만 바꾸는 리팩터이며, spec 문서 자체가 이 리팩터 배경을 §1.2 매트릭스 셀 안에 즉시 반영했다("두 소비처가 hook 에 위임"). 별도 `## Rationale` 신설 없이 매트릭스·rule 갱신만으로 충분한 수준의 변경 — 기존 §4 Rationale 의 "N개 분기 위치 응집" 취지에 오히려 더 부합한다(분기 위치가 줄어들수록 회귀 위험이 준다).

### 4. 암묵적 가정 충돌
없음. rule 3 갱신 텍스트가 `isLiveConversation`(drawer 잔여 subset 소비처, `ai_conversation`·`ai_form_render` 2값만 구분하는 plain `||` 비교)을 "두 가드(grep·TS exhaustive) 어느 쪽도 아니며 신규 enum 값은 자동으로 non-live 처리" 라고 명시한 것을 실제 코드(`run-results-drawer.tsx` 의 `isLiveConversation` 계산부)로 대조했다 — 정확히 일치. 이는 §1.3(리터의 ai-review W-1 fix, 커밋 `358f12ca1`)에서 "TS 로만 커버" 라는 부정확한 최초 표기를 정정한 것으로, invariant 우회가 아니라 기존 서술의 정확도 개선이다.

### 부가 확인 — 레터 renumbering 정합성
§1.2 `ai_form_render` 행의 resume 참조가 "(g)" → "(f)" 로, §1.2 아래 resume 노트의 "(g) 참조" 도 "(f) 참조" 로 동시 갱신됐음을 diff·현재 파일 양쪽에서 확인. drawer(d)+page(e) 병합으로 발생한 레터 갭이 ai-review W-1 로 이미 한 차례 잡혀 정정됐고(커밋 `358f12ca1`), 현재 HEAD 파일에서 (a)~(f) 연속 확인 — 갭 없음.

## 발견사항

없음.

## 요약

이번 변경은 `interaction-type-registry.md` §4 Rationale 이 확립한 3중 가드(매트릭스 SoT·AST `REGISTRY_SITES`·TS exhaustive switch) 설계를 그대로 유지한 채, 물리적 소비처를 drawer+page 2곳에서 공용 hook `use-result-detail-waiting.ts` 1곳으로 응집한 순수 리팩터다. §4 Rationale 텍스트 자체는 변경되지 않았고, 매트릭스·rule 3·`REGISTRY_SITES`·resume 노트 참조번호가 코드 현황과 정확히 일치하도록 동시 갱신됐다. 과거 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다 — 오히려 ai-review 라운드(W-1)를 거쳐 레터 연속성·`isLiveConversation` 서술 정확도까지 보강된 상태다.

## 위험도

NONE
