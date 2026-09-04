# 보안(Security) 코드 리뷰

## 범위 확정

이번 changeset 은 실질적으로 다음 세 그룹으로 구성된다.

1. **API 계약 정정**: `AlertRuleDto.threshold` 타입을 `number` → `string` 으로 정정
   (`codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`), 그
   경위를 설명하는 `CHANGELOG.md` 신규 섹션.
2. **개발 도구(repo-guard) 확장**: `swagger-dto-contract-guard.ts`/`.spec.ts` 에 `numeric`/
   `decimal` 컬럼을 `number` 로 잘못 문서화하는 자리를 잡는 정적 분석 축 추가. 빌드/테스트
   시점에만 저장소 소스를 스캔하는 dev-only 코드로, 사용자 입력이나 런타임 요청 경로와 무관.
3. **e2e 테스트 신설**: `alerts-threshold-wire-type.e2e-spec.ts` — 실 HTTP 로 `threshold` 가
   문자열임을 왕복 확인.
4. **문서/plan/이전 리뷰 산출물**: `plan/in-progress/spec-draft-nullable-notation-followups.md`,
   `review/code/**`, `review/consistency/**` 다수 — 전부 마크다운/JSON 리포트이며 코드 실행
   경로에 영향 없음.

## 발견사항

- **[INFO]** `AlertRuleDto.threshold` 타입 정정은 wire 포맷을 바꾸지 않는 순수 문서 정합화
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (필드
    `threshold`, `@ApiProperty({ type: String, example: '10.0000' })`)
  - 상세: `alert_rule.threshold` 는 `numeric(12,4)` 컬럼이고 TypeORM 은 정밀도 보존을 위해
    문자열로 반환한다. 응답 DTO 타입 애노테이션을 실제 wire 와 일치시킨 것뿐이며, 쓰기 경로
    (`CreateAlertRuleDto.threshold: number` → `alerts.service.ts` 에서 `String(dto.threshold)`)는
    TypeORM 파라미터 바인딩을 그대로 사용해 SQL 인젝션 벡터가 없다(이 diff 가 그 경로를
    변경하지 않음도 확인). 인증/인가·입력 검증 로직에는 영향 없음.
  - 제안: 없음 — 조치 불요.

- **[INFO]** repo-guard 정적 분석 코드(`swagger-dto-contract-guard.ts`)는 런타임 요청 경로와
  분리된 dev-only 도구
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
    (`scanNumericExposure`, `collectNumericFields`, `collectDtoFieldTypes`)
  - 상세: `fs.readFileSync`/`ts.createSourceFile` 이 읽는 대상은 `collectTsFiles(SRC_ROOT)` 로
    산출된 저장소 내부 TS 소스 경로뿐이며 사용자 입력이 개입할 여지가 없다(테스트·빌드 시점
    전용, HTTP 서버에 노출되지 않음). 경로 탐색·커맨드 인젝션 벡터 없음.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 diff (`CHANGELOG.md`, DTO, repo-guard, e2e spec, plan/review 문서 포함)
  - 상세: `password|secret|token|api[_-]?key|BEGIN ... KEY` 패턴으로 변경분 전체를 grep 했다.
    걸린 문자열은 전부 (a) 기능명/엔드포인트명에 대한 문서 서술(`rotate-bot-token`,
    `reset-password` 등), (b) e2e 테스트에서 로그인 응답으로 **런타임에 발급받는**
    `ownerToken`/`accessToken` 변수 사용(`Authorization: Bearer ${ownerToken}`)뿐이며, 실제
    시크릿 리터럴은 없다. `review/**` 하위 신규 `_retry_state.json`/`meta.json` 등에도
    key/token/secret/password/credential 패턴 매치 없음.
  - 제안: 없음.

- **[INFO]** e2e 테스트의 인증 처리 적절
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`
  - 상세: `registerAndLogin` 헬퍼로 매 테스트 실행마다 고유 이메일(`uniqueEmail`)의 신규
    계정을 생성해 토큰을 발급받고, 모든 요청에 `Authorization`/`X-Workspace-Id` 헤더를 붙인다.
    베이스 URL 은 `process.env.E2E_BASE_URL` 환경변수로 주입되며 하드코딩된 엔드포인트/자격
    증명 없음.
  - 제안: 없음.

## 요약

이번 changeset 의 실질 코드 변경은 응답 DTO 의 타입 애노테이션을 실제 wire 포맷(`string`)에
맞춘 정정 하나이며, 인증/인가, 입력 검증, 쿼리 실행 경로, 암호화, 에러 처리 어디에도 관여하지
않는다. 함께 추가된 repo-guard 정적 분석 코드와 e2e 테스트는 개발/CI 시점에만 동작하는 도구로
공격 표면을 넓히지 않는다. 대량의 `review/**` 신규 파일은 이전 리뷰 라운드의 마크다운/JSON
산출물이며 시크릿·민감정보 노출 없음을 grep 으로 확인했다. 인젝션·하드코딩 시크릿·인증 우회·
안전하지 않은 암호화·에러 메시지 정보 노출 등 어느 항목에서도 결함을 발견하지 못했다.

## 위험도

NONE
