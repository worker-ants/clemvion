# 테스트(Testing) 코드 리뷰

## 발견사항

### [INFO] 헬퍼 함수 `wireRefreshTransaction` / `setRefreshClientEnv` / `clearRefreshClientEnv` 가 `describe('auth failure')` 블록 내부에 인라인 정의됨
- 위치: `cafe24-api.client.spec.ts` — `describe('auth failure')` 블록 상단 (diff +46~+81)
- 상세: 세 헬퍼 함수는 T-1~T-4 모든 케이스에서 공통으로 쓰인다. 현재 위치(블록 내부 함수)는 격리된 스코프이므로 다른 블록에서 우발적으로 쓰이는 문제는 없다. 다만 `token refresh` 수트와 setup 패턴(동일한 `wireRefreshTransaction` 등)이 중복될 가능성이 있고, 동일 파일의 다른 `describe` 에서 동일 패턴이 필요해질 때 helper를 복사하게 된다. 테스트 파일 상단이나 `beforeEach`/`afterEach` 영역으로 이동하거나, 공유 픽스처 함수로 추출하면 유지보수성이 높아진다.
- 제안: 파일 레벨 helper(또는 `describe` 바깥 모듈 스코프)로 추출. `clearRefreshClientEnv`는 `afterEach`에 등록해 각 테스트에서 수동 호출(teardown 누락 위험)을 제거하는 것을 검토.

---

### [WARNING] `clearRefreshClientEnv()` 수동 teardown — 테스트 실패 시 환경변수 누수 위험
- 위치: `cafe24-api.client.spec.ts` — T-1(+170), T-2(+212), T-3(+243), 수정된 OAuth-shape 테스트(+292), INSUFFICIENT_SCOPE 테스트(+353)
- 상세: `setRefreshClientEnv()` 와 `clearRefreshClientEnv()` 가 각 `it` 블록 끝에 명시적으로 호출된다. 그러나 테스트 중간에 assertion이 실패(throw)하면 `clearRefreshClientEnv()`가 실행되지 않아 `process.env.CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` 가 남은 채로 다음 테스트가 실행된다. Jest는 기본적으로 `process.env` 를 격리하지 않으므로, 테스트 순서에 따라 이 환경변수가 의도치 않게 존재하는 상태가 다음 테스트에 영향을 줄 수 있다. 특히 환경변수 미존재를 전제하는 테스트(예: `refreshAccessToken` 호출이 오류를 내야 하는 케이스)가 오염될 수 있다.
- 제안: 해당 `describe` 블록에 `afterEach(() => { clearRefreshClientEnv(); })` 를 등록하고 각 테스트 내 수동 `clearRefreshClientEnv()` 호출을 제거한다. 이렇게 하면 테스트 중간 실패 여부와 무관하게 항상 정리가 보장된다.

---

### [WARNING] `wireRefreshTransaction`의 `dataSource.transaction` mock이 매 테스트에서 재설정되지 않음 — `describe` 블록 간 mock 오염 가능성
- 위치: `cafe24-api.client.spec.ts` — `wireRefreshTransaction` 함수(diff +47~+56), T-1~T-4 각 호출 위치
- 상세: `wireRefreshTransaction(integration)` 는 `dataSource.transaction.mockImplementation(...)` 을 교체한다. 파일 수준의 `beforeEach` 에서 `dataSource.transaction` 이 초기화되는지 확인이 필요하다(diff 상 확인 불가). 만약 `beforeEach` reset이 없다면, `wireRefreshTransaction` 을 호출한 테스트 이후에 실행되는 다른 `it` 블록이 예상치 못한 `transaction` mock을 물려받아 잘못된 결과를 검증할 수 있다. 특히 `wireRefreshTransaction` 을 호출하지 않는 403 테스트(단일 fetch 케이스)에서 이전 mock이 남아 있어도 겉으로는 정상 통과하지만 내부 동작이 달라질 수 있다.
- 제안: `describe('auth failure')` 블록의 `afterEach` 또는 파일 전체 `beforeEach` 에서 `dataSource.transaction.mockReset()` 또는 `mockRestore()` 를 실행하도록 보강한다.

---

