# 변경 범위(Scope) 리뷰

## 개요

`origin/main...HEAD` 는 5개 커밋(`96d3856a9` feat → `4d49aa575`/`9a186fa31`/`01b078379`/
`72c0bcc13` fix)으로 구성되고, 실질 코드/문서 변경은 `git diff --stat origin/main...HEAD --
. ':!review'` 기준 정확히 **14개 파일**이다. 전부 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 등재 항목("`User` 엔티티에 컬럼 수준 방어를 둘지 결정")을 닫는
단일 목적("User 엔티티 민감 컬럼 노출 검출 2축 신설 + 그 과정에서 발견한 실유출 수정")에
직접 대응한다. fix 4개 커밋은 각 자체(자기) 리뷰/consistency 라운드가 찾은 결함을 처분한
것으로, 이 저장소가 CLAUDE.md 에서 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"
로 명시한 표준 워크플로에 정확히 해당한다 — 자기가 낸 결함을 자기가 닫는 반복은 범위 이탈이
아니라 이 저장소의 정규 절차다.

새로 만들어진 파일(`user-entity-exposure-guard.ts`/`.spec.ts`, `user-secret-absence.ts`/
`.spec.ts`, `user-eager-relation.fixture.ts`, `user-relation-load.fixture.ts`)을 전부 직접
`git diff`/`Read` 로 열어 내용을 확인했다 — 전 함수·전 fixture 케이스가 "`User` 관계를
투영 없이 싣는 자리를 검출한다"는 선언된 목적 안에 있고, 무관한 유틸리티나 별개 기능은
섞여 있지 않다. `workflow-versions.service.ts`/`.spec.ts` 변경도 이 검출 인프라가 실제로
찾아낸 Critical(투영 없는 `findOne`)의 수정에 정확히 국한된다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 핵심 목표("User 컬럼 방어") 밖의
  파생 산출물 — 4차례 리뷰 라운드에서 이미 disclose·재확인된 항목이며 이번 최종 라운드에서
  재발·확대 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (`WorkspaceMemberDto` 클래스, `joinedAt` 필드 — 함수/클래스명으로 특정. 최종 diff 에서는
    `72c0bcc13` 커밋이 이 필드의 JSDoc/주석 형태만 다시 손봤다)
  - 상세: 신규 `GET /:id/members` e2e(`workspace-rbac.e2e-spec.ts`)가 `assertMatchesContract`
    를 처음 배선하며 드러난 §5.4 선언 갭이다. `WorkspacesService.listMembers`(diff 밖 기존
    코드)가 이미 무조건 `joinedAt`을 실어 왔고 프런트엔드도 이미 그 타입으로 소비 중이라는
    근거(wire 동작 불변)를 CHANGELOG·plan 완료 노트·DTO 자체 주석 세 곳 모두가 명시하며,
    직전 4개 scope 라운드(`10_13_22`, `10_53_48`, `11_27_53`, `11_55_36`)가 이미 같은
    결론(INFO, 조치 불요)에 도달했다. 이번 최종 커밋(`72c0bcc13`)이 이 필드에 가한 유일한
    변경은 consistency W3 처분 — 필드 JSDoc 에 담겼던 §5.4 근거·실측 날짜 같은 내부 서사를
    `//` 주석으로 내리고 공개 JSDoc(→ OpenAPI description)은 한 줄로 줄인 것뿐이라, 범위
    이탈의 성격이 바뀌거나 커지지 않았다.
  - 제안: 조치 불요 — 기존 판정 유지.

- **[INFO]** fix 커밋들이 코드 수정과 직전 리뷰/컨시스턴시 세션 산출물(`review/code/**`,
  `review/consistency/**`)을 한 커밋에 묶어 커밋한다 — 이 저장소의 명시 규약·선례에 부합
  - 위치: `review/code/2026/09/06/{10_13_22,10_53_48,11_27_53,11_55_36}/**`,
    `review/consistency/2026/09/06/{10_13_23,10_53_50,11_27_54,11_55_37}/**`
  - 상세: CLAUDE.md 의 "코드 리뷰 산출물"/"일관성 검토 산출물" 저장 위치 규약과 경로가
    정확히 일치하고, 각 `RESOLUTION.md` 가 서술한 처분 내용을 대응 코드 diff 와 대조한
    결과(`workflow-versions.service.ts` 투영 로직, `CREATOR_PROJECTION` 도입, `hasProjectionFor`
    술어 반전, `findEagerUserRelations`/`forEachUserTypedProperty` 등) 전부 일치했다. 3차례
    앞선 scope 라운드가 이미 검토·승인한 관례이며 이번 라운드에서 새로 지적할 이탈은 없다.
  - 제안: 조치 불요.

## 요약

5개 커밋의 실질 변경은 14개 파일로 한정되며 전부 "`User` 엔티티 컬럼 노출 검출·수정"이라는
단일 목적과 직접 대응한다. `git diff --stat` 로 재확인한 범위와 각 fix 커밋 메시지가 선언한
처분 항목(eager 관계 축 신설, `hasProjectionFor` 오탐 수정, `forEachUserTypedProperty` 로
순회 통합, `CREATOR_PROJECTION`/`ProjectedCreator`/`UnloadedRelations` 타입 좁히기, JSDoc
위치 정정)을 실제 diff 와 대조한 결과 선언 밖의 추가 리팩토링·기능 확장·무관한 파일 수정·
포맷팅 뒤섞임·불필요한 임포트/설정 변경은 발견되지 않았다. 유일하게 핵심 범위를 살짝
벗어나는 `WorkspaceMemberDto.joinedAt` 추가는 이전 4차례 scope 리뷰가 이미 INFO 로 처분한
동일 사안이며 이번 최종 커밋에서도 재발·확대 없이 그대로 유지됐다. 신규 검출 가드가 §5.4
`code:` 에 미등재된 점·`User` 7컬럼 규범이 spec 에 없는 점은 developer 권한 밖(`spec/` 쓰기)
이라 plan 에 planner 후속 항목으로 정확히 위임됐고, 이 브랜치 diff 밖의 인접 결함(다른 PR
`#1291` 이 만든 `Ref` DTO 클래스 JSDoc 2건)을 발견하고도 손대지 않고 등재만 한 것도 scope
경계를 스스로 지킨 사례다. Critical/Warning 급 범위 이탈은 없다.

## 위험도

NONE
