### 발견사항

- **[WARNING]** `run()` 의 `pending_install` 제외 로직(REQ-C1)에 대한 전용 단위 테스트 누락
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.ts` (파일 10), `integration-expiry-scanner.service.spec.ts` (파일 9)
  - 상세: `integration-expiry-scanner.service.ts` 의 `run()` 메서드는 만료 알림 후보를 조회할 때 `status: Not(In(['expired', 'error', 'pending_install']))` 으로 `pending_install` 상태를 명시 제외한다(REQ-C1). 그러나 `integration-expiry-scanner.service.spec.ts` 에 이 제외 동작을 직접 검증하는 테스트가 없다. `pending_install` 상태의 통합이 만료 알림 대상에서 제외되는지 확인하는 회귀 테스트가 추가되어야 한다. `enqueueCafe24BackgroundRefresh` 는 `where.status === 'connected'` 를 검증하는 테스트가 있으나, `run()` 의 `Not(In([..., 'pending_install']))` 경로는 미검증 상태다.
  - 제안: `run()` 이 `pending_install` 행의 `tokenExpiresAt` 가 만료 horizon 안에 있어도 알림을 발송하지 않음을 검증하는 테스트 추가. 예: `pending_install` 상태의 행을 mock 리포지토리에 주입 후 `dispatchRepo.insert` / `notificationsService.createMany` 미호출 확인.

- **[WARNING]** `cafe24-token-refresh.processor.spec.ts` 에 중복 테스트 케이스 존재
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts` 라인 105–135
  - 상세: "propagates refreshAccessToken failure (BullMQ failed marking depends on this)" 라는 동일한 `it()` 설명과 동일한 구현을 가진 테스트가 두 번 연속 정의되어 있다(라인 109–118, 라인 125–135). 이는 테스트 격리 원칙 위반이며, 테스트 결과가 실제로 두 케이스를 덮었는지 혹은 한 케이스가 다른 케이스를 은폐하는지 불명확하다. Jest 에서는 동일 describe 스코프 안의 동일 description 케이스 중 하나가 무시되거나 양쪽 모두 실행되어도 의도적인지 실수인지 구분이 어렵다.
  - 제안: 중복 케이스 중 하나를 제거하거나, 의도적으로 다른 케이스(예: 다른 `source` 값)를 테스트하는 것이라면 설명을 구분하여 명시.

- **[WARNING]** `OAuthBeginResultDto` 의 유니온 분기에 대한 단위 테스트 미존재
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (파일 7)
  - 상세: `OAuthBeginResultDto` 는 일반 흐름(`authorizeUrl + state`)과 Cafe24 Private 분기(`mode === 'cafe24_private_pending'` + `integrationId`, `appUrl`, `callbackUrl`, `scopesAdded?`) 두 형태를 모두 optional 필드로 표현한다. 두 분기 모두 필드가 선택적이어서 타입 시스템만으로는 각 분기의 필수 필드 누락을 잡을 수 없다. `integration-oauth.service.cafe24.spec.ts` 에서 `begin()` 반환값의 분기별 필드 존재 여부를 검증하는 테스트가 있는지 확인 필요하다. Cafe24 Private `begin()` 반환 시 `integrationId`, `appUrl`, `callbackUrl` 이 실제로 채워지는지, 일반 흐름에서 이 필드들이 `undefined` 인지를 단언하는 테스트가 없으면 런타임 회귀 위험이 있다.
  - 제안: `integration-oauth.service.cafe24.spec.ts` 에 `begin()` 의 두 분기를 각각 검증하는 테스트 추가 — (1) 일반 OAuth 시작 시 `authorizeUrl`/`state` 존재, `mode` 미존재; (2) Cafe24 Private 시작 시 `mode === 'cafe24_private_pending'`, `integrationId`/`appUrl`/`callbackUrl` 존재, `authorizeUrl`/`state` 미존재.

- **[INFO]** 여러 노드 스키마 spec 파일의 `describe` 설명이 영문 변환 후에도 "Korean warning" 구 잔류
  - 위치: `backend/src/nodes/data/code/code.schema.spec.ts` 라인 991, `backend/src/nodes/logic/foreach/foreach.schema.spec.ts` 라인 1685, 외 다수
  - 상세: 경고 메시지를 영문으로 전환하면서 테스트의 `expect` 내 문자열은 올바르게 갱신되었으나, 일부 `describe`/`it` 설명 텍스트에 "Korean warning when" 이라는 구가 그대로 남아 있다(`it('emits the Korean warning when code body is empty', ...)` 등). 동작에는 영향이 없지만 실제 동작(영문 메시지 반환)과 설명이 불일치한다.
  - 제안: `it` 설명을 "emits the warning when ..." 또는 "emits the English warning when ..." 으로 갱신하여 코드-주석 일관성 유지.

