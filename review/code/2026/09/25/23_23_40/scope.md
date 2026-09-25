# 변경 범위(Scope) 리뷰 — integration-personal-owner (2라운드)

## 발견사항

- **[INFO]** `assertCanRotate` → `assertCanModify(row, userRole, action)` 로 일반화
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `pickPrecheckConflict` 근방이 아니라 `assertCanModify`/`throwAdminRequired`/`judgedRow` 정의부(다이어그램상 게이트 651~683 부근)
  - 상세: 기존에 `rotate` 전용이던 판정 헬퍼를 `create`·`modify`·`delete`·`rotate`·`reauthorize` 공용으로 일반화했다. 이번 PR 에서 Organization 판정이 걸리는 액션이 1개(`rotate`)에서 5개로 늘어난 것이 원인이라, 그 확장에 직접 종속된 리팩터링이다 — "현재 작업과 무관한 정리"는 아니다.
  - 제안: 조치 불필요. 근거로만 남긴다(다음 라운드가 같은 자리를 또 "불필요한 리팩토링"으로 잘못 지적하지 않도록).

- **[INFO]** cafe24/makeshop precheck 공통 로직 `pickPrecheckConflict` 로 추출
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 함수 `pickPrecheckConflict` (게이트 351~365)
  - 상세: `precheckCafe24Mall`·`precheckMakeshopShop` 두 메서드가 이번 PR 에서 동시에 `userId` 파라미터 + `isIntegrationVisibleTo` 필터를 받아야 했다. 그대로 두면 같은 가시성 판정 로직이 두 곳에 중복돼 drift 위험이 생긴다 — 추출은 보안 로직 중복을 막기 위한 최소 범위 리팩터링으로, 기능 확장이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 컨트롤러 `roleOf()` 헬퍼 도입 + Swagger 거부 사유 문자열 상수화(`FORBIDDEN_MEMBER` 등)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (게이트 134~140 `roleOf`, 게이트 92~101 상수 정의부)
  - 상세: 이번 PR 로 `resolveRole` 호출 지점이 2곳(create, rotate)에서 7곳(oauthBegin/update/reauthorize/requestScopes/updateScope/remove 추가)으로 늘고, 거부 코드가 `FORBIDDEN`→`ADMIN_REQUIRED`/`RESOURCE_NOT_FOUND`로 세분화됐다. 문자열 상수화·헬퍼 추출 모두 이 확장에 직접 연동된 것이며, 호출자 공지에도 "기존 FORBIDDEN 4곳도 승격"이 의도된 동작으로 명시돼 있다.
  - 제안: 조치 불필요.

- **[INFO]** `update`/`remove`/`updateScope`/`reauthorize` 가 `entity.save()` 전체저장에서 조건부 `update()`(compare-and-set, `judgedRow`)로 전환
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `update`, `remove`, `updateScope`, `reauthorize` 메서드 본문
  - 상세: 단순 "userId 인자 추가" 범위를 넘어 쓰기 전략 자체가 바뀌었다(락 없는 원자적 조건부 쓰기). 다만 호출자 공지가 "판정 뒤 scope 변경은 락이 아니라 조건부 쓰기로 닫았다 — 삭제가 #1372 에서 락 없는 원자적 DELETE 로 설계된 것을 따른 선택"이라고 명시했고, 이는 이번 보안 수정이 만드는 새로운 TOCTOU 창(판정 시점과 커밋 시점 사이 scope 변경)을 막기 위한 필수 변경이다. 무관한 리팩토링이 아니라 기능 자체의 일부.
  - 제안: 조치 불필요.

