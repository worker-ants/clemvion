# 문서화(Documentation) 리뷰 — workspace-path-guard (3라운드)

## 컨텍스트

1라운드(`16_03_32`, 위험도 NONE)·2라운드(`16_39_25`, 위험도 LOW, Warning 1건 — `switchWorkspace`
`@ApiOperation.description` 이 헤더 우선 동작을 잘못 광고)를 거쳤다. 2라운드의 지적은 이번 diff(파일
11, `auth.controller.ts`)에서 "이 라우트는 경로 `:id` 의 워크스페이스로만 판정하며 X-Workspace-Id
헤더를 쓰지 않습니다" 로 정확히 정정돼 반영돼 있다 — 재지적 대상 아님. `RESOLUTION.md`(1·2라운드)의
W1~W8 조치 내역(역할 서열 단일화 · 거부 본문 공유 · `decoratorCallName` 중복 제거 · `@Roles` 타입
좁히기 · CHANGELOG 수치 보강 등)도 이번 27개 파일 전체 재검토에서 전부 반영 상태로 확인했다.

본 라운드는 `codebase/**` 27개 파일 diff 전체(신규 가드 2종 + fixture · spec, `RolesGuard` · 데코레이터 ·
서비스 계층 변경)를 다시 훑었고, spec(`spec/data-flow/12-workspace.md`)·`CHANGELOG.md` 는 changeset
예산상 실리지 않았으나 절대경로로 직접 열어 대조했다.

## 발견사항

