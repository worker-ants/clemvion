# Testing Review — Cafe24 mall_id 중복 감지 UX 보강

리뷰 대상: 14개 파일 (backend DTO, service, controller, spec, e2e / frontend page, api client, i18n / plan 문서)

---

### 발견사항

- **[WARNING]** `precheckCafe24Mall` — `expired` 단독 존재 케이스 미커버
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`, `describe('precheckCafe24Mall')`
  - 상세: 우선순위 배열은 `connected > pending_install > error > expired` 순서인데, `expired`만 존재할 때 결과를 검증하는 단위 테스트가 없다. `connected` / `pending_install` / `error` 각각은 개별 케이스로 존재하지만 `expired`는 빠져있어 커버리지 갭이 발생한다.
  - 제안: `it('returns status=expired when only expired row exists')` 케이스 추가. `status: 'expired'` 단일 row에서 `result.status === 'expired'` 및 `result.existingIntegrationId` 반환을 검증한다.

- **[WARNING]** `precheckCafe24Mall` — 미정의(unknown) status에 대한 fallback 분기 미테스트
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` `precheckCafe24Mall()` 함수 끝부분 fallback 블록 (`all[0]` 반환)
  - 상세: 구현에는 `PRIORITY` 배열에 없는 상태(예: 전이 중인 상태)가 들어왔을 때 `all[0]`를 그대로 반환하는 fallback 블록이 존재한다. 이 분기를 커버하는 단위 테스트가 없어 향후 새 status 값이 추가될 때 동작이 보장되지 않는다.
  - 제안: `status: 'initializing'` 같은 임의 값을 가진 row를 mock으로 넣어 `conflict: true`와 해당 row의 id/name이 반환되는지 검증하는 케이스를 추가한다.

- **[WARNING]** `precheckCafe24Mall` — legacy row(`mallId IS NULL`) 처리 단위 테스트 미존재
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`, `describe('precheckCafe24Mall')`
  - 상세: `findAllCafe24RowsForMall`의 legacy fallback(V045 이전 rows, `mallId IS NULL` + JSONB `mall_id` 매칭)은 `begin — public app duplicate prevention` 의 `matches legacy rows` 케이스에서만 검증된다. `precheckCafe24Mall` 자체에 대한 legacy row 시나리오 테스트가 없어, precheck 경로에서 legacy row가 정확히 감지되는지 보장되지 않는다.
  - 제안: `precheckCafe24Mall` describe 블록 안에 `callCount` 패턴을 사용해 `mallId IS NULL` + `credentials.mall_id === mallId` 인 connected row를 반환하는 mock을 설정하고 `conflict: true`가 반환됨을 검증하는 케이스를 추가한다.

- **[WARNING]** e2e — `pending_install` / `error` / `expired` 상태별 응답 미검증
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts`
  - 상세: e2e 테스트는 `conflict=false` / `conflict=true with connected` / validation 오류 / 라우트 순서 / cross-workspace / 401 총 7케이스를 다루지만, `insertCafe24Row`가 `pending_install`, `error`, `expired` status를 지원함에도 이 상태들로 삽입된 row의 응답 shape(`status`, `existingIntegrationId`, `existingName` 존재 여부)를 검증하는 케이스가 없다. 서비스 레이어 단위 테스트에서는 커버되지만 e2e 레벨에서 실제 DB와 HTTP 계층을 통한 end-to-end 검증이 누락되어 있다.
  - 제안: `pending_install` row 삽입 후 precheck 응답의 `status === 'pending_install'` 및 `conflict === true`를 검증하는 e2e 케이스를 최소 1개 추가한다. `error` / `expired`는 우선순위 로직이 서비스 레이어에서 이미 단위 테스트되어 있으므로 하나의 케이스로 대표 검증하는 수준도 허용 가능하다.

- **[WARNING]** 프론트엔드 — Connect 버튼 비활성화 상태 단언 누락
  - 위치: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx`
  - 상세: 테스트 파일 주석에 "conflict=true → inline 경고 배너 표시 + Connect 버튼 disabled"가 검증 대상으로 명시되어 있으나, 실제 테스트 코드에서 Connect 버튼의 `disabled` 속성을 어서션하는 코드가 없다. 배너 표시만 검증하고 버튼 비활성화는 누락되었다.
  - 제안: `conflict=true (status=connected)` 케이스 내에 `const connectBtn = screen.getByRole('button', { name: /connect/i }); expect(connectBtn).toBeDisabled();` 어서션을 추가한다.

- **[WARNING]** 프론트엔드 — `formatErrorToast` 분기 테스트 미존재
  - 위치: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx` / `frontend/src/app/(main)/integrations/new/page.tsx`
  - 상세: `formatErrorToast` 함수는 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드일 때 한국어 i18n primary 메시지와 backend 영문 메시지를 괄호 안에 결합하는 특수 처리를 한다. 이 분기를 검증하는 단위 테스트가 없다. `createMutation.onError` / `oauthBeginMutation.onError` 경로 모두 미커버.
  - 제안: `oauthBeginMock.mockRejectedValueOnce`로 `{ response: { data: { code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED', message: 'english msg' } } }` 에러를 주입하고 toast 메시지가 `"이 mall ID 는 이미 연결되어 있어 추가할 수 없어요 (english msg)"` 형태인지 검증하는 케이스를 추가한다.

