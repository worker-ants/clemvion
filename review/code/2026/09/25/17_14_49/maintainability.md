# 유지보수성(Maintainability) 리뷰 — review/code/2026/09/25/17_14_49 (3라운드)

## 발견사항

- **[INFO]** `RolesGuard.canActivate()`의 경로 워크스페이스 분기가 헤더/토큰 분기와 비대칭적으로 인라인화돼 있다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:154`~`168` (`canActivate` 내부, `pathParamNames.length > 0` 블록)
  - 상세: 같은 메서드 안에서 헤더·토큰 컨텍스트 검증은 `checkRequestContext`(사설 메서드, 179번째 줄)로 추출되어 있는데, 경로 파라미터 루프(`for (const name of pathParamNames) { ... await this.assertMember(...) }`)는 `canActivate` 본문에 그대로 남아 있다. 기능상 문제는 없고 뮤테이션 테스트(`roles.guard.spec.ts`)로 잘 덮여 있지만, 두 분기의 추출 수준이 다르면 다음에 셋째 컨텍스트(예: 쿼리 파라미터 워크스페이스)가 추가될 때 어느 스타일을 따라야 하는지 모호해진다.
  - 제안: `checkPathWorkspace(request, controllerClass, handler, userId, requiredRoles)` 형태로 동일하게 추출하면 `canActivate` 자체는 라우팅(어느 컨텍스트인지 판별)만 담당하게 되어 대칭성이 생긴다. 지금 당장 필수는 아님.

- **[INFO]** 새 e2e 파일이 이미 존재하는 공유 fixture 상수를 동일 이름·동일 값으로 로컬 재선언
  - 위치: `codebase/backend/test/workspace-path-guard.e2e-spec.ts:34` (`const NIL_WS = '00000000-0000-0000-0000-000000000000';`)
  - 상세: 같은 값·같은 이름의 `NIL_WS`가 이미 `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:57`에 export 돼 있고, `workspace.decorator.spec.ts` 등 다른 스펙이 그 모듈에서 `HEADER_WS`·`TOKEN_WS`·`DECOY_WS`를 가져다 쓴다. `test/*.e2e-spec.ts`가 `../src/...`를 import하는 선례도 이미 있다(`entity-schema-declarations.e2e-spec.ts`, `integration-cafe24-precheck.e2e-spec.ts` 등). 값 자체(nil UUID)가 바뀔 일은 없어 실질적 drift 위험은 낮지만, 같은 이름의 독립적인 두 선언이 존재하면 grep으로 정의를 찾을 때 혼동을 줄 수 있다.
  - 제안: `import { NIL_WS } from '../src/common/__test-utils__/workspace-id-fixtures'`로 교체. `ABSENT_WS`는 그 모듈에 없는 새 개념(실제 DB에 없는 임의 UUID)이라 그대로 로컬 선언이 맞다.

- **[INFO]** `beforeAll`에서 admin 픽스처가 2단계(초대 시 `'editor'` → 별도 PATCH로 승격)로 만들어지는 이유가 주석에 없음
  - 위치: `codebase/backend/test/workspace-path-guard.e2e-spec.ts:66`~`82`
  - 상세: `inviteAndAccept`의 `role` 파라미터는 `Exclude<WorkspaceRole, 'owner'>`라 `'admin'`을 직접 받을 수 있다(`test/helpers/auth.ts:96`). 그런데 이 setup은 `'editor'`로 초대해 수락시킨 뒤 `PATCH /members/:memberId`로 admin으로 승격시킨다. 결과는 동일하지만 왜 직접 `'admin'`으로 초대하지 않았는지 설명이 없어, 처음 읽는 사람은 "PATCH 라우트 자체를 검증하려는 의도인가?"를 오해하기 쉽다(그런데 이 파일의 다른 테스트는 PATCH members 라우트를 별도로 다루지 않는다).
  - 제안: 한 줄 주석으로 의도(예: "PATCH members(:memberId) 라우트도 이 setup 이 지나가며 exercise 한다" 또는 단순히 직접 `'admin'`으로 초대하도록 단순화)를 남기면 다음 사람이 이 우회를 실수로 "단순화"했다가 커버리지를 잃는 일을 막는다.

- **[INFO]** `RolesGuard` 클래스 docstring이 78줄(48~125)로 확장되어 spec 문서의 §Rationale 내용과 상당 부분 겹친다
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts:48`~`125`
  - 상세: 이번 PR로 "## 경로 워크스페이스" · "## 거부 코드" 두 섹션(약 30줄)이 추가되며 클래스 docstring이 더 길어졌다. 내용은 `spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드"를 상당 부분 그대로 재서술한다. 이 저장소는 보안 크리티컬 가드에 상세 근거를 코드 옆에 남기는 것을 일관되게 선호해 왔고(형제 파일 `workspace-reflection-canary.ts`도 같은 패턴), 1·2라운드 리뷰도 이 스타일 자체를 문제 삼지 않았다 — 그래서 WARNING 이 아니라 INFO 로 낮춘다. 다만 두 곳(코드 주석·spec)의 문장이 갈리기 시작하면 어느 쪽이 최신인지 판단하는 비용이 이 파일이 커질수록 늘어난다.
  - 제안: 지금 당장 조치는 불요. 다음에 이 클래스에 컨텍스트가 하나 더 늘 때는 상세 서술을 spec 쪽에만 두고 코드에는 "무엇을 하는지 + 왜 이 파일을 보라"는 짧은 포인터만 남기는 방향을 고려할 것.

- **[INFO]** 테스트 헬퍼 `buildGuard`의 시그니처가 유니온 타입으로 두 가지 다른 개념(전역 단일 역할 vs 워크스페이스별 역할 맵)을 겸함
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:178`~`190` (`function buildGuard(memberRole: string | null | Record<string, string | null>)`)
  - 상세: `typeof memberRole === 'object'`로 두 모드를 런타임에 구분하고, 두 모드 모두에서 `null`이 "그 워크스페이스의 비멤버"를 의미하도록 오버로드돼 있다. 기능은 정확하고 테스트도 촘촘하지만(경로 워크스페이스별로 다른 role을 부여해야 하는 새 요구를 기존 헬퍼에 얹은 결과), 다음에 세 번째 모드(예: 조회 실패를 흉내내는 reject)가 필요해지면 이 시그니처가 더 커질 여지가 있다.
  - 제안: 지금 규모에서는 리팩터링을 요구할 정도는 아니다. 세 번째 변형이 추가되는 시점에 `buildGuardWithRolesByWorkspace` 같은 별도 헬퍼로 분리하는 것을 고려.

## 요약

3라운드(전수 재검토) 기준, 이 changeset 은 유지보수성 관점에서 전반적으로 양호하다. 1·2라운드에서 지적된 역할 서열 중복·거부 본문 중복·`decoratorCallName` 복제·타입 안전성(`@Roles` 오탈자)·멀티 파라미터 테스트 커버리지 문제는 모두 실제로 해소되어 있음을 코드에서 직접 확인했다(`workspace-roles.ts` 단일 표, `NOT_A_MEMBER`/`ROLE_REQUIRED` 공유 상수, `source-scan.ts`의 `decoratorCallName` 통합, `Roles(...roles: WorkspaceRoleName[])`, 순서를 뒤바꾼 멀티 경로 파라미터 테스트 2건). 신규 코드(`RolesGuard.canActivate`의 경로 파라미터 분기, `workspace-param-binding-guard.ts`, `param-uuid-pipe-guard.ts`의 `WorkspaceParam` 확장)는 기존 가드들과 같은 패턴(순수 함수 분리, 위반·카운트를 같은 루프에서 산출, fixture 대조군)을 그대로 따르고 있어 일관성이 높다. 이번 라운드에서 새로 발견한 것은 모두 INFO 수준의 사소한 항목(경로 분기 추출 비대칭, 테스트 fixture 상수 로컬 재선언, admin 픽스처 생성의 불필요해 보이는 2단계, 계속 길어지는 클래스 docstring, 테스트 헬퍼의 유니온 시그니처)이며, 기능적 결함이나 실질적인 복잡도 초과는 없다.

## 위험도

LOW
