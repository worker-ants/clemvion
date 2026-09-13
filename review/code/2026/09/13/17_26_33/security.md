# 보안(Security) 코드 리뷰

## 발견사항

해당 없음.

이번 changeset(`CHANGELOG.md`·`PROJECT.md` 문구 갱신, `guide-error-code-existence.test.ts`/
`guide-error-code-scan.ts` 삭제 → `guide-identifier-existence.test.ts`/
`guide-identifier-scan.ts` 신설, `guide-sanitized-message-parity.test.ts` 주석 1줄,
`plan/in-progress/*.md` 트래커 갱신, `review/code/**`·`review/consistency/**` 산출물)를
아래 관점별로 직접 확인했다.

- **인젝션**: 신규 스캐너(`guide-identifier-scan.ts`)는 `fs.readFileSync`/`readdirSync` 로
  저장소 내 신뢰 경로(`codebase/backend/src`, `codebase/packages`, `.env.example`,
  `docker-compose*.yml`, `content/docs/**`)만 정적으로 읽어 정규식으로 매칭한다. 셸 실행
  (`child_process`), SQL, HTML 렌더링, LDAP 질의가 전혀 없고 외부/사용자 입력을 받지 않는다
  (전부 CI·로컬 vitest 실행 시점에 리포지토리 자체 파일만 대상). 경로 조합은 `repoRoot()` +
  하드코딩 상대경로/`readdirSync` 필터(`/^docker-compose.*\.ya?ml$/`)뿐이라 경로 탐색 표면이
  없다.
- **ReDoS**: 신규·변경된 정규식 5개(`UPPER_SNAKE`, `FIELD_TABLE_NAME`, `CODE_FIELD`,
  `BACKTICK_SPAN`/`BACKTICK_INNER`, `collectSourceTokens`/`collectEnvDeclarations` 의
  `\b…\b` 및 `^` 라인 앵커 패턴)를 직접 열람해 확인했다 — 중첩 정량자나 모호한 교대
  (`(a+)+` 류)가 없는 선형 패턴이다. `FIELD_TABLE_NAME` 의 `[^}]*?` 는 `}` 로 경계가 좁혀진
  lazy quantifier 라 선형이다. 새 카탈로그 이력(`review/code/2026/09/13/15_03_06/RESOLUTION.md`)
  에도 이 항목이 "ReDoS 형태 아님" 으로 이미 기록돼 있고, 코드 자체 재검토로도 동일 결론이다.
- **하드코딩된 시크릿**: 스캐너·테스트가 다루는 문자열은 전부 **식별자 이름**(에러 코드,
  환경변수 **키** 이름 — 예: `MCP_ALLOW_INSECURE_URL`, `POSTGRES_PASSWORD` 라는 *이름*)이지
  실제 비밀 **값**이 아니다. `collectEnvDeclarations` 는 `.env.example`/compose 에서 `KEY=`
  형태의 **키 이름만** 수집하고 값은 버린다(정규식이 `=` 뒤를 캡처하지 않음). 새로 추가된
  테스트 fixture 문자열(`MCP_INSECURE_URL_ALLOWED` 등)도 과거 버그를 재현하는 식별자
  이름이지 자격증명이 아니다.
- **인증/인가**: 해당 코드는 런타임 API/서버 경로와 무관한 빌드타임 정적 텍스트 검증
  테스트다. 인증·인가·세션과 관련된 로직 변경이 전혀 없다.
- **입력 검증**: "사용자 입력" 이 존재하지 않는 CI 전용 정적 분석기이므로 해당 관점이
  적용되지 않는다.
- **암호화**: 해시/암호화/전송 로직 변경 없음.
- **에러 처리**: 이 가드가 실패하면 vitest 단언 메시지(파일:줄 [축] 토큰)가 CI 로그에
  노출될 뿐이며, 여기 담기는 값은 가이드 문서에 이미 공개돼 있는 식별자 이름(문서 텍스트
  자체)이라 민감정보 노출로 볼 수 없다.
- **의존성 보안**: `package.json`/lockfile 변경 없음, 신규 외부 패키지 0건(내부 sibling
  모듈 `./guide-identifier-scan` 과 기존 devDependency `vitest`, Node 내장 `fs`/`path` 만
  사용).
- **가이드 콘텐츠의 값 자체**: `plan/in-progress/spec-draft-nullable-notation-followups.md`
  diff 에 `secret`·`token`·`password` 등의 낱말이 다수 등장하나, 전부 **기존에 이미
  존재하던 스코프-외 백로그 서술**(별도 트래커 항목들의 텍스트)이며 이번 diff 는 그 문서에
  `#1331`(이번 가드) 리네임 반영과 `cafe24-api-metadata.md` 오인용 항목 1건 추가만 한다.
  실제 비밀 값이 문서에 새로 노출된 사례는 없다(모두 필드/변수 *이름* 서술).

## 요약

이번 변경 세트는 유저 가이드(MDX)가 인용하는 UPPER_SNAKE 식별자(에러 코드 + 환경변수)가
backend/packages 소스나 env 선언처에 실재하는지 검사하는 vitest 정적 텍스트 스캐너의
리네임·스코프 확장(`guide-error-code-*` → `guide-identifier-*`)과 그에 따른 문서·plan·리뷰
산출물 갱신으로 구성된다. 모든 신규/변경 로직은 저장소 내부의 신뢰된 파일만 동기적으로
읽어 정규식으로 매칭하는 순수 함수이며, 외부 입력·네트워크·셸 실행·DB·인증 흐름을 전혀
건드리지 않는다. 정규식은 선형이라 ReDoS 위험이 없고, 다루는 문자열은 자격증명 값이 아닌
식별자 이름뿐이다. 신규 외부 의존성도 없다. 보안 관점에서 지적할 발견사항이 없다.

## 위험도

NONE
