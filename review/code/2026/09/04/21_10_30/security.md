# 보안(Security) 코드 리뷰

## 대상 요약

이번 changeset 의 실질 코드/문서 변경은 다음으로 한정된다:

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold` 를 `number` → `string` 으로, `@ApiProperty({ example: 10 })` →
   `@ApiProperty({ type: String, example: '10.0000' })` 로 정정 (Swagger 문서/TS 타입
   애노테이션만 변경, 런타임 직렬화 로직 불변).
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` /
   `swagger-dto-contract.spec.ts` — 저장소 전수 정적 스캔 가드(`findNumericAsNumber`)와
   그 테스트. `fs.readFileSync` + TypeScript AST 파서(`ts.createSourceFile`)로 **저장소
   자신의 소스 파일**만 읽는다 — 사용자 입력이나 외부 데이터를 다루지 않는 빌드/테스트
   시점 전용 도구다.
3. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e. 표준
   `registerAndLogin`/`createTeamWorkspace` 헬퍼로 계정을 발급받아 `Authorization: Bearer
   ${ownerToken}` 헤더로 인증한다. 시크릿 하드코딩 없음, 토큰은 런타임에 발급된 값을
   변수로만 사용.
4. `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서
   전용 변경.
5. `review/code/**`, `review/consistency/**` 하위 다수 파일 — 이전 리뷰 라운드
   (`19_43_18`/`20_16_17`/`20_39_25`/`20_05_42`) 산출물이 이번 커밋에 함께 실린 메타
   리포트(마크다운/JSON)다. 코드가 아니며 이번 diff 의 보안 판단 대상이 아니다. 본문을
   훑어 하드코딩된 시크릿·자격증명 패턴이 있는지 확인했고 없음을 확인했다.

`alert-rule.entity.ts`(`@Column({ type: 'numeric', precision: 12, scale: 4 })
threshold: string`), `alerts.controller.ts`(반환 타입 미명시, 엔티티 그대로 반환),
`codebase/frontend/src/lib/api/alerts.ts`(읽기 `string`/쓰기 `number` 로 이미 분리)를
직접 열어 CHANGELOG·plan 문서의 실측 주장과 대조했고 어긋남이 없었다.

## 발견사항

발견된 보안 취약점 없음.

- **인젝션(SQL/XSS/커맨드/경로 탐색 등)**: 해당 없음. `AlertRuleDto` 변경은 타입
  애노테이션뿐이고 쿼리 조립·사용자 입력 처리 경로에 변화가 없다. 신규 repo-guard 는
  저장소 자체 소스 트리를 `collectTsFiles`/`fs.readFileSync` 로 읽을 뿐 외부/사용자
  입력을 받지 않으며, 파일 경로도 저장소 내부 glob 결과로 고정돼 있어 경로 탐색 표면이
  없다.
- **하드코딩된 시크릿**: 없음. `@ApiProperty` 예시 값(`'10.0000'`)은 임계값 샘플이고,
  e2e 스펙의 `ownerToken`/`BASE_URL`(`process.env.E2E_BASE_URL` 기본값)은 테스트
  런타임에 발급·주입되는 값이다.
- **인증/인가**: 해당 없음. 컨트롤러 로직·가드·데코레이터 변경 없음. e2e 는 기존
  `registerAndLogin`/워크스페이스 헤더(`X-Workspace-Id`) 패턴을 그대로 재사용한다.
- **입력 검증**: 해당 없음. 이번에 바뀐 `AlertRuleDto` 는 **응답** DTO 이며 `@Is*` 요청
  검증 데코레이터가 붙는 쓰기 DTO(`CreateAlertRuleDto`)는 diff 대상이 아니다(여전히
  `number` 를 받음).
- **OWASP Top 10**: 해당 없음.
- **암호화**: 해당 없음. 해시/암호화 알고리즘·전송 방식 변경 없음.
- **에러 처리**: 해당 없음. 예외 처리·에러 메시지 로직 변경 없음.
- **의존성 보안**: 해당 없음. `package.json`/lockfile 변경 없음.

**참고(INFO, 결함 아님)**: `AlertRuleDto.threshold` 타입 정정 자체는 보안 관점에서
오히려 긍정적이다 — OpenAPI 문서가 실제 wire 형태(`numeric` 컬럼이 정밀도 보존을 위해
문자열로 직렬화됨)와 다르게 `number` 로 잘못 문서화돼 있던 것을 바로잡아, 이를 신뢰해
코드 생성(codegen)하는 소비자가 정밀도 손실이나 부정확한 숫자 파싱으로 임계값을
오해석할 여지를 줄인다.

## 요약

이번 changeset 은 (1) 응답 DTO 필드 하나의 Swagger/TS 타입 애노테이션을 실제 wire 형태에
맞춘 정정, (2) 그 결함 클래스를 저장소 전수로 재발 방지하는 정적 분석 repo-guard(빌드/
테스트 전용, 외부 입력 없음), (3) 그 계약을 실 HTTP 응답으로 고정하는 e2e, (4) 문서
갱신으로 구성된다. 인젝션·인증/인가·하드코딩 시크릿·암호화·에러 노출·의존성 등 보안
관점에서 우려할 실질적 코드 변경은 없다. 함께 커밋된 다수의 `review/**` 메타 리포트도
검토했으나 시크릿·자격증명 노출이나 보안 관련 지적 사항은 없다.

## 위험도

NONE
