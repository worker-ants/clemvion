# 보안(Security) 리뷰

## 발견사항

없음.

## 요약

이번 diff 는 전부 `codebase/backend/src/repo-guards/__tests__/**` 와
`codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}` 를 포함하는
**테스트/빌드 타임 정적 분석 도구(repo guard)** 리팩터링과, 관련 `plan/` 문서·`review/`
산출물 갱신이다. 다섯 곳에 중복되어 있던 `.ts` 파일 walker(`collectSourceFiles`·
`walkTsFiles`·`listSourceFiles`·`listProductionSources`)를 `common/__test-utils__/
source-scan.ts` 의 단일 `collectTsFiles()` 로 통합했고, `nullable-type-lie-cast-guard.ts`
는 `| null` 판정 술어(`isNullableType`)를 두 소비처(`widenedEntityFields`,
`findUntypedNullableColumns`) 모두에 일관 적용하도록 고쳤다.

보안 관점에서 점검한 8개 축을 대조한 결과:

- **인젝션**: SQL/커맨드/경로 탐색 표면이 없다. 모든 `fs.readFileSync`/`readdirSync` 호출은
  `__dirname` 기준 상수 경로(`SRC_ROOT`, `MODULES_DIR`, `ENGINE_DIR` 등)에서 파생된 값만
  받는다 — 외부·사용자 입력이 개입할 경로가 없다(jest 실행 시 개발자 로컬 저장소만 스캔).
- **하드코딩된 시크릿**: 없음. `passwordHash`/`password_hash` 문자열은
  `nullable-type-lie-cast.spec.ts` 의 `@Column` 데코레이터 판정 테스트에 쓰인 **필드명
  fixture**이며 실제 자격증명이 아니다.
- **인증/인가**: 해당 코드는 런타임 요청 경로가 아니라 CI/로컬 테스트 시점에만 실행되는
  정적 분석 스크립트라 인증/인가 표면 자체가 없다.
- **입력 검증**: 정규식들(`COLUMN_DECL`, `WIDENED_DECL`, `countRawUpdateReturning` 의
  `CALL` 등)은 신뢰할 수 있는 자체 저장소 소스 코드만을 대상으로 하며, 외부에서 주입 가능한
  입력이 아니므로 ReDoS 등 적대적 입력 검증 이슈는 이 컨텍스트에서 실질적 위험이 아니다.
- **OWASP Top 10 / 암호화 / 에러 처리 / 의존성**: 해당 사항 없음 — 네트워크 호출, 암호화
  연산, HTTP 응답, 신규 외부 의존성이 diff 에 없다.

`review/code/2026/09/04/01_49_18/*`(RESOLUTION.md, meta.json, documentation.md 등)는
이전 리뷰 라운드의 산출물이 저장소에 커밋된 것으로, 이번 diff 의 신규 위험을 만들지 않는다.
검증 중 저장소 파일을 수정하지 않았으며(`git status --short` 상 이 리뷰 세션 자신의
`review/code/2026/09/04/04_37_28/` 디렉터리만 untracked 로 남아 있고 그 외 잔여물 없음),
별도 원복도 필요하지 않았다.

## 위험도

NONE
