# 요구사항(Requirement) 리뷰

## 발견사항

### 1. `assertCredentials` 가 `pingConnection` 에서 예외를 throw — 반환값 불일치
- **[WARNING]** `pingConnection` 의 JSDoc 은 "반환값은 throw 하지 않고 항상 `IntegrationTestResult` 형태"라고 명시하지만, 함수 첫 줄 `this.assertCredentials(creds)` 는 자격증명 누락 시 `Cafe24IncompleteCredentialsError` 를 throw 한다. `try/catch` 범위 밖이므로 해당 예외는 호출자로 전파된다.
  - 위치: `cafe24-api.client.ts` — `pingConnection` 내 `assertCredentials(creds)` 호출 (diff line ~297)
  - 상세: 실제 사용 중인 Integration 엔티티에 `mall_id`, `access_token`, `refresh_token` 이 없는 케이스는 DB 재암호화 오류 등으로 발생 가능하며, 이 경우 호출자(`IntegrationsService.testConnection`)가 예외를 받아 500 응답이 된다. 문서·설계 의도와 어긋난다.
  - 제안: `assertCredentials` 호출을 `try/catch` 로 감싸 `Cafe24IncompleteCredentialsError` 를 `{ success: false, code: 'CAFE24_INCOMPLETE_CREDENTIALS', message: err.message }` 로 변환하거나, `assertCredentials` 대신 `null` 체크 후 early-return 으로 처리한다.

### 2. `tokenAfterProactive` 토큰 추출 로직의 중복·불필요한 방어 코드
- **[INFO]** `pingConnection` 내 `tokenAfterProactive` 산출 코드:
  ```ts
  const tokenAfterProactive =
    ((integration.credentials ?? {}) as Cafe24Credentials).access_token ??
    creds.access_token!;
  ```
  `creds` 는 이미 `integration.credentials ?? {}` 로 선언됐으므로 두 표현식은 항상 동일한 값을 참조한다. `ensureFreshToken` 이 `integration.credentials` 를 in-place 로 업데이트한다면 `creds` 를 재참조하는 것으로 충분하다.
  - 위치: `cafe24-api.client.ts` diff line ~323-325
  - 상세: 코드 의도("proactive refresh 후 최신 토큰 사용")는 올바르지만 표현이 혼란스럽다. `creds` 가 직접 변이(mutation)될 때만 최신 값을 읽는다는 전제 확인이 필요하다. `ensureFreshToken` 이 `integration.credentials` 를 직접 덮어쓰는 방식이 아니라면 이 코드는 항상 stale 한 `creds.access_token` 을 쓰게 된다.
  - 제안: `ensureFreshToken` 이 `integration.credentials` 객체를 교체하는지(참조 교체) vs 객체 내부를 변이하는지 확인한다. 만약 참조를 교체한다면 proactive refresh 이후 `(integration.credentials as Cafe24Credentials).access_token` 을 읽어야 한다.

### 3. 재시도 후 `403` 응답에 `markAuthFailed` 호출 — 첫 번째 403 정책과 불일치
- **[WARNING]** 설계 의도: 403 은 "진단용 — status 격하 없이 메시지만 전달". 그러나 재시도(`second`) 가 403 인 경우 `markAuthFailed` 를 호출한다 (`second.status === 401 || second.status === 403`). 이는 동일한 403 (scope 부족 등)이 재시도 맥락에서는 status 를 격하시키는 비대칭적 정책이다.
  - 위치: `cafe24-api.client.ts` diff line ~379-381
  - 상세: 첫 번째 403 은 "사용자가 직접 호출한 진단이라 status 격하 금지"로 처리하고, 두 번째 403 은(401 → refresh → 403) `markAuthFailed` 를 발사한다. 하지만 두 번째 403 도 동일하게 scope 부족일 수 있다. 401 이후 refresh 된 새 토큰으로 403 이 나오는 것은 "인증 자체 실패"가 아니라 "권한 부족"일 가능성이 높다.
  - 제안: 재시도 후 `403` 은 첫 번째 403 과 동일하게 "격하 없이 실패 반환"으로 처리하고, `401` 만 `markAuthFailed` 대상으로 한정하는 것이 일관된 정책이다.

### 4. `plan/in-progress/cafe24-test-connection.md` 체크리스트에 미완성 항목 존재
- **[WARNING]** 커밋과 함께 추가된 plan 문서의 진행 체크리스트에 `[ ]` (미체크) 항목이 남아있다:
  ```
  - [ ] 테스트 선작성
  - [ ] 구현 (pingConnection, dispatchTest 외부 분기, 테스트 카운터 합산 제외)
  - [ ] TEST WORKFLOW
  - [ ] REVIEW WORKFLOW
  - [ ] spec 갱신 위임 노트 분리 (spec-update-cafe24-test-connection.md) — 본 PR 과 별개로 머지 가능 시점에 작성
  ```
  실제로는 구현과 테스트가 이미 커밋에 포함돼 있어 이 항목들이 완료됐을 것으로 보이나, plan 문서가 업데이트되지 않아 `plan/in-progress/` 에 미완으로 잔류한다.
  - 위치: `plan/in-progress/cafe24-test-connection.md` lines 993-997
  - 상세: CLAUDE.md 규약에 따르면 모든 항목이 완료된 plan 은 `plan/complete/` 로 이동해야 한다. 체크박스가 갱신되지 않은 상태로 `in-progress/` 에 머무는 것은 plan 라이프사이클 위반이다.
  - 제안: 완료된 항목을 `[x]` 로 체크하고, 모든 항목 완료 시 `git mv` 로 `plan/complete/` 로 이동한다.

