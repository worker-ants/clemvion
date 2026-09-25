# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** workflow-assistant 하위 10개 파일(파일 12~21: `assistant-finish-guard.service.*`, `assistant-tool-router.service.*`, `candidate-lookup.service.*`, `explore-tools.service.*`, `workflow-assistant-stream.service.*`)은 언뜻 "통합(Integration) Personal 소유자 강제"라는 PR 제목과 무관해 보이지만, 실제로는 `IntegrationsService.findAll(workspaceId, userId, query)` · `ExploreToolsService.listIntegrations(workspaceId, userId, category)` 시그니처에 `userId` 가 추가된 것의 **필연적 하위 호출자 갱신**이다. 두 서비스가 워크플로 어시스턴트의 `list_integrations` 툴과 `integration-selector`/`mcp-server-selector` 후보 조회에서도 쓰이므로, 남의 personal 통합을 어시스턴트 후보 목록에서도 감추려면 이 경로들도 함께 고쳐야 한다(`candidate-lookup.service.ts` 주석 "요청자에게 보이는 통합만 — 남의 personal 은 후보에서 빠진다" 참고). `plan/in-progress/integration-personal-owner.md` 의 spec 근거(`spec/3-workflow-editor/4-ai-assistant.md` §4.1 · §4.3.1)도 이를 명시적으로 요구한다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts:50` (`fillCandidates` 시그니처), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:165` (`listIntegrations` 시그니처)
  - 상세: 스코프 이탈이 아니라 시그니처 변경의 정상적 파급 범위임을 확인했다.
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **[INFO]** `codebase/backend/src/modules/integrations/integrations.controller.ts` 에 새 private 헬퍼 `roleOf()`(:134 부근)가 추가되고, 기존 `create`/`rotate`/`requestScopes`/`updateScope` 4곳에서 반복되던 `this.integrationsService.resolveRole(workspaceId, user.sub)` 인라인 호출이 `this.roleOf(workspaceId, user)` 로 치환됐다. 동시에 `integrations.service.ts` 에는 `assertCanModify` · `judgedRow` · `reloadOrNotFound` 같은 새 private 헬퍼가 도입돼 `update`/`remove`/`updateScope`/`reauthorize`/`rotate` 가 `save()` 대신 조건부 `update()`(compare-and-set)로 바뀌었다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:134`(roleOf), `codebase/backend/src/modules/integrations/integrations.service.ts` 의 `assertCanModify`/`judgedRow`/`reloadOrNotFound`(파일 11, diff 상단부)
  - 상세: 겉보기엔 "불필요한 리팩토링"처럼 보이지만, PR 설명(호출자 고지) 과 인라인 주석이 "판정 뒤 scope 가 바뀌면 쓰지 않는다"·"TypeORM `save()` 는 lost update 를 일으킨다"는 이유를 구체적으로 들고 있고, 이는 3라운드 리뷰(`review/code/2026/09/25/23_58_59`)에서 이미 제기된 TOCTOU 문제의 연장선이다. 새 호출 지점(6곳 이상)에서 같은 역할·판정 로직이 필요해졌으므로 중복 제거가 이 기능에 종속적이다. 무관한 리팩토링으로 보지 않는다.
  - 제안: 조치 불필요 — 기록 목적의 INFO. (정확성·동시성 측면의 검증은 별도 correctness/concurrency 리뷰어의 몫)

- **[INFO]** 호출자 고지(프롬프트 하단)는 "changeset 은 `codebase/**` 22개 파일"이라고 적었으나, 실제로 리뷰 대상 파일은 27개(코드 23 + mdx 문서 4)다(`git diff <merge-base> HEAD -- codebase --stat` 로 실측). `.md`/`.json` 을 예산상 뺐다는 서술과 달리 mdx 문서 4개(파일 24~27)는 실제로 프롬프트에 포함되어 있다.
  - 위치: 프롬프트 "호출자 고지" 섹션(§4~5, 마지막 문단)
  - 상세: 코드 자체의 스코프 이탈은 아니며, 오케스트레이터가 파일 수를 잘못 세었거나 mdx 를 다른 분류로 취급한 것으로 보인다. 리뷰 판정에는 영향 없음.
  - 제안: 조치 불필요 — 차기 라운드에서 파일 수 서술만 바로잡으면 된다.

- **[INFO]** 4개 mdx 문서(파일 24~27, `integration-management.{,en.}mdx`, `workspaces-and-members.{,en.}mdx`)의 변경은 모두 이번 PR 이 도입한 새 권한 행렬(Personal 은 생성자만, Organization 변경은 Admin 이상, Viewer 도 자기 Personal 은 재인증 가능)을 정확히 반영하는 문장 교체이며, 무관한 문단 리라이트나 포맷팅 변경은 섞여 있지 않다(각 언어쌍의 표현이 대응 관계를 유지).
  - 위치: 4개 mdx 파일 diff 전체
  - 상세: 기능 변경과 문서 동기화가 1:1로 대응한다.
  - 제안: 조치 불필요.

## 요약

27개 변경 파일(백엔드 22 + e2e 1 + 프론트 mdx 문서 4)을 전수 대조한 결과, 모든 변경이 "Personal 통합은 생성자에게만 보이고 Organization 통합 변경은 Admin 이상으로 제한한다"는 단일 보안 기능(및 그 필연적 파급: 워크플로 어시스턴트의 통합 후보/목록 필터링, 관련 문서 동기화)에 직접 연결되어 있다. 의도 이상의 변경, 무관한 리팩토링, 요청 밖 기능 확장, 무관한 파일 수정, 실질 변경과 섞인 포맷팅, 불필요한 주석·임포트·설정 변경은 발견되지 않았다. 서비스 계층에서 `save()` → compare-and-set `update()` 전환처럼 다소 침습적인 리팩토링이 있으나, 이는 이전 라운드(3라운드)에서 이미 지적된 TOCTOU 문제를 닫기 위한 것으로 이 PR 의 보안 목적에 종속적이다. 이번 PR 은 4라운드째 `/ai-review` 를 거치는 중이며, 이번 회차에서 새로 스코프를 벗어난 항목은 확인되지 않았다.

## 위험도

NONE
