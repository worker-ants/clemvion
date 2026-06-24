# 신규 식별자 충돌 검토 결과

## 발견사항

### 요약 (충돌 없음)

M-3 3단계가 도입하는 신규 식별자는 다음과 같다.

| 신규 식별자 | 종류 | 파일 경로 |
|---|---|---|
| `AssistantTurnPersistenceService` | NestJS Injectable 클래스명 | `tools/assistant-turn-persistence.service.ts` |
| `makeResumeMeta` (함수, 동일 파일로 이동) | 모듈 레벨 export 함수 | `tools/assistant-turn-persistence.service.ts` |
| `assistant-turn-persistence.service.ts` | 파일 경로 | `codebase/backend/src/modules/workflow-assistant/tools/` |

**검토 결과: 6개 관점 모두 충돌 없음.**

---

1. **요구사항 ID 충돌** — target 이 새 요구사항 ID 를 부여하지 않는다. spec 변경 없음이 plan 에 명시되어 있고, 대상 spec `spec/5-system/4-ai-assistant.md` 의 기존 ID 체계(`ED-AI-*`)를 건드리지 않는다. 충돌 없음.

2. **엔티티/타입명 충돌** — `AssistantTurnPersistenceService` 는 기존 코드베이스에 동명 클래스가 없다. 인근 선례인 `AssistantToolRouter`(`assistant-tool-router.service.ts`)·`AssistantFinishGuard`(`assistant-finish-guard.service.ts`) 와 동일 `Assistant*` prefix 패턴을 따르며 의미상 충돌이 없다. `makeResumeMeta` 는 현재 `workflow-assistant-stream.service.ts` 의 모듈-스코프 private 함수로만 존재하므로 이동(export 승격) 후 충돌이 발생하지 않는다 — 원본은 삭제 대상. 충돌 없음.

3. **API endpoint 충돌** — 순수 백엔드 리팩터이며 새 endpoint 를 도입하지 않는다. 충돌 없음.

4. **이벤트/메시지명 충돌** — 새 이벤트명·큐명·SSE 이벤트명 도입 없음. 충돌 없음.

5. **환경변수·설정키 충돌** — 새 ENV var, config key 도입 없음. 충돌 없음.

6. **파일 경로 충돌** — `tools/assistant-turn-persistence.service.ts` 는 기존 `tools/` 디렉토리에 없는 신규 파일이다. 기존 파일 목록(`assistant-tool-router.service.ts`, `assistant-finish-guard.service.ts`, `candidate-lookup.service.ts`, `explore-tools.service.ts` 등)과 중복되지 않는다. 네이밍 패턴(`<role>-<feature>.service.ts`, kebab-case)도 기존 컨벤션과 일치한다. 충돌 없음.

---

### 추가 관찰 (INFO 수준)

- `makeResumeMeta` 함수가 `workflow-assistant-stream.service.ts` (원본) 와 `assistant-turn-persistence.service.ts` (이동 대상) 양쪽에 **동시에 존재**하는 상태가 현재 파일 시스템에서 확인됐다. 이는 구현이 이미 진행 중임을 시사한다. 원본 파일의 `makeResumeMeta` 와 `persistAssistantTurn` 을 삭제하는 작업이 동일 PR 에서 완료되어야 한다. 이는 식별자 충돌이 아니라 구현 완성도 문제이며, 현 검토 관점(착수 전)에서는 INFO 수준이다.

---

### 요약

M-3 3단계가 도입하는 신규 식별자(`AssistantTurnPersistenceService`, `makeResumeMeta` export, `assistant-turn-persistence.service.ts`)는 기존 spec ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 어디에도 충돌하지 않는다. 1단계(`AssistantToolRouter`)·2단계(`AssistantFinishGuard`)와 동일한 `tools/` 내 분리 패턴을 따르며 명명 컨벤션도 일치한다. `makeResumeMeta` 의 이중 존재는 구현 중간 상태로, 원본 삭제로 정리될 내용이다.

### 위험도

NONE
