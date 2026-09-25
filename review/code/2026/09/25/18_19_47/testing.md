# 테스트(Testing) 리뷰 — 2026/09/25 18:19:47 (5라운드)

## 개요

이번 changeset(`codebase/**` 30개 파일, 경로 워크스페이스 `@WorkspaceParam` 도입 + `RolesGuard` 인가
선행 + 역할 서열 단일화)은 이미 4라운드에 걸쳐 Warning 30건이 처분된 상태다. 테스트 관점에서 다시
훑어본 결과, 새 프로덕션 코드 경로 거의 전부가 unit(가드·데코레이터·서비스) + repo-guard(정적 스캔) +
e2e 세 층에서 중복 없이 교차 검증되고 있다. 아래는 그 위에서 찾은 잔여 갭이며, 전부 낮은 위험도다 —
새 Critical/Warning 급 커버리지 구멍은 발견하지 못했다.

## 발견사항

- **[INFO]** `RolesGuard` 다중 경로 파라미터에서 "서로 다른 종류의 거부"가 섞이는 조합은 테스트되지 않음
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `canActivate` 의 `for (const name of pathParamNames) { ...; await this.assertMember(raw, userId, requiredRoles); }` 루프(신규 경로 워크스페이스 분기, `workspaceParamNamesOf` 호출 직후 블록) / `codebase/backend/src/common/guards/roles.guard.spec.ts` 의 `twoPathsAdmin`·`twoPaths` `it.each` 블록(약 653번째 줄 부근 `@Roles("admin") 경로 라우트` 테이블, 703~745번째 줄 부근 "경로 워크스페이스가 여럿이면" 블록)
  - 상세: 이 루프는 `pathParamNames` 를 순서대로 순회하며 `assertMember` 를 **순차 `await`** 하고, 첫 예외에서 즉시 throw 되어 나머지 파라미터는 검사되지 않는다. 기존 `it.each` 는 "앞/뒤 자리 중 어느 쪽이 위반이어도 같은 판정"(둘 다 비멤버, 또는 둘 다 역할부족)을 자리를 바꿔 검증하지만, "첫 파라미터는 역할 미달(멤버), 둘째 파라미터는 비멤버" 처럼 **서로 다른 사유**가 자리마다 섞인 조합은 어느 것도 다루지 않는다. 이 경우 실제 동작은 "선언 순서상 먼저 걸린 사유가 이긴다"인데, 그 정책이 문서화도 테스트도 되어 있지 않다.
  - 제안: 현재 실제 라우트 중 워크스페이스 경로 파라미터가 2개인 곳은 없어(전부 단일 `id`) 당장 위험은 낮다. 다만 `twoPathsAdmin` 픽스처가 이미 존재하므로, 가벼운 `it.each` 한 줄로 "a=비멤버, b=역할미달(멤버)" / "a=역할미달, b=비멤버" 두 케이스를 추가해 어느 사유가 우선하는지(그리고 그것이 의도인지)를 명시적으로 고정해 두면 향후 워크스페이스 경로 파라미터가 2개인 라우트가 생겼을 때 회귀를 바로 잡을 수 있다.

- **[INFO]** `transferOwnership` 의 서비스 고유 거부 문구가 유닛 레벨에서 회귀 보호되지 않음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `throwOwnerTransferRequired()` (`message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.'`) / `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 의 `transferOwnership` 관련 `it('refuses when requester is not owner', ...)` 및 "비멤버에게 워크스페이스 존재 · 유형을 드러내지 않는다" 블록
  - 상세: `workspaces.service.spec.ts` 는 이 경로들에서 `response: { code: 'OWNER_REQUIRED' }` 만 단언하고 `message` 는 어디서도 확인하지 않는다(`grep` 결과 이 리터럴 문자열을 참조하는 테스트는 저장소 전체에 0건). 이 문구를 실제로 확인하는 테스트는 e2e `workspace-path-guard.e2e-spec.ts`의 "헤더에 자기 owner 워크스페이스를 실어도 경로 워크스페이스의 owner 가 아니면 가드가 막는다" 단 한 건뿐인데, 그 테스트는 **가드**의 메시지('Owner 권한이 필요합니다.')를 확인하는 것이지 서비스 고유 문구를 확인하는 게 아니다. 즉 서비스가 "두 번째 선"으로서 내는 고유 문구 자체를 지키는 테스트는 유닛 스위트 어디에도 없다 — 이 문구가 실수로 가드 문구와 같아지거나 다른 문구로 바뀌어도 unit 스위트는 초록으로 남는다.
  - 제안: `transferOwnership — 워크스페이스 %s 여도 비-owner 멤버는 OWNER_REQUIRED` 테스트(신규 추가분, `workspaces.service.spec.ts`)에 `response: { message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.' }` 한 줄을 보태면 unit 레벨에서 저비용으로 닫을 수 있다.

## 강점 (참고용 — 조치 불요)

- `roles.guard.spec.ts` 는 헤더/토큰/경로 세 컨텍스트를 조합한 20여 개 `it.each` 로 회귀를 촘촘히 잡고, "선언 순서만 있으면 살아남는 뮤턴트"를 실측(`review/code/2026/09/25/16_39_25`)까지 남겨 앞뒤 자리를 모두 검증하는 패턴을 이미 확립했다.
- `workspace.decorator.spec.ts`·`workspace-reflection-canary.spec.ts` 는 새 `WorkspaceParam`/`workspaceParamNamesOf` 를 헤더 전용·경로 전용·혼합 세 클래스로 나눠 "두 판별이 서로의 팩토리를 세지 않는다"까지 직접 단언한다.
- `repo-guards`(`param-uuid-pipe-guard`·`workspace-param-binding-guard`)는 대조군 fixture + vacuity floor + "면제가 과하게 넓어지지 않는가"의 반대방향 캐너리까지 갖춰, 정적 스캔 가드 자체의 자기 검증이 충실하다.
- `workspaces.service.spec.ts`의 "비멤버에게 워크스페이스 존재 · 유형을 드러내지 않는다" 블록은 `workspaceRepo.findOne` 미호출을 함께 단언해 "인가가 조회보다 먼저"라는 순서 불변식을 값이 아니라 **호출 여부**로 고정한다 — 존재·유형 오라클 재발을 구조적으로 막는 좋은 패턴이다.
- 신규 e2e `workspace-path-guard.e2e-spec.ts` 는 팀/개인/부재 워크스페이스에 대해 비멤버 응답이 구분되지 않음을 6개 라우트 클래스에 걸쳐 성질(값이 아니라 "셋이 같다")로 단언하고, `transferOwnership` 판별 케이스(헤더 vs 경로)를 양방향으로 갖춰 종전 결함 모양을 정확히 반증한다.

## 요약

새로 추가·변경된 프로덕션 로직(경로 워크스페이스 데코레이터, `RolesGuard` 인가 선행, 역할 서열 단일화, 서비스 계층 재정렬) 각각에 대해 unit·정적 스캔 가드·e2e 세 층이 중복 없이 서로 다른 실패 모드를 겨냥하고 있어 테스트 관점의 전반적 품질은 매우 높다. 발견한 두 건은 모두 INFO 수준이며 — 실제 라우트에 존재하지 않는 다중 경로 파라미터의 사유 충돌 조합, 그리고 서비스 고유 거부 문구의 유닛 레벨 회귀 보호 부재 — 병합을 막을 이유는 없다.

## 위험도

LOW
