# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 파일 1 — external-interaction.module.ts JSDoc 전용 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/backend/src/modules/external-interaction/external-interaction.module.ts` (lines 50-55)
- 상세: `@Module()` 데코레이터의 실제 `imports` 배열은 변경되지 않았다. `TypeOrmModule.forFeature([Trigger, Execution, ExecutionToken, NodeExecution])` 는 이미 코드에 존재했으며, JSDoc 주석만 해당 항목들을 나열하도록 갱신됐다. 런타임 의존성·DI 등록·exports 표면에 영향 없음.
- 제안: 없음. 변경은 안전하다.

### [INFO] 파일 2 — interaction.service.ts: `SSE_SEQ_PLACEHOLDER` 상수 추출 + JSDoc 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/backend/src/modules/external-interaction/interaction.service.ts`
- 상세:
  - 모듈 스코프 `const SSE_SEQ_PLACEHOLDER = 0` 추가. 값이 기존 리터럴 `0` 과 동일하여 런타임 동작 무변경이다. 이 const 는 모듈-스코프(파일 수준)이나 `export` 가 없으므로 외부로 노출되지 않는다 — 전역 변수가 아니다.
  - `getStatus()` 에 JSDoc 추가: 텍스트 전용, 시그니처/반환 타입/동작 변경 없음.
  - `it` → `rawInteractionType` 지역 변수 rename: 동일 스코프 지역 변수이며 외부 상태에 영향 없음.
- 제안: 없음.

### [WARNING] 파일 3 — node-execution.entity.ts: `@Index(['executionId', 'status'])` 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts` (line 704)
- 상세:
  - TypeORM `@Index` 데코레이터는 `synchronize: true` 환경에서 스키마 자동 동기화 시 **실제 DDL(CREATE INDEX)을 실행**한다. 프로덕션/스테이징이 `synchronize: false`(Flyway 관리)이면 이 데코레이터는 ORM 메타데이터에만 반영되고 DB에 DDL을 직접 발행하지 않는다.
  - JSDoc에 "중복 마이그레이션 없이 TypeORM 스키마 인식만 선언"이라 명시되어 있고, Flyway V095 partial index가 이미 존재한다는 사실도 적시됐다.
  - `synchronize: true` 개발 환경에서 해당 데코레이터가 Flyway partial index(`WHERE status IN ('waiting_for_input','running')`)와 **다른** 전체 인덱스를 별도로 생성할 수 있다. 두 인덱스가 공존해도 쿼리 정확도에는 영향이 없으나 불필요한 인덱스가 추가될 수 있다.
  - 또한 컬럼명이 DB에서는 snake_case(`execution_id`, `status`)인데, TypeORM `@Index` 에 엔티티 프로퍼티명(`executionId`, `status`)을 전달하는 것은 TypeORM이 내부에서 컬럼명으로 변환하므로 동작은 정상이다.
- 제안: JSDoc의 경고("중복 마이그레이션 없음")가 이미 존재하므로 추가 변경은 불필요하다. 단, `synchronize: true` 개발 환경에서 Flyway partial index와 ORM 생성 full index가 공존하는 상황을 팀이 인지하고 있는지 확인 권장.

### [INFO] 파일 4 — use-widget.ts: `seedWaitingFromStatus` JSDoc 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/channel-web-chat/src/widget/use-widget.ts` (lines 849-867)
- 상세:
  - `useCallback` 함수 본문·의존성 배열(`[]`)·호출 위치가 변경되지 않았다. JSDoc 텍스트만 추가됐다.
  - JSDoc이 "의존성 배열 `[]`: `dispatch`는 stable, `parseWaitingForInput`/`threadToMessages`는 pure import"라고 기술하고 있어, 빈 의존성 배열이 ESLint `exhaustive-deps` 경고를 의도적으로 억제하는 근거로 쓰인다.
  - 런타임 동작·이벤트 발생·콜백 호출 패턴 변경 없음.
- 제안: 없음.

### [INFO] 파일 5 — spec/5-system/14-external-interaction-api.md: EIA-IN-07 요구사항 문구 보강
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/spec/5-system/14-external-interaction-api.md` (EIA-IN-07 행)
- 상세: spec 문서에 `?lastEventId=0` → `seq≥1` 전체 replay 동작 설명 1줄을 추가한 것으로, 코드 동작 자체는 이미 구현되어 있으며 문서가 현실에 맞춰 보강된 것이다. 파일시스템·상태·API 인터페이스 변경 없음.
- 제안: 없음.

---

## 요약

이번 커밋의 5개 변경 파일은 모두 JSDoc·주석·spec 문서 업데이트이거나, 기존 리터럴을 named const로 추출하거나, 지역 변수를 rename한 것이다. 실질적인 런타임 부작용을 유발하는 변경은 `@Index(['executionId', 'status'])` 데코레이터 추가가 유일하다. 이 데코레이터는 `synchronize: false` 프로덕션 환경에서는 ORM 메타데이터 등록에만 그치고 추가 DDL이 발행되지 않으며, JSDoc에서 의도가 명확히 문서화되어 있다. 전역 변수 신규 도입, 공개 API 시그니처 변경, 환경 변수 읽기/쓰기, 네트워크 호출 추가, 이벤트/콜백 변경은 없다.

## 위험도

LOW
