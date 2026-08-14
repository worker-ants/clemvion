# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 조사 방법

`git diff origin/main -- spec/5-system/` 결과, 이번 target 의 실제 diff 는
`spec/5-system/14-external-interaction-api.md` **1개 파일, 11줄**(§6.2 종결 이벤트 필드
표의 `error`/`durationMs` 비고 갱신 + §6.4 `code` null 사유 설명 확장)뿐이다. 새 요구사항
ID·새 엔티티/DTO·새 API endpoint·새 이벤트명·새 ENV 변수·새 spec 파일 경로는 **diff 안에
전혀 도입되지 않았다** — 기존 EIA-* ID·기존 endpoint·기존 이벤트명을 그대로 재참조하며
서술만 정정한 문서 diff다.

Diff 가 유일하게 새로 언급하는 이름은 코드 심볼 `toTerminalErrorPayload` 이므로, 대응하는
구현(HEAD 워킹트리, `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts`
— 신규 파일, diff stat `+82/-0`)을 절대경로로 확인해 충돌 여부를 점검했다.

## 발견사항

- **[INFO]** `toTerminalErrorPayload` / `TerminalErrorPayload` — 유일한 신규 식별자, 충돌 없음
  - target 신규 식별자: `TerminalErrorPayload` 인터페이스 + `toTerminalErrorPayload()` 함수
    (`codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:36,48`, 신규 파일)
  - 기존 사용처: 전역 grep(`git grep -n "TerminalErrorPayload"`) 결과 이 신규 파일과 그
    호출부(`execution-engine.service.ts:204,664,3314,4872`, `retry-turn.service.ts:4,966`,
    `terminal-error-payload.spec.ts`) 외 다른 정의는 없음. 파일 경로 `terminal-error-payload.ts`
    도 같은 디렉터리의 기존 `sanitize-error-message.ts` / `workflow-errors.ts` kebab-case
    컨벤션과 일치하며 기존 파일과 겹치지 않는다.
  - 상세: spec §6.2 는 `toTerminalErrorPayload` 를 코드 심볼로만 인용한다(예: 기존에도
    `ErrorPortFallbackError`/`ExecutionTimeLimitError` 를 같은 방식으로 인용해 온 이 문서의
    기존 관행과 동일). 다만 같은 `execution-engine` 모듈 안에 개념적으로 유사한 이름의
    **다른** 헬퍼가 이미 존재한다 — `AiTurnOrchestrator.extractAiTurnErrorPayload()`
    (`ai-turn-orchestrator.service.ts:1313`, AI turn 예외 → `{code,message,details}` 분류)와
    프런트 `extractNodeErrorPayload()`(`codebase/frontend/src/lib/websocket/use-execution-events.ts:61`,
    노드 실행 에러 추출). 셋 다 "…ErrorPayload" 를 이름에 포함하지만 서로 다른 계층(터미널
    execution wire 표현 vs AI turn 에러 분류 vs 프런트 노드 에러 파싱)을 다루고, 동사 접두사도
    제각각(`to*` vs `extract*`)이라 실제 이름 충돌(동일 식별자·다른 의미)은 아니다.
  - 제안: 실제 충돌이 아니므로 액션 불요. 추후 이 계열 헬퍼를 더 늘릴 경우
    `to<X>ErrorPayload`(DB/이벤트 shape → wire 정규화) vs `extract<X>ErrorPayload`(예외 객체 →
    분류) 의 접두사 구분을 컨벤션으로 명시하면 grep 탐색성이 좋아진다는 정도의 참고사항.

## 요약

target diff 는 `spec/5-system/14-external-interaction-api.md` 한 파일의 서술 정정 11줄뿐이며,
새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV 변수·spec 파일 경로 중 어느 것도 신규
도입하지 않았다. diff 가 유일하게 언급하는 신규 코드 심볼 `toTerminalErrorPayload`/
`TerminalErrorPayload` 는 HEAD 워킹트리 전수 grep 으로 다른 정의와 충돌하지 않음을 확인했고,
파일 경로도 기존 명명 컨벤션을 따른다. 같은 모듈 내 유사 이름의 기존 헬퍼(`extractAiTurnErrorPayload`)와
표면적 이름 유사성이 있으나 동일 식별자가 아니라 CRITICAL/WARNING 대상은 아니다.

## 위험도

NONE
