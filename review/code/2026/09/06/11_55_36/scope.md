# 변경 범위(Scope) 리뷰

## 개요

`origin/main...HEAD` (기준 `bfa124920`) 는 4개 커밋으로 구성된다.

| 커밋 | 성격 |
|---|---|
| `96d3856a9` feat | `User` 엔티티 컬럼 노출 검출 2축(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축) 신설 + 소비 e2e/CHANGELOG/plan |
| `4d49aa575` fix | 1차 코드 리뷰(`10_13_22`)가 찾은 Critical 1(`WorkflowVersionsService.findOne` 이 `User` 전 컬럼을 투영 없이 반환) 처분 |
| `9a186fa31` fix | 2차 리뷰(`10_53_48`)·consistency(`10_53_50`)가 찾은 WARNING 4+2 처분 (`CREATOR_PROJECTION` 상수화, 중첩 객체 스캔 확장, e2e 라벨 정리 등) |
| `01b078379` fix | 3차 리뷰(`11_27_53`)·consistency(`11_27_54`)가 찾은 WARNING 4+2 처분 (`hasProjectionFor` 불리언 오탐 수정, eager 관계 축 신설, 테스트 제목 stale count 제거, `ProjectedCreator` 타입 좁히기) |

`git diff origin/main...HEAD --stat -- . ':!review'` 결과 실질 코드/문서 변경은 정확히 13개
파일이며, 전부 "`User` 컬럼 노출 검출·수정"이라는 단일 목적에 직접 대응한다 — 무관한 모듈,
포맷팅 전용 변경, 설정 변경은 없다.

가장 최근 커밋(`01b078379`)을 `git show --stat 01b078379 -- . ':!review'` 로 분리 확인한
결과 4개 파일(`workflow-versions.service.ts`, `user-entity-exposure-guard.ts`,
`user-relation-load.fixture.ts`, `user-entity-exposure.spec.ts`)만 건드리며, 커밋 메시지가
선언한 W1(eager 관계 축 `findEagerUserRelations` 신설)·W2(`hasProjectionFor` 를 "객체인가"
에서 "불리언이 아닌가" 로 뒤집음 + fixture 위반 12/준수 3 추가)·W3(가드 spec 제목에서 stale
개수 제거)·W4(`ProjectedCreator`/`WorkflowVersionDetail` 타입 신설)와 실제 diff 내용을
줄 단위로 대조한 결과 **정확히 1:1로 일치**했다. 선언 밖의 추가 수정은 없다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 핵심 목표(User 컬럼 방어) 밖의 파생 갭 — 3차례 리뷰에서 이미 disclose·재확인된 항목이며 이번 라운드에서 재발·확대 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto.joinedAt`)
  - 상세: 신규 `GET /:id/members` e2e(`workspace-rbac.e2e-spec.ts`)가 `assertMatchesContract` 를 처음 배선하며 드러난 §5.4 선언 누락이다. `git log -p --follow` 로 이 필드의 이력을 보면 `96d3856a9`(최초 feat 커밋)에서 한 번만 추가됐고 이후 `4d49aa575`/`9a186fa31`/`01b078379` 어느 커밋도 이 파일을 건드리지 않았다 — 즉 이번 라운드에서 새로 생기거나 커진 범위 이탈이 아니라 이미 세 차례(`10_13_22`, `10_53_48`, `11_27_53` 각 scope.md)가 INFO 로 처분한 동일 사안의 재확인이다. `WorkspacesService.listMembers` 가 이미 무조건 `joinedAt` 을 실어 왔고 프런트엔드도 이미 그 타입으로 소비 중이라는 근거(wire 동작 불변)도 그대로 유효하다.
  - 제안: 조치 불요 — 기존 판정 유지.

- **[INFO]** fix 커밋 3건 모두 코드 수정과 직전 리뷰/컨시스턴시 세션 산출물을 한 커밋에 묶어 커밋한다 — 이 저장소의 명시된 규약 및 선례(`f5d97aa39`)에 부합하는 확립된 관례이며, 3차례 scope 리뷰가 이미 검토·승인
  - 위치: `review/code/2026/09/06/{10_13_22,10_53_48,11_27_53}/**`, `review/consistency/2026/09/06/{10_13_23,10_53_50,11_27_54}/**` (총 51개 파일, `RESOLUTION.md`·`SUMMARY.md`·개별 reviewer 리포트·`meta.json`·`_retry_state.json`)
  - 상세: CLAUDE.md 의 "코드 리뷰 산출물"/"일관성 검토 산출물" 저장 위치 규약(`review/code/**`, `review/consistency/**`)과 정확히 일치하는 경로에 있고, `RESOLUTION.md` 가 각 라운드에서 실제로 처분한 항목을 서술한 내용이 대응 코드 diff 와 일치함을 위에서 직접 확인했다. 새로 지적할 것 없음.
  - 제안: 조치 불요.

## 요약

4개 커밋의 실질 코드/문서 변경은 13개 파일로 한정되며 전부 "`User` 엔티티 컬럼 노출 검출·수정"이라는 단일 목적과 직접 대응한다. 가장 최근 커밋(`01b078379`)을 별도로 분리해 커밋 메시지가 선언한 4개 수정 항목(W1 eager 관계 축, W2 `hasProjectionFor` 오탐 수정, W3 stale count 제거, W4 타입 좁히기)과 실제 diff를 줄 단위 대조한 결과 정확히 일치했고, 선언 밖의 추가 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한 주석/임포트/설정 변경은 발견되지 않았다. 유일하게 핵심 범위를 살짝 벗어나는 `WorkspaceMemberDto.joinedAt` 추가는 이전 3차례 scope 리뷰가 이미 INFO 로 처분한 사안이며, 이번 라운드에서 재발·확대되지 않았음을 재확인했다. 리뷰/컨시스턴시 산출물이 fix 커밋에 함께 실리는 것도 저장소 확립 관례에 부합한다. Critical/Warning 급 범위 이탈은 없다.

## 위험도

NONE
