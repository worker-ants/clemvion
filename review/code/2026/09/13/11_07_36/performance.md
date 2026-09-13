# 성능(Performance) 리뷰

## 검토 범위와 방법

이번 라운드(`11_07_36`)의 코드 diff(`git diff origin/main...HEAD --stat -- codebase/`)는
직전 두 라운드(`10_12_19`, `10_40_34`)가 이미 검토한 것과 **동일한 21개 코드 파일**이며,
그 사이 커밋(`de99def86` "리뷰 라운드 2")도 `TestConnectionResultDto` 에 `code` 필드 추가 +
JSDoc 배치 정정 + 형제 엔드포인트에 `assertMatchesContract` 배선 추가뿐으로 알고리즘·쿼리·
I/O 패턴에 영향이 없다. 프롬프트에 실린 나머지 다수 파일(43개)은 `review/code/**`·
`review/consistency/**` 아래 **이전 리뷰 라운드 자신의 산출물**(신규 커밋된 md/json)이라
성능 검토 대상이 아니다(문서 파일, 런타임 코드 경로 없음).

실제 소스를 직접 열어 재확인했다:
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` — 전체 165줄, 순수 함수.
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` — 1~80줄.
- `codebase/backend/src/shared/testing/response-contract.ts` — `contractForDto` 캐시 로직.
- `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` — `beforeAll`/`afterAll` 짝 확인.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — 중복 스캔 주장 재검증(`grep`).

## 발견사항

- **[INFO]** (carry-over, 신규 아님) 신규 가드가 `backend/src`+`packages` 전체를 매 테스트
  프로세스 로드마다 동기 `fs.readFileSync` 로 전량 적재하며, **같은 트리를 이미 다른 가드가
  독립적으로 재순회**하고 있음을 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts:46-51`
    (`walkTree(root, ["codebase/backend/src", "codebase/packages"], …).map(f => fs.readFileSync(...))`,
    `describe` 콜백 최상위 — 모듈 로드 시 1회, `it()` 당 재계산 아님) · 소비처
    `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:154-165`
    (`collectBackendTokens` — 파일마다 `\b(UPPER_SNAKE)\b` 전역 정규식 1회 스캔)
  - 상세: 알고리즘은 선형(O(총 바이트 수))이라 이차 복잡도·N+1 문제는 아니다. `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:463-478` 의
    `CODEBASE_SOURCE_ROOTS`(`codebase/backend/src`·`codebase/packages` 포함) →
    `walkTree` 호출이 지금도 그대로 존재함을 `grep` 으로 재확인했다 — 즉 vitest 스위트가
    같은 두 디렉터리를 **최소 두 곳(이 가드 + `spec-links.ts` 소비처)에서 독립적으로**
    `readdirSync`+`readFileSync` 하는 상태가 이번 라운드에서도 변경되지 않았다. 결과를
    캐싱·공유하는 장치는 없다.
  - 제안: 직전 두 라운드와 동일 결론 — 지금 규모(1,300여 파일)에서 병합을 막을 사유는
    아니다. 이 라운드의 `de99def86` 도 이 파일들을 건드리지 않았으므로 새로 생긴 리스크가
    아니라 기존 관찰의 재확인이다. 후속 가드를 더 추가하기 전에 `walkTree` 결과를 모듈
    레벨 캐시로 한 번만 만들어 공유하는 리팩터를 근거로 남겨 둔다(차단 사유 아님).

- **[INFO]** `assertMatchesContract`/`contractForDto` 를 형제 엔드포인트(`integrations`)와
  `llm.service.spec.ts` 신규 케이스에 배선을 늘렸지만, DTO 당 결과를 메모이즈해 스키마
  재계산 비용이 늘지 않음을 확인
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:412-437`
    (`contractForDto` — `contractCache.get(Dto)` 히트 시 즉시 반환, 미스 시에만
    `buildSwaggerDocument` 로 1회 생성 후 캐시)
  - 상세: 이번 두 라운드가 `assertMatchesContract(result, await contractForDto(...))` 호출을
    `integrations.service.spec.ts`·`llm.service.spec.ts`에 각 1건씩 추가했다. `contractForDto`
    는 `Type<unknown>` 을 키로 하는 Map 캐시라 같은 DTO 클래스를 여러 테스트가 호출해도
    스키마 생성(리플렉션 기반 `buildSwaggerDocument`)은 클래스당 1회로 유계다 — 호출 지점이
    늘어도 비용이 호출 횟수에 비례해 자라지 않는다.
  - 제안: 없음 — 설계가 이미 이 축을 방어하고 있다.

- **[INFO]** 신규 컨트롤러 HTTP 왕복 테스트는 `beforeAll`/`afterAll` 로 Nest 앱 생성/해제를
  스위트당 1회로 유계화
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:167-207`
    (`beforeAll` 에서 `Test.createTestingModule(...).compile()` → `createNestApplication()`,
    `afterAll` 에서 `app.close()`)
  - 상세: `it()` 마다 앱을 새로 띄우는 패턴이 아니라 파일당 1회 생성·해제라 테스트 실행
    비용이 케이스 수에 비례해 자라지 않는다. 짝이 정확히 맞아 리소스 누수도 없다.
  - 제안: 없음.

- **[INFO]** 실질 프로덕션 코드 변경(`error`→`message` rename, 미발행 `latencyMs`/`meta`
  제거, `code?` 선언 추가)은 순수 필드 정리 수준 — 알고리즘·쿼리·캐싱·블로킹 I/O 영향 없음
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:326,354` · `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:50-58` ·
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:457-491`
  - 상세: `testConnection` 은 기존 `try/catch`·단일 반환문 구조 그대로이고 반환 객체의 키
    이름만 바뀌었다. 생산자 0건이던 `latencyMs`/`meta` 제거는 런타임 페이로드에 원래도
    없던 필드라 직렬화 비용·응답 크기에 실질 변화가 없다. 새로 선언된 `code?: string` 은
    이미 서비스가 반환하던 값을 뒤늦게 문서화한 것뿐이다.
  - 제안: 없음.

## 요약

이번 라운드의 실제 코드 diff 는 직전 두 라운드와 동일 파일 집합이며, 그 사이 처분 커밋
(`de99def86`)도 필드 선언 추가·JSDoc 재배치·계약 검사 배선 확장뿐이라 성능에 영향을 주는
변경이 아니다. 실측으로 재확인한 결과 유일한 관찰점(신규 가드의 backend+packages 전량
동기 스캔이 `spec-links.ts` 의 기존 스캔과 중복된다)은 이번 라운드에서도 그대로 남아 있지만
알고리즘은 선형이고 지금 저장소 규모에서 병합을 막을 사유가 아니라는 직전 두 라운드의
결론이 유효하다. 새로 배선된 `assertMatchesContract` 호출은 DTO 당 메모이즈 캐시 덕에
호출 지점이 늘어도 비용이 자라지 않고, 신규 HTTP 왕복 테스트도 앱 생명주기를 스위트당
1회로 유계화해 문제가 없다. CRITICAL/WARNING 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
