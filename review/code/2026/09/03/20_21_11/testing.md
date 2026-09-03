# 테스트(Testing) 리뷰

## 검증 수행 내역

- `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 의 `listInvitations` 핸들러(약 392-406행)가 `invitedBy: i.invitedBy` 를 코어션 없이 그대로 통과시키는 것을 직접 확인 — plan·테스트 docstring 의 서술과 일치.
- `npx jest workspaces.controller.spec.ts` 원본 그대로 실행 → **14 passed, 14 total**. 신규 `listInvitations` describe 블록의 두 테스트(캐너리 + 대조군) 모두 GREEN.
- `npx jest src/modules/workspaces` (모듈 전체) 실행 → **6 suites / 113 tests 전부 pass**. `workspace-invitations.service.spec.ts` 에 `invitedBy: null` / `invitedByName: null` 케이스가 서비스 레벨에서 이미 커버되고 있음을 재확인(라인 373, 392, 467, 483 부근).
- `git status --short` — 리뷰 산출물 디렉터리(`review/code/2026/09/03/20_21_11/`)만 untracked, 코드/테스트 파일 변경 없음. 저장소 뮤테이션 없이 read-only 로만 검증했다.
- 직전 라운드(`review/code/2026/09/03/20_02_03/testing.md`)가 지적한 **WARNING — `listInvitations` 신규 테스트 2건에 서비스 호출 인자 검증 누락**을 이번 diff 에서 재확인 — 캐너리 테스트에 `expect(invitations.listPending).toHaveBeenCalledWith('ws-1', user.sub)` 가 추가되어 **해소됨**을 코드로 직접 확인했다(같은 라운드의 `RESOLUTION.md` W1 조치 내역과 일치).

## 발견사항

- **[INFO]** 대조군 테스트는 호출 인자를 검증하지 않는 비대칭 구조
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts` — `describe('listInvitations')` 중 `'[대조군] 초대자가 살아 있으면 그 id 를 싣는다'` 테스트
  - 상세: 직전 라운드 WARNING 조치가 "두 테스트 중 하나"에만 `toHaveBeenCalledWith` 를 추가하는 것으로 의도적으로 마무리됐다. 같은 핸들러를 같은 인자로 호출하는 두 테스트이므로 한 쪽만 검증해도 인자 순서 회귀는 잡히지만, 대조군 테스트 단독으로는 인자 검증이 없어 파일 내 다른 describe 블록(예: `update`)의 "테스트마다 인자 검증" 관례와는 완전히 같지는 않다. 실질적 위험은 낮다 — 캐너리 테스트가 이미 그 축을 잡고 있고, 뮤테이션(인자 스왑)으로도 RED 가 재현된 바 있다(RESOLUTION.md 기록).
  - 제안: 조치 불요. 다만 향후 유사 패턴을 추가할 때는 "짝 중 하나에만 검증" 규칙을 팀 컨벤션으로 명시하거나, 두 테스트 모두에 넣는 편이 다음 리뷰에서 같은 질문이 재발하지 않는다.

- **[INFO]** 남은 갭(예외 전파 테스트 부재, FK cascade e2e 부재, DTO `invitedBy?:` 표기 불일치)은 전부 직전 라운드에서 이미 식별·추적 중
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts` (`describe('listInvitations')`, 60번째 줄 부근), `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (105-110행)
  - 상세: 직전 리뷰(`20_02_03/testing.md`)가 낸 INFO 3건과 동일한 갭이 이번 diff 에도 그대로 남아 있다(변경 없음). `listInvitations` 에 대한 비-admin `ForbiddenException` 등 예외 전파 테스트가 없고, FK cascade 를 실 DB 로 관통하는 e2e 도 없으며, `invitedBy?:`(optional key) 표기가 `InvitationMetaDto.invitedByName`(non-optional) 과 다르다. 세 항목 모두 plan 문서(`entity-nullable-column-type-mismatch.md`)의 후속 항목 또는 이전 SUMMARY 의 "이번 PR 스코프 아님" 판정으로 이미 추적되고 있다.
  - 제안: 재-flag 불요. 이미 위임된 경로(§5.4 planner 턴, 선택적 e2e 후속)를 그대로 따른다.

## 요약

이번 라운드의 diff 는 직전 리뷰 라운드(`20_02_03`)가 지적한 테스트 WARNING(`listInvitations` 신규 테스트의 서비스 호출 인자 검증 누락)에 대한 조치 결과이며, 실제로 코드를 열어 확인한 결과 캐너리 테스트에 `toHaveBeenCalledWith('ws-1', user.sub)` 가 추가되어 해소됐다. `jest workspaces.controller.spec.ts`(14/14)와 워크스페이스 모듈 전체(113/113) 를 원본 상태 그대로 재실행해 회귀가 없음을 확인했고, 저장소는 clean 상태였다(뮤테이션 없이 read-only 검증). 새 테스트 쌍(null 케이스 + 대조군)은 여전히 명확한 docstring 으로 의도를 설명하고, 직전 라운드의 뮤테이션 재현(`?? ''` 삽입 시 1 failed/13 passed)으로 vacuous 하지 않음이 이미 실증돼 있다. 남은 것은 전부 INFO 급 — 대조군 테스트의 인자 검증 비대칭(설계상 의도된 것)과, 이미 추적 중인 예외 전파·e2e cascade·DTO optional 표기 갭뿐이다. 새로운 Critical/Warning 은 없다.

## 위험도

LOW