- **[INFO]** `workflow-assistant` 모듈 8개 파일(`assistant-finish-guard`, `assistant-tool-router`, `candidate-lookup`, `explore-tools`, `workflow-assistant-stream` 및 각 spec)에 `userId` 전파
  - 위치: 파일 12~21 전체
  - 상세: `IntegrationsService.findAll` 시그니처가 `(workspaceId, query)` → `(workspaceId, userId, query)` 로, `ExploreToolsService.listIntegrations` 가 `(workspaceId, category)` → `(workspaceId, userId, category)` 로 바뀌었다. 두 서비스를 호출하는 workflow-assistant 파이프라인(통합 후보 조회 · MCP 서버 후보 조회 · `list_integrations` 도구)이 이 시그니처 변경의 직접적 호출자라 전파가 강제된다. 남의 personal 통합이 AI Assistant 후보 목록·MCP 서버 후보에도 노출되면 §8 판정이 이 경로만 우회하는 구멍이 되므로, 오히려 누락하면 결함이었을 변경이다.
  - 제안: 조치 불필요. "무관한 파일 수정"이 아니라 공유 서비스 시그니처 변경의 필연적 ripple.

- **[INFO]** 프론트엔드 문서 2개(`integration-management.mdx`, `.en.mdx`) 갱신
  - 위치: 파일 23~24
  - 상세: 백엔드 전용 PR 이지만, 문서가 역할별 권한 표·Danger zone 설명을 이번에 바뀐 실제 API 동작(§8 판정, ADMIN_REQUIRED, 생성자 전용 삭제)에 맞춰 갱신했다. 코드 변경 없이 동작만 서술하는 문서라 실제 구현과 어긋나지 않는지 확인이 필요했으나, diff 내용은 이번 PR 이 강제하는 백엔드 규칙과 1:1 대응한다. 프로젝트 관례상 ko/en 문서 쌍은 항상 동반 갱신되므로 한쪽만 고치지 않은 점도 적절하다.
  - 제안: 조치 불필요.

## 불명확 사항 (확인 필요, 스코프 위반 아님)

- 문서(파일 23/24)의 Viewer 행 서술 — "자신의 Personal 통합은 재인증과 scope 추가 요청도 할 수 있어요" — 는 백엔드 API 레벨 사실(`assertRequesterStillAllowed`/`assertCanModify` 가 personal 소유자에게는 역할과 무관하게 허용)과 일치한다. 다만 화면의 버튼 노출(Viewer 에게 실제로 재인증 버튼이 보이는지)은 호출자 공지의 후속 목록("Viewer 의 자기 Personal … 화면 버튼")에 명시적으로 이번 PR 범위 밖이라고 돼 있다. 문서가 API 동작을 정확히 서술하는 것 자체는 스코프 위반이 아니지만, 프론트엔드가 아직 버튼을 노출하지 않는 상태에서 문서만 앞서 나갈 가능성이 있다 — 이는 스코프 리뷰가 아니라 문서-구현 정합성 리뷰어가 볼 사안으로 넘긴다.

## 요약

24개 파일(backend 21 + frontend docs 2 + e2e 1)이 모두 "Personal 통합은 생성자에게만 보이고 Organization 통합 변경은 Admin 이상"이라는 단일 보안 수정에 직접 연결된다. DTO 설명 갱신, 신규 `integration-visibility.ts` 판정 유틸, controller/service/oauth-service 의 판정 배선, 그리고 `IntegrationsService.findAll`/`ExploreToolsService.listIntegrations` 시그니처 변경으로 인해 강제된 workflow-assistant 파이프라인 전체(8파일)의 `userId` 전파까지, 표면적으로는 넓어 보이지만 전부 같은 시그니처 변경의 필연적 ripple 이거나 같은 판정 로직의 중복 제거다. `entity.save()` → 조건부 `update()` 전환처럼 얼핏 "판정과 무관한 리팩토링"으로 보일 수 있는 부분도 호출자 공지에서 이번 보안 수정이 만드는 TOCTOU 창을 닫기 위한 의도된 설계 변경임이 명시돼 있고 근거(#1372 선례)까지 있다. 문서(ko/en mdx) 갱신도 실제 바뀐 API 동작과 1:1 대응해, 임의 기능 확장이나 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트 정리, 의도치 않은 설정 변경은 발견되지 않았다. 2라운드 리뷰(1라운드 Warning 11건 조치 완료 후)라는 점도 이 changeset 이 목표를 좁혀 다시 제출된 것과 부합한다.

## 위험도

NONE
