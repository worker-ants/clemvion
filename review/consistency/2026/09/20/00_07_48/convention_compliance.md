# 정식 규약 준수 검토 — 연결 테스트 결과 코드 (`spec/2-navigation`, --impl-done)

## 검토 범위 및 방법

- scope `spec/2-navigation/` 델타: 0개 파일 (코드 전용 PR — 정상, CRITICAL 근거 아님).
- 구현 diff: 11개 파일 / 541줄 (`codebase/backend/src/modules/integrations/connection-test-codes.{ts,spec.ts}` 신설 +
  `database-connection-tester.ts` · `http-connection-tester.ts` · `integrations.service.ts` · `cafe24-api.client.ts` ·
  `makeshop-api.client.ts` 등 소비자 갱신, 테스트 추가).
- 대조한 정식 규약: `spec/conventions/error-codes.md`(에러 코드 명명·안정성), `spec/conventions/swagger.md`(API 문서
  데코레이터·DTO), `spec/conventions/spec-impl-evidence.md`(frontmatter `code:` glob).
- 코드 확인은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/tester-codes-4b9e17`)로 직접
  `Read`/`grep` 하여 diff 와 대조했다.

## 발견사항

### [INFO] 신규 closed union 이 Swagger DTO 에는 반영되지 않음
- target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `IntegrationTestResult.code`
  타입을 `string` → `IntegrationTestResultCode`(닫힌 union)로 좁힘.
- 관련 규약: `spec/conventions/swagger.md` §1-4 "닫힌 union(variant 집합이 코드로 확정)"은 `@ApiProperty({ enum, enumName })`
  또는 `oneOf` 로 문서화할 것을 권한다.
- 상세: 같은 값을 API 로 노출하는 형제 DTO `dto/responses/integration-response.dto.ts`
  (`TestConnectionResultDto.code` · `code` 필드, 두 곳 모두 `@ApiPropertyOptional() code?: string;`)는 이번 diff 에
  포함되지 않아 여전히 `string` 으로만 선언돼 있다. 서비스 레이어는 이제 정밀한 계약을 갖지만, OpenAPI 스키마는
  여전히 값 집합을 알려주지 않는다.
- 제안: swagger.md 자체가 "기존 필드 일괄 소급 스키마화는 요구하지 않는다"(§1-4 적용범위, §3 기존 DTO 소급 정리
  비대상)고 명시하므로 이번 PR 의 결함은 아니다 — 위반이 아니라 **다음에 이 DTO 를 건드릴 때** `enum:
  Object.values(CONNECTION_TEST_CODES)` 류로 좁히면 좋다는 제안 수준.

### [INFO] 상수 객체 식별자 케이싱이 형제 대표 surface 와 다름
- target 위치: `codebase/backend/src/modules/integrations/connection-test-codes.ts:16` — `export const
  CONNECTION_TEST_CODES = { ... } as const;`
- 관련 규약: `spec/conventions/error-codes.md` §Overview — "대표 surface 는 둘이다"로 지목하는
  `nodes/core/error-codes.ts` 의 `ErrorCode`/`EngineErrorCode` 는 PascalCase 식별자를 쓴다.
- 상세: `CONNECTION_TEST_CODES` 는 SCREAMING_SNAKE_CASE 식별자다. 다만 저장소에는 이미 같은 패턴의 선례가
  있다(`AUDIT_ACTIONS`, `MCP_ERROR_CODES`, `PASSWORD_VERIFY_CODES`) — 즉 이 diff 가 **새 스타일을 도입한 것이
  아니라 기존에 공존하던 두 케이싱 계열 중 하나를 따른 것**이다. error-codes.md 는 코드 **값**의
  `UPPER_SNAKE_CASE`(§1, node-output.md §3.2 가 SoT)만 규율하고 상수 **식별자** 케이싱은 규정하지 않는다.
- 제안: 규약 위반 아님. 상수 식별자 케이싱 통일이 필요하다면 별도 리팩터 논의 대상이며 본 PR 범위 밖.

## 준수 확인 (근거로 남김 — 위반 없음)

- **UPPER_SNAKE_CASE 값 표기**: `CONNECTION_TEST_CODES` 9개 값(`EMAIL_HOST_BLOCKED` · `EMAIL_CONNECT_FAILED` ·
  `DB_HOST_BLOCKED` · `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_BLOCKED` · `HTTP_AUTH_FAILED` ·
  `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED`), `Cafe24PingCode`(`CAFE24_AUTH_FAILED` ·
  `CAFE24_TRANSPORT_FAILED` · `CAFE24_INSUFFICIENT_SCOPE`), `MakeshopPingCode`(`MAKESHOP_AUTH_FAILED` ·
  `MAKESHOP_TRANSPORT_FAILED`) 전부 `error-codes.md` §1 도메인 prefix 원칙(`<DOMAIN>_<CONDITION>`)과
  일치한다.
- **값 자체가 신규가 아님**: diff 는 기존에 인라인 문자열 리터럴로 흩어져 있던 wire 값을 `CONNECTION_TEST_CODES`
  상수로 중앙화하고 타입으로 좁힌 것이지, 새 코드를 발행하지 않는다 — `error-codes.md` §2 "rename 은
  breaking" 원칙에 해당하는 rename 이 없다.
- **spec 과의 값 일치**: `spec/2-navigation/4-integration.md` §5.3(HTTP) · §5.4(Database) · §5.5(Email) · §14.1
  (연관 동작 표, 라인 1107~1122)이 이미 이 9개 코드 전부를 문서화하고 있고, 새 상수의 키·값과 정확히 일치한다
  (직접 grep 대조 완료). 노드 런타임 코드(`DB_CONNECTION_ERROR`, `HTTP_TRANSPORT_FAILED`)와 "namespace 가
  다르다"는 diff 의 JSDoc 서술도 4-integration.md §14.1 표·Rationale(라인 1165-1167)과 정합한다.
- **frontmatter `code:` glob 유효성**: `spec/2-navigation/4-integration.md` frontmatter 의
  `codebase/backend/src/modules/integrations/**` 글롭이 신규 파일
  `connection-test-codes.ts`/`connection-test-codes.spec.ts` 를 포함한다 — `spec-impl-evidence.md` §2 의 `code:`
  매치 의무(`status: implemented`)가 깨지지 않는다.
- **파일 명명**: `connection-test-codes.ts` / `.spec.ts` 는 같은 디렉터리의 `database-connection-tester.ts` ·
  `http-connection-tester.ts` 와 동일한 kebab-case 파일명 관례를 따른다.
- **금지 항목 위반 없음**: `error-codes.md` §2 의 "이름 정확성 향상만을 위한 rename 금지" 를 어기지 않았고
  (기존 문자열 값 그대로 재사용), swagger.md §6 "레거시 패턴" 목록에 해당하는 패턴도 이 diff 에 없다(컨트롤러·
  DTO 자체를 건드리지 않음).
- **API 문서 데코레이터**: 이 diff 는 `integrations.controller.ts` 의 `@ApiOkWrappedResponse(TestConnectionResultDto,
  ...)` 등 기존 데코레이터 구성을 변경하지 않았고, 서비스 내부 타입 좁히기만 수행했다 — swagger.md §2 계열
  규약과 충돌 없음.

## 요약

이번 diff(연결 테스트 결과 코드 리팩터 + 테스트)는 새 wire 값을 발행하지 않고 기존에 산재해 있던 문자열
리터럴을 `CONNECTION_TEST_CODES` 상수와 `Cafe24PingCode`/`MakeshopPingCode`/`IntegrationTestResultCode` 타입으로
중앙화·정밀화하는 순수 타입-안전성 개선이다. 값·이름 전부 `spec/conventions/error-codes.md` 의 의미 기반 명명·
`UPPER_SNAKE_CASE`·도메인 prefix 원칙과 이미 정확히 일치하며, `spec/2-navigation/4-integration.md` §5.3/§5.4/§5.5/
§14.1 에 문서화된 값과 1:1 대조로 어긋남이 없다. frontmatter `code:` glob 도 신규 파일을 포함해 spec-impl-evidence
가드를 깨지 않는다. 유일하게 짚을 지점은 서비스 레이어의 닫힌 union 이 형제 Swagger DTO(`TestConnectionResultDto.code`
등, 이번 diff 미포함)에는 아직 반영되지 않았다는 것인데, swagger.md 스스로 기존 필드 소급 갱신을 요구하지 않으므로
INFO 수준 제안에 그친다. CRITICAL/WARNING 없음.

## 위험도

NONE
