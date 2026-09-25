# 테스트(Testing) 리뷰 — workspace-path-guard (2라운드)

## 사전 확인

1라운드(`review/code/2026/09/25/16_03_32`)의 testing 관련 발견(INFO 6·INFO 7)을 `RESOLUTION.md` 와 대조했다.

- INFO 6(병용 핸들러 + 경로 값 형식 불량 미고정) — `roles.guard.spec.ts`
  `'경로 값이 형식 불량이면 역할 판정 없이 헤더 멤버십만 본다'` 테스트가 실제로 추가돼 있다. **해결 확인.**
- INFO 7(`workspaceParamNamesOf` 순서가 `.sort()` 로 가려짐) — "가드는 모든 이름을 순회해 순서에 의존하지 않는다" 는
  근거로 변경 없이 처분됐다. 그 주장 자체(코드가 실제로 모든 이름을 순회하는가)는 아래 발견 1과 관련된 별개
  질문이라 재지적하지 않고 새 관찰로 분리해 적는다.

이 라운드에서 새로 관찰된 항목만 아래에 적는다.

## 발견사항

- **[WARNING]** `RolesGuard` 가 다중 `@WorkspaceParam` 을 "전부" 검증한다는 유일한 테스트가, "마지막 파라미터만
  검증하는" 회귀를 잡지 못하는 형태로 짜여 있다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:692-704`
    (`it('경로 워크스페이스가 여럿이면 전부 본다 — 하나라도 비멤버면 거부', ...)`)
  - 상세: 이 테스트는 `PathTarget.prototype.twoPaths`(`@WorkspaceParam('a')` · `@WorkspaceParam('b')`)에
    `{ a: SAME_WS, b: OTHER_WS }` 를 주고 `buildGuard({ [SAME_WS]: 'owner' })` 로 설정한다 — 즉 **먼저 오는
    `a` 는 통과, 나중 `b` 는 비멤버**라 거부 사유가 항상 마지막 파라미터에서 나온다. 단언도
    `getMemberRole` 이 `OTHER_WS`(=`b`)로 호출됐는지만 확인하고, `SAME_WS`(=`a`)로도 호출됐는지는 확인하지
    않는다. 그 결과 `roles.guard.ts:167-179`(`for (const name of pathParamNames) { ... await
    this.assertMember(...) }`)를 "마지막 항목만 검사"로 바꾸는 뮤턴트를 넣어도 — `b` 하나만 조회해도
    같은 `NOT_A_MEMBER` 가 나오므로 — 이 테스트는 그대로 GREEN 이다. 반대로 **앞선 파라미터가 실패하고
    뒤 파라미터가 통과하는** 케이스(`{ a: OTHER_WS(비멤버), b: SAME_WS(owner) }`)가 없어, "일부 경로
    워크스페이스만 검사하고 통과시키는" 방향의 회귀는 어느 테스트로도 걸리지 않는다.
    `plan/in-progress/workspace-path-guard-impl.md` 의 뮤턴트 표(M1~M17)에도 이 형태의 뮤턴트(가드
    루프가 여러 경로 파라미터 중 일부만 검사)는 없다 — M8("경로 이름 첫 하나만")은
    `workspaceParamNamesOf`(반환값이 전부인지)만 겨냥했고, 가드의 `for` 루프 자체를 겨냥하지 않았다.
  - 현재 실사용 라우트는 전부 `@WorkspaceParam` 1개(`workspace-roles-attachment.spec.ts` 15곳 표가 전부
    `['id']`)라 오늘 당장의 취약점은 아니다 — 다만 이 테스트가 "여럿이면 전부 본다" 는 불변식을 지킨다고
    주장하는 유일한 자리이므로, 그 주장을 실제로 증명하지 못하는 상태로 남아 있다.
  - 제안: `twoPaths` 케이스에 순서를 뒤집은 변형을 추가한다 — 예:
    `buildGuard({ [OTHER_WS]: null, [SAME_WS]: 'owner' })` 로 `{ a: OTHER_WS, b: SAME_WS }` 를 주고
    거부됨을 확인하거나, 최소한 기존 테스트에
    `expect(getMemberRole).toHaveBeenCalledWith(SAME_WS, 'u1')` 를 추가해 **양쪽 다** 조회됐음을 고정한다.

