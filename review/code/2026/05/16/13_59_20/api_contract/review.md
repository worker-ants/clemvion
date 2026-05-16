### 발견사항

- **[WARNING]** `testConnection` API 응답 계약 변경 — `code` 필드가 조건부로 누락될 수 있음
  - 위치: `backend/src/nodes/integration/cafe24/cafe24.module.ts` onModuleInit 콜백 (lines 866–877)
  - 상세: `pingConnection` 반환값을 `IntegrationTestResult` 로 변환하는 래퍼에서 `code: result.code` 를 포함하고 있으나, `pingConnection` 의 반환 타입은 `{ success: boolean; code?: string; message?: string }` 으로 `code` 가 옵셔널이다. 성공 시(`success: true`) `code` 가 `undefined` 로 반환되는데, 기존 `dispatchTest` 경로가 성공 시 `code` 를 어떻게 처리하는지에 따라 클라이언트가 기대하는 응답 스키마와 불일치가 발생할 수 있다. `IntegrationTestResult` 타입 자체가 `code` 를 옵셔널로 정의하고 있다면 무해하지만, 스키마 문서(Swagger 등)와 실제 응답의 일관성 여부를 확인해야 한다.
  - 제안: 성공 케이스에서 `code` 필드를 아예 제외하거나 `undefined` 가 직렬화에서 제외됨을 명시적으로 보장. `IntegrationTestResult` 타입과 Swagger 스키마가 `code?: string` 으로 정의되어 있는지 확인.

- **[WARNING]** `POST /api/integrations/:id/test` 의 실제 동작이 spec §5.8과 불일치한 상태로 배포됨
  - 위치: commit message 및 `plan/in-progress/cafe24-test-connection.md` (lines 940–941, 976–990)
  - 상세: spec §5.8은 여전히 `GET /store` 를 ping 엔드포인트로 명시하지만, 구현은 `GET /api/v2/admin/apps` 로 변경되었다. commit message 에서 spec 갱신을 "3개 in-flight worktree 머지 후"로 의도적으로 지연시켰다. 이 상태로 배포되면 spec 문서 기반의 다른 클라이언트 코드·QA·문서화 작업이 잘못된 ping 엔드포인트를 기준으로 진행될 수 있다. 특히 API 계약 검증 자동화(contract testing)가 있다면 실패한다.
  - 제안: spec 갱신이 blocking 되더라도 최소한 §5.8에 "구현과 상이함, 추적 plan: spec-update-cafe24-test-connection.md" 인라인 노트 추가. 또는 해당 PR 이 `cafe24-spec-sync-e2a8b9` 등 3개 worktree 머지 완료 후에 main 에 병합되도록 merge order 를 강제.

- **[INFO]** `registerEntityTester` 는 "last registration wins" 정책이나 등록 실패(overwrite) 에 대한 경고 없음
  - 위치: `backend/src/modules/integrations/integrations.service.ts` lines 200–202
  - 상세: `this.entityTesters.set(serviceType, tester)` 는 기존 등록값을 묵묵히 덮어쓴다. 향후 다른 모듈이 동일 `service_type` 으로 중복 등록하면 디버깅이 어렵다. API 계약 외부 노출은 아니지만, 이 hook 이 잘못 등록되면 `testConnection` 의 응답 동작이 예측 불가하게 바뀐다.
  - 제안: 기존 등록값이 있을 경우 Logger.warn 으로 overwrite 사실을 기록. 또는 중복 등록 시 예외를 발생시켜 조기에 문제를 탐지.

- **[INFO]** 403 응답 시 `code: 'CAFE24_AUTH_FAILED'` 로 401(인증 실패)과 동일 코드 사용
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` line 682
  - 상세: 403은 인증(Authentication) 실패가 아닌 인가(Authorization/scope) 실패다. 동일한 `CAFE24_AUTH_FAILED` 코드를 사용하면 클라이언트가 "토큰이 만료됐으니 재연결하라"는 UX를 보여줄 수 있으나 실제 원인은 "스코프 부족"이다. 두 에러가 클라이언트에서 동일하게 처리되면 사용자 혼란이 발생한다.
  - 제안: 403 케이스에는 `CAFE24_INSUFFICIENT_SCOPE` 또는 `CAFE24_PERMISSION_DENIED` 같은 별도 에러 코드 사용. 이미 spec-update plan 에서 `/store` → `/apps` 변경 근거로 "403 false negative" 를 언급한 만큼, 코드 레벨에서도 구분이 일관성 있다.

### 요약

이번 변경은 외부 엔드포인트 URL이나 HTTP 메서드를 변경하지 않았으며, `POST /api/integrations/:id/test` API의 시그니처는 유지된다. 주요 API 계약 우려사항은 두 가지다: 첫째, spec §5.8과 구현이 불일치한 상태(`/store` vs `/apps`)로 배포가 진행되며 spec 갱신이 외부 의존성으로 지연되어 있어, 계약 문서와 실제 동작 간의 드리프트가 발생한다. 둘째, 403(인가 실패)과 401(인증 실패)에 동일한 에러 코드 `CAFE24_AUTH_FAILED`를 사용해 클라이언트가 에러 유형을 구분하지 못한다. 하위 호환성 파괴나 버전 충돌은 없으며, 인증/인가 적용과 페이지네이션은 이번 변경 범위 밖이다.

### 위험도
MEDIUM
