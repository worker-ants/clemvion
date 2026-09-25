# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** e2e 스펙 파일 상단 설명 주석의 문장이 미완성으로 끊겨 있다(주어/서술어 누락)
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts:20` (파일 헤더 JSDoc 블록, "보호 대상 invariants" 목록 첫 항목)
  - 상세: 실제 파일을 `Read` 로 직접 확인한 결과, 해당 줄은 다음과 같다 —
    `*   - 남의 personal 은 목록에서 빠지고, `:id` 경로는 **없는 id 와 같은** `404 RESOURCE_NOT_FOUND` 다 — Owner 에게도`
    문장이 "Owner 에게도" 에서 끝나며 뒤에 이어질 서술어(예: "그렇다", "예외가 아니다" 등)가 없다. 바로 아래 §8 spec 본문과
    이 파일의 파일 상단 설명(`* 근거: ... Rationale «Personal 통합 소유자 강제 — 404 존재 은닉 · 역할 우위 없음 · 노드 실행은
    후속»`)을 보면 의도된 문장은 "Owner 에게도 예외가 아니다" 류로 보이나, diff·전체 파일 컨텍스트 모두 이 상태로 커밋되어
    있다. 테스트 자체(`it.each([...])('%s — 남의 personal 은 Owner 에게도 없는 통합과 같은 404', ...)`)는 정상 동작하므로
    코드 결함은 아니고 순수 문서(주석) 결함이지만, 이 파일이 e2e 계약의 "SoT 요약" 역할(주석에 3라운드 리뷰·spec §8·Rationale
    을 모두 인용)을 하고 있어 다음에 이 파일을 참조하는 사람이 문장을 오독하거나 잘린 근거로 착각할 수 있다.
  - 제안: `- 남의 personal 은 목록에서 빠지고, `:id` 경로는 **없는 id 와 같은** `404 RESOURCE_NOT_FOUND` 다 — Owner 에게도
    예외가 아니다` 정도로 문장을 완결한다.

## 그 외 확인한 항목 (문제 없음, 참고용)

- **JSDoc/독스트링**: `integration-visibility.ts`(신규 모듈), `IntegrationOAuthService.assertRequesterStillAllowed`,
  `IntegrationsService.requireVisible`/`assertCanModify`/`judgedRow`/`reloadOrNotFound`/`requireModifiable`,
  `pickPrecheckConflict`, `integrations.controller.ts`의 `modifyActionOfBeginMode`/`roleOf` 등 이번 PR 이 새로 만든 공개·비공개
  함수 전부에 "무엇을·왜"를 설명하는 독스트링이 붙어 있고, spec 문서(§8·§9.2)와 이전 리뷰 라운드(WARNING 번호까지)를 구체적으로
  인용한다. 표본 대조 결과 spec 본문(`spec/2-navigation/4-integration.md` §8 "판정 규칙"·"아직 강제되지 않는 것")과 주석 서술이
  정확히 일치한다(예: Viewer 가 자신의 personal 통합에 한해 reauthorize·request-scopes 가 가능하다는 문서 서술이 실제
  `@Roles('editor')` 가드가 `reauthorize`/`requestScopes` 핸들러에는 없고 `update`/`rotate`/`remove` 에만 있다는 코드와 일치).
- **API 문서(Swagger)**: `integrations.controller.ts`의 `@ApiForbiddenResponse`/`@ApiNotFoundResponse` 설명이 새 인가 규칙
  (Admin 이상 필요, 남의 personal=404)에 맞춰 전부 갱신됐고, 공유 상수(`FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등)로 문구가 코드
  상수(`ROLE_REQUIRED.admin.code`)와 자동 동기화되도록 만들어 향후 코드명이 바뀌어도 문서가 stale 해지지 않는 구조다.
  `Cafe24PrecheckResultDto`/`existingIntegrationId`/`existingName`의 필드 설명도 "남의 personal 이면 생략" 조건이 추가됐다.
- **README/사용자 문서**: `integration-management.mdx`/`.en.mdx`, `workspaces-and-members.mdx`/`.en.mdx` 네 파일이 한국어·영어
  양쪽 다 새 권한 규칙(목록·상세·Danger zone 권한 표, RBAC 표의 "통합은 예외" 각주)을 반영해 갱신됐다. 두 언어 버전 간 내용이
  대응되고, 링크(`/docs/06-integrations-and-config/integration-management`)도 정확하다.
- **CHANGELOG**: `CHANGELOG.md` 최상단에 `## Unreleased — 남의 Personal 통합은 보이지 않고, Organization 통합의 변경은 Admin이다`
  항목이 이미 추가되어 있고, 관측 가능한 API 변화(404 통합, 403 코드 변경 `FORBIDDEN`→`ADMIN_REQUIRED`)를 항목 기준
  (`plan/complete/changelog-criteria.md`)에 맞게 정확히 서술한다.
- **주석 정확성(stale 코멘트 점검)**: `IntegrationsService.remove`/`getUsages`/`throwIntegrationNotFound` 등 기존 주석이
  코드 변경(`findById`→`requireVisible`, `findOne`→원자적 `delete`/`update` 조건절에 `scope` 추가)에 맞춰 함께 수정됐다.
  예: `remove()` 의 원자적 DELETE 설명에 "조건에는 판정 근거인 scope 도 싣는다" 문단이 새로 추가돼 실제 SQL 조건
  (`AND scope = $3`)과 일치한다.
- **설정 문서**: 이번 PR 은 새 환경변수·설정 옵션을 추가하지 않는다(순수 인가 로직 변경) — 해당 항목 해당 없음.
- **예제 코드**: 신규 e2e 스펙(`integration-personal-owner.e2e-spec.ts`)이 액터별(Owner/Admin/Editor/Viewer) 시나리오를
  실행 가능한 예제로 제공하고, `integration-visibility.spec.ts`의 `it.each` 표도 판정 표를 그대로 코드화해 사실상의
  "표 기반 예제" 역할을 한다.

## 요약

이번 PR 은 보안 인가 로직 변경치고 이례적으로 문서화 커버리지가 높다 — 신규 함수 전부에 근거(spec 섹션·이전 리뷰 라운드)를
인용하는 독스트링이 있고, Swagger 응답 설명·CHANGELOG·사용자 대상 mdx 문서(한/영)까지 일관되게 갱신됐으며 표본 대조 결과
spec 본문과 실제 라우트 가드 구성이 정확히 일치한다. 유일하게 발견한 결함은 신규 e2e 스펙 파일 헤더의 invariants 목록 한
줄이 문장 중간에서 끊겨 있는 사소한 오탈자 수준 문제로, 코드 동작이나 테스트 유효성에는 영향이 없다.

## 위험도

LOW
