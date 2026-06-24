# 신규 식별자 충돌 검토 — C-2 1차 슬라이스 (executeSingleTurn 분해)

## 검토 범위

대상: `03-maintainability C-2` 1차 슬라이스 — `AiTurnExecutor.executeSingleTurn` (~545줄)을
spec §6.1 단계에 정렬한 private 메서드들로 behavior-preserving 분해.

본 작업은 **순수 리팩토링**이다. spec 변경 불요, 새 엔티티/API/이벤트/ENV 변수/파일 경로 미도입.

---

## 발견사항

신규 식별자가 명시적으로 확정되지 않은 상태에서 검토를 수행했다. 계획서(`03-maintainability.md §C-2`)가 예시하는 추출 후보 메서드명과 기존 코드를 대조했다.

### INFO — 기존 `build*` 네임스페이스와 신규 추출 메서드명 계열의 명명 일관성

- **target 신규 식별자**: 계획서가 제안하는 추출 메서드 이름군 — spec §6.1 단계를 따른 이름 (예: `buildSystemPrompt`, `buildMessages`, `injectSingleTurnContext` 계열 등). 실제 확정 이름은 구현 시 결정됨.
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 내 동일 클래스 `AiTurnExecutor` 의 기존 private 메서드들: `buildAiNodeRefFromContext` (:544), `buildAiNodeRefFromState` (:562), `buildConditionOutput` (:2737), `buildMultiTurnConfigEcho` (:2833), `buildMcpDiagnosticsMeta` (:2866), `buildTools` (:2873), `buildRetryState` (:2661).
- **상세**: `build*` 접두사가 클래스 내에서 이미 광범위하게 쓰이고 있어 신규 추출 메서드도 같은 접두사를 쓰면 의미상 충돌은 없다. 기존 `buildTools`(도구 목록 빌드, :2873)와 신규 추출 대상인 시스템 프롬프트 빌드·메시지 빌드는 대상 단계가 달라 실질 혼동 가능성이 낮다. 외부 import 함수 `buildSystemContextPrefixFromContext`(모듈 `shared/system-context-prefix`)와 신규 private 메서드(예: `buildSystemPrompt`)는 scope 가 다르므로 실제 충돌이 없다.
- **제안**: 추출 메서드 이름에 `SingleTurn` 한정어를 포함하거나(`buildSingleTurnSystemPrompt`, `buildSingleTurnMessages`) prefix 를 달리하면(`prepareSystemPrompt`) 클래스 내 기존 멀티턴/공통 `build*` 메서드와 시각적 구분이 명확해진다. 단 이는 선택 사항이며 기존 코드와의 실질 충돌 없음.

---

## 요약

이번 작업은 `AiTurnExecutor.executeSingleTurn` 의 내부 로직을 동일 클래스 내 private 메서드로 추출하는 behavior-preserving 리팩토링이다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·파일 경로 중 새로 도입되는 외부 노출 식별자가 없다. 추출될 private 메서드 이름은 클래스 내부에만 존재하며, 기존 `build*` 접두사 메서드 군과 의미상 겹치지 않는다. spec 변경 불요가 명시되어 있어 요구사항 ID 충돌도 발생하지 않는다. 전반적으로 식별자 충돌 위험이 없는 안전한 리팩토링이다.

## 위험도

NONE
