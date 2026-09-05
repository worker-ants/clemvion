# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `GET/POST/PATCH /api/schedules` 응답의 `trigger` 필드가 **Trigger 엔티티 전체**에서 4개 참조 필드로 좁혀지는 공개 API 인터페이스 변경.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:67-83` (`private toResponse<T extends Schedule>(...)`, `findAll`/`findOne`/`create`/`update` 4개 핸들러에 적용, 각각 101/119-121/194-196/246-248행)
  - 상세: 종전엔 `leftJoinAndSelect('s.trigger', 't')`(서비스는 `relations: ['trigger', 'trigger.workflow']`)로 `type`·`config`·`endpointPath`·`authConfigId`·`cronExpression` 등 `ScheduleDto` 가 선언하지 않던 필드까지 wire 로 나갔다. 이번 변경은 이를 `{ id, name, workflowId, workflow?.name }` 로 좁힌다. 보안상 필요한 수정(같은 컬럼에 회전 secret `notificationSecretV2`/`chatChannelTokenV2` 가 실려 있었음)이고, CHANGELOG 에 영향 범위(프런트엔드 소비처 4곳, `schedules/page.tsx`)가 명시돼 있어 내부 소비자 영향은 확인됐다. 다만 이 엔드포인트를 응답 본문 그대로 로깅·캐시·재전송하는 미확인 외부/서드파티 소비자가 있다면 `trigger.type`/`trigger.config`/`trigger.isActive` 등 나머지 필드 참조 경로가 조용히 깨진다 — 이 리뷰의 관점(부작용)에서는 "선언 없이 실려 있던 필드를 제거"가 **기존 호출자에 대한 breaking change** 라는 사실 자체를 별도로 기록해 둔다.
  - 제안: 이미 CHANGELOG·이전 라운드 api_contract 리뷰(`review/code/2026/09/05/18_23_02/api_contract.md`)에 동일 항목이 등재·수용돼 있다. 추가 조치 불요, 참고용 재확인.