- **[INFO]** `integration-expiry-scanner.service.spec.ts` 의 `enqueueCafe24BackgroundRefresh` — `Or(LessThan, IsNull)` 내부 shape 검증이 TypeORM 내부 구현에 결합
  - 위치: `backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` 라인 479–540
  - 상세: `findCall.where.lastRotatedAt` 의 TypeORM `FindOperator` 내부 구조(`_type`, `_value`, `_useParameter` 등)를 직접 검사하는 방식은 TypeORM 버전 업그레이드 시 조용히 깨질 수 있다. 테스트가 "IsNull 분기 누락 회귀 방지"를 목적으로 한다면, DB 레이어를 완전히 mock 하는 대신 실제 TypeORM query builder 또는 e2e 테스트에서 `lastRotatedAt IS NULL` 조건을 포함한 쿼리가 실제로 해당 행을 반환하는지 검증하는 것이 더 강건하다.
  - 제안: 단기적으로는 현행 유지하되, `Or(LessThan, IsNull)` 쿼리에 대한 e2e/integration 테스트를 추가해 내부 구조 의존을 보완.

- **[INFO]** `frontend/src/lib/docs/__tests__/registry.test.ts` 의 신규 path-existence 테스트 — `it.runIf(hasRealDocs)` 로 격리 환경에서 skip 가능
  - 위치: `frontend/src/lib/docs/__tests__/registry.test.ts` (파일 107) 라인 3188–3215
  - 상세: 신규 추가된 `describe('real docs frontmatter spec/code paths', ...)` 의 `it.runIf(hasRealDocs)` 패턴은 `content/docs` 폴더가 없는 격리 환경에서 조용히 skip된다. CI 환경이 `content/docs` 를 항상 포함하는지 명시적으로 보장되지 않으면, 이 테스트가 CI 에서 never-ran 상태로 유지될 수 있다. 현재 plan 문서는 "표준 개발 환경에서는 항상 수행된다"고 명시하지만, CI 파이프라인 설정에서 이 가정의 충족 여부는 확인되지 않는다.
  - 제안: CI workflow 에서 해당 테스트가 실제로 실행(skip 아님)되는지 확인. `hasRealDocs === false` 시 테스트를 skip 하는 대신 명시적 실패로 처리하는 방안도 고려.

- **[INFO]** `sanitizeLastErrorMessage` 테스트 — `"secret":` 패턴 테스트의 `toContain('***')` 단언이 충분하지 않을 수 있음
  - 위치: `backend/src/modules/integrations/integration-oauth.service.spec.ts` (파일 12) 라인 500–507
  - 상세: `masks standalone "secret:" keyword` 테스트는 `toContain('***')` 와 `.not.toMatch(/verySecret/)` 를 함께 사용한다. 그러나 key 부분(`"secret"`) 이 마스킹 대상인지, value 부분(`"verySecret"`) 만이 마스킹 대상인지가 테스트에서 명확하지 않다. 실제 sanitize 함수가 `key=value` 쌍을 `***` 로 통째로 치환하는지, value 만 치환하는지에 따라 이 테스트는 다른 동작도 통과시킬 수 있다.
  - 제안: 마스킹 결과의 전체 문자열을 `toBe(...)` 로 단언하거나, `key` 부분의 노출 여부도 명시적으로 단언.

### 요약

이번 변경은 크게 세 영역으로 구성된다: (1) 26개 이상 노드 스키마의 경고 메시지 한국어→영문 전환, (2) Cafe24 연동 Phase 2 follow-up(연속 네트워크 실패 카운터, pending_install 만료 제외, HMAC URLEncoder 호환성 등), (3) e2e Makefile `--build` 추가 및 문서 동기화. 테스트 관점에서 전반적으로 TDD가 잘 적용되어 있으며, 각 변경에 대응하는 회귀 테스트가 함께 추가되었다. 특히 REQ-C2(연속 네트워크 실패), CONC H-2(source 무관 status 검증), SEC H-1(HMAC URLEncoder 호환), SEC H-3(postMessage origin 검증) 등 중요 버그 수정에 단위 테스트가 명시적으로 동반되어 있다. 다만 `run()` 의 `pending_install` 제외 로직(REQ-C1)에 전용 단위 테스트가 없고, processor spec 에 중복 테스트 케이스가 존재하며, `OAuthBeginResultDto` 분기 단언이 서비스 테스트에서 불명확하다는 점은 보완이 필요하다. 메시지 영문 전환은 전수 검증이 이루어졌고, schema spec 파일들은 모두 대응하는 `.spec.ts` 가 함께 갱신되어 메시지 변경으로 인한 테스트 깨짐 위험이 즉시 해소되었다.

### 위험도

LOW
