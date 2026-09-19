# 정식 규약 준수 검토 — `spec/2-navigation/4-integration.md` (impl-done)

## 검토 범위

- **spec 델타**: `spec/2-navigation/4-integration.md` §3.3 · §5.1~§5.4 · §5.7 · §6 · §9.2 · §9.4 · §10.3 · §10.5 · §14.1 · `## Rationale`
- **구현 diff**: `codebase/backend/src/modules/integrations/{database-connection-tester,http-connection-tester,clamp-message,integrations.service,integrations.controller,dto/**}.ts`,
  `codebase/backend/src/nodes/integration/{http-request,database-query}/**`, 사용자 가이드 mdx 2편, `CHANGELOG.md`
- **대조한 정식 규약**: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md` §3.2, `spec/conventions/swagger.md`, `spec/conventions/audit-actions.md`, `spec/conventions/i18n-userguide.md`, `spec/conventions/spec-impl-evidence.md`

## 발견사항

이번 델타에서 정식 규약 위반은 발견되지 않았다. 아래는 확인 과정에서 본 규약 근거와, 위반이 아니라고 판단한 이유를 남긴다 (checker 재작업·재-flag 방지용).

- **[INFO] 신규 에러 코드 5종의 명명·소속 namespace 확인**
  - target 위치: `4-integration.md` §5.4(`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`), §5.3(`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED`), §9.4 에러 코드 표
  - 대조 규약: `spec/conventions/error-codes.md` §1(의미 기반 명명), `node-output.md` §3.2(`UPPER_SNAKE_CASE`)
  - 상세: 5개 코드 모두 `UPPER_SNAKE_CASE`, 기존 도메인 prefix(`DB_*`/`HTTP_*`, `DB_HOST_BLOCKED`·`HTTP_BLOCKED` 선례)를 그대로 따르고, 이름이 조건의 의미(인증 실패/그 외 연결 실패/서버 에러)를 기술해 §1 원칙을 만족한다. 코드베이스 전수 grep 결과 `ErrorCode`/`EngineErrorCode` enum(`nodes/core/error-codes.ts`)과 문자열 충돌 없음 — §9.4 표가 명시하듯 이 5개는 `IntegrationTestResult.code`라는 **별개 namespace**(§5.5 정의)이며, 노드 런타임 `output.error.code`(node-output §3.2)와 값 집합이 다름을 매 행마다 "연결 테스트 전용" 각주로 명시했다. `audit-actions.md`류의 "반드시 중앙 union 에 등록" 의무는 error-codes.md 에 없고(§1 은 "인라인 문자열 리터럴로 발행되는 코드"를 명시적으로 적용 범위에 포함), `database-connection-tester.ts`/`http-connection-tester.ts` 의 리터럴 발행 방식도 기존 `DB_HOST_BLOCKED`/`HTTP_BLOCKED` 리터럴 발행 패턴과 동일하다. → 위반 아님.

- **[INFO] Swagger DTO 필드 추가 패턴**
  - target 위치: `integration-response.dto.ts` `PreviewTestResultDto.code`
  - 대조 규약: `spec/conventions/swagger.md` §1-1(JSDoc)·§1-3(Optional 필드)
  - 상세: 새 필드는 JSDoc + `@ApiPropertyOptional()` 로 선언돼 있고, 형제 필드 `TestConnectionResultDto.code`(기존)와 동일한 선언 형태다. 신규 DTO 클래스 신설이 아니라 기존 클래스에 필드 1개를 추가한 것이라 §1-7(요청 DTO 명명)도 해당 없음. → 위반 아님.

- **[INFO] 사용자 가이드 mdx 프런트매터·en sibling 구조**
  - target 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management{,.en}.mdx`
  - 대조 규약: `spec/conventions/i18n-userguide.md` Principle 5
  - 상세: `code:` 프런트매터(신규 파일 2개 추가) 갱신은 canonical `.mdx`(한국어)에만 있고 `.en.mdx` 는 프런트매터 없이 본문만 — 규약이 명시한 "frontmatter 는 canonical 에만" 원칙과 정확히 일치. 추가된 `<Callout>` 은 heading 에 `GUI` bareword 도, 본문에 `**...GUI...**` 강조도 없어 Principle 7 의 `<ImplAnchor kind="ui-entry">` 자동 검출 대상(GUI 흐름 절)에 해당하지 않는 개념 설명 절로 분류됨. → 위반 아님.

- **[INFO] `rotate()` 변경의 감사 액션 명명**
  - target 위치: `integrations.service.ts` `rotate()` (save→update 전환)
  - 대조 규약: `spec/conventions/audit-actions.md` §1
  - 상세: 이번 diff 는 저장 방식(`save`→`update`+재조회)만 바꿨고 감사 기록 자체는 그대로 `AUDIT_ACTIONS.INTEGRATION_ROTATED`(중앙 union) 를 계속 사용 — 인라인 문자열 신설 없음. → 위반 아님.

- **[INFO] `RESOURCE_NOT_FOUND` 재사용**
  - target 위치: `integrations.service.ts` `rotate()` 의 TOCTOU 404 분기
  - 대조 규약: `spec/conventions/error-codes.md` §1(도메인 prefix 없는 시스템 전역 공용 코드 예외)
  - 상세: `RESOURCE_NOT_FOUND` 는 `workflow-test-datasets.service.ts`·`nodes.service.ts`·`workflows.service.ts`·`triggers.service.ts` 등 저장소 전역에서 이미 쓰는 공용 404 코드이며 4-integration.md §14.1 표(`requireEntity` `RESOURCE_NOT_FOUND` fallback)도 이미 같은 코드를 인용한다. 신규 코드 신설이 아니라 기존 공용 코드 재사용. → 위반 아님.

- **[INFO] 문서 구조(Overview/본문/Rationale)**
  - target 위치: `4-integration.md` `## Rationale` 신규 하위 절 "연결 테스트 — Database · HTTP 는 실제로 접속한다…"
  - 대조 규약: CLAUDE.md 문서 구조 권장(Overview/본문/Rationale)
  - 상세: 기존 `## Rationale` 최상위 섹션 아래 새 H3 로 추가돼 기존 3섹션 구조를 유지. 범위 결정·코드 명명·preview-test 예외 범위 등 근거를 그 자리에 모아 적었다. → 위반 아님.

## 요약

`spec/2-navigation/4-integration.md` 의 이번 델타(§3.3·§5.1~§5.4·§5.7·§6·§9.2·§9.4·§10.3·§10.5·§14.1·Rationale)와 대응 구현(DB/HTTP connection tester 신설, rotate 저장 방식 변경, Swagger 설명 갱신, 사용자 가이드 mdx)은 `spec/conventions/error-codes.md`(신규 에러 코드 5종이 UPPER_SNAKE_CASE·도메인 prefix·의미 기반 명명을 모두 만족하고 `IntegrationTestResult.code` 라는 기존에 이미 존재하던 별개 namespace 안에 정확히 귀속됨), `node-output.md` §3.2, `swagger.md`(DTO 필드 추가가 기존 형제 필드와 동일한 JSDoc+`@ApiPropertyOptional` 패턴), `audit-actions.md`(감사 액션은 중앙 union 재사용, 신규 인라인 문자열 없음), `i18n-userguide.md`(canonical mdx 에만 프런트매터, `.en.mdx` 는 본문만) 를 모두 준수한다. 정식 규약 직접 위반(CRITICAL)이나 규약과 거리감 있는 표현(WARNING)은 발견되지 않았다.

## 위험도

NONE