### [WARNING] T-4(스펙 §6.1 계획상 케이스)가 구현 테스트에 미포함 — plan의 T-4·T-5 대비 실제 추가된 테스트 수 불일치
- 위치: `cafe24-api.client.spec.ts` diff 전체, plan `cafe24-call-401-retry.md` §테스트 항목
- 상세: plan은 T-1~T-5 다섯 케이스를 명시했다. diff를 보면 T-1·T-2·T-3은 신규 추가되었고, T-4("403 insufficient_scope 시그널 있음 → 즉시 격하, refresh 시도 안 함")와 T-5("403 시그널 없음 → 즉시 격하")는 기존 테스트의 rename + 작은 보강(`expect(fetchMock).toHaveBeenCalledTimes(1)` 추가)으로 처리했다. T-4 대응은 `on 403 + INSUFFICIENT_SCOPE signal — flips statusReason to insufficient_scope (no refresh)` 로 1-fetch 검증이 추가되어 충분하다. T-5 대응은 최상단의 `on 403 — flips Integration.status to error(auth_failed) and throws Cafe24AuthFailedError immediately (no refresh)` 케이스로 커버된다. 따라서 5건 모두 커버된 것으로 보이나, plan 체크리스트의 `[ ] T-4`, `[ ] T-5` 가 아직 미완으로 표시되어 있다면 추적 불일치가 발생한다. plan의 해당 항목이 실제로 `[x]` 처리되었는지 확인이 필요하다.
- 제안: plan 문서 `plan/in-progress/cafe24-call-401-retry.md` 의 T-4·T-5 체크박스가 `[x]` 로 갱신되었는지 검토 후, 미완이면 갱신한다.

---

### [INFO] T-1 성공 케이스에서 `integration.statusReason` 검증 추가 권장
- 위치: `cafe24-api.client.spec.ts` — T-1 테스트(diff +111~+171), `expect(integration.statusReason).toBeNull()` (+158)
- 상세: T-1은 재시도 성공 시 `integration.status === 'connected'` 와 `integration.statusReason === null` 을 검증하고 있어 핵심 invariant를 잘 커버한다. 추가로 `res.body` 또는 `res.json()` (실제 2차 응답 데이터)가 예상 값인지 검증하면 재시도된 응답이 올바르게 반환됨을 단언할 수 있다. 현재는 `res.status === 200` 만 확인한다(+154).
- 제안: `expect(await res.json()).toEqual({ products: [{ product_no: 1 }] })` 또는 동등한 단언을 추가해 2차 응답 본문도 검증한다.

---

### [INFO] `execSync('git rev-parse --show-toplevel')` 사용 — CI 환경에서의 side effect 및 오류 처리 부재
- 위치: `catalog-sync.spec.ts` — 파일 상단 `REPO_ROOT` 초기화 블록(diff +8~+10)
- 상세: `execSync` 호출은 테스트 로딩 단계(모듈 평가 시)에 동기적으로 실행된다. git이 설치되어 있지 않거나 git 저장소 밖에서 실행되면 예외를 던져 해당 파일의 모든 테스트가 로드 실패한다. Docker나 특정 CI 이미지에서 git이 없는 경우도 있다. 또한 `worktree` 환경 문제를 해결하는 좋은 접근이나, 오류 시 `stdio: 'inherit'` 없이 기본 옵션이므로 오류 메시지가 부족할 수 있다.
- 제안: try-catch로 감싸거나, `spawnSync` 로 returncode 확인 후 fallback 처리를 추가한다. 최소한 오류 발생 시 명확한 메시지("git rev-parse failed — run tests inside a git repository")를 출력하도록 보강한다. 또는 `REPO_ROOT` 를 환경변수로도 주입받을 수 있게 하는 이중 전략(`process.env.REPO_ROOT || execSync(...)`)을 고려한다.

---

### [INFO] 401 재시도 성공 케이스에서 새 access_token이 Authorization 헤더에 정확히 전달되는지 검증 — 현재 부분적 단언
- 위치: `cafe24-api.client.spec.ts` — T-1 내 fetchMock.mock.calls[2] 검증(diff +144~+153)
- 상세: T-1은 3번째 fetch 호출의 Authorization 헤더가 `Bearer new-access` 인지 확인한다. 이는 핵심 동작(갱신된 토큰으로 재호출)을 올바르게 검증한다. 다만 `fetchMock.mock.calls[2][1]` 을 `as RequestInit` 로 캐스팅하고 headers를 `as Record<string, string>` 으로 이중 캐스팅하는 방식은 런타임에 타입 안전성이 보장되지 않는다. `Headers` 객체가 전달될 경우 `Record<string, string>` 캐스팅이 예상대로 동작하지 않을 수 있다.
- 제안: `expect(fetchMock.mock.calls[2][1]).toMatchObject({ headers: expect.objectContaining({ Authorization: 'Bearer new-access' }) })` 와 같이 `toMatchObject` 를 활용하거나, 헤더 추출 로직을 별도 헬퍼로 정리해 타입 안전성을 높인다.

---

