# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 차단 사유 없음.

## 전체 위험도
**LOW** — Warning 1건(plan 내 spec 경로 오기재), Info 5건. 외부 계약·API·DB 스키마 변경 없는 behavior-preserving 리팩터.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | plan 내 spec 경로 오기재 (`spec/5-system/4-ai-assistant.md` → 실제: `spec/3-workflow-editor/4-ai-assistant.md`) | `plan/in-progress/refactor/02-architecture.md` M-3 "spec 대조" 노트 및 관련 포인터 | `spec/3-workflow-editor/4-ai-assistant.md` (실제 존재 경로) | plan 문서 내 참조 경로를 `spec/3-workflow-editor/4-ai-assistant.md` 로 정정. 구현 자체는 차단 불요. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 신규 파일(`tools/assistant-turn-persistence.service.ts`)이 spec `code:` 배열에 별도 미등재 | `spec/3-workflow-editor/4-ai-assistant.md` frontmatter | 기존 glob `codebase/backend/src/modules/workflow-assistant/**/*.ts` 으로 자동 커버. 별도 항목 추가 불필요. M-3 완료 후 Rationale 일괄 보완 선택적. |
| 2 | Cross-Spec | spec §9 의사코드가 `WorkflowAssistantStreamService.persistAssistantTurn` 직접 호출 기술 — 분리 후 위임 구조와 미세 불일치 | `spec/3-workflow-editor/4-ai-assistant.md` §9 | 외부 계약 변경 없으므로 CRITICAL 아님. M-3 완료 후 `AssistantTurnPersistenceService` 참조로 선택적 갱신. |
| 3 | Rationale Continuity | SSE 순서 불변식 — `persistAssistantTurn` → `auto_resume` emit 선행 보장이 위임 레이어 후에도 유지돼야 함 | `WorkflowAssistantStreamService.streamMessage` stall 복구 블록 | 구현 착수 시 stall 블록 3곳의 `await persistAssistantTurn` 이 SSE yield 보다 선행함을 확인. SoT: Rationale §10 "(1)→(2)→(3)→(4)" 순서 블록. |
| 4 | Rationale Continuity | `planPersisted` 플래그 소유권 — "무상태 서비스" 원칙과 충돌 방지 | `streamMessage` 내 `planPersisted` 로컬 변수 | 플래그 평가·`null` 변환 로직은 `streamMessage` 호출부에 잔류. `AssistantTurnPersistenceService` 는 plan 을 그대로 받아 DB write 만 수행. |
| 5 | Naming Collision | `makeResumeMeta` 가 원본·이동 대상 파일 양쪽에 현재 존재 (구현 중간 상태) | `workflow-assistant-stream.service.ts` / `tools/assistant-turn-persistence.service.ts` | 동일 PR 에서 원본 `makeResumeMeta` + `persistAssistantTurn` 삭제 완료 필요. 식별자 충돌 아님, 구현 완성도 체크포인트. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 외부 계약(API·SSE·DB) 변경 없음. spec glob 이 신규 파일 자동 커버. |
| Rationale Continuity | LOW | 기각된 대안 재도입·합의 원칙 위반 없음. SSE 순서 불변식·planPersisted 소유권 구현 착수 전 체크포인트 명시. |
| Convention Compliance | LOW | plan 내 spec 경로 오기재(WARNING 1건). 명명 규약·파일 패턴·배치 모두 기존 1·2단계와 일치. |
| Plan Coherence | NONE | 선행 1·2단계 완료. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 없음. |
| Naming Collision | NONE | 클래스명·파일명·endpoint·이벤트명·ENV 6개 관점 모두 충돌 없음. |

## 권장 조치사항

1. (즉시, 구현 착수 전) `plan/in-progress/refactor/02-architecture.md` M-3 spec 경로를 `spec/3-workflow-editor/4-ai-assistant.md` 로 정정 (WARNING 해소).
2. (구현 중 체크) stall 블록 내 3곳의 `await AssistantTurnPersistenceService.persistAssistantTurn(...)` 호출이 `yield auto_resume` SSE 보다 선행하는지 확인.
3. (구현 중 체크) `planPersisted` 플래그와 `plan → null` 변환 로직이 `streamMessage` 호출부에 잔류하고 서비스 내부로 이동하지 않는지 확인 ("무상태 서비스" 원칙 보존).
4. (동일 PR 완료 전) 원본 `workflow-assistant-stream.service.ts` 에서 `makeResumeMeta` + `persistAssistantTurn` 삭제 완료.
5. (M-3 전체 완료 후, 선택적) `spec/3-workflow-editor/4-ai-assistant.md` Rationale 에 3단계 분리 패턴(`AssistantTurnPersistenceService`) 설명 일괄 보완.
