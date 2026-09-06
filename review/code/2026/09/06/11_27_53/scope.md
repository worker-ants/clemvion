# 변경 범위(Scope) 리뷰

## 개요

이번 프롬프트 번들(54개 파일)의 실체는 `origin/main...HEAD` 세 커밋이다.

| 커밋 | 성격 |
|---|---|
| `96d3856a9` feat | `User` 컬럼 노출 검출 2축(`user-entity-exposure-guard.ts`/`user-secret-absence.ts`) 신설 + 소비 e2e/CHANGELOG/plan |
| `4d49aa575` fix | `96d3856a9` 코드 리뷰(`10_13_22`)가 찾은 Critical 1(`WorkflowVersionsService.findOne` `User` 전 컬럼 유출) + WARNING 3 처분 |
| `9a186fa31` fix | `4d49aa575` 코드 리뷰(`10_53_48`)·consistency(`10_53_50`)가 찾은 WARNING 4+2 처분 |

`git diff --stat origin/main...HEAD` 결과 54개 파일 중 12개가 `codebase/`+`plan/`+`CHANGELOG.md`(실질 코드/문서 변경)이고 나머지 42개는 앞선 두 리뷰·컨시스턴시 라운드(`10_13_22`, `10_53_48`, `10_13_23`, `10_53_50`)의 산출물(RESOLUTION.md·SUMMARY.md·개별 reviewer 리포트·meta.json·`_retry_state.json`)이 커밋된 것이다. `review/**` 를 리뷰 산출물로 커밋하는 것은 CLAUDE.md 저장 위치 규약과 이 저장소의 기존 관례(예: `f5d97aa39`)에 부합하므로 그 자체는 범위 이탈이 아니다.

