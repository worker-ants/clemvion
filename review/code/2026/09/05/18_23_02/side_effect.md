# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 신규 모듈-레벨 캐시(전역 가변 상태) 도입 — `contractForDto` 가 `Type<unknown> → Promise<DtoContract>` 를 키로 하는 module-scope `Map` 을 새로 갖는다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:407` (`const contractCache = new Map<...>()`), 사용부 `:409-422` (`contractForDto`/`buildContractForDto`)
  - 상세: 이전에는 `contractForDto` 가 호출마다 Nest 테스트 모듈을 새로 부트스트랩하는 순수 함수였다. 이번 변경으로 DTO 클래스를 키로 하는 module-level `Map` 이 생겨, 같은 Jest worker 프로세스 내에서 호출한 결과(진행 중 promise 포함)가 프로세스 수명 동안(=해당 worker 가 재사용되는 한 여러 테스트 파일에 걸쳐) 유지된다. 설계 자체는 신중하다 — 진행 중 promise 를 캐시해 동시 호출의 중복 부트스트랩을 막고, 실패한 promise 는 `catch` 에서 즉시 `contractCache.delete` 해 "한번 실패하면 영원히 실패" 상태를 피한다. DTO 데코레이터는 클래스 정의 시점에 정적으로 고정되므로 캐시 무효화 이슈는 실질적으로 없다. 다만 "전역 변수 신설" 관점에서는 명백한 신규 표면이라 기록해 둔다.
  - 제안: 특별한 조치 불필요 — 설계·문서화(JSDoc)가 이미 이 트레이드오프를 설명하고 있다. 다만 이 파일이 `tsconfig.build.json` 의 `exclude` 대상(테스트 전용, `src/shared/testing/**`)에 계속 남아 있는지만 회귀 감시하면 된다(프로덕션 dist 에 캐시가 섞여 들어갈 표면이 원리적으로는 존재).

- **[INFO]** `contractForDto` 가 `async function` 선언에서 일반 함수로 바뀌었다 (반환 타입은 동일하게 `Promise<DtoContract>`).
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:409` (`export function contractForDto(...)`, 이전 `export async function contractForDto(...)`)
  - 상세: 모든 호출부가 `await contractForDto(...)` 형태로만 쓰이므로(실제로 diff 전체에서 확인된 14곳 e2e 스펙 전부 `await`) 관측 가능한 차이는 없다. 다만 `async` 제거로 인해 함수 본문에서 동기적으로 던지는 예외가 있다면 (현재는 없음 — `contractCache.get` 은 던지지 않는다) rejected promise 대신 동기 throw 로 전파된다는 미묘한 차이가 생긴다. 지금은 실질적 위험이 없다.
  - 제안: 조치 불필요. 향후 이 함수 본문에 동기 코드가 추가될 경우 이 차이를 염두에 둘 것.

- **[INFO]** `GET/POST/PATCH /api/schedules` 응답의 `trigger` 필드 형태가 축소됐다 — 공개 REST 응답 인터페이스 변경.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse` 메서드(53~80번째 줄 부근) 및 `findAll`/`findOne`/`create`/`update` 4개 핸들러
  - 상세: 종전에는 `ScheduleDto.trigger` 자리에 `Trigger` 엔티티 **전체**(비밀 컬럼 포함)가 그대로 나갔다. 이제 컨트롤러 경계에서 `{ id, name, workflowId, workflow?: { name } }` 4필드로 좁힌다. 이는 CHANGELOG 에 명시된 **의도된 보안 수정**이고, 프런트엔드 소비처는 `schedules/page.tsx` 한 곳(실측 확인됨 — 다른 컴포넌트의 `.trigger` 참조는 무관한 prop 이름 재사용)뿐임을 확인했다. 그럼에도 이 자체는 "기존 필드가 사라지는" 응답 계약 변경이므로, 문서화되지 않은 제3자/사내 다른 소비처(예: 외부 웹훅 알림 페이로드 재사용, 모바일 클라이언트 등)가 `trigger.type`/`trigger.config`/`trigger.isActive` 등 나머지 필드를 참조하고 있었다면 그 경로는 이번 배포로 깨진다.
  - 제안: 이미 CHANGELOG 에 영향 범위가 적혀 있으므로 추가 조치는 불필요해 보인다. 다만 사내 다른 서비스(그로스/분석 파이프라인 등)가 이 엔드포인트를 직접 소비하는지 한 번 더 확인해 두면 안전하다.

