# 정식 규약 준수 검토 — M-3 3단계: AssistantTurnPersistenceService 분리

검토 범위: `diff-base=origin/main`, 구현 완료 후 (`--impl-done`).  
대상 spec: `spec/3-workflow-editor/4-ai-assistant.md`  
변경 파일:
- `codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` (신규)
- `codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.spec.ts` (신규)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (수정)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` (수정)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant.module.ts` (수정)

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### INFO 1 — `UsageSnapshot` 인터페이스 위치: tools/ 내 service 파일 정의
- target 위치: `assistant-turn-persistence.service.ts` L270–276 (`export interface UsageSnapshot { ... }`)
- 관련 규약: `spec/conventions/swagger.md §5-1` (응답 DTO 위치는 `dto/responses/` 하위)
- 상세: `UsageSnapshot` 은 SSE `usage` 이벤트 페이로드와 동형이라고 JSDoc 에 명시됐으며, persist 에만 쓰이는 내부 타입이다. swagger.md §5-1 의 응답 DTO 위치 규약(`dto/responses/*-response.dto.ts`)은 외부 노출 API 응답 DTO 에 적용되며, 내부 서비스-간 타입에는 적용 범위가 없다. 따라서 실질적 위반은 아니나, 동일 모양의 타입이 `AssistantStreamEvent` 측에도 존재한다면 중복 정의가 될 수 있어 향후 단일화 검토 대상.
- 제안: 현재 위치를 유지해도 규약 위반은 아님. `AssistantStreamEvent` 페이로드와 실제로 동형인지 확인 후, 공유 interface 로 추출 여부를 별도 트랙으로 판단. 현 구현은 INFO 수준.

### INFO 2 — `ResumeMeta` 인터페이스: 이름 기반 명명 규약 형식
- target 위치: `assistant-turn-persistence.service.ts` L282–286 (`export interface ResumeMeta { ... }`)
- 관련 규약: CLAUDE.md §정보 저장 위치 — 식별자는 관례 기반. 명시된 interface 명명 규약 문서는 없음.
- 상세: `ResumeMeta` 는 `PascalCase` 으로 NestJS/TypeScript 프로젝트 관행에 부합. `spec/conventions/` 에 service 내 interface 명명 규약이 별도 존재하지 않으므로 규약 위반 항목 없음.
- 제안: 해당 없음 (INFO 참고용).

---

## 요약

M-3 3단계의 구현 diff(`AssistantTurnPersistenceService` 분리)는 검토된 모든 정식 규약(`spec/conventions/`)과 충돌하는 항목이 없다.

1. **명명 규약**: 신규 파일명 `assistant-turn-persistence.service.ts` / `.spec.ts` 는 NestJS 모듈 파일명 관행(`<noun>-<noun>.service.ts`) 및 기존 tools/ 디렉토리 내 파일들(`assistant-tool-router.service.ts`, `assistant-finish-guard.service.ts`)의 패턴과 일치한다.
2. **출력 포맷 규약**: 본 변경은 API endpoint 나 이벤트 페이로드 형식을 새로 도입하지 않는다. SSE `usage` 이벤트와 동형이라고 JSDoc 에 명시된 `UsageSnapshot` 은 기존 DB persist 계약을 그대로 따른다.
3. **문서 구조 규약**: spec 파일(`spec/3-workflow-editor/4-ai-assistant.md`) 은 변경되지 않았으며 (`behavior-preserving, spec 무변경`), 기존 frontmatter(`id: ai-assistant`, `status: implemented`, `code:` glob `codebase/backend/src/modules/workflow-assistant/**/*.ts`)가 신규 서비스 파일을 glob 로 커버한다. frontmatter 갱신 의무 없음.
4. **API 문서 규약**: `swagger.md` 관련 DTO 나 Controller 변경이 없다. 추가된 파일은 모두 내부 서비스 레이어다.
5. **금지 항목**: conventions 에서 명시적으로 금지한 패턴 적용 없음.

CRITICAL·WARNING 발견사항 없음. INFO 2건은 현 규약의 적용 범위 외이거나 미래 리팩토링 트랙용 메모 수준이다.

---

## 위험도

NONE
