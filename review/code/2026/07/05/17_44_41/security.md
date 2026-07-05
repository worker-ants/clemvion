# 보안(Security) Review — trigger-list-cron-nextrun

## 리뷰 대상
- `CHANGELOG.md`
- `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`TriggersService.findAll` — schedule 목록 enrichment, V-10)

## FOCUS 검증: batch schedule 조회의 workspace 스코프

핵심 변경:

```ts
const schedules = await this.scheduleRepository.find({
  where: { triggerId: In(scheduleTriggerIds), workspaceId },
});
```

- `Schedule` 엔티티(`codebase/backend/src/modules/schedules/entities/schedule.entity.ts`)는 `workspaceId` 를 자신의 컬럼으로 직접 보유(`trigger_id` FK 와 별도, `Trigger` 를 통해 유도되는 값이 아님). 따라서 `where: { triggerId: In([...]), workspaceId }` 는 AND 조건으로 컴파일되어, `triggerId` 가 일치하더라도 `schedule.workspaceId !== workspaceId` 인 행은 절대 조회되지 않는다 — 이는 이론적으로도 발생 불가능한 케이스(정상 데이터라면 `schedule.workspaceId` 는 항상 부모 `trigger.workspaceId` 와 같아야 함)를 이중으로 방어하는 defense-in-depth 패턴.
- `scheduleTriggerIds` 자체가 `data.filter((t) => t.type === 'schedule').map((t) => t.id)` 로, `data` 는 상위 쿼리(`qb.where('t.workspace_id = :workspaceId', ...)`)에서 이미 `workspaceId` 로 스코프된 결과다. 즉 `triggerId` 후보 집합 자체가 이미 같은 워크스페이스로 한정되어 있어, `In(...)` 절에 타 워크스페이스의 트리거 id 가 섞여 들어갈 경로가 없다.
- `workspaceId` 값의 출처: 컨트롤러(`triggers.controller.ts`)의 `@WorkspaceId() workspaceId: string` 데코레이터가 인증된 세션/토큰에서 유도 — 클라이언트가 임의로 주입 가능한 쿼리 파라미터가 아니다. 사용자가 다른 워크스페이스의 `workspaceId` 를 요청에 실어 보내도 이 값에 영향을 줄 수 없다(추정: `WorkspaceId` 데코레이터가 request context/JWT claim 기반, 프로젝트 공통 패턴).
- 결론: `triggerId IN (...)` 만으로 필터링하고 `workspaceId` 를 누락했다면 이론상 (a) 상위 쿼리로 이미 같은 워크스페이스로 필터된 `triggerId` 만 후보이므로 실질적 크로스 워크스페이스 유출 경로는 없었겠지만, 방어적 이중 스코프를 코드가 실제로 갖추고 있어 이 리뷰의 우려 지점(FOCUS)은 해소됨. 향후 `scheduleTriggerIds` 산출 로직이 실수로 다른 워크스페이스 데이터를 섞게 되더라도 `workspaceId` AND 조건이 최후 방어선 역할을 한다.
- 동일 패턴이 이미 `findOneDetail`(`scheduleRepository.findOne({ where: { triggerId: id, workspaceId } })`)에도 존재해 신규 코드와 일관.
- 단위 테스트(`triggers.service.spec.ts` L536-577)가 `scheduleRepo.find` 호출 인자를 `{ where: { triggerId: In(['s-trig']), workspaceId: 'ws' } }` 로 정확히 단언 — 회귀 시 즉시 실패하는 가드 존재.

**크로스 워크스페이스 leak 없음으로 판단.**

## 신규 노출 필드 검토

- `cronExpression` / `timezone` / `nextRunAt` — 세 필드 모두 `TriggerDto` 에 기존에 이미 선언되어 있었고(단건 조회에서만 채워짐), 이번 변경은 JSDoc 주석 정정("단건 조회 시에만" → "목록·단건 모두")과 목록 enrichment 로직 추가뿐. 필드 자체는 신규가 아니며 값의 민감도도 낮음(cron 스케줄 문자열, IANA 타임존, 다음 실행 예정 시각) — 인증정보·시크릿·PII 아님. FOCUS 에서 명시한 대로 non-sensitive.
- `sanitizeChatChannelForResponse` 가 schedule enrichment 이후에도 두 분기(`Object.assign` 경로/기본 경로) 모두에서 호출되어, chat-channel 관련 strip-key allow-list(`botTokenRef`/`inboundSigningRef`/`botToken`/`inboundSigning`/`inboundSigningPlaintext`)가 여전히 일관 적용됨. 신규 코드가 이 sanitize 단계를 우회하는 경로를 만들지 않음.
- `Object.assign(t, {...})` 는 `qb.getMany()` 로 매 요청마다 새로 생성된 엔티티 인스턴스를 in-place 로 확장하는 것으로, 요청 간 캐시/공유 객체를 오염시키는 구조가 아님(요청 스코프 로컬 배열).

## 기타 관점 점검

- **인젝션**: `scheduleRepository.find({ where: {...} })` 는 TypeORM 의 파라미터화된 QueryBuilder/Repository API 사용 — raw SQL string 결합 없음. SQL 인젝션 위험 없음.
- **인증/인가**: 엔드포인트는 `@ApiBearerAuth`, `@WorkspaceId()` 데코레이터로 인증된 워크스페이스 컨텍스트만 사용. 신규 코드가 인가 체크를 우회하거나 추가 권한을 요구하는 변경은 아님(기존 `GET /api/triggers` 인가 모델 그대로).
- **입력 검증**: 신규 코드 경로는 사용자 입력을 직접 소비하지 않음(내부적으로 산출된 `scheduleTriggerIds` 배열만 사용). 기존 쿼리 파라미터(`search`, `type`, `status`, `interactionEnabled`) 처리는 이번 diff 범위 밖.
- **에러 처리**: 신규 코드에 별도 try/catch·에러 메시지 노출 없음. `scheduleRepository.find` 실패 시 기존 글로벌 예외 필터 경로를 그대로 탐(추가 노출 없음).
- **하드코딩 시크릿**: 없음.
- **암호화**: 해당 없음(변경 범위에 암호화/해시 로직 없음).
- **의존성**: 신규 의존성 추가 없음(`typeorm` 의 `In` 연산자만 추가 import, 기존 의존성).
- **CHANGELOG.md / DTO 주석 변경**: 문서·주석 정정으로 보안 영향 없음.

## 요약

이번 변경(`TriggersService.findAll` 의 schedule 목록 batch enrichment)은 신규 `scheduleRepository.find` 조회를 `triggerId IN (...)` 와 `workspaceId` 양쪽으로 스코프하여, 상위 트리거 쿼리 자체도 이미 워크스페이스로 한정된 결과만 사용하므로 크로스 워크스페이스 데이터 유출 경로가 없다. 신규 노출 필드(`cronExpression`/`timezone`/`nextRunAt`)는 기존에 이미 DTO 에 선언돼 있던 non-sensitive 필드로 민감정보 노출이 아니며, 기존 `sanitizeChatChannelForResponse` sanitize 단계도 두 응답 경로 모두에서 일관되게 적용된다. TypeORM 파라미터화 쿼리 사용으로 인젝션 위험 없고, 인증/인가는 기존 `@WorkspaceId()` 데코레이터 기반 컨텍스트를 그대로 재사용한다. 단위 테스트가 `where` 절 파라미터(특히 `workspaceId`)를 명시적으로 단언해 회귀 가드도 확보되어 있다. 보안 관점에서 문제되는 발견사항은 없다.

## 위험도

NONE