- **[INFO]** 사설 메서드 rename 이후 남은 stale 주석 — 동작에는 영향 없음.
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:112` (`// plaintext / ref 는 응답에 절대 없어야 함 (sanitizeChatChannelForResponse).`)
  - 상세: `TriggersService` 의 private 메서드가 `sanitizeChatChannelForResponse` → `sanitizeForResponse` 로 이름이 바뀌었다(`codebase/backend/src/modules/triggers/triggers.service.ts`, `sanitizeForResponse` 정의부). 이 rename 은 private 메서드라 외부 호출자 영향은 없지만, 위 e2e 테스트 파일의 주석 하나가 옛 이름을 그대로 인용하고 있어 이 PR 이후로 stale 해졌다. 동작에는 영향 없는 순수 문서 drift.
  - 제안: 사소하지만 원할 경우 주석을 `sanitizeForResponse` 로 갱신.

## 검증 메모

- 저장소 트리에는 아무것도 쓰지 않았다 (`git status --short` 로 확인 — review 산출물 디렉터리 외 변경 없음). 뮤테이션 검증은 하지 않고 `Read`/`grep` 정적 대조만 수행했다.
- `PaginatedResponseDto` (data/pagination 두 필드만 보유), `ClassSerializerInterceptor` 미사용, `schedulesService.*` 의 유일한 소비자가 `SchedulesController` 뿐임(grep 확인)을 근거로, `schedules.controller.ts` 의 `{ ...schedule, trigger: ... }` 스프레드가 프로토타입 메서드 유실이나 다른 소비처 영향으로 이어지지 않음을 확인했다.
- `TriggersService.sanitizeForResponse` 는 매번 **새 객체**를 만들어 반환하고(`Object.assign(Object.create(...), trigger, overrides)` 뒤 `delete`), 원본 `trigger`/`schedule` 엔티티는 변경하지 않는다 — DB 저장 경로에 영향 없음을 코드로 확인.
- `buildSwaggerDocument` 는 기존과 동일하게 `app.close()` 를 `finally` 에서 호출한다(`swagger-probe.ts`, 변경 없음) — 캐싱 도입으로 오히려 이 부트스트랩·종료 사이클의 호출 빈도가 **줄어든다** (기존: 매 호출마다, 신규: DTO 당 1회).

## 요약

이번 변경은 §5.4 응답-계약 스윕이 검출한 두 건의 실제 비밀 유출(트리거 `notificationSecretV2`/`chatChannelTokenV2` 가 `GET/POST/PATCH /api/triggers` 와 조인 경유 `GET/POST/PATCH /api/schedules` 로 노출)을 응답 경계에서 막고, 나머지는 이미 wire 에 나가고 있던 필드의 DTO 선언을 실제에 맞추는 문서 정합화다. 부작용 관점에서 가장 눈에 띄는 것은 테스트 헬퍼(`response-contract.ts`)에 신설된 module-level 캐시(전역 가변 상태)인데, 설계가 신중하고(promise 캐싱, 실패 시 무효화, worker 격리) 프로덕션 코드 경로가 아니므로 위험은 낮다. `TriggersService.sanitizeForResponse`/`SchedulesController.toResponse` 는 원본 엔티티를 변경하지 않고 새 객체를 반환하도록 구현되어 있고, 응답 형태 축소(스케줄의 `trigger` 필드)는 유일하게 확인된 프런트엔드 소비처와 정확히 일치한다. 시그니처·인터페이스 변경(스케줄 응답 축소, `contractForDto` 의 `async` 제거)은 모두 의도적이고 호출부와 정합하는 것으로 확인했으며, 치명적이거나 예상 밖의 부작용은 발견하지 못했다.

## 위험도

LOW
