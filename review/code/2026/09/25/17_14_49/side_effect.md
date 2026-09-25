# 부작용(Side Effect) 리뷰 — review/code/2026/09/25/17_14_49

## 컨텍스트

이 changeset 은 3라운드째다. 1라운드(`16_03_32`)·2라운드(`16_39_25`)가 이미 이 기능의 핵심 부작용 —
`RolesGuard` 거부 응답이 전 라우트에서 `false`(기본 `FORBIDDEN`)에서 코드를 실은
`ForbiddenException` 으로 바뀐 전역 인터페이스 변경(1라운드 W1, "이미 announce 됨"으로 처분) ·
가드+서비스 이중 멤버십 조회(1라운드 W2 · 2라운드 W7, 비용 실측으로 처분) · `decoratorCallName`
중복(2라운드 W3, 통합 완료) — 를 다루고 처분했다. 아래는 그 처분을 다시 올리지 않고, 이번 라운드
diff 에서 부작용 관점으로 새로 확인한 내용이다.

## 발견사항

- **[INFO]** `RolesGuard.canActivate` 의 경로 워크스페이스 루프가 파라미터마다 **순차** `await` 로
  멤버십을 조회한다 — 병렬화(`Promise.all`)가 아니다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `canActivate` 메서드,
    `for (const name of pathParamNames) { ... await this.assertMember(...); }` 블록(게이트 156~163).
  - 상세: 현재 프로덕션 컨트롤러는 전부 `@WorkspaceParam` 이 라우트당 하나뿐이라(`workspaces.controller.ts`
    14곳 · `auth.controller.ts` 1곳, 모두 단일 `:id`) 실질 영향은 없다. 다만 가드 자체는 라우트당 여러
    `@WorkspaceParam` 을 지원하도록 일반화돼 있고(`workspace.decorator.spec.ts` `twoParams` ·
    `roles.guard.spec.ts` `twoPaths`/`PathTarget.twoParams` 테스트가 그 일반성을 검증), 그런 라우트가
    나중에 추가되면 요청 하나가 N 개의 순차 DB 왕복으로 늘어난다. 이는 라우트 정의 시점에 데코레이터
    개수로 고정되는 값이라 사용자 입력으로 늘릴 수 있는 표면은 아니므로 DoS 급은 아니다.
  - 제안: 현재는 조치 불요. 다중 `@WorkspaceParam` 라우트가 실제로 추가되는 시점에 `Promise.all` 전환을
    검토(단, 실패 시 가장 먼저 매칭된 예외만 던지는 현재의 fail-fast 순서 보장이 깨지지 않게 주의).

- **[INFO]** `countWorkspaceIdConsumingRoutes` → `countWorkspaceConsumingRoutes` 로 개명하며 반환
  타입이 `number` → `{ requestContext, pathParam, total }` 객체로 바뀐 것은 **exported** 함수의
  하위호환 깨는 시그니처 변경이다.
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (게이트 98~124,
    `export function countWorkspaceConsumingRoutes(...)`).
  - 상세: 실제 호출부를 전수 확인한 결과(`grep -rn countWorkspace(Id)?ConsumingRoutes codebase/backend/src`)
    이 파일 내부(`assertWorkspaceIdReflectionWorks`)와 두 `.spec.ts` 뿐이며, 셋 다 이번 diff 에서
    함께 갱신됐다. `main.ts` 가 부팅 시 쓰는 `assertWorkspaceIdReflectionWorks(app)` 의 반환 타입은
    여전히 `number`(합계)라 부팅 경로는 영향 없다. 블라스트 반경이 이 파일로 닫혀 있어 실질 위험은 없다.
  - 제안: 조치 불요 — 기록 목적.

- **[INFO]** 거부 본문 상수(`NOT_A_MEMBER` · `ROLE_REQUIRED[...]`)를 던지는 모든 자리가 `{ ...NOT_A_MEMBER }`
  형태로 **펼쳐서** 넘기는지 저장소 전수로 확인했다 — `common/guards/roles.guard.ts`(2곳) ·
  `modules/auth/auth.service.ts` · `modules/workspaces/workspaces.service.ts`(2곳) 전부 스프레드를
  쓴다. 공유 싱글턴 객체가 `ForbiddenException` 을 거쳐 요청 간에 참조로 새거나 다운스트림 미들웨어가
  원본 상수를 오염시킬 경로는 없다. 새 결함 아님 — 기존 설계 의도(모듈 docstring)가 실제로 지켜지고
  있음을 확인한 기록.

## 재확인만 하고 재-flag 하지 않은 항목

- `RolesGuard` 거부가 전 `@Roles()` 라우트에서 코드를 싣는 전역 변경(예: 이번 diff 의
  `workspace-rbac.e2e-spec.ts` 에서 `/api/workflows` POST 의 viewer 거부가 `EDITOR_REQUIRED` 코드를
  얻는 것도 이 전역 변경의 발현이다) — 1라운드 W1 에서 "이미 announce 됨 · frontend 가 코드로 가르는
  자리는 `OWNER_REQUIRED` 하나" 로 처분됐고 이번 diff 의 CHANGELOG 근거도 그대로 유지된다. 새로운 근거
  없이 다시 올리지 않는다.
- `leaveWorkspace` 에 `assertMembership` 을 조회보다 먼저 두어 부재 워크스페이스도 404 대신 403
  `NOT_A_MEMBER` 로 답하게 된 변경(존재 오라클 폐쇄) — 서비스 메서드 호출부를 전수 확인한 결과
  (`grep -rn "\.leaveWorkspace("`) 컨트롤러(HTTP, 가드 보호)와 `removeMember` 내부 자기호출뿐이라
  가드 밖에서 이 서비스 메서드를 직접 부르는 경로가 없다 — 외부에서 "놀라는" 호출자가 없다. 의도된
  변경이고 `workspaces.service.spec.ts` 신규 테스트(부재·개인·팀 전부 `NOT_A_MEMBER`, `findOne`
  미호출)가 고정한다.

## 요약

핵심 부작용(전역 거부 응답 계약 변경, 가드·서비스 이중 조회)은 1·2라운드에서 이미 식별·처분됐고 이번
라운드 diff 에서 그 처분을 뒤집을 새 근거는 찾지 못했다. 이번 라운드에서 새로 확인한 것은 순차
DB 조회 루프의 잠재적 확장 리스크와 exported 함수 시그니처 변경 두 건인데, 둘 다 현재 코드베이스
범위에서는 blast radius 가 닫혀 있어 INFO 수준이다. 거부 본문 상수의 스프레드 사용도 전수 확인했고
문제 없다.

## 위험도

LOW
