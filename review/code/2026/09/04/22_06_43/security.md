# 보안(Security) 코드 리뷰

## 검토 범위

- `CHANGELOG.md` — `AlertRuleDto.threshold` 타입 정정을 설명하는 신규 Unreleased 섹션 추가 (문서)
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold` 필드를 `number` → `string` 으로, `@ApiProperty({ example: 10 })` → `@ApiProperty({ type: String, example: '10.0000' })` 로 정정
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` / `swagger-dto-contract.spec.ts` — 빌드타임 정적 가드에 `numeric`/`decimal` 컬럼을 엔티티 그대로 노출하는 응답 DTO 가 `number` 로 잘못 선언하는 것을 잡는 세 번째 축(`findNumericAsNumber`/`scanNumericExposure`) 추가
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — `POST`/`GET`/`PATCH /api/alerts` 세 응답 모두 `threshold` 가 문자열로 내려오는지 실 HTTP 로 대조하는 e2e 신규
- `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/code/2026/09/04/19_43_18/**` — plan 트래커 갱신 및 직전 리뷰 라운드 산출물 (문서, 실행 코드 아님)

## 발견사항

- **[INFO]** `threshold` 타입 정정은 wire 바이트를 바꾸지 않는 순수 문서/타입 정합화
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (`threshold` 필드, 함수/클래스: `AlertRuleDto`)
  - 상세: `numeric(12,4)` 컬럼을 TypeORM 이 정밀도 보존을 위해 문자열로 반환하는 기존 동작은 변경되지 않는다. Swagger 선언을 실제 wire 형태(`string`)에 맞춘 것뿐이라 인젝션·인가·검증 관점의 새 공격 표면이 생기지 않는다. 요청측(`CreateAlertRuleDto.threshold: number`)은 이번 diff 범위 밖이며 여전히 서버가 `String(...)` 으로 변환해 저장하므로 별도 검증 우회는 없다.
  - 제안: 없음.

- **[INFO]** 신규 정적 가드(`findNumericAsNumber`/`scanNumericExposure`)는 공격 표면 없는 빌드타임 도구
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`scanNumericExposure`, `collectNumericFields`, `readColumnType`)
  - 상세: `fs.readFileSync(file, ...)` 는 저장소 내부 소스 스캔(`collectTsFiles`)이 넘기는 경로만 받는 테스트/빌드타임 유틸이며, 외부 입력이나 런타임 요청 경로에 노출되지 않는다. 경로 판별에 `toPosixPath` 정규화를 거친 뒤 `includes('/entities/')`/`includes('/dto/responses/')` 로 문자열 부분일치 검사를 하는데, 이는 신뢰되지 않는 사용자 입력이 아니라 저장소 자체의 파일 목록에만 적용되므로 경로 탐색(path traversal) 취약점으로 이어지지 않는다.
  - 제안: 없음(런타임 코드가 아니므로 이 축에서 조치 불요 — 정확도 개선 관점의 논의는 다른 리뷰어 축 참조).

- **[INFO]** e2e 테스트는 하드코딩된 시크릿·환경별 자격증명을 도입하지 않음
  - 위치: `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`
  - 상세: `BASE_URL` 은 `process.env.E2E_BASE_URL` 폴백이고, 인증 토큰은 `registerAndLogin` 헬퍼로 테스트마다 동적으로 발급받는다(`uniqueEmail`/`uniqueName` 로 매 실행 고유값 생성). 고정된 API 키·비밀번호·JWT 시크릿 등이 소스에 직접 포함되지 않았다.
  - 제안: 없음.

- **[INFO]** CHANGELOG/plan 문서에 시크릿·내부 인프라 상세 노출 없음
  - 위치: `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 신규 섹션은 컬럼 타입·DTO 필드명·엔드포인트 경로 등 이미 공개 OpenAPI 문서로 노출되는 정보만 다룬다. 내부 자격증명·비밀 설정값 언급 없음.
  - 제안: 없음.

## 요약

이번 changeset 의 실질 코드 변경은 `AlertRuleDto.threshold` Swagger/TS 타입을 `number` 에서 실제 wire 형태인 `string` 으로 정정한 것과, 이를 재발 방지하기 위해 `swagger-dto-contract` 정적 가드에 `numeric`/`decimal` 컬럼 노출 축을 추가한 것, 그리고 이를 실 HTTP 로 고정하는 e2e 테스트 1건이다. 인젝션 벡터(SQL/XSS/커맨드/경로 탐색), 하드코딩 시크릿, 인증/인가 로직, 암호화, 에러 메시지 노출, 의존성 변경 중 어느 것도 이번 diff 에 관여하지 않는다. 정적 가드는 저장소 내부 소스 파일만 스캔하는 빌드타임 도구이고 e2e 테스트는 동적으로 발급된 테스트 자격증명만 사용한다. 저장소 트리 뮤테이션 없이 파일을 읽기 전용으로 확인했으며 `git status --short` 기준 이상 없음.

## 위험도

NONE