- **[WARNING]** `param-uuid-pipe-guard.ts` 의 `isIdShaped` 측정 주석(2026-09-12, "id-형 136건")이
  이번 PR 이 만든 모집단 분할(`@Param` → `@WorkspaceParam` 15곳 이동)을 반영하지 않은 채 그대로
  남아 있다 — 같은 함수 안, 몇 줄 아래에 **같은 136 이라는 숫자를 두고 이번 PR 이 직접 추가한 다른
  주석**은 이 분할을 정확히 짚고 있어 두 주석이 서로 다른 정밀도로 같은 수를 말한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:56` (`isIdShaped`
    독스트링 "실측(2026-09-12, controller 35개): id-형 136건 · 비-id 9건…") 및 같은 파일
    `:158-159`("2026-09-12 실측(`modules/` 전수, **이 PR 이 마지막 1건을 채운 뒤**): 파이프를 가진
    id-형 136건이 맨 식별자 108 : 인스턴스화 28 로 갈린다.") — 두 곳 모두 diff 밖 미변경 컨텍스트 줄.
    대조군: 같은 파일 `:149`("136 → 121 로 줄고 그 15곳의 문서 축이 조용히 검사 밖으로 나갈 뻔했다")는
    이번 PR 이 새로 추가한 줄로, 정확히 같은 이슈를 인지하고 있다.
  - 상세: `isIdShaped` 는 이제 `binding === 'Param'` 인 경우에만 호출된다(`:142`,
    `if (binding === 'Param' && !isIdShaped(param)) continue;`) — `@WorkspaceParam` 바인딩은
    이름 검사 없이 항상 카운트된다. 2026-09-25 이전에는 두 데코레이터가 없어 "id-형 136건"이 전부
    `@Param` population 이었지만, 이 PR 이 그중 15곳을 `@WorkspaceParam` 으로 옮기면서 `@Param`
    population 은 실측상 121건으로 줄고 새 `@WorkspaceParam` population(15건)이 그 자리를 채운다
    (`:149` 주석이 스스로 인정하는 숫자). 즉 `:56`·`:158-159` 의 "136건 · 108:28 분할"은 더는 "현재
    `@Param` 이 만드는 population"을 정확히 묘사하지 않는다 — `idParams` **총합**(두 binding 합산)은
    136으로 보존되지만, 그 136 안의 "@Param 108:28 분할"이라는 세부 서술은 깨졌다.
    이 저장소는 바로 이런 종류의 drift 에 유난히 엄격하다 — 같은 파일 `:160-165`에 "이 수치를
    `135건 107:28` 로 적었다가 정정했다… 그래서 지금은 어느 시점의 값인지를 문장에 박아 둔다" 는
    자체 교훈이 이미 있고, 이번 PR 도 `workspaces.service.ts`·`workspaces.service.spec.ts`에서
    똑같은 패턴(취소선 + "(2026-09-25 정정)")으로 두 군데의 낡은 주석을 고쳤다(2라운드 문서화
    리뷰가 확인). `:56`·`:158-159` 만 그 처리에서 빠졌다.
  - 제안: `:56`·`:158-159` 에도 같은 저장소 관례대로 "(2026-09-25~) `@WorkspaceParam` 으로 15곳이
    빠져나가 `@Param` population 은 121건(맨 식별자 93 : 인스턴스화 28, 추정 — 실측 권장)이고
    `@WorkspaceParam` 은 15건" 같은 날짜 붙은 addendum을 추가하거나, 최소한 "이 수치는 2026-09-12
    시점의 `@Param`-only population" 이라는 스코프 한정 문구를 덧붙인다. 정지 규칙상 `documentation`
    단독 발견은 차단 사유가 아니므로 즉시 조치가 아니어도 무방하나, 다음에 이 함수를 만지는 사람이
    136 을 현재값으로 오인하지 않도록 남겨 둘 필요가 있다.

## 그 외 확인한 항목 (문제 없음)

- **CHANGELOG**: `CHANGELOG.md` Unreleased 항목("워크스페이스 권한 거부가 코드를 싣고…")이 이번
  diff 의 두 관찰 가능한 변경(거부 코드 표준화, 경로 워크스페이스 15곳 가드 판정)을 그대로 반영하며,
  이미 2라운드가 수치 일치를 확인한 상태에서 변경이 없다.
- **spec 상호 참조**: 코드·테스트 전반이 인용하는 `spec/data-flow/12-workspace.md` §"경로 파라미터
  워크스페이스도 가드가 본다"·§"가드 거부의 오류 코드" 두 섹션 모두 실재하고 인용 문구와 일치한다.
  다만 같은 spec 문서의 §"경로 파라미터 워크스페이스도 가드가 본다" 하단 "기각된 대안" 단락은 경로
  라우트 수를 "13곳"으로 적어, 같은 문서 서두·CHANGELOG·이번 diff 전역(워크스페이스-roles-attachment
  테이블 14+1=15)이 일관되게 쓰는 "15곳"과 다르다(`spec/data-flow/12-workspace.md:391`). 이 파일은
  이번 리뷰의 27개 대상 파일에 포함돼 있지 않아(변경분 없음, changeset 예산으로 제외) 확정 지적은
  아니지만, 코드가 그 섹션을 직접 근거로 인용하는 만큼 참고용으로 남긴다.
- **독스트링/JSDoc**: `WorkspaceParam`·`workspaceParamNamesOf`(`workspace.decorator.ts`),
  `RolesGuard` 클래스 docstring 의 신규 "경로 워크스페이스"·"거부 코드" 섹션, `workspace-roles.ts`
  각 export, 신규 가드 2종(`workspace-param-binding-guard.ts`, `param-uuid-pipe-guard.ts` 의
  `WorkspaceParam` 분기)과 그 fixture·spec 모두 "왜 필요한가 · 판정 규칙 · 알려진 한계 · 이웃
  가드와의 경계"를 갖췄다 — 이 저장소의 기존 상위권 수준을 유지한다.
- **API 문서(Swagger)**: 이번 diff 가 건드린 라우트 전부(`workspaces.controller.ts` 14곳,
  `executions.controller.ts` 2곳, `auth.controller.ts` 1곳)에서 `@ApiForbiddenResponse` 설명이
  새 거부 코드·판정 계층(가드/서비스)을 정확히 반영한다. `workspaces.controller.ts` 의
  `FORBIDDEN_MEMBER_ROUTE`/`FORBIDDEN_ADMIN_ROUTE`/`FORBIDDEN_OWNER_ROUTE` 상수화는
  `workspace-roles-attachment.spec.ts` 의 15곳 테이블(`@Roles` 요구)과 라우트별로 정확히 대응한다.
- **주석 정확성(오래된 주석)**: `workspaces.service.ts`(`removeMember` 상단)·
  `workspaces.service.spec.ts` 의 "가드 층은 이 라우트를 막지 못한다" 서술을 취소선 +
  "(2026-09-25 정정)" 으로 정확히 갱신했다 — 원문을 지우지 않고 남긴 방식이 이 저장소 관례와
  일치한다.
- **예제 코드**: `WorkspaceParam` 사용법은 `workspace.decorator.spec.ts`, 두 대조군
  fixture(`param-uuid-pipe`/`workspace-param-binding`), 그리고 실제 프로덕션 사용처
  (`workspaces.controller.ts` 14곳, `auth.controller.ts` 1곳)로 충분히 드러난다 — 별도 가이드
  문서 불필요.
- **설정 문서**: 신규 환경변수·설정 옵션 없음(순수 인가 로직 변경) — README 갱신 필요성 없음.

## 요약

문서화 수준은 이전 두 라운드와 마찬가지로 이 저장소의 상위권이다 — 신설/변경 함수·클래스마다 "왜"를
설명하는 JSDoc, spec Rationale·CHANGELOG·테스트와의 상호 참조, 그리고 이 PR 자신이 낡게 만든 주석을
취소선 + 날짜로 정확히 정정한 이력까지 확인된다. 이번 라운드의 유일한 신규 지적은
`param-uuid-pipe-guard.ts` 안에서 같은 "136" 이라는 수치를 두고 이 PR 이 새로 추가한 주석(population
분할을 정확히 인지)과 그 몇 줄 위의 기존 측정 주석(분할 이전 값 그대로) 사이에 정밀도 격차가 생긴
것이다 — 저장소 스스로 여러 차례 확립한 "수치에는 시점을 박아 둔다" 관례의 사각지대다. 차단 사유는
아니다.

## 위험도

LOW
