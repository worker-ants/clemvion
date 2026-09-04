# 보안(Security) 코드 리뷰

## 대상 요약

이번 changeset 은 다음으로 구성된다.

1. `CHANGELOG.md` — `AlertRuleDto.threshold` OpenAPI 문서(`number`)가 실제 wire(`string`)와
   달랐던 결함을 정정한 사실을 기록하는 신규 항목.
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `threshold` 필드를 `number` → `string`, `@ApiProperty({ example: 10 })` →
   `@ApiProperty({ type: String, example: '10.0000' })` 로 정정. 저장소를 직접 열어 확인한
   결과 컨트롤러(`alerts.controller.ts`)는 `ClassSerializerInterceptor` 없이 엔티티를 그대로
   반환하므로 이 DTO 는 Swagger 문서 전용이며 런타임 직렬화·검증에 관여하지 않는다. wire 바이트
   변화 없음.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` —
   `findNumericAsNumber` 신규 함수 추가(제3의 계약 검증 축). 직접 열어 확인한 결과 AST
   (`typescript` 컴파일러 API)만 사용하고, 대상은 저장소 자신의 `src/**/*.ts` 파일이며 외부
   입력·네트워크·쉘 실행이 전혀 없는 정적 분석 도구다(CI/테스트 전용, 프로덕션 실행 경로
   아님).
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 함수의
   테스트. `withFiles` 헬퍼(`common/__test-utils__/temp-fixture.ts`)로 `os.tmpdir()` 아래
   임시 파일을 쓰는데, 파일명은 테스트 코드에 하드코딩된 리터럴(`'entities/probe.entity.ts'`
   등)이라 외부/사용자 입력이 아니다 — 경로 탐색(path traversal) 공격면 아님.
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신(문서,
   코드 아님).
6. `review/code/2026/09/04/{19_43_18,20_16_17}/**`, `review/consistency/2026/09/04/20_05_42/**`
   — 직전 두 리뷰 라운드의 산출물이 신규 파일로 커밋된 것. 리뷰 메타 기록이며 실행 코드 아님.

## 발견사항

발견된 보안 취약점 없음.

- 인젝션(SQL/XSS/커맨드/경로 탐색 등): 해당 없음. `findNumericAsNumber`/`findSwaggerContractMismatches`
  는 저장소 자신의 소스를 `fs.readFileSync` 로 읽어 AST 파싱만 한다 — 쉘 실행·동적 쿼리 조립
  없음. 테스트 픽스처(`withFiles`)의 파일명은 전부 하드코딩 문자열.
- 하드코딩된 시크릿: 없음. 예시 값(`'10.0000'`)은 임계값 샘플일 뿐 자격증명이 아니다.
- 인증/인가: 해당 없음. 컨트롤러·가드 로직 변경 없음.
- 입력 검증: 해당 없음. `AlertRuleDto` 는 응답(response) DTO 이고 요청 검증 데코레이터(`@Is*`)
  변경이 없다. 쓰기 측 `CreateAlertRuleDto.threshold`(`number`)는 이번 diff 밖.
- OWASP Top 10: 해당 없음.
- 암호화: 해당 없음.
- 에러 처리: 해당 없음. 에러 메시지·예외 처리 변경 없음.
- 의존성 보안: 해당 없음. 패키지 변경 없음.

**참고(INFO 수준, 실제 결함 아님):** `threshold` 타입 정정 자체는 보안 관점에서 오히려
긍정적이다 — 실제 wire 형태(`numeric` 컬럼이 정밀도 보존을 위해 문자열로 직렬화됨)와 다르게
`number` 로 잘못 문서화돼 있던 것을 바로잡아, 이를 신뢰해 코드 생성(codegen)하는 소비자가 겪을
수 있는 타입 오작동(부정확한 숫자 파싱으로 인한 임계값 오해석)을 방지한다.

## 요약

이번 changeset 의 실질 변경은 (1) `AlertRuleDto.threshold` Swagger/TS 타입 애노테이션 정정
(`number`→`string`, 런타임 wire·직렬화 로직 불변), (2) 저장소 자체 소스를 AST 로 정적 분석하는
CI 전용 회귀 가드(`findNumericAsNumber`) 신설, (3) 그에 대응하는 CHANGELOG/plan 문서 갱신,
(4) 직전 두 리뷰 라운드의 산출물 커밋으로 구성된다. 인젝션·인증/인가·하드코딩 시크릿·암호화·
에러 노출·의존성 취약점 등 보안 관점에서 우려할 실질적 코드 변경은 없다. 신규 가드는 외부 입력을
전혀 받지 않는 개발/CI 도구이고, 그 테스트가 쓰는 tmpdir 픽스처 파일명도 전부 하드코딩 리터럴이라
경로 탐색 공격면이 되지 않는다.

## 위험도

NONE