### 5. spec §5.8 과 구현의 엔드포인트 불일치가 지연 처리됨
- **[WARNING]** commit message 에 명시적으로 인정: "spec §5.8 still says GET /store; the goal-stated endpoint is /apps. Update is deferred". 이 상태에서 코드는 `/apps` 를 호출하지만 spec 은 `/store` 를 정의하고 있어, spec-코드 간 괴리가 PR merge 후에도 지속된다.
  - 위치: commit message 및 `plan/in-progress/spec-update-cafe24-test-connection.md` 전체
  - 상세: 3개 in-flight worktree merge 후에야 spec 갱신을 할 수 있다는 의존성은 파악됐으나, 현재 코드가 spec 을 위반한 상태로 merge 되면 향후 혼동 위험이 존재한다. `plan/in-progress/spec-update-cafe24-test-connection.md` 가 별개 위임 plan 으로 관리되고 있어 추적은 가능하다.
  - 제안: `spec-update-cafe24-test-connection.md` 의 머지 의존성 해소 즉시 spec 갱신을 최우선으로 처리한다. 코드 JSDoc 의 `spec/2-navigation/4-integration.md §5.8` 참조 주석에 "(현재 spec 은 /store 기술 — 갱신 예정)" 라는 임시 주석 추가를 고려한다.

### 6. `fallthrough` 테스트에서 성공 결과 타입 검증 불충분
- **[INFO]** `integrations.service.spec.ts` 의 "falls through to dispatchTest" 테스트:
  ```ts
  const result = await service.testConnection('int-1', 'ws-1');
  expect(result.success).toBe(true);
  ```
  `success: true` 만 검증하고 `message`, `code` 필드는 미검증. 구조적 성공 fallback 이 반환하는 전체 shape 가 `IntegrationTestResult` 타입을 충족하는지 확인하지 않는다.
  - 위치: `integrations.service.spec.ts` diff line ~110
  - 상세: 현재 구현에서 문제가 될 가능성은 낮으나, `dispatchTest` 의 성공 반환값 shape 변경 시 해당 테스트가 silent miss 로 통과할 수 있다.
  - 제안: `expect(result).toMatchObject({ success: true, message: expect.any(String) })` 또는 최소한 `message` 필드 존재 여부를 검증한다.

### 7. `previewTest` 에 cafe24 entity-aware 분기 없음 — 설계 문서와 일치하나 테스트 부재
- **[INFO]** `plan/in-progress/cafe24-test-connection.md` 구현 범위에 "preview-test (DB 저장 전) cafe24 케이스는 막 발급된 토큰이라 refresh 불필요 — 단순 ping만 수행 (entity 없는 분기)"가 언급되나, 실제 구현에서 `previewTest` 는 `dispatchTest` 를 그대로 호출한다. `dispatchTest` 에 `cafe24` 타입의 TransportTester 가 등록돼 있지 않으면 structural-only success 가 반환된다.
  - 위치: `integrations.service.ts` — `previewTest` 메서드 (diff line ~575-577)
  - 상세: cafe24 의 preview-test 가 항상 구조적 성공을 반환하는 것이 의도된 설계인지 (막 발급 토큰이라 괜찮다는 논리), 아니면 추후 ping 추가가 필요한지 spec 에 명시가 없다. `spec-update-cafe24-test-connection.md` 에는 "단순 ping만 수행"으로 기술됐지만 실제 구현은 없다.
  - 제안: preview-test 에 cafe24 단순 ping (refresh 없이 현재 토큰으로 `/apps` 1회 호출)을 구현하거나, 의도적으로 생략한 경우 이를 코드 주석 또는 spec 에 명시한다.

---

## 요약

핵심 기능인 `pingConnection` 의 401-refresh-retry 흐름, entity-aware tester 등록 패턴, transport 실패 시 카운터 비합산 정책은 설계 의도에 부합하며 테스트 케이스도 주요 분기를 커버한다. 다만 `assertCredentials` 가 `pingConnection` 의 "never throws" 계약을 깨는 구조적 불일치(WARNING #1)와, 재시도 후 403 처리가 첫 번째 403 정책과 비일관적인 점(WARNING #3)은 에러 시나리오 관점의 실제 결함이다. 또한 spec §5.8 과 구현 엔드포인트 불일치가 알려진 상태로 병렬 진행 중이며(WARNING #5), plan 체크리스트 미갱신(WARNING #4)은 프로젝트 라이프사이클 규약 위반이다. `previewTest` cafe24 단순 ping 미구현(INFO #7)은 기능 완전성 관점에서 후속 작업이 필요하다.

## 위험도

MEDIUM
