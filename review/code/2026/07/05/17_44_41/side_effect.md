# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `findAll` 이 `getMany()` 결과 엔티티를 in-place mutate (`Object.assign(t, {...})`)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` findAll, `Object.assign(t, { cronExpression, timezone, nextRunAt })` (신규 enrichment 블록)
  - 상세: `t` 는 `qb.getMany()` 가 매 요청마다 새로 생성하는 TypeORM 엔티티 인스턴스이며, 프로젝트 TypeORM 설정(`app.module.ts` `TypeOrmModule.forRootAsync`)에 query result cache 가 구성되어 있지 않고, Nest 의 기본 request-scope 밖에서 repository/entity 인스턴스가 요청 간 캐시·재사용되는 경로도 없다. 따라서 이 mutation 은 요청 로컬 객체에 국한되며 전역/공유 상태(다른 요청, 다른 워크스페이스 응답, 이후 재사용되는 캐시 엔티티)에 영향을 주지 않는다. `findOneDetail` 이 이미 동일 패턴(`Object.assign(trigger, {...})`)을 사용 중이라 일관적이다.
  - 제안: 없음(현행 유지 가능). 다만 스타일 선호 시 `{ ...t, cronExpression, ... }` 같은 non-mutating 패턴으로 바꿔 "엔티티를 직접 mutate 하지 않는다"는 불변식을 코드베이스 전체에 더 명확히 할 수 있으나, 기존 `findOneDetail` 과의 일관성·낮은 실질 리스크를 고려하면 필수는 아니다.

- **[INFO]** `sanitizeChatChannelForResponse` 순서·계약 보존 확인
  - 위치: `triggers.service.ts` L458-487 (`sanitizeChatChannelForResponse`), L840-856 (신규 `enriched` map)
  - 상세: `sanitizeChatChannelForResponse` 는 인자로 받은 `trigger`(mutate 된 `t` 포함)를 직접 mutate 하지 않고, `Object.create(prototype)` + `Object.assign(..., trigger, { config: sanitizedConfig })` 로 **새 객체**를 만들어 반환한다. `sanitizedConfig` 역시 `{ ...cfg, chatChannel: sanitizedChatChannel }` 스프레드로 새로 만든 객체다. 따라서 호출 순서는 "먼저 `Object.assign(t, {cron...})` 로 스케줄 필드를 엔티티에 얹은 뒤, 그 결과를 `sanitizeChatChannelForResponse` 에 넘겨 chat-channel 민감 필드를 strip 한 새 응답 객체를 생성"이다 — cron 필드는 chat-channel 관련 strip 로직과 무관한 필드라 strip 대상에 걸리지 않고 그대로 통과하며, chat-channel 민감정보(botToken 등)는 여전히 정상적으로 제거된다. `findOneDetail` 의 기존 순서(enrich → sanitize)와 동일해 신규 목록 경로도 동일 보안 계약을 만족한다.
  - 제안: 없음.

- **[INFO]** `TriggerDto` JSDoc 변경 (필드 존재 범위 정정) 은 순수 문서 주석 변경
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` L318-330
  - 상세: `@ApiPropertyOptional` 데코레이터·필드 타입·구조는 변경되지 않았고 JSDoc 주석("단건 조회 시에만" → "목록·단건 조회 모두")만 정정됐다. Swagger 스펙 출력에는 영향 없음(JSDoc 은 `@ApiPropertyOptional` 옵션에 포함되지 않음). 기존 API 소비자에는 영향 없는 순수 문서 정합화.
  - 제안: 없음.

- **[INFO]** 반환 타입 시그니처 변경: `Promise<PaginatedResponseDto<Trigger>>` → `Promise<PaginatedResponseDto<TriggerDetail>>`
  - 위치: `triggers.service.ts` `findAll` 시그니처
  - 상세: `TriggerDetail = Trigger & { cronExpression?; timezone?; nextRunAt? }` 로, 기존 `Trigger` 의 상위 집합(구조적으로는 optional 필드 추가)이라 컴파일 타임 호환. `findAll` 을 호출하는 컨트롤러(`TriggersController.findAll` 등)는 별도 응답 DTO(`TriggerDto`, 이미 cron/timezone/nextRunAt 필드 보유)로 매핑해 반환하므로 컨트롤러·API 계약에 breaking 영향 없음. `TriggerDetail` 은 이미 `findOneDetail` 에서 쓰이던 기존 export 타입 재사용이라 신규 공개 타입 도입도 아니다.
  - 제안: 없음.

- **[INFO]** 신규 `scheduleRepository.find({ where: { triggerId: In(...), workspaceId } })` — 네트워크/DB 호출 추가
  - 위치: `triggers.service.ts` `findAll`
  - 상세: schedule 타입 트리거가 1건 이상 있는 페이지에서만 배치 조회 1회 추가(N+1 회피 설계, workspaceId 로 스코프돼 cross-workspace 유출 없음). 트리거·스케줄이 없는 페이지(`scheduleTriggerIds.length === 0`)에서는 스킵 — 관련 unit 테스트로 검증됨(`triggers.service.spec.ts` "schedule 행이 없으면 schedule 조회를 skip"). 외부 서비스 호출 아니고 동일 DB 내 추가 쿼리이며 트랜잭션·부작용 없는 read-only 조회.
  - 제안: 없음.

## 요약

이번 변경(`TriggersService.findAll` 의 schedule cron/timezone/nextRunAt 목록 enrichment)은 `findOneDetail` 에 이미 존재하던 "entity in-place `Object.assign` 후 `sanitizeChatChannelForResponse` 로 새 객체 반환" 패턴을 목록 경로로 그대로 복제한 것이다. mutate 대상 `t` 는 `getMany()` 가 매 요청 생성하는 로컬 엔티티 인스턴스이고, 프로젝트에 TypeORM 쿼리 캐시나 엔티티 재사용 경로가 없어 요청 간 공유 상태 오염 위험은 없다. `sanitizeChatChannelForResponse` 는 항상 새 객체를 반환하며 enrich(먼저) → sanitize(나중) 순서가 `findOneDetail` 과 동일하게 보존돼, cron 필드는 그대로 노출되고 chat-channel 민감 필드(botToken 등)는 정상적으로 strip 된다. 반환 타입 확장(`Trigger` → `TriggerDetail`)과 JSDoc 정정은 구조적 상위 호환이며 DTO 응답 계약에 breaking 영향이 없다. 신규 `scheduleRepository.find` 호출은 스코프된 read-only 배치 조회로 부작용이 없다. 전반적으로 부작용 관점에서 특별한 위험 요소는 발견되지 않았다.

## 위험도

NONE
