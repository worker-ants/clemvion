# 신규 식별자 충돌 검토 — 연결 테스트 결과 코드 (spec/2-navigation)

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
- `spec/2-navigation/` 자체는 이 브랜치에서 **델타 0** — 정상(코드 전용 PR). 검토는 구현 diff(11파일/541줄)가 새로 도입하는 식별자가 기존 코드·spec 사용처와 충돌하는지에 집중.
- 코드 존재 확인은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/tester-codes-4b9e17`)에서 `git grep` 로 직접 수행.

diff 가 새로 도입하는 식별자:
- 상수: `CONNECTION_TEST_CODES` (`codebase/backend/src/modules/integrations/connection-test-codes.ts`)
- 타입: `TransportTestCode`, `TestGateCode`, `IntegrationTestResultCode`, `Cafe24PingCode`, `MakeshopPingCode`
- 신규 파일: `connection-test-codes.ts` / `connection-test-codes.spec.ts`
- 코드 값 자체(`DB_HOST_BLOCKED` · `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_BLOCKED` · `HTTP_AUTH_FAILED` · `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED` · `EMAIL_HOST_BLOCKED` · `EMAIL_CONNECT_FAILED` · `INTEGRATION_CREDENTIALS_UNREADABLE` · `INTEGRATION_INCOMPLETE` · `CAFE24_*` · `MAKESHOP_*`)는 새로 만든 값이 아니라, 기존에 이미 리터럴 문자열로 쓰이던 wire 값을 named 상수/union 으로 **묶기만** 한 리팩터다(diff 상 `'DB_HOST_BLOCKED'` → `CONNECTION_TEST_CODES.DB_HOST_BLOCKED` 같은 치환).

## 확인 결과 (충돌 없음)

1. **타입명**: `TransportTestCode`·`TestGateCode`·`IntegrationTestResultCode`·`Cafe24PingCode`·`MakeshopPingCode`·`CONNECTION_TEST_CODES` 를 전체 `codebase/`·`spec/` 에서 grep — 정의 파일과 그 소비처(`database-connection-tester.ts`·`http-connection-tester.ts`·`integrations.service.ts`·`cafe24-api.client.ts`·`makeshop-api.client.ts`) 외 다른 의미로 쓰인 곳 없음.
2. **파일 경로**: `connection-test-codes.ts`/`.spec.ts` 는 같은 디렉터리(`modules/integrations/`)의 기존 kebab-case 단일 책임 파일 명명 컨벤션(`clamp-message.ts`, `jwt-exp.ts` 등)과 일치하고, 동일 이름의 기존 파일 없음.
3. **코드 값(wire code) namespace 중복은 의도된 설계이며 이미 spec 에 문서화됨** — `spec/2-navigation/4-integration.md` §14.1(1092행 이하)이 `EMAIL_CONNECT_FAILED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED` 등을 "연결 테스트 전용 — `IntegrationTestResult.code` namespace (노드 런타임 `ErrorCode` enum 과 별개)" 로 명시하고, `DB_CONNECT_FAILED`↔`DB_CONNECTION_ERROR`, `HTTP_CONNECT_FAILED`↔`HTTP_TRANSPORT_FAILED` 의 모집합 차이까지 적어 두었다. 코드의 JSDoc(`connection-test-codes.ts` 상단 주석)도 동일한 구분을 반복 서술 — spec 과 구현이 정확히 일치한다. `HTTP_BLOCKED`·`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED` 세 값만 노드 런타임 `ErrorCode` 와 이름이 겹치는데, 이 역시 "같은 SSRF 가드의 판정" 이라는 의도된 동일 의미로 spec·코드 양쪽에서 일관되게 설명된다.
4. **`INTEGRATION_INCOMPLETE`/`INTEGRATION_CREDENTIALS_UNREADABLE`/`CAFE24_*`/`MAKESHOP_*`**: 전부 `spec/4-nodes/4-integration/{0-common,4-cafe24,5-makeshop}.md` 및 기존 `cafe24-api.client.ts`/`makeshop-api.client.ts`/`*.handler.ts` 에 이미 같은 의미로 존재하던 값 — 이 diff 는 그 값들을 `Cafe24PingCode`/`MakeshopPingCode`/`IntegrationTestResultCode` union 으로 타입화했을 뿐, 새 의미를 부여하지 않았다.
5. **API endpoint·이벤트명·ENV/설정키**: diff 에 컨트롤러·라우트·큐·webhook·ENV 변경 없음 — 이 관점의 충돌 대상 자체가 없다.
6. **요구사항 ID**: spec 델타가 0이므로 신규 요구사항 ID 부여 없음.

## 발견사항

없음.

## 요약

이번 diff 는 연결 테스트(`IntegrationTestResult.code`) 결과 코드를 `CONNECTION_TEST_CODES` 상수와 `Cafe24PingCode`/`MakeshopPingCode`/`IntegrationTestResultCode` 타입으로 묶는 순수 내부 리팩터로, 새로 도입한 TS 식별자(상수명·타입명·파일명)는 기존 코드베이스 전역에서 다른 의미로 쓰이는 곳이 없다. 코드 값 자체는 전부 `spec/2-navigation/4-integration.md` §14.1 및 `spec/4-nodes/4-integration/*` 에 이미 문서화된 기존 wire 값이며, 노드 런타임 `ErrorCode` 와 이름이 겹치는 세 값(`HTTP_BLOCKED`·`DB_HOST_BLOCKED`·`EMAIL_HOST_BLOCKED`)도 "같은 판정을 공유하는 의도된 중복" 으로 spec·코드 양쪽에 일관되게 설명되어 있어 혼선 소지가 없다. 신규 endpoint·이벤트·ENV·요구사항 ID 도입도 없다.

## 위험도

NONE