- **[WARNING]** 프론트엔드 — precheckLoading 상태(checking 인디케이터) 테스트 미존재
  - 위치: `frontend/src/app/(main)/integrations/new/__tests__/cafe24-precheck.test.tsx`
  - 상세: 구현에서 `precheckLoading && !conflict?.conflict`일 때 `checking…` 인디케이터 텍스트를 렌더한다. debounce 구간(350ms 이전)에서 로딩 인디케이터가 표시되는지, 완료 후 사라지는지를 검증하는 케이스가 없다.
  - 제안: `user.type` 후 `vi.advanceTimersByTime(100)` 등 350ms 이전 시점에서 `screen.getByText(/checking/i)` 존재를 검증하고, 360ms 후 사라짐을 검증하는 케이스를 추가한다.

- **[INFO]** `Cafe24PrecheckQueryDto` — DTO 자체 validation 단위 테스트 미존재
  - 위치: `backend/src/modules/integrations/dto/integration.dto.ts`
  - 상세: `Cafe24PrecheckQueryDto`의 `@MinLength(3)`, `@MaxLength(50)`, `@Matches(/^[a-z0-9-]{3,50}$/)` 제약은 e2e에서 invalid character / missing mallId 케이스로 간접 검증되지만, DTO 자체를 `class-validator`로 직접 검증하는 단위 테스트가 없다. 3자 미만, 50자 초과, 허용되지 않는 문자(대문자, 언더스코어 등), 정확히 경계값(3자/50자)에 대한 경계값 테스트가 누락되어 있다.
  - 제안: `validate()` (`class-validator`)를 사용해 경계값(길이 2, 3, 50, 51)과 패턴 위반 케이스를 직접 검증하는 DTO 단위 테스트를 추가한다. e2e 400 케이스가 존재해 필수는 아니나 회귀 방지 측면에서 권장.

- **[INFO]** e2e — throttle(분당 60회) 제한 동작 미테스트
  - 위치: `backend/test/integration-cafe24-precheck.e2e-spec.ts`
  - 상세: `@Throttle({ default: { limit: 60, ttl: 60_000 } })`가 적용되어 있으나 e2e에서 429 응답을 검증하는 케이스가 없다. throttle은 구성 레이어에 속하며 e2e 환경에서 rate limiter가 활성화되지 않을 수도 있으므로 필수는 아니지만, 실제 환경에서 throttle이 동작하는지 보장이 없다.
  - 제안: e2e 인프라에서 throttle guard가 활성화된다면 61회 연속 호출 후 429 응답을 검증하는 케이스를 추가하거나, throttle이 비활성화된 환경임을 명시하는 주석을 추가한다.

- **[INFO]** 단위 테스트의 error 타입 캐스팅 패턴이 불명확
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` lines 170-174, 194-196
  - 상세: `(error as { response?: { code?: string } }).response`와 같은 이중 캐스팅 패턴이 반복된다. NestJS의 `ConflictException`은 `getResponse()` 메서드나 `response` 프로퍼티로 직접 접근 가능하지만, 현재 캐스팅이 런타임에서 실제로 맞는지 보장이 없다. 기존 private-flow 테스트가 `rejects.toMatchObject({ response: ... })` 패턴을 사용하는 것(line 501)과 혼재되어 가독성이 낮다.
  - 제안: public-flow begin 테스트도 기존 private-flow와 동일하게 `await expect(...).rejects.toMatchObject({ response: { code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED' } })` 패턴으로 통일한다.

---

### 요약

이번 변경은 Cafe24 mall_id 중복 감지 UX 기능 전체에 걸쳐 단위·e2e·프론트엔드 계층 모두에 테스트가 추가되어 있으며, 핵심 경로(공개 흐름 begin 가드, precheck 우선순위 로직, race backstop, cross-workspace 격리, 라우트 순서 회귀)는 적절히 커버되어 있다. 그러나 `precheckCafe24Mall`의 `expired` 단독 케이스 누락, fallback 분기 미테스트, legacy row와 precheck의 조합 미검증, e2e에서 `pending_install`/`error`/`expired` 상태 응답 미검증, 프론트엔드에서 Connect 버튼 disabled 어서션 누락 및 `formatErrorToast` 분기 미테스트 등 여러 커버리지 갭이 존재한다. 특히 Connect 버튼 disabled 검증은 UX 보강의 핵심 동작임에도 테스트 주석에만 언급되고 실제 어서션이 없는 점이 가장 두드러지는 누락이다. 전반적으로 단위 테스트 격리성과 가독성은 양호하며, mock 사용은 저장소 계층에 적절하게 집중되어 있다.

### 위험도

MEDIUM