**이번 라운드에서 새로 검토할 실질 대상은 마지막 fix 커밋(`9a186fa31`)이다** — 앞의 두 커밋은 각 리뷰 라운드의 `scope.md`(`10_13_22`, `10_53_48`)가 이미 상세히 다뤘다. `9a186fa31` 을 직접 `git show` 로 열어 대조한 결과, 해당 커밋의 커밋 메시지·`RESOLUTION.md`(`10_53_48`)가 선언한 6개 항목(W1 투영 리터럴 통합, W2 중첩 객체 스캔 확장 + `unwrap()`, INFO#4 `enclosingName` fixture 보강, W3 e2e 라벨 `J.` 위치 복구 + `workflow-crud` `H.` 부여, W4 plan 수치 정정, consistency W1 지시문 정정)과 실제 diff(7 파일, 233 insertions / 63 deletions)가 **정확히 1:1로 일치**했다 — 선언 밖의 추가 수정은 없다.

## 발견사항

- **[INFO]** `workspace-rbac.e2e-spec.ts` 의 104줄 diff는 리팩토링이 아니라 순수 블록 이동이다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 케이스 `J.`(51줄 블록)가 `D.`/`E.` 사이(구 위치)에서 파일 끝(`I.` 뒤)으로 이동
  - 상세: `git show 9a186fa31 -- codebase/backend/test/workspace-rbac.e2e-spec.ts` 로 직접 대조한 결과, 삭제된 51줄과 파일 끝에 추가된 51줄이 공백 하나까지 완전히 동일하다(순수 cut-paste, 로직·주석 변경 없음). 라벨 재사용(`F.`→`J.`) 자체는 이전 라운드에서 이미 처리됐고, 이번 커밋은 "라벨=등장 순서" 관례를 복구하기 위한 위치 이동만 한다 — RESOLUTION.md·commit message 가 선언한 범위와 정확히 일치.
  - 제안: 없음(정상 처분 확인).

- **[INFO]** `CREATOR_PROJECTION` 도입은 새 기능이 아니라 이미 4곳에 존재하던 리터럴의 통합
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:33-39`(상수 신설), 소비 4곳(`service.ts` 2곳 + `service.spec.ts` 2곳)
  - 상세: `git show` 로 대조한 결과 값 자체(`{ id: true, name: true, email: true }`)는 바뀌지 않았고 손으로 복제된 4곳을 단일 상수 참조로 치환했을 뿐이다. 추가된 `CreatorProbeController`/`buildSwaggerDocument` 기반 테스트는 기존에 이미 존재하던 `shared/testing/swagger-probe.ts`(이번 diff 밖, `b541484c2` 이전부터 존재)를 재사용한 것이라 새 테스트 인프라를 도입하지 않았다. 범위 확장 아님.
  - 제안: 없음.

- **[INFO]** 가드 `unwrap()` 신설과 fixture 위반 9~11 추가는 지적된 결함(중첩 객체 미검출·캐스트 우회·`enclosingName` 미관측 분기)에 각각 정확히 대응하며, 그 이상으로 검출 범위를 넓히지 않았다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(`unwrap`, `userRelationInInitializer` 재귀화), `.../fixtures/user-relation-load.fixture.ts`(위반 9/10/11)
  - 상세: `unwrap()` 은 `as`/`satisfies`/괄호/`<T>` 네 형태만 벗기며, 그 네 형태가 실측(`as unknown as Record<…>` 로 검출 0건이 된 사례)과 저장소 lint 제약(`no-unnecessary-type-assertion` 이 `as` 를 막아 `satisfies` 가 유일하게 프로덕션에 남을 수 있는 형태)으로 근거가 명시돼 있다. 새 fixture 3건은 각각 W2·INFO#4 가 지목한 구체적 관측 불가 분기 하나씩에 대응하며, 관계 이름 화이트리스트나 스캔 대상 디렉터리를 넓히는 등의 부가 확장은 없다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 정정은 두 리뷰가 지적한 대상 문장에 정확히 국한된다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (18줄 diff)
  - 상세: (a) "DTO 가 하나 늘었다" → "둘 늘었다"(`WorkspaceMemberDto`·`WorkflowVersionDto`) 정정, (b) "정확히 두 검증자" 로 읽히는 인접 서술 두 곳을 표로 명시하고 "새 개수를 적지 말라"는 지시로 교체. 둘 다 `10_53_48`/`10_53_50` RESOLUTION.md 가 선언한 W4·consistency-W1 범위와 일치하며, `spec/` 파일 자체는 건드리지 않았다(developer 쓰기 경계 준수, `git diff --stat -- spec/` 결과 0).
  - 제안: 없음.

- **[INFO]** 앞선 두 라운드의 scope 리뷰(`10_13_22/scope.md`, `10_53_48/scope.md`)가 이미 지적한 유일한 범위 관련 항목(`WorkspaceMemberDto.joinedAt` 추가)은 이번 라운드에서 재확인 대상일 뿐 새로운 이슈가 아니다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: 두 선행 scope 리뷰가 이미 "핵심 목표(User 컬럼 방어) 밖의 곁가지지만, wire 동작 변경이 없고 CHANGELOG·plan·DTO JSDoc 세 곳에서 투명하게 disclose 됐다"고 INFO 로 처분했다. 이번 라운드(`9a186fa31`)는 이 파일을 건드리지 않았으므로 판정을 바꿀 근거가 없다.
  - 제안: 없음(기존 판정 유지).

## 요약

이번 diff(3개 커밋)는 "`User` 엔티티 컬럼 노출 방어" 라는 단일 목적에서 벗어나지 않는다. 마지막 fix 커밋(`9a186fa31`)을 직접 `git show` 로 열어 커밋 메시지·`RESOLUTION.md`(10_53_48/10_53_50)가 선언한 항목과 실제 diff 를 하나씩 대조한 결과, 선언 밖의 추가 수정·리팩토링·포맷팅·임포트 정리·설정 변경은 발견되지 않았다 — 104줄로 보이는 e2e diff 도 순수 블록 이동임을 확인했다. 앞선 두 라운드가 이미 처분한 유일한 경미한 곁가지(`WorkspaceMemberDto.joinedAt`)는 이번 커밋 범위 밖이라 재론하지 않는다. 리뷰/컨시스턴시 세션 산출물 42개 파일이 함께 커밋된 것도 이 저장소의 명시된 저장 위치 규약에 부합하는 정상 관례다. Critical/Warning 급 범위 이탈은 없다.

## 위험도

NONE
