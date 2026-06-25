# Convention Compliance Review

검토 모드: `--impl-done`  
범위: `03 M-1 — integration-oauth.service.ts install 보일러플레이트 4종 helper 추출`  
diff-base: `origin/main`

---

## 발견사항

### [INFO] 신규 private 메서드 명명 — 규약 직접 참조 항목 없음, 관용 TypeScript camelCase 준수

- target 위치: `integration-oauth.service.ts` L1326–L1421 (신규 private 메서드 4종)
- 위반 규약: 없음 (명시적 메서드 명명 규약 없음)
- 상세: `assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState` — 모두 camelCase, 동사+명사 구조, 의미 기술 충분. `spec/conventions/` 어디에도 서비스 내부 private 메서드 명명 규약이 별도로 정의되어 있지 않다. 기존 코드베이스 관용 패턴(camelCase)과 일치.
- 제안: 현 상태 유지. 규약 갱신 불필요.

---

### [INFO] 에러 코드 인라인 문자열 리터럴 전달 패턴 — `error-codes.md` §1 적용 범위 이해 필요

- target 위치: `assertInstallTimestampFresh(timestamp, 'CAFE24_INSTALL_REPLAY')` 호출부 (diff L415, L514)
- 위반 규약: `spec/conventions/error-codes.md §1` "적용 범위" 항
- 상세: `error-codes.md §1`은 "프로젝트 전체의 에러 코드 문자열에 적용된다 — API·통합·OAuth 등에서 인라인 문자열 리터럴로 발행되는 코드(`CAFE24_*`, `OAUTH_*` 등)를 포함한다"고 명시한다. `CAFE24_INSTALL_REPLAY` / `MAKESHOP_INSTALL_REPLAY` 는 **이미 spec(`spec/4-nodes/4-integration/4-cafe24.md §9.x`, `spec/2-navigation/4-integration.md`)에 정의된 안정적 코드**이며, `UPPER_SNAKE_CASE` + 도메인 prefix 규칙을 준수한다. 이번 리팩토링은 이 코드를 **새로 발명하지 않고 호출자가 인자로 주입**하는 방식으로 provider prefix 분리 의도를 코드 내 주석으로도 명시(L292–L299)했다. 규약 §1·§2 위반이 아니며, breaking rename 도 아니다. 다만 호출 시 문자열 리터럴 인자(`'CAFE24_INSTALL_REPLAY'`)를 인라인으로 사용하는 점은 `ErrorCode` union enum 중앙화 권고 방향과 약간의 거리가 있다.
- 제안: 이 패턴은 이전부터 해당 위치에 존재했고(리팩토링이 아니라 이전부터 인라인), 코드 이동만 발생했으므로 이번 PR 범위에서 추가 조치 불필요. 장기적으로 `CAFE24_INSTALL_*`·`MAKESHOP_INSTALL_*` 코드를 `error-codes.ts` `ErrorCode` union에 흡수하면 타입 강제가 가능해지나, 이는 별도 개선 트랙.

---

### [INFO] JSDoc 주석 — `swagger.md §1-1` 패턴과 무관 영역이나 JSDoc 기재 일관성 검토

- target 위치: `integration-oauth.service.ts` L301–L396 (신규 메서드 4종 JSDoc)
- 위반 규약: `spec/conventions/swagger.md §1-1` (DTO JSDoc), 직접 적용 대상이 아님
- 상세: `swagger.md §1-1`의 JSDoc 요건은 **DTO 파일 필드**에 적용된다. 서비스 클래스의 private 메서드는 적용 대상이 아니다. 신규 4종 메서드 모두 JSDoc(영문)이 작성되어 있으며 역할·파라미터 의미·provider 분리 이유를 충분히 기술한다. 규약 위반 없음.
- 제안: 현 상태 유지.

---

### [INFO] 테스트 파일 명명 — 기존 패턴 일치

- target 위치: `integration-oauth.service.cafe24.spec.ts`, `integration-oauth.service.makeshop.spec.ts`
- 위반 규약: 없음 (테스트 파일 명명 규약이 `spec/conventions/`에 별도 정의되지 않음)
- 상세: 두 파일은 기존 파일에 테스트 케이스를 추가한 것이다. 명명 패턴(`<service>.<provider>.spec.ts`)은 해당 디렉토리의 기존 관용과 일치한다.
- 제안: 현 상태 유지.

---

## 요약

이번 M-1 리팩토링(install 보일러플레이트 4종 helper 추출)은 `spec/conventions/`의 정식 규약을 직접 위반하는 항목이 없다. 에러 코드는 `error-codes.md §1`이 요구하는 `UPPER_SNAKE_CASE` + 도메인 prefix 패턴을 준수하고 있으며 기존에 spec에 정의된 안정적 코드를 그대로 유지한다. 신규 private 메서드 명명은 camelCase 관용, JSDoc은 서비스 레이어 수준에서 충분히 기재되었다. 인라인 문자열 에러 코드를 `ErrorCode` union으로 흡수하는 점은 개선 여지이나, 이는 이번 diff가 도입한 문제가 아니라 사전 존재 패턴이다.

---

## 위험도

NONE
