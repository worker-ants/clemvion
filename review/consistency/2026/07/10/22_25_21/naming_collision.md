# 신규 식별자 충돌 검토 — getStatus() 2단계 컬럼 projection

- 모드: `--impl-prep`
- target: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` 리팩터
- plan: `plan/in-progress/eia-getstatus-column-projection.md`

## 조사 방법

- `grep -rn "select: \[" codebase/backend/src/modules/executions codebase/backend/src/modules/external-interaction codebase/backend/src/modules/node-executions codebase/backend/src/modules/execution-engine`
- `grep -rniE "base_columns|_projection|projectionColumns|BASE_PROJECTION" codebase/backend/src`
- `grep -rn "GET_STATUS" codebase/backend/src`
- plan 파일명 `eia-getstatus-column-projection` 을 `plan/in-progress/`·`plan/complete/` 전체와 대조
- `Execution` 엔티티(`execution.entity.ts`) `@Column({ name: '...' })` 매핑과 기존 `select:[...]` 호출부 비교

## 발견사항

- **[INFO]** 재사용 가능한 기존 공용 projection 상수 없음 — 신규 지역 상수 도입은 중복 SoT 아님
  - target 신규 식별자: (예시) `GET_STATUS_BASE_COLUMNS` 류의 지역 상수
  - 기존 사용처: 없음. `grep -rniE "base_columns|_projection|projectionColumns|BASE_PROJECTION"` 전체 backend 0건, `select: [` 사용부(`interaction.service.ts:156/209/359`, `interaction.guard.ts:129/136`, `notification-webhook.processor.ts:194`, `interaction-token.service.ts:330`, `notification-fanout.service.ts:109`)는 전부 인라인 배열 리터럴이며 이름 붙은 공용 상수로 추출된 선례가 프로젝트에 없음
  - 상세: 검토 질문 2 가 우려한 "기존 공용 Execution projection 상수" 는 존재하지 않는다. 따라서 plan 이 `getStatus()` 전용 지역 상수를 새로 도입해도 기존 SoT 와 경합하거나 중복 정의를 만들지 않는다.
  - 제안: 상수를 도입한다면 module-level 지역 상수(`interaction.service.ts` 파일 내부)로 한정 — 기존 `TERMINAL_STATUSES` / `SSE_SEQ_PLACEHOLDER` 와 동일하게 파일 상단에 SCREAMING_SNAKE_CASE 로 선언해 스타일 일관성 유지. 다른 모듈에서 재사용할 계획이 없다면 `export` 하지 않는다(불필요한 공개 표면 방지).

- **[WARNING]** projection 배열은 반드시 TypeORM **엔티티 프로퍼티명**(camelCase) 사용 — DB 컬럼명 오용 시 런타임 무결과/에러 위험
  - target 신규 식별자: `select: ['id','status','workflowId','startedAt','finishedAt','outputData']` (plan 본문에 명시된 목록)
  - 기존 사용처: `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:109` `select: ['id', 'workspaceId', 'workflowId', 'config']` — camelCase 엔티티 프로퍼티명 사용이 이미 확립된 관행. `execution.entity.ts` 는 `@Column({ name: 'workflow_id' }) workflowId`, `@Column({ name: 'started_at' }) startedAt`, `@Column({ name: 'finished_at' }) finishedAt`, `@Column({ name: 'output_data' }) outputData`, `@Column({ name: 'conversation_thread' }) conversationThread` 로 DB 컬럼명과 프로퍼티명이 상이
  - 상세: plan 본문의 필드 목록(`id`,`status`,`workflowId`,`startedAt`,`finishedAt`,`outputData`) 은 이미 전부 올바른 camelCase 프로퍼티명이라 **현재 plan 문서 자체는 정합**이다. 다만 실제 구현(TDD) 단계에서 `snake_case` DB 컬럼명(`workflow_id`, `started_at` 등)을 실수로 쓰면 TypeORM 이 해당 프로퍼티를 찾지 못해 조용히 무시하거나(존재하지 않는 select 키) 타입 에러 없이 undefined 필드가 응답에 섞이는 회귀로 이어질 수 있다(plan 자체가 "`updatedAt` fallback 침묵 회귀" 위험을 이미 명시).
  - 제안: 구현 시 `select` 배열은 plan 문서에 적힌 프로퍼티명 그대로 사용하고, 2단계 조회의 `conversationThread` 필드도 동일하게 camelCase(`conversationThread`)로 select — snake_case 오기 방지를 위해 유닛 테스트에서 각 필드가 실제로 응답에 채워지는지(특히 `updatedAt` 도출용 `finishedAt`/`startedAt`) 단언할 것.

- **[INFO]** plan 파일 경로 충돌 없음
  - target 신규 식별자: `plan/in-progress/eia-getstatus-column-projection.md`
  - 기존 사용처: 없음. `plan/in-progress/` 34개 파일, `plan/complete/` 내 `eia-*` 12개 파일(`eia-message-length-error-mapping.md`, `eia-secret-masking-residuals.md`, `eia-distributed-seq-load-verify.md`, `eia-seq-const-never-cleanup.md`, `eia-strip-llmcalls.md`, `eia-seq-load-spec-cleanup.md`, `eia-distributed-seq-counter.md`, `eia-distributed-seq-checklist.md`, `eia-sdk-publish.md`, `spec-fix-eia-token-error-codes.md`, `spec-draft-eia-seq-nfr.md`, `spec-draft-eia-strip-llmcalls.md`) 중 동명·유사명 없음
  - 상세: 신규 파일명은 기존 `eia-<topic>-<detail>.md` kebab-case 명명 컨벤션과 일치하며 겹치는 항목이 없다.
  - 제안: 없음(현행 유지).

- **[INFO]** 지역 변수명(`execution`, `nodeExec`, 가칭 `threadRow`)은 함수 스코프 내부라 크로스 모듈 충돌 개념 자체가 성립하지 않음
  - target 신규 식별자: `execution`(이미 기존 코드에 존재, 변경 없음), `nodeExec`(이미 기존 코드에 존재), 2단계 조회 결과를 담을 신규 지역 변수(가칭 `threadRow`)
  - 기존 사용처: `execution`/`nodeExec` 는 `interaction.service.ts` 자체 함수 스코프 내 기존 식별자(라인 242·267). `nodeExec` 는 `execution-engine/form-interaction.service.ts` 에서도 지역 변수로 사용되나 별개 함수/모듈 스코프
  - 상세: TypeScript 지역 변수는 함수/블록 스코프이므로 다른 파일·다른 함수에서 같은 이름을 쓰는 것은 언어적으로 충돌이 아니다. `getStatus()` 내부에서 재사용 시 기존 `execution`/`nodeExec` 와 이름이 겹치지 않는 새 변수명(예: `threadRow`)을 쓰면 그림자 변수(shadowing) 문제도 없다.
  - 제안: 가독성을 위해 1단계 결과(`execution`)와 2단계 결과(`conversationThread` 재조회 row)의 변수명을 명확히 구분할 것 — 예: 1단계는 기존대로 `execution`, 2단계 재조회는 `threadRow` 또는 `conversationThreadRow` 등 "무엇을 위한 재조회인지" 드러나는 이름 권장(단, 이는 명명 명확화 권장 수준이며 충돌은 아님).

- **요구사항 ID / 엔티티·DTO / API endpoint / 이벤트·메시지명 / ENV 변수** — 해당 없음
  - target 이 이 카테고리에서 아무것도 신규 도입하지 않음을 확인. plan 범위는 "wire 형식 무변경 — 순수 내부 조회 최적화"(plan §범위)로 명시되어 있고, `ExecutionStatusDto`/엔드포인트/이벤트명/환경변수 변경이 코드·spec 어디에도 없음(`spec/5-system/14-external-interaction-api.md` 의 `getStatus`/`conversationThread` 관련 서술은 기존 §5.3/§R17 그대로, 신규 요구사항 ID 미추가).

## 요약

target 이 도입하려는 신규 식별자는 사실상 (1) `getStatus()` 내부에 한정된 module-scope 상수 1개, (2) 함수 스코프 지역 변수 몇 개, (3) 신규 plan 파일 1개뿐이며, 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·환경변수 등 크로스 모듈 표면은 전혀 건드리지 않는다. 프로젝트 전역에 재사용 가능한 기존 Execution projection 공용 상수가 없음을 확인했으므로 신규 지역 상수 도입은 중복 SoT 를 만들지 않는다. plan 문서에 명시된 projection 필드 목록은 이미 `notification-fanout.service.ts` 의 기존 관행과 마찬가지로 올바른 camelCase 엔티티 프로퍼티명을 사용하고 있어 즉각적인 충돌은 없으나, 실제 구현 단계에서 DB 컬럼명(snake_case)으로 오기하면 침묵 회귀로 이어질 수 있는 구조적 위험이 있어 WARNING 으로 남겨 구현 시 주의를 당부한다. plan 파일 경로는 기존 명명 컨벤션과 충돌 없이 안전하다.

## 위험도

LOW

STATUS: OK
