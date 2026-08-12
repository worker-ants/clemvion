# Cross-Spec 일관성 검토 — spec/data-flow/ (impl-done, lint-warning-triage)

## 검토 대상 요약

diff 는 `codebase/backend` 의 ESLint warning 처분(타입 전용: 제네릭 인자·타입 단언·콜백 인자
타입 명시)이며, 실행 시맨틱을 바꾸지 않는 것이 PR 자체의 스코프·전제다(대부분 hunk 주석이
"emit 은 소거되고 그대로" 를 명시). `idempotency.interceptor.ts` / `.spec.ts` 만 예외적으로
`HttpResponseLike` 구조적 타입을 신설하고 테스트 커버리지를 크게 확장했다.

## 발견사항

- **[WARNING]** `spec/data-flow/15-external-interaction.md` 의 idempotency 캐시 제외 조건
  서술이 `spec/5-system/14-external-interaction-api.md` §R8 (그 문서 스스로 지목하는 SoT) 과
  불일치 — 이번 diff 가 그 불일치를 코드 쪽에 캐너리로 "고정"하면서도 data-flow 쪽 서술은
  갱신하지 않았다.
  - target 위치: (diff) `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스·메서드 docstring, `idempotency.interceptor.spec.ts` 신규 "409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리" 테스트
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §1.2 시퀀스 다이어그램 텍스트("2xx 응답을 … 24h 캐시 (4xx 캐시 제외)")와 §2.2 Schema 매핑 표 ("2xx 응답 캐시 … 4xx (`VALIDATION_ERROR` 등) 캐시 제외 ([Spec EIA §R8])") — 두 자리 모두 "4xx 전체 제외" 로 서술
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8(1053행)은 "4xx 응답 중 `400
    VALIDATION_ERROR` **만** idempotency cache 에서 제외하고, 그 외(성공 2xx / `409 Conflict`
    / `410 Gone`) 는 캐시한다" 고 명시적으로 좁혀 적었다. 그런데 data-flow/15 는 이를 "4xx
    (`VALIDATION_ERROR` 등) 캐시 제외" 로 뭉뚱그려, 409·410 도 제외 대상인 것처럼 읽힌다 — 이는
    현재의 **비정합 구현**(`statusCode >= 400` 이면 전부 제외)과 우연히 일치하는 서술이라, R8
    을 정확히 옮기지 못한 채 구현 갭을 그대로 반영하고 있다. 이번 diff 가 추가한 코드 주석·
    캐너리 테스트는 R8 원문을 정확히 인용하며 "선재 결함" 임을 명시하지만(`plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 마지막 항목에도 동일 근거로 이미 기록·의도적 유예됨), data-flow/15 문서 자체는 이 diff 로도, 그 plan 항목으로도 갱신 대상에 포함되지 않았다. 두 spec 영역(system 계약 문서 vs data-flow 문서)이 같은 §R8 을 서로 다르게 요약하는 상태가 이번 변경 이후에도 남는다.
  - 제안: `spec/data-flow/15-external-interaction.md` §1.2·§2.2 의 "4xx 캐시 제외" 문구를
    "`400 VALIDATION_ERROR` 만 캐시 제외 (그 외 2xx/409/410 은 캐시 — 단, 현재 구현은 R8 보다
    넓게 제외하는 선재 결함이 있음, `plan/in-progress/backend-lint-gate-broken-on-main.md` 참조)"
    수준으로 정정해 두 문서가 §R8 을 동일하게 요약하도록 한다. planner 턴에서 처리 가능한 문서
    정합 항목이며, 이번 lint-only PR 의 스코프(런타임 미접촉)에는 해당하지 않는다.

## 그 외 점검 결과 (충돌 없음)

- **데이터 모델/API 계약**: diff 전부가 함수 시그니처·제네릭 인자·타입 단언 수준이며 엔티티
  필드·endpoint·request/response shape 변경 없음 (`m.query<{id:string}[]>`, `.value as string
  | undefined`, `getResponse<HttpResponseLike>()` 등 — 전부 컴파일 타임에 소거).
- **요구사항 ID**: 신규 코드 주석이 인용하는 `Spec EIA §R8`·`EIA-RL-02` 는
  `spec/5-system/14-external-interaction-api.md` 에서 실제로 그 의미로만 쓰이는 기존 ID이며,
  data-flow 나 다른 영역에서 동일 ID 가 다른 의미로 재사용되고 있지 않음을 확인.
  (grep 결과 `EIA-RL-02` 는 단일 정의.)
- **상태 전이**: `execution.status`/`node_execution.status`(data-flow §3), `iext_*`/`itk_*`
  토큰 상태 머신(15-external-interaction.md §3) 모두 diff 의 어떤 변경과도 접점 없음
  (admission-control 쿼리에 제네릭 타입 인자 추가는 SQL·상태 전이 로직 불변).
  단, `chat-channel.dispatcher.ts` 의 `logFn` 단언은 커밋 로그(`plan` §잔여 표)가 emit
  md5 대조로 "괄호 한 쌍 외 동일" 을 실측해 둔 것을 확인 — 로그 레벨 분기(debug/warn) 자체는
  안 바뀜.
- **권한/RBAC**: `workspace-reflection-canary.ts` 변경은 `handlerConsumesWorkspaceId(cls, handler)`
  의 불필요한 `as object` 제거뿐이며 workspace 멤버십 가드 로직·RBAC 판정과 무관.
  `spec/data-flow/12-workspace.md` §4 RBAC 요약과 충돌 없음.
  `chat-channel-config.dto.ts` 의 `@Transform` 파라미터 타입 명시도 검증 로직 불변.
- **계층 책임**: `triggers.service.ts` 의 `SetupResult` 타입 임포트·`let result: SetupResult`
  는 기존 위임 구조(`ChannelAdapterRegistry`/`ChannelListenerRegistry` 경유)를 그대로 유지 —
  data-flow/14-chat-channel.md(예산 초과로 본문 미포함이나 diff 자체가 로직 변경 없음을
  자체 서술)와 충돌 소지 없음.

## 요약

이번 lint-warning 처분 PR 은 backend 전역에 걸쳐 타입 전용 수정을 적용했고, 대부분은 컴파일
타임에 소거되어 spec/data-flow/ 및 인접 spec 영역과 새로운 데이터 모델·API 계약·상태 전이·
RBAC·계층 책임 충돌을 만들지 않는다. 유일하게 주목할 점은 `idempotency.interceptor` 주변에
새로 붙은 방대한 테스트·주석이 "Spec EIA §R8 대비 구현이 더 넓게 캐시 제외한다" 는 선재 결함을
정확히 인용하며 캐너리로 고정했는데, 그 과정에서 `spec/data-flow/15-external-interaction.md`
자체가 §R8 을 부정확하게("4xx 전체 제외") 요약해 온 상태는 손대지 않았다는 것이다. 이는 이번
PR 이 만든 새 충돌이 아니라 기존에 있던 spec-내부 서술 불일치이며, 코드 레벨 갭은 이미
`plan/in-progress/backend-lint-gate-broken-on-main.md` 에 WARNING 으로 명시 추적·의도적
유예되어 있다 — 다만 그 plan 항목도 data-flow 문서 갱신은 포함하지 않으므로, 문서 정합을 위한
후속 planner 작업으로 남긴다.

## 위험도

LOW