- **[INFO]** `assertMember` 의 `ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER` 폴백(`??` 우측)이 현재 불변식
  아래에서는 도달 불가능해 보이며 테스트로 확인되지 않는다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (`assertMember`, `throw new
    ForbiddenException(ROLE_REQUIRED[threshold] ?? NOT_A_MEMBER)` 줄)
  - 상세: `threshold` 는 `requiredRoles`(항상 `@Roles(...)` 에 적힌 문자열) 중 `roleLevel` 최솟값이다.
    `@Roles()` 에 계층 밖 문자열(오탈자 등)이 오면 `roleLevel` 이 0 을 반환해 `threshold` 가 그 문자열이
    되지만, 그 경우 실제 멤버(`role`)의 레벨은 항상 ≥1 이라 `roleLevel(role) >= roleLevel(threshold)`
    (0)가 항상 참이 되어 애초에 `throw` 에 도달하지 않는다. 즉 `threshold` 가 `ROLE_REQUIRED` 에 없는
    값이 되는 경로와 `throw` 가 실행되는 경로가 서로 배타적이라, 이 `?? NOT_A_MEMBER` 는 현재 짜여진
    도메인에서 죽은 코드로 보인다(같은 성질의 폴백이 리팩터 이전 `ROLE_HIERARCHY[required] || 0` 형태로도
    있었으므로 이번 diff 가 새로 만든 문제는 아니다).
  - 제안: 조치 불요 수준이나, 방어적 코드라는 것을 주석 한 줄로 남기거나(예: "이 자리는 현재 도달하지
    않는다 — threshold 가 ROLE_REQUIRED 밖이면 roleLevel 0 이라 위 비교가 항상 통과한다"), 정말 방어가
    필요하면 `@Roles()` 등록 시점(데코레이터)에서 유효한 역할 문자열인지 검증하는 편이 더 이른 실패다.

## 요약

이번 라운드 diff 는 1라운드 Warning 8건에 대한 실제 수정(`37ee970a2` 등)을 담고 있고, 그 수정들(역할 서열
단일화 4테스트, `@ApiForbiddenResponse` 상수화, stale 주석 정정, INFO 6 테스트 추가)은 diff 에서 확인된다.
`workspace-roles.spec.ts`·`workspace.decorator.spec.ts`·`roles.guard.spec.ts`·
`workspace-reflection-canary.spec.ts`·`workspace-param-binding.spec.ts`·`param-uuid-pipe.spec.ts`·
`workspace-roles-attachment.spec.ts`·`workspaces.service.spec.ts`(비멤버 오라클 제거 케이스)·신규 e2e
`workspace-path-guard.e2e-spec.ts` 까지 계층별 테스트가 촘촘하고, 대조군 fixture(`sample.controller.ts`
2종)로 정적 가드의 판별 자체를 검증하는 패턴이 일관되게 반복돼 가독성·격리 모두 양호하다. 유일하게 새로
발견한 갭은 `RolesGuard` 가 다중 `@WorkspaceParam` 을 "전부" 검사한다는 불변식을 증명하는 테스트가 실은
"마지막 파라미터만 검사"하는 뮤턴트를 구분하지 못하는 형태라는 점이다 — 현재 프로덕션 라우트는 전부 단일
파라미터라 즉각적 위험은 아니지만, 향후 다중 경로 워크스페이스 라우트가 추가되면 이 테스트가 그 결함을
잡지 못한 채 그린을 유지할 수 있다. 그 외에는 회귀·엣지 케이스(형식 불량, nil UUID, 헤더-경로 병용, 멤버십
오라클 제거 등)를 촘촘히 커버하고 있어 전체적으로 테스트 품질은 높다.

## 위험도

LOW
