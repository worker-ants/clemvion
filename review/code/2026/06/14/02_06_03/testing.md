# Testing Review — schedule-gaps impl (§2.2 timezone fallback)

## 발견사항

### [WARNING] `isValidIanaTimezone` 함수에 대한 독립 단위 테스트 부재
- 위치: `/codebase/backend/src/modules/workspaces/workspaces.service.ts:23-30` (exported utility function)
- 상세: `isValidIanaTimezone`은 `export function`으로 공개되어 있어 독립 테스트 가능하다. 현재는 `updateWorkspaceSettings`의 통합 경로를 통해서만 간접 검증(유효 케이스 1건 + 무효 케이스 1건)된다. 엣지 케이스 — 빈 문자열 입력, 공백만 있는 문자열, `Etc/UTC`, `UTC`, `GMT` 같은 비표준 IANA alias, 매우 긴 문자열(MaxLength 64 경계값) — 에 대해 직접 단위 테스트가 없다.
- 또한 `system-context-prefix.ts:80`에 동일 로직의 private 복사본이 존재해 두 구현이 언제든 diverge할 수 있다. 중앙 유틸 테스트가 없으면 이 drift를 감지할 수 없다.
- 제안: `workspaces.service.spec.ts`(또는 별도 파일)에 `isValidIanaTimezone`을 직접 import하여 `UTC`, `Etc/UTC`, `GMT`, 빈 문자열, 65자 초과 문자열을 커버하는 단위 테스트 추가. 중복 구현은 shared util로 통합 권장.

### [WARNING] `resolveTimezone` — workspace가 null인 경우 테스트 누락
- 위치: `/codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `create — timezone fallback (§2.2)` describe 블록
- 상세: `schedules.service.ts:478-482`의 `resolveTimezone`에서 `workspaceRepository.findOne`이 `null`을 반환하는 경우(`workspace?.settings?.timezone` → undefined → `'Asia/Seoul'` 폴백)가 테스트되지 않는다. 현재 3번째 케이스(`settings: {}`)는 workspace 존재는 하되 timezone 키만 없는 상황이다. 실제 운영에서 workspace가 삭제되거나 ID가 잘못된 경우 null 반환이 충분히 발생할 수 있다.
- 제안: `workspaceRepo.findOne.mockResolvedValue(null)` 케이스를 추가하여 최종 폴백 `'Asia/Seoul'`이 반환됨을 검증.

### [WARNING] `UpdateWorkspaceSettingsDto.timezone` 의 DTO 레벨 유효성 — 공백 전용 문자열 처리 불일치
- 위치: `/codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:38-41`
- 상세: DTO에 `@IsString()`, `@MaxLength(64)` 만 있고 `@Matches()`나 `@MinLength()`가 없어 공백 전용 문자열(`"   "`)이 DTO 유효성 통과 후 서비스 계층에 도달한다. 서비스에서는 `dto.timezone.trim()`으로 공백을 제거해 빈 문자열로 처리(키 제거)하는데, 이 동작에 대한 테스트가 없다. 명시적 빈 문자열(`""`) 케이스 테스트는 있지만 공백 전용(`"  "`) 케이스는 없다.
- 제안: `workspaces.service.spec.ts`에 `timezone: '  '`(공백 전용) 입력 시 키가 제거됨을 검증하는 케이스 추가. DTO에 `@Transform(() => value.trim())` 또는 `@Matches(/\S/)` 추가도 고려.

### [INFO] e2e 레벨에서 timezone 설정/조회/스케줄 fallback 경로가 미검증
- 위치: `/codebase/backend/test/workspace-rbac.e2e-spec.ts` — 테스트 G 및 `/codebase/backend/test/schedule-trigger.e2e-spec.ts`
- 상세: `workspace-rbac.e2e-spec.ts` 테스트 G는 `interactionAllowedOrigins`만 다루고 `timezone` PATCH/GET를 검증하지 않는다. `schedule-trigger.e2e-spec.ts`는 `timezone: 'Asia/Seoul'` 하드코딩으로 스케줄을 생성하며 workspace timezone 미지정 fallback 경로(워크스페이스 settings.timezone → Asia/Seoul)를 실제 DB 경유로 검증하지 않는다. 단위 테스트만으로는 TypeORM jsonb 병합, DB 컬럼 타입, 직렬화 포맷이 의도대로 동작함을 보증하기 어렵다.
- 제안: 기존 e2e 테스트 G에 `{ interactionAllowedOrigins: [], timezone: 'Europe/London' }` PATCH 후 GET 응답에 timezone 포함 여부, 빈 문자열 PATCH 후 키 제거 여부를 추가 검증. 우선순위는 낮으나 회귀 방지 가치가 있다.

### [INFO] `create` 경로 — `resolveTimezone` 호출 후 `registerJob` 미검증
- 위치: `/codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `create — timezone fallback` describe
- 상세: 해당 describe의 `beforeEach`에서 `runner.registerJob`은 mock 제공이 되어 있으나, timezone fallback 케이스에서 `registerJob`이 호출되었는지(`isActive` 기본값 true이므로 호출되어야 함) 확인하지 않는다. timezone 로직에 집중한 의도는 이해되나, timezone fallback과 이후 BullMQ 등록 사이에 예외가 발생할 수 있는 경로가 커버되지 않는다.
- 제안: 현재 테스트 범위 내에서 `expect(runner.registerJob).toHaveBeenCalled()` 단언 추가(낮은 우선순위, 기존 runNow 테스트와 보완 관계).

### [INFO] `as never` 타입 캐스팅이 타입 안전성을 우회
- 위치: `/codebase/backend/src/modules/schedules/schedules.service.spec.ts:156,165,171`
- 상세: `service.create('ws-1', { ...baseDto } as never)` 패턴은 TypeScript가 DTO 형태를 검증하지 못하게 한다. `CreateScheduleDto`에 필수 필드가 추가되거나 변경되어도 컴파일 타임에 감지되지 않아 테스트가 구현과 괴리될 수 있다. `as never` 대신 실제 DTO 타입을 사용하거나 `Partial<CreateScheduleDto>` 캐스팅이 더 안전하다.
- 제안: `baseDto`를 `CreateScheduleDto` 인터페이스에 맞게 정의하거나 최소한 `as unknown as CreateScheduleDto`로 변경하여 의도적 우회임을 명시. `as never`는 타입 체커를 완전히 침묵시키므로 지양.

## 요약

신규 테스트(6건: schedules.service.spec.ts 3건 + workspaces.service.spec.ts 3건)는 §2.2 timezone fallback의 핵심 분기(명시값 우선 · workspace fallback · 하드코딩 폴백, 유효성 오류, 빈 문자열 제거)를 적절히 커버하며, mock 격리와 beforeEach 리셋도 정상이다. 그러나 `isValidIanaTimezone` 함수의 독립 단위 테스트 부재, `resolveTimezone`에서 workspace null 반환 케이스 미검증, 공백 전용 timezone 처리 경로 누락이 실운영에서 예상치 못한 동작으로 이어질 수 있다. e2e 레벨에서 timezone 설정 흐름 전체를 통합 검증하지 않는 점도 단위 테스트의 mock 의존성에 따른 DB 직렬화 신뢰도를 낮춘다. `as never` 캐스팅은 테스트 코드의 타입 안전성을 훼손한다.

## 위험도

MEDIUM
