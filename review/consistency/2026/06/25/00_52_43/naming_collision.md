# 신규 식별자 충돌 검토 결과

scope: `spec/5-system/14-external-interaction-api.md` (impl-done, diff-base=origin/main)

---

## 발견사항

### 발견사항 없음

이번 diff 가 도입하는 식별자를 6개 관점(요구사항 ID, 엔티티/타입명, API endpoint, 이벤트/메시지명, 환경변수·설정키, 파일 경로)에서 전수 검토한 결과 충돌이 없다.

#### 검토 근거

**요구사항 ID 충돌**: 신규 요구사항 ID 없음. EIA §5.3·§R6·EIA-IN-07 참조는 모두 기존 spec의 기존 섹션이며 이미 정의된 식별자를 재인용하는 것이다.

**엔티티/타입명 충돌**:
- `NodeExecution` — 기존 엔티티(`spec/1-data-model.md §2.14`, `node-executions/entities/node-execution.entity.ts`). 이번 diff 는 기존 엔티티를 `external-interaction.module.ts` 의 TypeORM `forFeature` 에 **추가 등록**할 뿐 새 의미를 부여하지 않는다.
- `NodeExecutionStatus` — 기존 enum. 이번 diff 는 `interaction.service.ts` 에서 import해 기존 값(`WAITING_FOR_INPUT`)을 소비하는 것이다.
- `SSE_SEQ_PLACEHOLDER` — `interaction.service.ts` 모듈-스코프 상수(non-export). 코드베이스 전체에서 동일 이름의 다른 선언이 없다.
- `seedWaitingFromStatus` — `use-widget.ts` 내부 `useCallback` 로컬 변수. 코드베이스 어디에도 동명 export/import 없다.
- `ExecRepoMocks` (test interface) — `interaction.service.spec.ts` 파일 내부 전용 interface. 이미 해당 파일에 존재하던 interface를 `nodeRepo` 에도 재사용한 것이며 별도 새 이름이 아니다.
- `nodeRepo` (test local var) — spec 파일의 `makeMocks()` 내부 지역 변수. `schedule-runner.service.spec.ts` 등 다른 파일에도 `nodeRepo`라는 지역 변수가 있지만 파일 스코프가 완전히 분리되어 충돌 없다.

**API endpoint 충돌**: 이번 diff 는 새 endpoint를 추가하지 않는다. `GET /api/external/executions/:id` 는 기존 EIA §5.3 에 이미 정의된 엔드포인트이며, `interaction.controller.ts` 의 `getStatus` 핸들러 구현을 실질화(기존 null 반환 → `NodeExecution` 조회 결과 반환)하는 것이다.

**이벤트/메시지명 충돌**: 이번 diff 는 새 SSE/webhook/queue 이벤트 이름을 도입하지 않는다. `NOTIFICATION_WEBHOOK_QUEUE` / `TERMINAL_REVOKE_RECONCILE_QUEUE` 는 기존 상수이며, 모듈 comment 의 `@Index` 를 통해 TypeORM 이 인식하는 DB 인덱스 이름은 TypeORM 이 자동 생성(`IDX_...`)하며 마이그레이션 V095 의 partial index 와 이름 공간이 겹치지 않는다(V095 는 명시적 이름 지정 없이 `CREATE INDEX` 구문 사용).

**환경변수·설정키 충돌**: 이번 diff 는 새 ENV var 또는 config key를 도입하지 않는다.

**파일 경로 충돌**: 이번 diff 는 새 파일을 추가하지 않으며 기존 파일 5개를 수정한다.

---

## 요약

이번 변경은 기존 식별자(`NodeExecution`, `NodeExecutionStatus`, `nodeExecutionRepository`)를 새 소비처에 연결하고 모듈 내부 상수(`SSE_SEQ_PLACEHOLDER`) 및 hook 내부 함수(`seedWaitingFromStatus`)를 추가하는 것으로, 기존 사용처와 다른 의미로 사용되거나 중복 정의되는 이름이 없다. 신규 식별자 충돌 관점에서 이번 변경은 안전하다.

---

## 위험도

NONE