- **[INFO]** 신규 모듈-레벨 캐시(전역 가변 상태) — `contractForDto` 가 `Type<unknown> → Promise<DtoContract>` 를 키로 하는 module-scope `Map` 을 갖는다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:407` (`const contractCache = new Map<...>()`), 사용부 `:409-422`
  - 상세: 이전에는 `contractForDto` 가 호출마다 Nest 테스트 모듈을 새로 부트스트랩하는 순수 함수였다. 이제 DTO 클래스를 키로 하는 module-level `Map` 이 생겨, 같은 Jest worker 프로세스 수명 동안(여러 테스트 파일에 걸쳐) 결과가 유지된다. 설계는 신중하다 — 진행 중 promise 를 캐시해 동시 호출의 중복 부트스트랩을 막고, 실패한 promise 는 `catch` 에서 즉시 `contractCache.delete` 한다(`:414-419`). DTO 데코레이터는 클래스 정의 시점에 정적으로 고정되므로 캐시 무효화 이슈는 실질적으로 없다. `src/shared/testing/**` 는 `tsconfig.build.json` exclude 대상이라 프로덕션 dist 에는 섞이지 않는다(이전 라운드에서 확인된 사실, 이번 diff 로 그 경계가 바뀌지 않았음을 재확인). 이 항목은 `review/code/2026/09/05/18_23_02/side_effect.md` 에 이미 동일하게 기록·수용됐다 — 새 diff 에서 이 캐시의 동작 자체는 바뀌지 않았고 참조용으로만 다시 남긴다.
  - 제안: 조치 불요(기존 판단 유지). `tsconfig.build.json` exclude 회귀만 감시.

- **[INFO]** `TriggersService.sanitizeForResponse`(舊 `sanitizeChatChannelForResponse`) 확장 — 엔티티를 변경하지 않는 새 객체 반환임을 코드로 재확인.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:576-639`
  - 상세: `Object.assign(Object.create(Object.getPrototypeOf(trigger)), trigger, overrides)` (628-632행)로 **새 객체**를 만든 뒤 그 새 객체에서만 `delete sanitized[column]` (633-637행)을 수행한다 — 원본 `trigger`/`saved`/`result` 인자는 변경되지 않는다. `findAll`/`findOneDetail`/`create`/`update` 4개 호출부 모두 이 반환값을 그대로 리턴하거나 곧바로 사용을 끝내므로, 사후에 원본 엔티티가 재사용되며 잘못된 상태를 참조할 여지는 없음을 확인했다. `config` 정화 경로도 `{ ...cfg }`/`{ ...cfg.chatChannel }`/`{ ...cfg.notification }` 스프레드만 사용해 원본 JSONB 참조를 직접 mutate 하지 않는다(586-624행). 조기 return 제거로 정화 대상이 없는 트리거도 이제 매번 새 참조를 받으므로, 호출부가 (문서화된 대로) 참조 동일성을 전제하지 않는지 확인 — 4개 호출부 모두 반환값만 사용해 해당 없음.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** `schedules.service.ts` — `saved.trigger = savedTrigger` 대입 위치가 `if (isActive)` 블록 밖으로 이동(무조건 실행).
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:203` (`create()`), 종전에는 205행 `if (isActive)` 블록 안에 있었다.
  - 상세: 이 대입은 in-memory 참조 갱신일 뿐 그 뒤에 `save()`/`update()` 재호출이 없어(같은 함수 내 최종 `return saved;` 까지 추가 영속화 없음을 확인) DB 저장 경로에는 영향이 없다. `isActive=true` 경로에서 `registerJob(saved)` 에 전달되는 `saved.trigger` 값은 종전과 동일(호출 직전 대입되던 것과 동일 값)하므로 회귀는 없고, `isActive=false` 로 생성된 스케줄의 응답에서도 이제 `trigger` 참조가 실린다(버그 수정). 다만 `update()` 쪽의 대응 대입(`saved.trigger = trigger ?? schedule.trigger`, 258행 부근, 이번 diff 에 포함되지 않은 기존 코드)은 여전히 `if (schedule.isActive)` 안에만 있어 — PATCH 로 `isActive: false` 로 전환하면 `SchedulesController.toResponse` 의 §5.4 키-생략 규칙과 맞물려 응답에서 `trigger` 키가 사라진다. e2e 주석(`test/schedule-trigger.e2e-spec.ts` PATCH 케이스, `review/code/2026/09/05/19_08_18 W5` 인용)이 이 비대칭을 이미 인지하고 있어 새로 발견된 결함은 아니지만, `create()`/`update()` 두 경로가 "공유 헬퍼만으로 안전이 자동 보장되지 않는" 상태로 남아 있다는 점은 부작용 관점에서 재확인해 둔다.
  - 제안: 조치 불요(이미 추적 중, 문서화됨) — 참고용 기록.

- **[INFO]** `contractForDto` 가 `async function` 선언에서 일반 함수로 바뀜(반환 타입은 동일 `Promise<DtoContract>`).
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:409` (이전 `export async function contractForDto(...)`)
  - 상세: 모든 호출부가 `await contractForDto(...)` 형태로만 사용되므로(diff 전체 e2e 스펙 신규 배선 지점 포함 관측 가능한 차이 없음) 시그니처 관점의 실질 영향은 없다. `async` 제거로 함수 본문의 동기 예외가 (현재는 없지만) rejected promise 대신 즉시 throw 로 전파될 수 있다는 미묘한 차이만 남는다 — 현재 본문(`contractCache.get`)은 던지지 않으므로 위험 없음.
  - 제안: 조치 불요.

## 검증 메모

- 저장소 트리에 아무것도 쓰지 않았다(`git status --short` 로 재확인 — 이번 세션 산출물 디렉터리 외 변경 없음). 코드 뮤테이션은 하지 않고 `Read`/`git diff`/`grep` 정적 대조만 수행했다.
- 대상 diff 는 `origin/main...HEAD` 전체(3개 코드 커밋 `dfb2664af`/`cb17f0870`/`a6f582680` + 1개 docs 커밋 `9a9c024a6` + merge `a4e1e04dc`)이며, 앞선 리뷰 라운드(`review/code/2026/09/05/18_23_02`)가 이미 다룬 항목은 그 결론이 이번 diff 로 바뀌지 않았음을 코드로 재확인한 뒤 INFO 로 재기록했다. `cb17f0870`(§5.4 금지 조합 정정 + 래칫 가드 신설)·`a6f582680`(양성 대조군 fixture 교체)는 전부 테스트/문서 레이어 변경이라 이번 리뷰 관점의 새 부작용 표면을 만들지 않았다 — `swagger-dto-contract-guard.ts` 의 신규 함수(`findOptionalNullableResponseFields`/`isResponseDtoFile`)는 `fs.readFileSync` 읽기 전용이고, 신규 fixture(`optional-nullable.fixture.ts`)는 스캔 루트(`src/modules`) 밖에 있어 프로덕션 베이스라인을 오염시키지 않음을 테스트 자체가 단언한다.
- `process.env`/`fs.write*`/네트워크 호출 관련 신규 표면은 diff 전체에서 검색되지 않았다(`grep -nE "process\.env|fs\.(write|unlink|mkdir|rm)"` 0건).

## 요약

이번 변경은 §5.4 응답-계약 스윕이 검출한 두 건의 실제 비밀 유출(트리거 회전 secret 이 `GET/POST/PATCH /api/triggers` 및 조인 경유 `GET/POST/PATCH /api/schedules` 로 노출)을 응답 경계에서 막고, 나머지는 이미 wire 에 나가고 있던 필드의 DTO 선언을 실제에 맞추는 교정이다. `sanitizeForResponse`/`toResponse` 는 원본 엔티티를 mutate 하지 않고 새 객체를 반환하도록 구현돼 있음을 코드로 재확인했고, `schedules.service.ts` 의 트리거 대입 위치 이동도 DB 저장 경로에 영향 없는 in-memory 수정이다. 유일한 실질적 인터페이스 변경은 스케줄 응답의 `trigger` 필드 축소(WARNING)인데, 이는 CHANGELOG 에 이미 문서화되고 전 라운드 리뷰에서도 수용된 의도적 breaking change 다. 신규 전역 가변 상태(`contractCache`)는 테스트 전용 경로에 격리돼 있고 이전 라운드에서 이미 평가·수용됐다. 새 코드 커밋들(`cb17f0870`/`a6f582680`)은 테스트·가드 레이어에 국한돼 새로운 부작용 표면을 추가하지 않는다. 치명적이거나 예상 밖의 부작용은 발견되지 않았다.

## 위험도

LOW
