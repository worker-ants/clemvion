# 보안(Security) 코드 리뷰

## 리뷰 범위

실질 코드/문서 변경은 5개 파일이다(나머지 21개 파일은 이전 리뷰/컨시스턴시 세션(`19_43_18`, `20_05_42`)의 산출물이 `review/**` 에 신규 커밋되는 것으로, 마크다운/JSON 보고서일 뿐 실행 코드가 아니다 — 보안 관점에서 별도 취약점 표면이 아니다):

1. `CHANGELOG.md` — `AlertRuleDto.threshold` 타입 정정 서술 추가 (문서)
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number` → `threshold: string` 타입/데코레이터 정정 (실 코드)
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 정적분석 repo-guard 술어 `findNumericAsNumber` 신규 추가 (실 코드, 개발-시점 전용)
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어에 대한 단위 테스트 추가 (테스트 코드)
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 트래커 갱신 (문서)

## 발견사항

- **[INFO]** DTO 필드 타입 정정 자체는 wire·인가·검증 로직에 영향 없음
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28-29`
  - 상세: `@ApiProperty({ type: String, example: '10.0000' })` / `threshold: string;` 로 바뀐 것은 OpenAPI **문서**(및 TS 컴파일 타임 타입)를 실제 wire(`numeric(12,4)` 컬럼을 TypeORM 이 문자열로 직렬화)에 맞춘 것뿐이다. 인증·인가 데코레이터(가드, `@Roles` 등), 입력 검증(`class-validator`) 데코레이터, SQL 쿼리 경로에는 어떤 변경도 없다. 응답 바이트 자체도 종전과 동일 — 순수 문서/타입 정합화로 신규 공격 표면이 생기지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 신규 정적분석 술어(`findNumericAsNumber`)는 개발-시점 repo-guard 로, 신뢰 입력(저장소 소스 파일)만 처리
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:216-217`(정규식), `:219-269`(함수 본문)
  - 상세: `NUMERIC_COLUMN` 정규식과 `findNumericAsNumber()` 는 `fs.readFileSync` 로 `collectTsFiles(SRC_ROOT)` 가 나열한 저장소 내부 `.ts` 파일만 읽는다 — 외부/사용자 입력이 개입할 여지가 없고, CI/테스트 실행 시점에만 동작하는 개발 도구다. 정규식(`@Column\(\{[^}]*type:\s*'(?:numeric|decimal)'[^}]*\}\)\s*\n\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*[!?]?\s*:`)은 중첩 정량자 없이 `[^}]*` 두 개가 선형으로 소비되는 구조라 ReDoS 형태도 아니며, 설령 병리적이더라도 입력이 신뢰된 소스 트리로 한정돼 공격자가 트리거할 경로가 없다.
  - 제안: 조치 불요 — 프로덕션 런타임 코드가 아님을 확인.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 5개 실질 변경 파일 전체 + 신규 커밋되는 review 산출물 21개 전체
  - 상세: API 키/비밀번호/토큰/인증서 패턴(`password`, `secret`, `api[_-]?key`, `token`, `BEGIN ... KEY` 등)으로 grep 했을 때 유일하게 걸린 문자열은 기존 spec 규약에 대한 언급 중 엔드포인트 **이름**(`rotate-bot-token`, RPC-style sub-channel 경로)이며 실제 시크릿 값이 아니다.
  - 제안: 조치 불요.

## 요약

이번 changeset 의 실질 코드 변경은 `AlertRuleDto.threshold` 의 Swagger/TS 타입을 실제 wire 형태(`string`)에 맞춰 정정한 것 하나이며, 인증/인가·입력 검증·SQL/커맨드 실행 경로에는 어떤 영향도 주지 않는 순수 문서·타입 정합화다. 동반 추가된 `findNumericAsNumber` repo-guard 술어는 저장소 내부 신뢰 소스만 정적분석하는 개발-시점 도구로 외부 입력 표면이 없다. 나머지 다수 파일은 이전 리뷰/컨시스턴시 세션의 마크다운·JSON 산출물이 새로 커밋되는 것뿐이라 별도 보안 표면을 만들지 않는다. 하드코딩된 시크릿, 인젝션 벡터, 안전하지 않은 암호화·에러 노출 어디에도 해당 사항이 없다.

## 위험도

NONE
