# 보안(Security) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`)

## 대상 요약

이번 diff 는 엔진이 사용하던 맨 문자열 에러 코드 4종(9지점)을 `error-codes.ts` 의
`ErrorCode`/신규 `EngineErrorCode` 상수 참조로 치환하는 **순수 리팩터**다. 문자열 값 자체는
치환 전후 완전히 동일하며(`'LLM_RATE_LIMIT'` → `ErrorCode.LLM_RATE_LIMIT` 등, 실제 소스에서
직접 `grep` 확인: `execution-engine.service.ts:1147,2873,3336`,
`ai-turn-orchestrator.service.ts:1298,1301,1304,1311`), 신규 AST 기반 repo-guard
(`engine-error-code-anchor-guard.ts`/`-fixture.ts`/`.spec.ts`) 는 빌드·테스트 시점에만 도는
정적 분석 도구다. 그 외 `CHANGELOG.md`, `plan/**`, `review/code/2026/08/31/20_27_29/**` 는
전부 문서·plan·이전 라운드 리뷰 산출물이며 실행 코드가 아니다.

## 점검 관점별 확인

1. **인젝션** — 신규/변경 코드에 SQL·쉘·경로 처리가 없다. 가드가 쓰는 `fs.readFileSync`/
   `path.join`(`engine-error-code-anchor-guard.ts`)의 인자는 하드코딩 상수(`ENGINE_DIR`,
   `CODES_SOURCE`) 또는 테스트 코드가 넘기는 고정 문자열(`relDir`)뿐 — 사용자 입력이나
   HTTP 요청 경로에서 유입되는 값이 아니므로 경로 탐색 공격 표면이 아니다(CI/테스트 전용
   실행).
2. **하드코딩된 시크릿** — 변경분 전체(files 1~21, review 산출물 포함)에서
   password/secret/token/api key/private key 패턴 grep 결과 없음.
3. **인증/인가** — 인증·인가 로직 변경 없음. 에러 코드 문자열 값이 그대로라 FE/알림/채널
   분류기의 분기 결과도 동일하게 유지된다.
4. **입력 검증** — 새 사용자 입력 처리 경로 없음. 문자열 리터럴 → `as const` 상수 참조 치환뿐.
5. **OWASP Top 10** — 해당 없음. 신규 엔드포인트·직렬화·역직렬화·외부 호출 없음.
6. **암호화** — 해시/암호화/평문 전송 관련 코드 변경 없음.
7. **에러 처리** — `error.code` 값 자체는 불변이라 클라이언트에 노출되는 정보량 변화 없음.
   `message` 필드도 diff 상 문자열 값 변경이 없음(참조 방식만 변경).
8. **의존성 보안** — 신규 의존성 없음. 가드가 쓰는 `typescript`(AST 파서)는 이미 devDependency로
   존재하는 컴파일러 자체이며 이번 변경으로 신규 도입되지 않았다.

## 발견사항

없음.

## 요약

문자열 값이 완전히 보존된 상태에서 리터럴을 타입 상수 참조로 바꾸는 기계적 리팩터와, 그
회귀를 막는 빌드/테스트 전용 AST 정적 가드 추가로 구성된 변경이다. 사용자 입력 처리·인증/인가·
암호화·네트워크 I/O 표면에 아무런 변화가 없고, 신규 시크릿·인젝션·의존성 위험도 발견되지
않았다. 뮤테이션 원복 불필요(저장소 파일 수정 없이 `grep`/`Read` 만으로 검증 완료,
`git status --short` 로 잔여 변경 없음 확인).

## 위험도

NONE