### [INFO] `refreshAccessToken` 경로(BullMQ queue 미연결 시)의 실제 동작과 mock 사이의 괴리 검토 필요
- 위치: `cafe24-api.client.spec.ts` — `wireRefreshTransaction` 함수(diff +47~+56), `cafe24-api.client.ts` — 401 분기 구현(diff +404~+422)
- 상세: T-1~T-3은 BullMQ queue가 없는 테스트 환경(테스트 기본값)에서 `refreshAccessToken(integration)` 경로를 밟는다. `wireRefreshTransaction` 은 `dataSource.transaction` 을 mock하여 `refreshAccessToken` 내부의 DB 조회와 저장을 인터셉트한다. `refreshAccessToken` 이 내부적으로 `fetch`(token endpoint 호출) + `dataSource.transaction` 두 가지를 사용하므로, mock 구조가 실제 코드 경로와 일치하는지 확인이 필요하다. 특히 `txRepo.findOne` 이 `integration` 을 반환하는 구조가 실제 `refreshAccessToken` 코드의 쿼리 패턴과 일치하는지(컬럼 선택, WHERE 조건 등), 또한 `txRepo.save` 의 결과가 `integration.credentials` 업데이트로 이어지는지 검토해야 한다.
- 제안: `refreshAccessToken` 의 실제 구현 코드와 `wireRefreshTransaction` 의 mock 구조를 대조하여 `txRepo.findOne` 응답이 실제 쿼리와 일치하는지 확인한다. integration e2e 테스트에서도 이 경로를 커버하면 mock-실제 괴리를 방어할 수 있다.

---

### [INFO] 401 retry 도중 `refreshViaQueue` 경로(BullMQ 연결 시)에 대한 테스트 부재
- 위치: `cafe24-api.client.ts` — 401 분기(diff +405~+408), `cafe24-api.client.spec.ts` 전체 diff
- 상세: 구현 코드는 `this.refreshQueue && this.refreshQueueEvents` 조건에 따라 `refreshViaQueue` 와 `refreshAccessToken` 두 경로로 분기한다. 현재 T-1~T-3는 모두 `refreshAccessToken` 경로(queue 없는 테스트 환경)만 커버한다. `refreshViaQueue` 경로는 BullMQ 큐가 연결된 상황에서 jobId dedup 직렬화를 거치는 다른 코드 경로이므로, 이 분기가 401 재시도 흐름과 올바르게 통합되는지 검증하는 테스트가 없다.
- 제안: `refreshQueue`와 `refreshQueueEvents` mock을 주입한 상태에서 T-1 등가 케이스를 추가해 `refreshViaQueue` 경로의 401 자가 회복도 커버한다. 단, BullMQ integration 테스트가 별도 계층(e2e)에서 이미 커버된다면 unit 레벨에서는 INFO 수준으로 남겨도 무방하다.

---

### [INFO] plan `cafe24-call-401-retry.md` 의 `[ ] TEST WORKFLOW` 체크박스 미완 상태
- 위치: `plan/in-progress/cafe24-call-401-retry.md` §검증 — `[ ] TEST WORKFLOW (lint · unit · build · e2e)`
- 상세: plan의 검증 체크리스트에서 TEST WORKFLOW, REVIEW WORKFLOW, RESOLUTION.md 모두 미완(`[ ]`) 상태다. 본 AI Review가 REVIEW WORKFLOW의 일부이므로 리뷰 완료 후 해당 항목이 `[x]` 로 갱신되어야 한다. 테스트 실행 결과(lint · unit · build · e2e 통과 여부)도 plan에 반영되어야 plan 라이프사이클이 완성된다.
- 제안: 리뷰 완료 및 테스트 실행 후 plan의 검증 섹션 체크박스를 `[x]` 로 갱신한다.

---

## 요약

이번 변경의 핵심 구현 대상인 `cafe24-api.client.spec.ts` 는 spec §6.1 의 401 자가 회복 흐름(T-1~T-3)을 잘 구조화하여 추가했으며, 기존 403 케이스(T-4·T-5)도 1-fetch 단언 보강을 통해 회귀 방어를 강화했다. 테스트의 의도와 스펙 연결이 주석으로 명확히 서술되어 가독성이 우수하다. 다만 `setRefreshClientEnv`/`clearRefreshClientEnv` 의 수동 teardown 패턴은 테스트 중간 실패 시 `process.env` 오염으로 이어질 수 있어 `afterEach` 방식으로 교체가 필요하고(`WARNING`), `wireRefreshTransaction` 의 mock이 테스트 간 격리가 보장되는지 확인이 필요하다(`WARNING`). BullMQ queue 연결 경로(`refreshViaQueue`)의 401 재시도는 unit 레벨 커버리지 갭으로 남아 있으며, `catalog-sync.spec.ts` 의 `execSync` 오류 처리 부재도 CI 안정성 측면에서 보강 여지가 있다. 전반적으로 테스트 설계와 커버리지 방향은 스펙과 잘 정렬되어 있으며, 발견된 이슈는 teardown 안전성과 mock 격리 측면의 개선 사항이 중심이다.

## 위험도

LOW
