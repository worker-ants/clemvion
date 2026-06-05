# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `resumeCallStack` 필드가 엔진에서 아직 읽히거나 쓰이지 않음 — 순수 스키마 추가
- 위치: `execution.entity.ts:138-139`, `V087__execution_resume_call_stack.sql`
- 상세: `resumeCallStack` 컬럼은 entity에 선언되었고 마이그레이션으로 DB에 추가되지만, `execution-engine.service.ts` 어디서도 아직 읽거나 쓰지 않는다. `stageDurableResumeSnapshot`은 `conversationThread`와 `userVariables`만 세트하고 `resumeCallStack`은 건드리지 않는다. PR-B2 구현 전 인프라 단계 — 의도적 분리임이 plan 설명과 일치하므로 부작용은 없다. 단, 이 상태에서 `executeInline` 내 blocking 노드가 park하면 `resumeCallStack`은 NULL인 채 DB에 저장되고, 재개 시 rehydration은 top-level 단일 레벨로 회귀한다(plan spec-draft C1 의도와 동일).

### [INFO] `CALL_STACK_SCHEMA_VERSION` 상수가 미정의 상태
- 위치: `resume-call-stack.types.ts:32`, `V087__execution_resume_call_stack.sql:13`
- 상세: 두 파일 모두 `CALL_STACK_SCHEMA_VERSION`이 `execution-engine.service.ts`에 정의될 예정이라고 JSDoc/주석으로 언급하지만, 현재 서비스 파일에는 해당 상수가 없다(`CHECKPOINT_SCHEMA_VERSION = 1`만 존재). 타입 파일은 `import type`으로만 사용되므로 런타임 오류는 없다. PR-B2에서 컬럼을 실제로 write할 때 상수도 함께 추가해야 한다. 현재 PR 범위에서는 상수가 참조되지 않으므로 부작용 없음.
- 제안: PR-B2 구현 시 `const CALL_STACK_SCHEMA_VERSION = 1;` 을 `execution-engine.service.ts`에 `CHECKPOINT_SCHEMA_VERSION` 옆에 추가하고, types 파일 JSDoc도 실제 정의 위치로 업데이트한다.

### [INFO] `resumeCallStack`이 API DTO에 미노출됨 — 기존 `conversationThread`/`userVariables` 패턴과 동일
- 위치: `execution.entity.ts:135-136`, `dto/responses/execution-response.dto.ts`
- 상세: entity 주석에 "whitelist 매핑이라 자동 배제"라고 명시됨. `ExecutionDto`/`ExecutionDetailDto`는 명시적 필드만 선언하므로 `resumeCallStack`은 API 응답에 포함되지 않는다. 확인 완료 — DTO 파일에 해당 필드 없음. 의도된 설계이며 외부 인터페이스 변경 없음.

### [INFO] 마이그레이션 V087 번호 확정 — 현재 max=V086 기준 정합
- 위치: `V087__execution_resume_call_stack.sql`
- 상세: 현재 worktree의 migrations/ 디렉토리에서 V086(`agent_memory_scope_updated_index`)이 최고 번호이고 V087은 이 PR이 신규 추가한다. spec-draft가 "main max=V086, next=V087" 로 명기한 것과 일치. 다만 병렬 active worktree(`impl-concurrency-cap-pr2b`)가 미착수 상태이므로 V087 선점 충돌 리스크는 현재 없음. 머지 레이스가 발생하면 plan 진행메모 W4 절차대로 renumber 필요.

### [INFO] `stageDurableResumeSnapshot`이 `resumeCallStack`을 세트하지 않음 — executeInline 블로킹 경로에서 NULL 유지
- 위치: `execution-engine.service.ts:8819-8825`, `executeInline` L2924/2931/2942
- 상세: `executeInline` 내부 blocking 노드가 `waitForFormSubmission`/`waitForButtonInteraction`/`waitForAiConversation`을 호출할 때 `parkMode` 기본값(`'await'`)으로 진입한다. `stageDurableResumeSnapshot`은 `conversationThread`와 `userVariables`만 세트하고 `resumeCallStack`은 null로 둔다. PR-B2 이전까지 중첩 blocking park 시 `resumeCallStack`이 null인 채 WAITING 전이가 일어나므로, 현재는 rehydration이 top-level fallback으로 동작한다. 이는 PR-B1 이전과 동일한 행동이므로 회귀가 아니다.

---

## 요약

이번 변경은 DB 컬럼(V087 마이그레이션), TypeORM entity 필드(`resumeCallStack`), 타입 정의(`resume-call-stack.types.ts`)를 추가하는 순수 인프라 레이어 PR이다. 엔진 런타임 경로에서 새 필드를 읽거나 쓰는 코드는 없으며, API DTO 노출도 없고(`conversation_thread`/`user_variables`와 동일한 whitelist 매핑 패턴), 전역 변수 도입이나 기존 함수 시그니처 변경도 없다. 모든 기존 park 경로(`waitForFormSubmission`, `waitForButtonInteraction`, `waitForAiConversation`)는 변경되지 않았다. 유일한 잠재적 gap은 `CALL_STACK_SCHEMA_VERSION` 상수가 타입 파일 주석에 언급되지만 아직 서비스에 정의되지 않은 것인데, 현재 PR 범위에서 해당 상수는 런타임에 참조되지 않으므로 실제 부작용은 없다. 플랜·문서 파일(파일 4~18) 변경은 코드 동작에 영향을 주지 않는다.

## 위험도

NONE

STATUS: DONE
