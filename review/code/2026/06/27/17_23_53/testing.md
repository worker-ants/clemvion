# Testing Review

## 발견사항

### [WARNING] `warn.mockRestore()` 가 try/finally 없이 호출됨
- **위치**: `/codebase/backend/src/modules/llm/list-models-cap.spec.ts` — "logs a warning only when truncating" 테스트 마지막 줄
- **상세**: `warn.mockRestore()`는 `expect(warn).toHaveBeenCalledTimes(1)` assertion 실패 시 실행되지 않는다. Logger.prototype.warn 스파이가 복원되지 않은 채 남게 된다. 현재는 해당 it() 블록이 파일 내 마지막 테스트여서 즉각적 피해는 없지만, 이후 같은 파일에 테스트가 추가될 경우 스파이가 누수돼 격리가 깨진다. 또한 두 번째 `capModelList(over, logger)` 호출이 실제로 warn 을 1회 호출하는지 의존 — `warn.mockRestore()` 를 포함하는 별도의 afterEach 또는 try/finally 블록이 없다.
- **제안**: `afterEach(() => warn.mockRestore())` 패턴으로 분리하거나, `jest.spyOn` 호출을 `beforeEach`/`afterEach`로 래핑한다. 또는 `expect.assertions(n)` 을 추가해 assertion 수 미달 시 즉시 실패하도록 방어한다.

### [INFO] `SENSITIVE_ACTION_THROTTLE` 상수 값에 대한 직접 테스트 없음
- **위치**: `/codebase/backend/src/common/constants/throttle.ts`
- **상세**: `SENSITIVE_ACTION_THROTTLE = { default: { ttl: 60_000, limit: 10 } }` 는 비즈니스 정책 상수이지만, 이 값 자체를 검증하는 테스트가 없다. `INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE`, `PROVIDER_PROBE_THROTTLE = SENSITIVE_ACTION_THROTTLE` 로 리팩터링한 후에는 값이 바뀌어도 기존 unit test 가 잡아내지 못한다. throttle 한도(limit: 10, ttl: 60_000) 변경은 silent regression 이 된다.
- **제안**: 상수 파일에 대한 직접 assertion 은 과할 수 있으나, e2e/integration 레벨에서 throttle 거동을 검증하는 테스트가 없다면 최소한 상수 값에 대한 스냅샷 또는 컴파일 타임 assertion(`satisfies`) 을 고려한다.

### [INFO] `workspaces.controller.ts` throttle 리팩터링에 대한 회귀 테스트 부재
- **위치**: `/codebase/backend/src/modules/workspaces/workspaces.controller.ts`
- **상세**: `INVITATION_THROTTLE` 를 인라인 객체에서 `SENSITIVE_ACTION_THROTTLE` 참조로 변경했으나 이 변경을 검증하는 controller unit/integration 테스트가 변경 세트에 없다. 실제 동작(값 동일)은 유지되지만 `@Throttle(INVITATION_THROTTLE)` 데코레이터가 올바른 값을 받는지 테스트로 보장하지 않는다.
- **제안**: 기존 workspaces controller e2e 테스트에서 invitation 엔드포인트에 throttle 검증이 있다면 충분하다. 없다면 별도 트랙으로 추가를 고려한다. 현 변경 자체는 리팩터링 수준이므로 즉각 차단 사항은 아니다.

### [INFO] `model-type.ts` DTO 추출에 대한 직접 테스트 없음
- **위치**: `/codebase/backend/src/modules/model-config/dto/model-type.ts`
- **상세**: `MODEL_TYPE_ENUM`/`ModelTypeFilter` 를 컨트롤러 파일에서 별도 DTO 파일로 이전했다. 컨트롤러 `ParseEnumPipe` 가 허용값 외 입력에 400 을 반환하는지 검증하는 단위 테스트가 변경 세트에 없다. 타입 이동은 TypeScript 컴파일러가 안전성을 보장하지만, `Object.values(MODEL_TYPE_ENUM)` 런타임 동작은 명시적으로 검증되지 않는다.
- **제안**: 컨트롤러에 대한 NestJS Testing Module 기반 unit test 에서 `type=rerank` 쿼리 파라미터 전달 시 400 응답을 검증하는 케이스를 추가하면 ParseEnumPipe 연동 회귀를 잡을 수 있다.

### [INFO] `capModelList` 캐시 저장 전 적용 — 캐시 히트 경로 테스트 없음
- **위치**: `/codebase/backend/src/modules/llm/llm.service.ts` 내 `listModels` + `llm.service.spec.ts`
- **상세**: `capModelList(models, this.logger)` 는 캐시 저장 직전에 호출되므로 캐시된 결과는 이미 상한 적용 상태다. 그러나 현재 추가된 테스트 `'caps a pathologically large provider response at MAX_MODEL_LIST_SIZE'` 는 캐시 미스 경로만 검증한다. 캐시 히트 경로(동일 configId 를 두 번 호출하는 케이스)에서 cap 이 적용된 목록이 올바르게 반환되는지는 테스트하지 않는다.
- **제안**: 캐시 히트 경로에서 대량 응답이 이미 절단된 상태로 저장·반환되는지 확인하는 테스트를 추가한다. 실제 버그 가능성은 낮으나(캐시 저장 후 재조회이므로 동일 배열 참조), 의도된 동작을 명시적으로 문서화하는 효과가 있다.

---

## 요약

이번 변경의 핵심 기능인 `capModelList` 함수는 전용 단위 테스트(`list-models-cap.spec.ts`)를 갖추고 있으며 경계값(빈 배열, 정확히 cap, 미만, 초과)과 로그 동작을 모두 커버한다. `LlmService.listModels` 및 `LlmPreviewService.previewModels` 양 경로에 cap 통합 테스트도 추가됐다. 상수 추출(`SENSITIVE_ACTION_THROTTLE`) 및 DTO 이전(`MODEL_TYPE_ENUM`) 은 타입·값 불변 리팩터링으로 기존 테스트의 회귀 보호가 유효하다. 주요 개선 포인트는 `list-models-cap.spec.ts` 의 spy 복원(`warn.mockRestore()`)을 try/finally 또는 afterEach 로 보호하는 것이며, 나머지는 정보성 보완 제안이다.

## 위험도

LOW
