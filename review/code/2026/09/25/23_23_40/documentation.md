# 문서화(Documentation) 리뷰 — integration-personal-owner (2라운드)

## 검증 방법

24개 변경 파일 전수(unified diff + 예산 초과분은 `Read` 로 원본 직접 확인)를 검토했다. 특히 다음을 교차 검증했다:

- `spec/2-navigation/4-integration.md` §8 «판정 규칙» · «아직 강제되지 않는 것» · Rationale «Personal 통합 소유자 강제»
- `spec/3-workflow-editor/4-ai-assistant.md` §4.1 `list_integrations` 행 · §4.3.1 `integration-selector` / `mcp-server-selector` 필터 표
- `spec/data-flow/12-workspace.md` 의 인용된 두 Rationale 제목("멤버십 검증은 가드 1곳에서" · "경로 파라미터 워크스페이스도 가드가 본다") 실존 여부
- `CHANGELOG.md` 최상단 항목
- `codebase/backend/src/modules/integrations/integrations.controller.ts` 의 실제 `@Roles()` 부착 현황(4곳만 `editor` — create/update/rotate/remove) vs 두 언어 mdx 문서의 역할별 권한 서술
- `codebase/backend/src/modules/integrations/integrations.service.ts` 의 `getForExecution`/`requireEntity` 잔존 사용처와 그 예외를 설명하는 JSDoc의 정합성

## 발견사항

- **[INFO]** `Cafe24PrecheckResultDto` 클래스 레벨 docstring 이 새 personal-owner 은닉 규칙을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:344`~`353` (클래스 상단 주석, `export class Cafe24PrecheckResultDto` 직전 블록)
  - 상세: 클래스 doc 은 여전히 "인증 정보 누설 방지를 위해 (id, name, status) 만 노출 — 자격 증명·토큰·timestamps 비포함" 이라고만 적혀 있다. 이번 PR 이 추가한 "충돌 대상이 남의 personal 이면 conflict=true 여도 id/name 을 생략한다" 는 조건부 은닉 규칙은 `existingIntegrationId`(라인 361)·`existingName`(라인 368) 두 필드의 `@ApiPropertyOptional({ description: ... })` 에만 개별적으로 적혀 있고, 클래스 요약에는 반영되지 않았다. Swagger UI 에서 필드를 하나씩 펼쳐보지 않고 클래스 요약만 읽으면 이 규칙을 놓칠 수 있다.
  - 제안: 클래스 doc 에 한 문장만 추가 — 예: "충돌 대상이 다른 멤버의 personal 통합이면 conflict=true 여도 id/name 은 생략된다(spec 통합 §8 · §9.2)." 필드 두 곳의 설명과 중복되지만, Swagger 상단 요약만 보는 소비자를 위한 안전망이다. Blocking 은 아니다.

## 확인했으나 문제 없음 (참고용)

리뷰 중 의심했으나 실측으로 반증된 항목들 — 재조사 불필요:

- **CHANGELOG**: 최상단에 `## Unreleased — 남의 Personal 통합은 보이지 않고, Organization 통합의 변경은 Admin 이다` 항목이 이미 있고, 관측되는 API 변화(404 은닉·403 코드 승격·재판정 시점·precheck 은닉·scope drift 방지) 를 모두 담고 있다. "아직 강제되지 않는 것"(후속 범위)도 명시. 항목 누락 없음.
- **spec 갱신**: `4-integration.md` §8 판정 규칙·Rationale, `4-ai-assistant.md` §4.1/§4.3.1 필터 표가 이번 PR 의 코드 동작과 정확히 일치한다(예: Editor route guard 4곳만 `@Roles('editor')`이고 reauthorize/request-scopes/updateScope 엔드포인트는 라우트 가드 없이 서비스 레이어에서만 판정하는 실제 구현이, 두 mdx 문서의 "Viewer 는 자신의 Personal 재인증·scope 요청 가능, 생성·수정·삭제·rotate 불가" 서술과 정확히 대응).
- **자기-반증형 소정정 형식**: `4-integration.md:1715` 의 취소선(`~~...~~`) + 정정 문구가 CLAUDE.md 규약(원문 보존, 국지적 정정)을 따른다.
- **JSDoc 신규 함수**: `integration-visibility.ts`(`isIntegrationVisibleTo`/`integrationVisibilityClause`), `integrations.service.ts`(`requireVisible`/`assertCanModify`/`judgedRow`/`reloadOrNotFound`/`requireModifiable`), `integration-oauth.service.ts`(`assertRequesterStillAllowed`/`pickPrecheckConflict`) 모두 "왜"(동시성 · lost-update 방지 · fail-closed 근거)까지 설명하는 수준 높은 docstring 을 갖췄고, `{@link}` 참조(`getForExecution`)도 실제로 존재하는 대상을 가리킨다.
- **인라인 주석 정확성**: `remove()`/`update()`/`updateScope()` 의 동시성 주석이 `findOne` → `requireModifiable`/선조회 로 구현이 바뀐 부분을 정확히 따라가며 갱신되어 있다(stale 주석 없음).
- **README**: 새 환경변수·설정 옵션이 없고(순수 인가 로직 변경), 백엔드/루트에 이 기능을 언급하는 기존 README 섹션도 없어 README 갱신 불요.
- **예제 코드**: `integration-visibility.ts` 는 함수 자체가 5줄 내외로 자명하고 spec 링크가 있어 별도 사용 예제 불필요.

## 요약

이번 PR 은 보안/인가 로직 변경치고 문서화 수준이 이례적으로 높다 — 새 공개/비공개 함수 전부에 "왜"를 설명하는 JSDoc, spec §8/§4.3.1 사전 갱신과 코드의 완전한 대응, CHANGELOG 항목, 두 언어(ko/en) 사용자 문서까지 실제 라우트 가드 현황과 대조해도 어긋남이 없었다. 유일하게 지적할 점은 `Cafe24PrecheckResultDto` 클래스 요약이 필드 레벨에서만 설명된 새 은닉 규칙을 반복하지 않는다는 완결성 관점의 사소한 누락이며, 병합을 막을 사안은 아니다.

## 위험도

NONE
