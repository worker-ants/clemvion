# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** spec §5.8 의 테스트 엔드포인트가 구현과 불일치 — 갱신 미완료 상태로 merge
  - 위치: `spec/2-navigation/4-integration.md` 564행
  - 상세: 현재 spec §5.8 은 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 를 테스트 엔드포인트로 명시하고 있으나, 이번 구현은 `GET /api/v2/admin/apps` 를 사용한다. 코드와 스펙 문서가 서로 다른 엔드포인트를 가리키는 상태이다. commit message 와 plan 문서 모두 이 불일치를 인지하고 있으며 "3개 in-flight worktree 머지 후 spec 갱신 예정"으로 기록되어 있지만, spec은 "제품의 최종 상태"를 정의해야 한다는 프로젝트 규약(`CLAUDE.md §프로젝트 스펙 문서`)에 따라 현행 불일치는 Critical로 분류한다. spec §5.8 에 401-refresh-retry 정책 설명도 없어 구현 전체가 문서화되지 않은 상태이다.
  - 제안: 3개 cafe24-spec 워크트리 머지 이후 즉시 `spec/2-navigation/4-integration.md` §5.8 을 아래 내용으로 갱신한다 — "저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 핑. 401 응답 시 `refresh_token` 으로 access_token 갱신 후 1회 재시도; 재시도 401 → `auth_failed` 확정. 403/transport 실패 → status 격하 없이 진단 결과 반환."

- **[WARNING]** `pingConnection` spec 참조 주석이 갱신 전 엔드포인트를 가리킴
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection` JSDoc 첫 줄 (`spec/2-navigation/4-integration.md §5.8 의 GET /api/v2/admin/apps 핑으로 access_token 의 유효성을 확인한다`)
  - 상세: JSDoc 자체는 `/apps` 를 명시하고 있으나, spec §5.8 은 아직 `/store` 를 기술하고 있다. JSDoc 독자가 spec 을 교차 확인하면 두 문서가 상충하여 혼란이 발생한다. spec 갱신 전까지 한시적으로 불일치가 존재한다.
  - 제안: spec 갱신과 동시에 JSDoc 의 spec 참조가 자동으로 일치하게 되므로 spec 갱신을 선행 처리한다. 그 전까지 JSDoc 에 `(spec §5.8 갱신 대기 중 — /store → /apps 변경)` 같은 한시적 노트를 추가해 독자에게 알린다.

- **[WARNING]** plan 체크리스트 미완료 항목이 남은 채 커밋됨
  - 위치: `plan/in-progress/cafe24-test-connection.md` 993-997행
  - 상세: `- [ ] 테스트 선작성`, `- [ ] 구현 (...)`, `- [ ] TEST WORKFLOW`, `- [ ] REVIEW WORKFLOW`, `- [ ] spec 갱신 위임 노트 분리` 항목이 모두 미체크 상태로 커밋에 포함되어 있다. 커밋된 코드는 이 항목들의 구현이 완료된 것처럼 보이나 plan 문서가 반영되지 않았다. plan 문서는 "작업 이후 결과를 해당 위치의 살아있는 문서에 반영"하도록 규정한다(`CLAUDE.md §작업 시 점검`).
  - 제안: 구현이 실제로 완료된 항목은 `[x]` 로 체크하고, 아직 남은 후속 항목(spec 갱신 위임 노트 분리 등)만 `[ ]` 로 유지한다. spec 갱신 위임 노트(`spec-update-cafe24-test-connection.md`) 가 아직 생성되지 않았다면 별도 후속 커밋에서 생성한다.

- **[WARNING]** `registerEntityTester` 공개 메서드에 사용 범위 제약 미문서화
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `registerEntityTester` JSDoc
  - 상세: JSDoc 에 "Last registration wins" 는 기술되어 있으나, 이 메서드가 `onModuleInit` 단계에서 한 번만 호출되어야 하는 제약, 런타임 재등록 허용 여부, 동시 등록 시 동작 등이 명시되어 있지 않다. 공개 API 임에도 호출 타이밍 계약이 불명확하다.
  - 제안: JSDoc 에 `@remarks Called once per service_type during module initialization (onModuleInit). Runtime re-registration overwrites silently — intended only for infrastructure wiring at startup.` 형태로 호출 타이밍 계약을 추가한다.

- **[WARNING]** `EntityAwareTester` 타입 export 에 예제 또는 사용 안내 없음
  - 위치: `backend/src/modules/integrations/integrations.service.ts` 165-167행, `EntityAwareTester` export type
  - 상세: 새로 export 된 공개 타입이지만 JSDoc 에는 동작 설명만 있고, 이 타입을 구현할 외부 모듈이 지켜야 하는 계약(throw vs return 정책, 반환값 형식)이 코드 주석 수준에서 명시되어 있지 않다. `Cafe24Module.onModuleInit` 에서의 구현 예시가 유일한 레퍼런스이다.
  - 제안: JSDoc 에 `@example` 블록으로 구현 패턴을 간략히 제시하거나, 반환 시 throw 금지 / 항상 `IntegrationTestResult` 반환 규약을 `@remarks` 로 명시한다.

- **[INFO]** `rawPing` private 메서드 JSDoc 에 반환값 타입 설명 미흡
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `rawPing` JSDoc
  - 상세: `rawPing` 은 discriminated union (`kind: 'success' | 'http' | 'transport'`) 을 반환하는데, JSDoc 에 각 variant 의 의미와 `http` variant 의 `status`, `body` 필드 활용 방식이 설명되지 않는다. private 메서드이지만 `pingConnection` 의 핵심 분기 로직을 이 반환값으로 구동하므로 가독성 확보가 필요하다.
  - 제안: JSDoc 에 `@returns` 로 각 variant 를 한 줄씩 설명한다 — `success`: 200 응답, `http`: 비-2xx HTTP (status, body 포함), `transport`: 네트워크/타임아웃 오류.

- **[INFO]** `formatAuthFailure` private 메서드에 JSDoc 없음
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `formatAuthFailure`
  - 상세: `pingConnection` 내에서 403 및 최종 401 실패 시 사용자에게 노출되는 메시지를 구성하는 메서드인데 JSDoc 이 없다. 메서드명으로 의도는 파악되나 `summarizeCafe24ErrorBody` 위임 구조와 출력 형식이 주석으로 기술되어 있지 않다.
  - 제안: 한 줄 JSDoc `/** Formats a human-readable failure message from a non-2xx Cafe24 HTTP response for display in the test-connection result. */` 를 추가한다.

- **[INFO]** `cafe24-api.client.spec.ts` `describe` 블록 상단 한국어 주석이 `cafe24-api.client.ts` JSDoc 와 중복
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` 260-263행
  - 상세: 테스트 `describe('pingConnection (test-connection probe)')` 블록 상단의 한국어 주석(260-263행)은 구현 파일의 JSDoc 내용과 거의 동일하다. 테스트 파일에서는 `describe` 블록 이름으로 의도가 충분히 전달되므로 이 주석은 중복이다. 단, 이는 사소한 정도의 문제이다.
  - 제안: spec 참조(`spec §5.8`)와 동작 요약(401 retry 정책)을 한 줄로 줄이거나 제거한다.

