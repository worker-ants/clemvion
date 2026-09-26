# 변경 범위(Scope) 리뷰

## 검증 방법

리뷰 대상 29개 파일을 `plan/in-progress/post-status-openapi.md` (본 작업의 plan)와 대조했다. plan 은 "요구" 섹션에 정확히
7가지 산출물을 명시한다: (1) 정적 가드 신설(`http-status-advertised{-guard.ts,.spec.ts}` + fixture), (2) 14곳
`@HttpCode(HttpStatus.OK)`, (3) `revokeInvitation` 광고를 `ApiOkWrappedResponse(OkResultDto)` 로, (4) 관련 e2e 기대값
정합, (5)(6)(7) CHANGELOG·트래커·spec(리뷰 대상 밖). `git diff HEAD~5 HEAD` 로 실제 변경분을 재구성해 `--stat` 전체(29 파일)가
프롬프트가 준 목록과 정확히 일치함을 확인했고, 컨트롤러 6개 파일의 전체 diff(프롬프트에서 크기 제한으로 잘린 4개 포함:
`integrations` · `knowledge-base` · `schedules` · `workflows`)를 직접 읽었다.

## 발견사항

- **[INFO]** 리뷰 대상 파일 목록과 실제 `git diff` 변경 파일이 1:1로 일치, 추가/누락 없음
  - 위치: 저장소 전체 (`git diff HEAD~5 HEAD --stat` = 29 files changed, review 프롬프트의 파일 1~29 목록과 동일)
  - 상세: `codebase/backend/src` 6개 컨트롤러 + 신설 가드 3개 파일, `codebase/backend/test` e2e 19개 파일. 스코프 밖 디렉터리(`frontend`·`packages`·`channel-web-chat`) 변경 없음.
  - 제안: 없음(정상)

- **[INFO]** `@HttpCode(HttpStatus.OK)` 추가 개수가 plan 이 명시한 "14곳"과 정확히 일치
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts`(regenerate) · `integrations.controller.ts`(previewTest·oauthBegin·testConnection·rotate·reauthorize·requestScopes 6곳) · `knowledge-base.controller.ts`(search) · `schedules.controller.ts`(previewExpression) · `workflow-assistant.controller.ts`(sendMessage) · `workflows.controller.ts`(saveCanvas) · `workspaces.controller.ts`(leave·transferOwnership·acceptInvitation 3곳)
  - 상세: 1+6+1+1+1+1+3 = 14. plan `## 실측` 섹션이 나열한 14개 핸들러 이름과 정확히 대응한다. 추가로 건드린 핸들러 없음.
  - 제안: 없음(정상)

- **[INFO]** import 변경은 실제 신규 사용에 정확히 대응
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (import 블록, `HttpStatus` 추가·`ApiNoContentResponse` 제거)
  - 상세: `integrations` · `knowledge-base` · `schedules` · `workflows` 4개 컨트롤러는 `HttpCode`·`HttpStatus` 가 이미 import 되어 있어(다른 핸들러가 기존에 사용 중) diff 에 import 변경이 없다. `workspaces.controller.ts` 만 `HttpStatus` 를 새로 쓰므로 import 를 추가했고, `ApiNoContentResponse` 는 이 파일 안에서 그 자리(`revokeInvitation`)가 유일한 사용처였으므로 대체와 함께 제거했다(grep 으로 사용처 0건 확인). 사용하지 않는 임포트를 추가하거나, 무관한 정리성 임포트 삭제는 없음.
  - 제안: 없음(정상)

- **[INFO]** `revokeInvitation` 의 `@ApiNoContentResponse` → `@ApiOkWrappedResponse(OkResultDto)` 치환은 새 타입 도입이 아니라 기존 타입 재사용
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:230`(delete) · `:395`(remove) 등에서 이미 쓰이던 `OkResultDto` 를 `revokeInvitation` 자리에도 적용
  - 상세: `OkResultDto` 는 같은 파일의 `remove`·`leave`·`transferOwnership` 등에서 이미 import·사용 중이던 DTO다. 신규 DTO 정의나 기능 확장이 아니라 같은 컨트롤러 내 기존 패턴을 한 자리 더 적용한 것.
  - 제안: 없음(정상)

- **[INFO]** e2e 19개 파일의 변경은 전부 상태 코드 기대값 조인(`[200, 201]`/`201` → `200`)과 그에 직결된 주석 정리
  - 위치: `codebase/backend/test/*.e2e-spec.ts` 19개 파일 각 1~2줄
  - 상세: 삭제된 주석은 전부 "POST 기본값이 201이라 둘 다 허용" 류의, 이번에 해소된 불일치를 설명하던 문장이다(예: `graph-warning-save.e2e-spec.ts` 의 "POST 기본 201(saveCanvas 컨트롤러는 @HttpCode override 없음)" 주석 삭제, `workspace-path-guard.e2e-spec.ts` 의 "…OpenAPI 는 200 을 광고한다(기존 불일치, 트래커 등재)" 주석 삭제). 코드 변경과 분리된 무관한 주석 편집이 아니라, 그 줄이 서술하던 사실 자체가 이 PR 로 사라졌으므로 함께 제거된 것. `workflow-assistant.e2e-spec.ts` 에 신규 테스트 케이스 G 가 추가됐는데, 이는 plan 요구 4번("workflow-assistant `sendMessage` SSE 상태 줄" 검증)에 명시된 산출물이라 스코프 내.
  - 제안: 없음(정상)

- **[INFO]** 신설 가드 파일 3개(`http-status-advertised-guard.ts` 319줄 · `http-status-advertised.spec.ts` 282줄 · fixture 152줄)는 규모가 크지만 plan 요구 1번에 정확히 대응
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`, `.../http-status-advertised.spec.ts`, `.../fixtures/http-status-advertised/sample.controller.ts`
  - 상세: plan 은 "정적 가드 … 베이스라인 0 … 대조군 fixture 로 각 분기를 가른다" 를 명시적 요구사항으로 적었다. 이 세 파일이 그 요구를 구현한 것이며, 기존 `repo-guards/__tests__/` 디렉터리 관례(다른 가드들과 동일한 3-파일 구조: guard 로직 + spec + fixture)를 따른다. 기능 확장(over-engineering)이 아니라 명시된 산출물.
  - 제안: 없음(정상)

- **[INFO]** 포맷팅·설정 파일 변경 없음
  - 위치: 해당 없음
  - 상세: 29개 변경 파일 어디에도 순수 공백/줄바꿈 재포맷팅, `package.json`/`tsconfig`/`eslint` 등 설정 변경이 없다.
  - 제안: 없음(정상)

## 요약

리뷰 대상 29개 파일 전부가 `plan/in-progress/post-status-openapi.md` 의 명시적 요구사항(정적 가드 신설·14곳 `@HttpCode`·초대 취소 광고 정정·관련 e2e 기대값 조인)에 1:1로 대응하며, 스코프를 벗어난 추가 리팩토링·기능 확장·무관한 파일 수정·불필요한 포맷팅/주석/임포트 변경을 발견하지 못했다. import 변경(workspaces 컨트롤러의 `HttpStatus` 추가·`ApiNoContentResponse` 제거)도 실제 사용 변화에 정확히 대응한다. 신설 가드 파일의 규모가 크지만 이는 plan 이 요구한 산출물이지 over-engineering 이 아니다. 리뷰 중 저장소 파일에 대한 뮤테이션은 수행하지 않았다(`git status --short` 확인, 읽기만 수행).

## 위험도

NONE
