# Rationale 연속성 검토 — backend-hygiene-followups

## 검토 대상 요약

`git diff origin/main...HEAD -- code_areas` 는 `spec/**` 를 전혀 건드리지 않는다. 변경은 전부
`codebase/backend/**` 의 테스트/문서/주석 위생 정리다:

- `README.md` — 부트 가드 2종(assertProductionConfig / assertWorkspaceIdReflectionWorks) 설명 확장
- `common/__test-utils__/workspace-id-fixtures.ts` (신규) — 3개 spec 파일에 흩어져 있던 워크스페이스 UUID 픽스처 통합
- `common/decorators/workspace-reflection-canary.ts` — 실측 라우트 수 갱신(73→142) + 73/142 이 subset/superset 관계임을 명시
- `common/decorators/workspace.decorator.spec.ts`, `common/guards/roles.guard.spec.ts`, `common/utils/workspace-context.util.spec.ts` — 로컬 픽스처를 공용 모듈 import 로 교체
- `common/utils/uuid.ts`, `common/utils/uuid.spec.ts` — "회귀 캐너리는 `system-status.e2e-spec.ts`" 라던 주석을 "실제로는 `uuid.spec.ts`+`workspace-context.util.spec.ts`" 로 정정
- `modules/secret-store/secret-resolver.service.spec.ts` (+ 신규 `test/secret-store-like-prefix.e2e-spec.ts`) — LIKE 와일드카드 가드 테스트 보강
- `nodes/integration/http-request/http-request.handler.spec.ts` — 죽은 코드 제거

병합 베이스(`602f677cd`, PR #1112 "auth 불변식 5곳 spec 동기화")는 이미 아래 두 Rationale 절을
포함하고 있으며, 이번 diff 는 그 절이 지정한 정정을 코드 주석/테스트 쪽으로 전파하는 작업이다:

- `spec/5-system/1-auth.md` `## Rationale` § "부트 캐너리 — `@WorkspaceId()` reflection 자가검증
  (fail-closed, 2026-08-09)" (line 817–856)
- `spec/data-flow/12-workspace.md` `## Rationale` § "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터
  — UUID 검증 강도 비대칭 (2026-08-09)" 의 "캐너리 지목 정정 (2026-08-09)" 하위 문단 (line
  15410–15415)

## 발견사항

교차검증 결과 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 유형도
발견되지 않았다. 구체적으로:

1. **캐너리 앵커 정정 (uuid.ts / uuid.spec.ts)** — diff 는 "회귀 캐너리 = `system-status.e2e-spec.ts`"
   라는 기존 주석을 "실제로는 두 unit 테스트" 로 고친다. 이는 `spec/data-flow/12-workspace.md`
   Rationale 이 **이미 2026-08-09 일자로 동일하게 정정해 둔 내용**(`#1112` 실측)과 정확히 일치한다.
   결정(느슨한 `isUuidShaped` 술어, 403↔400 뒤바뀜 방지)은 그대로고 앵커(어느 테스트가 그 회귀를
   잡는가)만 바뀌었다 — Rationale 이 스스로 "결정은 영향 없고 앵커만 바뀐다" 고 명시한 그대로다.
   **번복이 아니라 Rationale 이 지시한 정정의 이행**이다.

