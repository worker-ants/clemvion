# Cross-Spec 일관성 검토 결과

검토 대상: M-3 3단계 — WorkflowAssistantStreamService 에서 `persistAssistantTurn` + `makeResumeMeta` + 사용자/assistant 메시지 영속 로직을 무상태 `AssistantTurnPersistenceService`(`tools/assistant-turn-persistence.service.ts`)로 분리. behavior-preserving 백엔드 리팩터. spec 변경 없음.

대상 spec: `spec/3-workflow-editor/4-ai-assistant.md`

---

## 발견사항

발견된 CRITICAL/WARNING 항목 없음.

### [INFO] 새 서비스 파일이 spec `code:` 배열에 미등재

- target 위치: 해당 없음 (신규 파일 생성)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` 배열
- 상세: spec frontmatter `code:` 는 `codebase/backend/src/modules/workflow-assistant/**/*.ts` glob 을 이미 포함하므로 새로 생성되는 `tools/assistant-turn-persistence.service.ts` 파일은 실제로 해당 glob 에 의해 자동 커버된다. 별도 항목 추가가 필수는 아니지만, 1단계(`AssistantToolRouter`) 및 2단계(`AssistantFinishGuard`) 에서도 동일 glob 으로 커버됐으므로 일관성 상 신규 spec 행 추가는 불필요하다.
- 제안: 현 상태 유지 (glob 커버). 선택적으로 `## Rationale` 에 분리 패턴 설명을 M-3 완료 후 일괄 추가 가능.

### [INFO] `persistAssistantTurn` 시그니처가 spec §9 에 기술되어 있으나 분리 후 호출 계층이 달라짐

- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §9 (persistAssistantTurn 시그니처 확장 언급)
- 충돌 대상: 동일 문서 내 §9 의사코드 (`await this.persistAssistantTurn(...)`)
- 상세: spec §9 는 `WorkflowAssistantStreamService` 가 `persistAssistantTurn` 을 직접 호출하는 것처럼 기술되어 있다. 3단계 리팩터 이후 실제 구현은 `AssistantTurnPersistenceService.persistAssistantTurn(...)` 를 `WorkflowAssistantStreamService` 가 위임 호출하는 구조가 되지만, 외부 계약(HTTP API, SSE 이벤트, DB 스키마)에는 변화가 없다. 의사코드가 구체 클래스를 특정하지 않는 한 spec 위반은 아니다.
- 제안: spec 의사코드가 클래스 이름을 명시하고 있다면 M-3 완료 후 `AssistantTurnPersistenceService` 로 참조를 갱신. 현재 구조(glob 커버 + behavior-preserving)에서 CRITICAL/WARNING 수준 충돌 아님.

---

## 요약

M-3 3단계는 behavior-preserving 백엔드 내부 리팩터로, 외부 API 계약·SSE 이벤트 형식·DB 스키마·RBAC·상태 전이에 변경이 없다. 대상 spec(`spec/3-workflow-editor/4-ai-assistant.md`)의 데이터 모델(`AssistantSession`, `AssistantMessage`)·요구사항 ID·권한 모델은 이번 변경에 영향을 받지 않는다. 다른 영역(spec/0-overview, spec/1-data-model, spec/5-system/*)과의 교차 충돌도 없다. 발견사항은 모두 INFO 등급(glob 커버·의사코드 선택적 동기화)이며, 구현 착수를 차단할 이슈가 없다.

## 위험도

NONE
