# 보안(Security) 코드 리뷰

## 리뷰 범위

`trigger-uuid-and-guide-codes` 배치 17개 파일: `rotateBotToken` 엔드포인트에 `ParseUUIDPipe`·
`@ApiParam({format:'uuid'})` 추가, `switchWorkspace` 의 `@ApiParam` 문서 축 보강, 이를 전수로
강제하는 정적 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`/fixture) 신설, 유저 가이드 MDX·
`backend-labels.ts`/`.test.ts` 의 잘못된 에러 코드·환경변수명 정정, CHANGELOG·plan 갱신.

## 발견사항

- **[INFO]** 신규 `param-uuid-pipe` 가드의 `ParseUUIDPipe` 존재 판정이 텍스트 부분일치다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (`if (!pipes.includes('ParseUUIDPipe')) missing.push(...)` — `collectMethodViolations` 함수 내)
  - 상세: 심볼 해석이 아니라 `call.arguments.slice(1).map(a => a.getText(sf)).join(',')` 결과에 대한 문자열 `includes` 검사이므로, `import { ParseUUIDPipe as UuidPipe }` 형태로 별칭 import 하면 실제로는 파이프가 적용돼 있어도 가드가 "누락"으로 오탐하거나(별칭 사용 시 오탐), 반대로 이름에 `ParseUUIDPipe` 문자열을 포함하지만 다른 동작을 하는 사용자 정의 파이프가 있으면 가드가 통과시켜 버릴 수 있다(미탐). 이 한계는 코드 주석에도 이미 명시돼 있고 저장소 실측상 별칭 0건이라 현재는 실질 위험이 없다. 런타임 애플리케이션 코드가 아니라 CI 시점 정적 가드이므로 우회되어도 직접적인 취약점이 아니라 "누락을 놓칠 수 있는 가드"라는 한계다.
  - 제안: 현행 유지 가능(문서화된 한계, 실측 0건). 별칭 import 가 생기면 타입 체커 기반 검사로 확장을 검토.

- **[INFO]** `param-uuid-pipe` fixture 에 `/_test/backdoor` 경로 컨트롤러가 존재하지만 실제 앱 모듈에는 등록되지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (`ParamUuidFixtureController`, `excluded`/`excludedPipeless` 메서드)
  - 상세: `@Post(':id/_test/backdoor')` 같은 이름의 라우트가 있어 처음엔 실제 백도어 엔드포인트로 오인할 수 있으나, `grep -rn "ParamUuidFixtureController" codebase/backend/src` 로 확인한 결과 어떤 `*.module.ts` 에도 import/등록되지 않는 순수 가드 테스트용 fixture다. 실제 공격 표면이 아니다.
  - 제안: 조치 불요(오탐 방지 차원의 기록).

## 점검 관점별 확인 결과

1. **인젝션**: 이번 diff 는 SQL/커맨드/경로 실행 로직을 건드리지 않는다. 오히려 `rotateBotToken` 의 `:id` 경로 파라미터에 `ParseUUIDPipe` 를 추가해 형식이 아닌 값이 ORM 쿼리(`findById`)까지 흘러가는 것을 컨트롤러 경계에서 차단한다(방어 강화). Postgres 드라이버가 던지는 `QueryFailedError`(SQLSTATE 22P02)를 `GlobalExceptionFilter` 가 매핑하지 못해 500 으로 마스킹되던 기존 결함이 이 변경으로 예방된다 — 단, 필터 자체의 22P02 미분류는 여전히 남아 있고(`@Query()`·body 조회 등 다른 경로는 계속 500 마스킹 가능) 이는 plan 에 후속 항목으로 이미 등재되어 있다(`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다).
2. **하드코딩된 시크릿**: 테스트 파일의 `NEW_BOT_TOKEN = '222222222:NewToken'` 등은 BotFather 토큰 포맷을 흉내 낸 더미 값이며 실 자격증명이 아니다. 그 외 diff 전체에서 API 키·비밀번호·인증서 패턴 없음.
3. **인증/인가**: `rotateBotToken` 의 `@Roles('editor')`·`@ApiBearerAuth` 는 이번 diff 로 변경되지 않았고 그대로 유지된다(`sed -n '240,300p' triggers.controller.ts` 로 확인). `@ApiParam`/`ParseUUIDPipe` 추가는 순수 입력 검증·문서화 계층이라 인가 로직에 영향 없음.
4. **입력 검증**: 이번 변경의 핵심 — `rotateBotToken` 의 `:id` 가 형제 엔드포인트 6개와 동일하게 `ParseUUIDPipe` 를 갖추도록 맞췄고, 저장소 전수(id-형 `@Param` 136건)에 대해 베이스라인 0 인 AST 가드로 회귀를 방지한다. 검증 강화 방향이며 약화 요소 없음.
5. **OWASP Top 10**: 해당 없음(A03 Injection 은 위 1항, A05 Security Misconfiguration 관점에서 에러 마스킹은 아래 6·7항).
6. **암호화**: 변경 없음. 문서(`telegram.mdx` 등)에 기술된 AES-256-GCM 봇 토큰 암호화·평문 미노출 서술도 이번 diff 로 수정되지 않은 기존 서술이다.
7. **에러 처리**: `GlobalExceptionFilter` 를 직접 열어 확인한 결과, 매핑되지 않은 내부 `Error`(예: 이전의 22P02 QueryFailedError)는 이미 `UNHANDLED_ERROR_MESSAGE`("An unexpected error occurred. Please try again later.")로 마스킹되고 원문은 `logger.error` 로만 남는 CWE-209 대응 구조다. 즉 이번 PR 이전에도 500 오분류가 DB 에러 메시지나 스택을 클라이언트에 노출한 것은 아니었다 — 문제는 정보 노출이 아니라 클라이언트 입력 오류가 5xx 로 보여 재시도·모니터링 신호가 왜곡되는 가용성/DX 이슈였고, 이번 400 화로 해소된다. 새로 추가된 신규 테스트 HTTP 왕복 케이스도 `error.code`/`error.message` 만 단언하며 스택·내부 경로를 노출하지 않는다.
8. **의존성 보안**: 신규 의존성 추가 없음(`@nestjs/common`, `@nestjs/testing`, `supertest`, `typescript` 모두 기존 devDependencies 재사용).

## 요약

이번 변경은 트리거 `:id` 경로 파라미터에 누락돼 있던 `ParseUUIDPipe`(런타임 입력 검증)와 `@ApiParam({format:'uuid'})`(문서 계약)를 보강하고 이를 저장소 전수 AST 가드로 고정한 것이 핵심이며, 부수적으로 유저 가이드·i18n 라벨의 잘못된 에러 코드/환경변수명 서술을 실제 코드에 맞게 정정했다. 인가 데코레이터(`@Roles`)는 손대지 않았고, 기존 `GlobalExceptionFilter` 가 이미 CWE-209 대응(내부 에러 메시지 비노출)을 하고 있어 종전 500 마스킹도 정보 노출로 이어지지는 않았다 — 이번 수정은 입력 검증을 서버 경계로 앞당겨 방어를 강화하는 방향이다. 하드코딩된 시크릿, 인젝션 신규 표면, 인가 우회, 취약 암호화 알고리즘은 발견되지 않았다. 신규 가드의 텍스트 부분일치 판정 한계는 저장소가 이미 문서화한 채 수용한 리스크이며 실질적 공격 표면이 아니다.

## 위험도

NONE