2. **73건 vs 142건 (workspace-reflection-canary.ts)** — `spec/data-flow/12-workspace.md` Rationale
   의 "73건"(HTTP 라우트 222건 중 `@WorkspaceId()` 소비 + `@Roles()` 없음, cross-tenant 결함
   클래스 크기)과 캐너리가 세는 "142건"(`@Roles()` 유무 무관 `@WorkspaceId()` 소비 라우트 전체)은
   서로 다른 집합이며, diff 의 새 주석은 이 subset/superset 관계를 명시적으로 구분해 혼동을
   차단한다. `1-auth.md` Rationale 의 캐너리 설계 원칙("단언 대상은 라우트 목록이 아니라 '0건이
   아님'")과도 충돌하지 않는다 — 개수 자체를 단언 조건으로 쓰는 게 아니라 부팅 로그 참고치일
   뿐이다.

3. **"라우트별 opt-in 마커" 재도입 여부** — `1-auth.md` Rationale (b) 는 `SetMetadata` + `Reflector`
   opt-in 마커 방식을 **재기각**(reject) 한 바 있다. diff 는 `handlerConsumesWorkspaceId` 판별
   로직이나 데코레이터 사용 방식을 전혀 건드리지 않으므로 이 기각된 대안을 재도입하지 않는다.

4. **헤더 검증 강도(`isUuidShaped` vs `isValidUuid`)** — `data-flow/12-workspace.md` Rationale 은
   "일관성 명목으로 헤더를 `ParseUUIDPipe` 급으로 조이는 것은 회귀" 라고 명시한다. diff 는
   `uuid.ts` 의 술어 로직을 변경하지 않고 docstring 만 정정했으므로 이 invariant 를 우회하지
   않는다.

5. **secret-store LIKE 가드 e2e 신설** — 새 e2e(`secret-store-like-prefix.e2e-spec.ts`)와 mock
   보강은 기존 가드(메타문자 거부)의 **존재 근거를 검증 가능하게 만드는 테스트 추가**일 뿐,
   가드 자체의 정책 변경이 아니다. `spec/5-system/*` Rationale 범위에 이 가드에 대한 상충 서술은
   없다.

6. **http-request.handler.spec.ts 죽은 코드 제거** — 실행에 영향 없는 미사용 `fetchPromise`
   변수·리스너 제거로, 실제 abort 전파 검증 로직(observedSignal 기반 단언)은 그대로 유지된다.
   Rationale 저촉 없음.

이번 검토에서 CRITICAL/WARNING 급 항목은 없다.

- **[INFO] 73/142 subset·superset 설명이 코드 주석에만 있고 spec Rationale 에는 없음**
  - target 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` 상단 주석
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` § "멤버십 검증은 가드
    1곳에서" (73건 실측 서술, line 15320–15355)
  - 상세: 코드 주석은 73건(subset)과 142건(superset)의 관계를 정확히 설명하지만, spec 쪽
    Rationale 은 142건(캐너리 실측치)을 언급하지 않는다. 지금은 모순이 아니지만, 향후 73건
    쪽 숫자가 바뀌었을 때 spec 만 보고 캐너리 카운트와의 관계를 추정하면 다시 혼동이 재발할
    소지가 있다(이번 PR 자체가 그런 혼동의 재발 사례).
  - 제안: `1-auth.md` "부트 캐너리" 절 또는 `12-workspace.md` "73건" 문단에 "캐너리가 세는
    142건(전체 `@WorkspaceId()` 소비 라우트)은 이 73건(그중 `@Roles()` 없는 subset)의
    상위집합" 한 줄을 추가해 코드 주석과 spec Rationale 양쪽에서 동일 설명이 발견되도록 미러링
    (project-planner 소관, 후속 스펙 동기화 항목으로 등재 가능 — 즉시 차단 사유는 아님).

## 요약

이번 diff 는 spec 변경이 전혀 없는 순수 코드/테스트/문서 위생 PR이며, 내용 전체가 이미 병합된
`#1112`("auth 불변식 5곳 spec 동기화") 커밋이 spec Rationale 에 기록해 둔 두 건의 명시적 정정
(캐너리 앵커 정정, UUID 검증 강도 비대칭의 "일관성 조임 금지" 원칙)을 코드 주석·테스트 픽스처
쪽으로 그대로 전파하는 작업이다. 기각된 대안(라우트별 opt-in 마커)의 재도입, 합의 원칙(헤더
느슨한 검증, 캐너리 fail-closed 설계) 위반, 무근거 결정 번복, invariant 우회 중 어느 것도
발견되지 않았다 — 오히려 Rationale 이 지시한 정정을 정확히 따른 사례다. 유일한 관찰은 INFO
수준의 spec-코드 간 숫자 설명 미러링 제안이며 차단 사유가 아니다.

## 위험도
NONE
