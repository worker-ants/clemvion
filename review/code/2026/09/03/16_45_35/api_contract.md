# API 계약(API Contract) 리뷰

## 확인한 내용

리뷰 대상 11개 파일은 전부 (1) TypeORM 엔티티 필드 타입을 `nullable: true` 인 DB 컬럼 실제 상태에 맞춰 `| null` 로 넓히고 `@Column({ type: ... })` 를 명시한 변경(`execution.entity.ts` · `knowledge-base.entity.ts` · `node-execution.entity.ts` · `node.entity.ts` · `notification.entity.ts` · `schedule.entity.ts` · `trigger.entity.ts` · `user.entity.ts` · `workflow.entity.ts`), (2) 그로 인해 제네릭 제약을 함께 넓힌 내부 마스킹 유틸(`shared/utils/redact-stored-error.ts`), (3) 이를 추적하는 plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`) 뿐이다.

컨트롤러·라우트·요청/응답 DTO·가드는 이번 diff 에 포함되지 않았다. 아래를 직접 확인했다:

- `src/modules/*/dto/responses/*.ts` 를 grep 한 결과, 변경된 필드(`avatarUrl`·`endpointPath`·`resourceType`/`resourceId`·`description`/`folderId`)에 대응하는 응답 DTO 는 이미 독립적으로 `string | null` 을 선언하고 있다 (예: `user-response.dto.ts:16`, `trigger-response.dto.ts:35`, `notification-response.dto.ts:42/46`, `workflow-response.dto.ts:21/33/146`). 즉 wire 상의 nullability 는 이 diff 이전부터 이미 이렇게 문서화되어 있었고, 엔티티 타입만 뒤늦게 실제와 맞춘 것이다.
- 엔티티에 `@ApiProperty` 계열 데코레이터가 없고(`grep -l ApiProperty src/modules/*/entities/*.ts` 결과 0건), 컨트롤러가 엔티티 인스턴스를 그대로 반환하는 지점도 없다 — 응답은 항상 별도 DTO/whitelist 매핑을 거친다(`executions.service.ts` 의 `ResponseExecution`/`ResponseNodeExecution` 타입이 이를 명시적으로 보여준다).
- `@Column({ type: 'varchar' | 'int' })` 추가는 새 마이그레이션 없이 **기존 DB 스키마를 `information_schema` 로 실측해** TypeORM 메타데이터만 맞춘 것(plan 문서 §배치 1/2 실측 기록)이라 스키마·와이어 포맷 변경이 아니다.
- TS 타입 주석은 컴파일 타임에만 존재하고 런타임 직렬화 바이트에 영향을 주지 않는다 — plan 문서 자체가 "런타임 코드는 이미 null 을 올바로 다루고 있었고 타입만 거짓말하고 있었다"(`tsc` 신규 오류 0건, e2e 로 확인)를 실측으로 명시하고 있다.

`redact-stored-error.ts` 의 `maskIfPresent`/`redactNodeExecutionRowForResponse` 시그니처 확장도 위 엔티티 타입 변경에 맞춘 정적 정합화이며, 마스킹 런타임 로직(`value == null ? value : mask(value) ?? value`)은 이전과 동일하다 — `null`/`undefined` 두 부재 형태 모두 결과가 같음을 문서 자체가 진리표로 근거를 대고 있다.

plan 문서(`entity-nullable-column-type-mismatch.md`)의 후속 항목 중 `2-api-convention.md §2.2 /api/auth/* 액션 네임스페이스 예외` 관련 gap 은 이 diff 가 아니라 **이전에 이미 발견되어 planner 턴 대기 중인 별개 항목**으로 명시되어 있고, 이번 diff 는 그 spec 파일을 건드리지 않는다 — 범위 밖.

## 발견사항

없음.

## 요약

이번 변경분은 TypeORM 엔티티의 TS 타입을 실제 DB `nullable: true` 컬럼 상태와 `@Column` 메타데이터에 맞춘 내부 정적 타입 정합화이며, 컨트롤러·라우트·요청/응답 DTO·인증가드 등 API 계약을 구성하는 표면은 diff 에 포함되지 않았다. 응답 DTO 는 이미 독립적으로 nullable 을 선언하고 있어 이번 변경이 wire-level 응답 스키마·하위 호환성·에러 응답·페이지네이션·인증/인가에 미치는 영향은 없다.

## 위험도

NONE