- **[INFO]** `Cafe24Module.onModuleInit` JSDoc 의 spec 참조가 현재 stale
  - 위치: `backend/src/nodes/integration/cafe24/cafe24.module.ts` — `onModuleInit` JSDoc
  - 상세: `spec §5.8 의 GET /api/v2/admin/apps 핑 + 401 시 refresh + 1회 재시도 정책` 으로 기술되어 있으나 spec §5.8 은 아직 `/store` 를 기술하고 있으므로 독자가 spec 을 확인할 경우 혼란이 발생한다. `cafe24-api.client.ts` JSDoc 과 동일한 문제이다.
  - 제안: spec 갱신과 함께 자동 해소된다. 갱신 전까지 동일한 한시적 노트를 추가하는 것이 선택지이다.

---

## 요약

이번 변경의 핵심 코드(`pingConnection`, `registerEntityTester`, `EntityAwareTester`, `Cafe24Module.onModuleInit`)는 JSDoc 주석이 비교적 충실하게 작성되어 있으며, 인라인 주석도 복잡한 분기마다 한국어로 의도를 설명하고 있다. 그러나 구현이 사용하는 엔드포인트(`/apps`)와 `spec/2-navigation/4-integration.md` §5.8 이 여전히 기술하는 엔드포인트(`/store`) 사이의 불일치가 가장 중요한 문서화 결함이다. 이 불일치는 의도적으로 defer 된 것임이 commit message 와 plan 에 명시되어 있으나, spec 이 "제품의 최종 상태"를 기술해야 한다는 프로젝트 규약 하에서 현재 상태는 Critical 수준이다. 추가로 plan 체크리스트가 구현 완료를 반영하지 않은 채 커밋된 점, `registerEntityTester` 의 호출 타이밍 계약이 불명확한 점이 WARNING 수준 이슈로 식별되었다. spec 갱신 의존 블로커(3개 워크트리 머지)가 해소된 즉시 spec §5.8 갱신과 plan 체크리스트 정리를 선행하도록 권고한다.

---

## 위험도

MEDIUM
