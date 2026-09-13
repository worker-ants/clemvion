# 보안(Security) 코드 리뷰

## 리뷰 방법

본 프롬프트는 `origin/main` 대비 누적 diff(44~172개 파일, 6번째 `/ai-review` 라운드)이며 실제 애플리케이션 로직 변경은 다음 두 파일뿐이다.

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규, 279줄) — `guide-error-code-scan.ts` 대체
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규, 421줄) — `guide-error-code-existence.test.ts` 대체

프롬프트 내 이 두 파일의 unified diff 는 크기 제한으로 생략돼 있어, `Read` 로 저장소의 현재 파일 전문을 직접 열어 확인했다(저장소에 아무것도 쓰지 않았다 — `git status --short` 로 clean 확인). 나머지 변경분(`CHANGELOG.md`·`PROJECT.md` 문구, `guide-sanitized-message-parity.test.ts` 주석 1줄, `plan/in-progress/*.md`, `review/code/**`·`review/consistency/**` 산출물)은 전부 마크다운/JSON 문서다.

이전 5개 라운드(`14_41_14`~`16_04_15`)의 RESOLUTION 을 확인한 결과, security 관점은 매 라운드 **INFO(조치 불요)** 로만 다뤄졌다 — "ReDoS 형태 아님(`_` 앵커 분리)", "env 스캔은 이름만 수집하고 값은 버림", "존재≠방출은 보안 이슈가 아니라 정합성 문제"(라운드 1), "env 수집기는 변수 이름만 걷고 값은 정규식 밖 — 시크릿 경로 아님"(라운드 4). 이번 라운드는 그 이후 순수 정밀도 보정(경계 정규식 수정, JSDoc 갱신)만 있었고 신규 보안 표면은 추가되지 않았다.

## 발견사항

해당 없음. 아래는 점검 관점별 확인 근거다.

- **인젝션 취약점**: 두 파일 모두 `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync` 로 저장소 내 신뢰된 경로(`repoRoot()` 기준 고정 상대경로, 사용자 입력 없음)만 동기 읽기하고, 정규식 매칭·`Set`/`Array` 조립 외의 동작이 없다. `eval`/`Function`/`child_process`/템플릿 렌더링/SQL/LDAP 호출이 전무하다. 경로 탐색 벡터도 없다 — 읽는 경로가 전부 하드코딩된 리터럴(`codebase/backend/.env.example` 등)이거나 `walkTree`/`collectMdxFiles` 가 저장소 내부 디렉터리만 순회한다.
- **하드코딩된 시크릿**: `guide-identifier-existence.test.ts:275` 의 `"POSTGRES_PASSWORD: secret"` 은 compose 매핑 스타일 파싱을 검증하는 합성 fixture 문자열이며, 리터럴 `secret` 은 실제 자격증명이 아니라 정규식이 "값"이 아닌 "키 이름"만 추출하는지 확인하기 위한 더미 값이다(`collectEnvDeclarations` 는 변수 **이름**만 수집하고 값은 반환값에 포함하지 않는다 — `guide-identifier-scan.ts:257-279` 확인). 다른 파일에도 API 키·비밀번호·토큰·인증서 리터럴은 없다.
- **인증/인가**: 해당 코드는 CI/vitest 시점에만 실행되는 정적 텍스트 스캐너로, HTTP 엔드포인트·세션·인증 로직과 무관하다. 컨트롤러·가드·미들웨어 변경 없음.
- **입력 검증**: 스캐너의 "입력"은 저장소 내 신뢰된 MDX/TS/env/compose 파일이며 외부 사용자 입력을 받지 않는다. 정규식은 모두 `^`/`\b`/lookbehind 등으로 경계가 있어(라운드 5 에서 5개 정규식 전수 감사 및 판별 fixture 로 고정) 과매치가 있어도 방향이 fail-closed(더 많은 토큰이 검사받아 거짓 PASS 가 아니라 거짓 RED 쪽)로 설계돼 있다.
- **OWASP Top 10**: 웹 요청 처리 경로가 없어 해당 카테고리(A01~A10) 전반이 적용되지 않는다.
- **암호화**: 해시/암호화/평문 전송 관련 코드 없음.
- **에러 처리**: `expect(...).toEqual([])` 류의 테스트 단언 실패 메시지는 vitest 리포터가 로컬/CI 콘솔에만 출력하며, 여기 담기는 값은 가이드 MDX 파일 안의 식별자 **이름**(에러 코드/env 변수명) 문자열이지 비밀값이 아니다. 민감정보 노출 경로 없음.
- **의존성 보안**: `package.json`/lockfile 변경 없음. import 는 `vitest`(기존 devDependency)·`node:fs`/`node:path`(내장)·동일 폴더 기존 유틸(`./tree-walk`, `./impl-anchor-parse`)·신규 sibling 모듈(`./guide-identifier-scan`)뿐, 신규 외부 패키지 도입 없음.

## 요약

이번 변경 세트는 유저 가이드(MDX)가 인용하는 UPPER_SNAKE 식별자(에러 코드 + 환경변수)가 backend/packages 소스나 env 선언처에 실재하는지 검증하는 vitest 정적 텍스트 스캐너의 리네임·축 확장(`guide-error-code-*` → `guide-identifier-*`)이며, 신규/변경 실행 코드는 저장소 내 신뢰된 파일을 동기적으로 읽어 정규식으로 매칭하는 순수 함수로만 구성된다. 네트워크·DB·인증·암호화·외부 입력 처리 표면이 전혀 없고, 시크릿 리터럴이나 신규 의존성도 없다. 이전 5개 라운드가 이미 같은 결론(NONE~LOW, security 카테고리는 전 라운드 INFO)에 도달했고, 이번 라운드의 diff 증분은 경계 정규식 정밀화와 문서 문구 갱신뿐이라 새로운 보안 표면을 만들지 않는다.

## 위험도

NONE
