# 보안(Security) 코드 리뷰

## 범위 확정

프롬프트 번들에는 78개 파일이 나열되어 있으나, 실제 `git diff --stat origin/main...HEAD -- codebase/` 로
대조한 결과 코드베이스에 대한 실질 변경은 다음 4개 파일뿐이다(594 insertions, 10 deletions):

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `AlertRuleDto.threshold` 타입을 `number` → `string` 으로 정정(Swagger 문서·TS 타입 애노테이션만, 런타임 직렬화 로직 불변)
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 정적 분석 가드(`findNumericAsNumber`/`scanNumericExposure`)에 세 번째 축(numeric 컬럼을 `number` 로 문서화하는 응답 DTO 탐지) 추가. AST(`typescript` 컴파일러 API) 기반, 정규식 아님
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 가드의 신규 단위 테스트(대조군 다수)
4. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — `POST/GET/PATCH /api/alerts` 응답의 `threshold` 필드가 실제로 문자열임을 확인하는 e2e 테스트

나머지 파일들(`CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, 그리고
`review/code/**`·`review/consistency/**` 하위의 이전 리뷰 라운드 산출물 RESOLUTION.md/SUMMARY.md/
meta.json/각 관점 리뷰 md 다수)는 마크다운 문서·JSON 메타데이터로, 실행되는 코드가 아니며 보안 관점의
공격 표면을 만들지 않는다. 저장소 파일은 읽기만 했고 아무것도 쓰거나 수정하지 않았다
(`git status --short` 확인: untracked 항목은 이번 세션의 리뷰 출력 디렉터리 자신뿐).

## 발견사항 (점검 관점별)

- **인젝션 취약점**: 해당 없음. `swagger-dto-contract-guard.ts` 는 `ts.createSourceFile` 로 소스를
  정본 AST 파싱하며, 파일 경로는 저장소 내부 `collectTsFiles`/개발 시점 fixture 로만 공급된다(사용자
  입력·네트워크 입력 경로 없음, 빌드/테스트 전용 정적 분석 도구). e2e 테스트는 `supertest` 로 자체
  로컬 테스트 서버에 HTTP 요청을 보낼 뿐 쿼리 조립·셸 명령·경로 조작이 없다.
- **하드코딩된 시크릿**: 없음. `example: '10.0000'` 은 임계값 예시일 뿐 자격증명이 아니다.
- **인증/인가**: e2e 테스트(`alerts-threshold-wire-type.e2e-spec.ts`)는 기존 헬퍼
  (`registerAndLogin`/`createTeamWorkspace`)로 정상 인증 플로우를 거쳐 토큰을 얻고
  `Authorization`/`X-Workspace-Id` 헤더를 붙인다 — 인증 우회나 권한 검사 로직 변경 없음. 컨트롤러/
  가드 코드 자체는 이번 diff 에 포함되지 않는다.
- **입력 검증**: 응답(response) DTO 의 타입 애노테이션만 바뀌었고 요청 검증 데코레이터(`@IsNumber` 등,
  `CreateAlertRuleDto`/`UpdateAlertRuleDto`)는 이번 diff 대상이 아니다. 읽기(`string`)/쓰기(`number`)
  비대칭은 CHANGELOG 서술상 기존부터 있던 의도된 설계.
- **OWASP Top 10**: 관련 항목 없음(주입·인증 실패·민감정보 노출·XXE·접근제어·설정오류·XSS·역직렬화·
  취약 컴포넌트·로깅 부족 어느 것도 해당하는 코드 변경이 없음).
- **암호화**: 해당 없음.
- **에러 처리**: e2e/unit 테스트는 `expect()` 단언만 사용하며 에러 메시지에 민감정보를 싣는 코드
  변경이 없다.
- **의존성 보안**: `import * as ts from 'typescript'` 는 기존 devDependency 재사용(신규 패키지 추가
  없음). `package.json`/lockfile 변경이 diff 에 없음을 확인.

이번 diff 자체는 OpenAPI 문서(`number`)와 실제 wire(`string`, `numeric(12,4)` 컬럼의 정밀도 보존
직렬화)를 일치시키는 방향의 정정이다. 오히려 종전에 틀린 `number` 선언을 신뢰해 codegen 클라이언트가
부정확한 수치 파싱을 할 가능성을 줄이는 효과가 있다(참고 INFO, 결함 아님).

## 요약

이번 changeset 의 실질 코드 변경은 응답 DTO 필드 하나의 타입 애노테이션 정정과, 그 결함 클래스의
재발을 막는 정적 분석 가드(AST 기반) + 단위/e2e 테스트 추가로 한정된다. 인젝션·인증/인가·시크릿·
암호화·에러 노출·의존성 어느 축에서도 취약점이나 위험 패턴이 발견되지 않았다. 신규 가드는 개발/CI
시점에만 실행되는 저장소 내부 소스 스캐너로 외부 입력을 처리하지 않으며, e2e 테스트는 기존 인증
헬퍼를 정상적으로 재사용한다.

## 위험도

NONE
