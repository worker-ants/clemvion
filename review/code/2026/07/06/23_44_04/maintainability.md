# 유지보수성(Maintainability) Review

## 리뷰 범위

실질 코드 변경은 4개 파일(+1 e2e 파일):
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규, 공용 util 추출)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (sanitizer 적용 1줄 교체)
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (로컬 함수 제거, import 로 교체)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (`getNotificationsService` 4분기 unit 추가)
- `codebase/backend/test/background-monitoring.e2e-spec.ts` (REST 미노출 단언 추가)

나머지(plan/*.md, review/**/*.md, spec/*.md)는 문서 산출물로 코드 유지보수성 관점 대상이 아니므로 제외.

### 발견사항

- **[INFO]** 중복 제거 리팩터링이 깔끔하게 수행됨
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규), `background-execution.processor.ts:12-20` (제거분), `execution-engine.service.ts:4495`
  - 상세: 기존 `background-execution.processor.ts` 안에 로컬로 있던 `sanitizeErrorMessage`+상수 3개(`ERROR_MESSAGE_MAX_LENGTH`, `STACK_TRACE_PATTERN`, `CONNECTION_STRING_PATTERN`)를 `sanitize-error-message.ts` 단일 모듈로 추출하고, 두 호출부(processor·execution-engine.service)가 이를 공유하도록 정리했다. 이전 리뷰(22_42_32) 의 "방어 심도가 갈린다" WARNING 을 정확히 해결하는 형태이며, JSDoc 에 "두 경로가 공유하는 이유"를 명시해 향후 세 번째 호출부가 추가될 때도 의도를 파악하기 쉽다. 매직 넘버(500자)와 정규식 패턴이 이름 있는 상수로 잘 분리되어 있다.
  - 제안: 없음. 모범적인 중복 제거 사례.

- **[INFO]** `getNotificationsService` 캐싱 로직의 가독성은 양호하나 `undefined`/`null` 이중 상태가 약간 미묘함
  - 위치: `execution-engine.service.ts:693, 700-713`
  - 상세: `resolvedNotificationsService?: NotificationsService | null` 필드가 "아직 시도 안 함"(undefined)과 "시도했지만 못 찾음"(null)을 구분하는 sentinel 패턴을 쓴다. 캐시 히트/미스 판정(`!== undefined`)과 반환 시 `?? undefined` 변환이 한 함수 안에 몰려 있어 최초 1회 읽는 사람은 undefined/null 두 상태의 의미를 되짚어야 한다. 다만 함수가 14줄로 짧고 JSDoc 이 의도(순환 그래프 인스턴스화 순서 문제, 지연 해석, 캐시)를 명확히 설명하므로 실질적 유지보수 부담은 낮다.
  - 제안: 필요 시 `NOT_YET_RESOLVED` 같은 별도 sentinel 상수보다는 현재 방식(undefined/null)이 TypeScript 관용구에 맞으므로 그대로 두어도 무방. 다만 "이미 존재하는 신규 @Optional 순환 의존이 동일 패턴을 재사용할 때" 대비해 이 캐싱 로직을 별도 유틸(`makeLazyModuleRefResolver` 등)로 뽑아 재사용 가능하게 만드는 것을 고려할 수 있음 — 이미 `notif-hardening-followups.md` 에 아키텍처 부채로 기록되어 있어 별도 조치 불요.

- **[INFO]** 테스트가 private 메서드/필드에 타입 캐스팅으로 직접 접근
  - 위치: `execution-engine.service.spec.ts:39-45` (`type Svc`, `asSvc()`)
  - 상세: `getNotificationsService`, `notificationsService`, `moduleRef`, `resolvedNotificationsService` 가 모두 private 인데 `service as unknown as Svc` 캐스팅으로 우회 접근한다. 4개 테스트 케이스 각각이 `asSvc().notificationsService = ...`, `asSvc().moduleRef = ...`, `asSvc().resolvedNotificationsService = undefined` 세 줄을 거의 그대로 반복(중복도 다소 있음)한다. 이는 화이트박스 unit 테스트에서 흔한 트레이드오프이며, 기존 파일 스타일(주석에 언급된 `CheckpointSubject` 패턴)과도 일관되어 코드베이스 컨벤션을 따르는 것으로 판단된다.
  - 제안: 4개 케이스에서 반복되는 3줄 셋업(`notificationsService`/`moduleRef`/`resolvedNotificationsService` 초기화)을 `beforeEach` 또는 헬퍼 함수로 뽑으면 중복이 약간 줄어들 수 있으나, 각 테스트가 독립적으로 읽기 쉬운 현재 형태도 실용적 수준이라 강제할 사안은 아님.

- **[INFO]** 새니타이징 안내 주석의 근거 참조 방식(review 타임스탬프)
  - 위치: `execution-engine.service.ts:120-122`, `background-execution.processor.ts:169-170`
  - 상세: 코드 주석이 `(security review 22_42_32 WARNING — 방어 심도 통일)` 형태로 리뷰 세션 타임스탬프를 인용한다. 이 프로젝트의 review 산출물 경로 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)과 일치하며 변경 이력 추적에는 유용하나, 코드 주석에 외부 문서의 임시 식별자(날짜/시각 폴더명)를 남기면 해당 리뷰 폴더가 아카이브되거나 이동될 경우 참조가 무의미해질 수 있다.
  - 제안: 현재 규모(짧은 인라인 주석 1줄)에서는 문제 삼을 정도는 아님. 코드베이스에 이미 유사한 리뷰-타임스탬프 인용 관례가 있다면(다른 커밋에서도 발견됨) 일관성 있는 기존 패턴으로 간주 가능.

### 요약

이번 변경은 이전 리뷰(22_42_32)에서 지적된 "에러 메시지 새니타이징 로직이 한 곳에만 적용되어 방어 심도가 갈린다"는 문제를 `sanitize-error-message.ts` 단일 유틸로 추출해 정확히 해소했으며, 회귀 가드용 unit 4건과 e2e 단언도 함께 추가되어 테스트 커버리지가 실제 동작 분기를 잘 반영한다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 매직 넘버는 이름 있는 상수로 분리되어 있으며, JSDoc 주석이 "왜 이렇게 했는지"(순환 DI, 방어 심도 통일)를 충실히 설명해 향후 유지보수자가 맥락을 파악하기 쉽다. private 필드 캐스팅 기반 테스트나 캐시 sentinel 이중 상태 같은 사소한 트레이드오프가 있으나 기존 코드베이스 관용구와 일관되고 각기 문서화되어 있어 실질적 유지보수 리스크는 낮다.

### 위험도
NONE
