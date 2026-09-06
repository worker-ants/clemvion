# 변경 범위(Scope) 리뷰

## 개요

`origin/main...HEAD` 는 6개 커밋(`96d3856a9` feat → `4d49aa575`/`9a186fa31`/`01b078379`/
`72c0bcc13`/`4529812c6` fix)으로 구성되며, 앞선 5개 커밋은 이미 5차례의 `/ai-review`
라운드(`10_13_22`·`10_53_48`·`11_27_53`·`11_55_36`·`12_28_02`)를 거쳐 scope 관점에서 매번
"핵심 목표(`User` 엔티티 컬럼 노출 검출)와 1:1 일치, Critical/Warning 급 범위 이탈 없음"으로
판정된 바 있다. 이번 라운드(`12_53_28`)의 신규 검토 대상은 **아직 scope 리뷰를 받지 않은
마지막 커밋 `4529812c6`**(직전 라운드 `12_28_02` 가 찾은 WARNING 3 + INFO 3 + consistency
INFO 1 을 처분)이다.

`git show --stat 4529812c6 -- . ':!review'` 로 이 커밋만 분리해 확인한 결과 9개 파일
(`CHANGELOG.md`, `dto-jsdoc-citation-guard.ts`/`.spec.ts`/`jsdoc-citation.fixture.ts` 신규,
`user-relation-load.fixture.ts`/`user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts`
수정, `workspace-rbac.e2e-spec.ts`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)
만 건드리며, 커밋 메시지가 선언한 5개 항목(W1 `unwrap` 4분기 중 관측 불가 2분기 제거 + `as`
캐스트 fixture 추가, W2 `dto-jsdoc-citation-guard.ts` 신설, W3 eager 축 문서 갱신, INFO#2·12
`propKeyText()` 통합, INFO#14 `J.` 테스트 `rbac-f-*`→`rbac-j-*` 치환, consistency INFO#1
`§1.3`→`§3` 정정)을 코드와 줄 단위로 대조한 결과 **정확히 1:1로 일치**했다. `§1.3`→`§3`
정정은 `spec/5-system/1-auth.md` 를 직접 열어 실측했다 — `## 3. 인가 (Authorization)` 는
존재하고 `### 1.1 이메일/비밀번호 인증` 산하에 `1.3` 이라는 하위 절은 없어(RBAC 를 다루지
않음), 이 정정이 근거 있는 사실 정정임을 확인했다. 선언 밖의 추가 수정, 무관한 리팩토링,
포맷팅 뒤섞임, 불필요한 임포트/주석/설정 변경은 발견되지 않았다.

전체 6개 커밋 누적분(`git diff --stat origin/main...HEAD -- . ':!review'`)도 17개 파일,
1936줄 추가/12줄 삭제로 여전히 "`User` 컬럼 노출 검출 2축 + 소비 e2e + 그 계기로 드러난
`WorkflowVersionsService.findOne` 유출 수정"이라는 단일 목적 안에 있다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 핵심 목표(`User` 컬럼 방어) 밖의
  파생 갭 — 이번 라운드에서 재발·확대 없이 5차례째 재확인됨
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (`WorkspaceMemberDto.joinedAt`, 최초 커밋 `96d3856a9`에서 1회만 추가)
  - 상세: `git log -p --follow` 로 이 필드의 이력을 재확인한 결과 이후 5개 fix 커밋 어느
    것도 이 필드를 다시 건드리지 않았다 — 이번 라운드(`4529812c6`)의 diff에도 이 파일이
    없다. 이전 5차례 scope 리뷰(`10_13_22`~`12_28_02`)가 이미 동일 근거(wire 동작 불변,
    3곳 문서 disclose)로 INFO 처분한 사안의 재확인이며, 신규 확대는 없다.
  - 제안: 조치 불요 — 기존 판정 유지.

- **[INFO]** fix 커밋 6건 모두 코드 수정과 직전 리뷰/컨시스턴시 세션 산출물을 한 커밋에
  묶어 커밋한다 — 저장소 명시 규약(`review/code/**`, `review/consistency/**` 저장 위치)과
  선례(`f5d97aa39`)에 부합하는 확립된 관례이며, 4차례 scope 리뷰가 이미 검토·승인
  - 위치: `review/code/2026/09/06/{10_13_22,10_53_48,11_27_53,11_55_36,12_28_02}/**`,
    `review/consistency/2026/09/06/{10_13_23,10_53_50,11_27_54,11_55_37,12_28_03}/**`
    (누적 108개 파일, 8899줄)
  - 상세: `RESOLUTION.md` 각 라운드가 서술한 처분 내용을 대응 코드 diff 와 대조한 결과
    일치했다(이번 라운드에서 `4529812c6` 을 직접 대조 완료, 이전 라운드는 선행 scope
    리뷰들이 이미 확인). 새로 지적할 것 없음.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드 신규 fixture(`violationAsCastRelations`)가 도입한 `strictRepo`
  로컬 선언이 다른 fixture 파일의 관례(TypeORM `Repository` 미임포트, 로컬 no-op 선언)를
  그대로 따른다 — 범위 밖 확장 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts`
    (`StrictOpts`/`strictRepo` 선언, `violationAsCastRelations`)
  - 상세: 커밋 메시지가 명시한 이유(`relations`를 `string[]`으로만 받는 타입이라야
    `as unknown as string[]` 캐스트가 lint 의 `no-unnecessary-type-assertion` 을 통과하는
    "필요한" 단언이 된다)와 실제 코드가 정확히 일치했다. 새 타입/헬퍼가 fixture 파일 밖으로
    새어 나가거나 프로덕션 코드에 영향을 주지 않는다.
  - 제안: 없음.

## 요약

이번 세션이 새로 검토해야 했던 유일한 미검증 구간(마지막 커밋 `4529812c6`)은 직전 라운드
(`12_28_02`)가 남긴 WARNING 3·INFO 3·consistency INFO 1 을 커밋 메시지가 선언한 그대로,
1:1로 처분했다. 신규 파일(`dto-jsdoc-citation-guard.ts`/`.spec.ts`/fixture)은 그 자체로
독립적인 신규 검출 축이지만 CHANGELOG·plan 완료 노트에 "왜 이번 PR 범위에 포함되는가"
(같은 브랜치 계열에서 JSDoc 유출이 세 번 반복됐다는 실측)가 명시돼 있어 임의 기능 확장이
아니라 이 PR 자신이 반복 재현한 결함 클래스에 대한 자기 방어로 판단한다. 6개 커밋 전체
누적분도 여전히 단일 목적(`User` 컬럼 노출 검출) 안에 있으며, 무관한 리팩토링·포맷팅·
불필요한 임포트/주석/설정 변경은 발견되지 않았다. `WorkspaceMemberDto.joinedAt` 파생 갭과
리뷰 산출물 동반 커밋 관행은 이미 4~5차례 재확인된 INFO 항목으로, 이번 라운드에서도 재발·
확대 없음을 확인했다. Critical/Warning 급 범위 이탈은 없다.

## 위험도

NONE
