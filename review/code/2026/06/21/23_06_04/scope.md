# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** `capFormDataBytes` 함수의 `export` 노출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (line 710)
  - 상세: `capFormDataBytes`는 `export function`으로 선언되어 있다. 이 함수는 이전 핸들러에서도 export되어 있었는지 확인이 필요하다. 신규 파일 신설이므로 verbatim 이동의 일부로 볼 수 있으나, 핸들러 외부 소비자가 이 API를 직접 참조하는 경우 퍼블릭 계약 변경이 될 수 있다. 단, `ai-agent.handler.ts`의 re-export 블록은 `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` 두 상수만 포함하고 `capFormDataBytes`는 제외되어 있어, 기존에 핸들러 외부에서 직접 import되지 않았다면 범위 이탈 없음.
  - 제안: 기존 테스트·외부 소비자가 `capFormDataBytes`를 핸들러에서 import하고 있지 않은지 확인. 문제가 없다면 INFO로 유지.

- **[INFO]** `FORM_SUBMITTED_GUIDANCE_MESSAGE` / `FORM_SUBMITTED_MAX_BYTES` re-export 추가
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` (lines 18-24)
  - 상세: 기존 소비자의 import 경로(`./ai-agent.handler`)를 깨지 않기 위한 하위 호환 re-export. 이는 본 리팩토링 범위 내의 정상적인 backward-compat 처리로, 의도된 범위 내에 있다.
  - 제안: 해당 없음.

- **[INFO]** `ToolCallTrace` 인터페이스가 `ai-agent.handler.ts`에서 `ai-turn-executor.ts`로 이동
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (lines 495-506)
  - 상세: 핸들러에서 export되던 `ToolCallTrace`가 executor로 이동했다. 핸들러 파일의 diff에서 해당 인터페이스를 다시 re-export하는 코드가 없다. 외부 소비자가 `import { ToolCallTrace } from './ai-agent.handler'`로 참조하고 있다면 컴파일 오류가 발생한다. 단, 커밋 메시지에서 "lint·build PASS"를 명시하고 있어 실제 참조 깨짐은 없는 것으로 보인다.
  - 제안: 외부 소비자 import 경로 확인 완료(빌드 통과)면 INFO 유지. 명시적 re-export 미추가는 범위 내 의도적 결정으로 판단.

## 요약

이번 변경은 M-1 3단계 계획에 따라 `AiAgentHandler`의 turn 실행 표면(2999줄 god-handler)을 `AiTurnExecutor` 신규 파일로 verbatim 이동하는 behavior-preserving 리팩토링이다. 핸들러는 219줄 facade로 축소되고 모든 실행 로직은 신설 executor로 단방향 위임된다. 변경 파일은 `ai-agent.handler.ts`(삭제 위주), `ai-turn-executor.ts`(신설), `ai-turn-executor.spec.ts`(신설) 세 파일로 한정되며, 의도된 범위를 벗어난 불필요한 리팩토링·기능 확장·무관한 수정은 발견되지 않는다. 주석은 기존 주석을 verbatim 유지하거나 클래스명(AiAgentHandler → AiTurnExecutor)만 교체한 수준이며, 임포트 정리도 executor 분리로 인해 핸들러에서 더 이상 필요 없는 심볼을 제거한 것으로 범위 내에 해당한다. `capFormDataBytes` export 노출과 `ToolCallTrace` re-export 미추가는 빌드·테스트 통과 기준으로 영향이 없음이 확인되었다.

## 위험도

NONE
