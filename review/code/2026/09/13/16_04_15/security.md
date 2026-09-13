# 보안(Security) 코드 리뷰

## 검증 방법

리뷰 대상 diff(`origin/main...HEAD`, 누적 5개 커밋 — `guide-error-code-*` 가드를
`guide-identifier-*` 로 리네임·재설계 + 문서/plan/이전 리뷰 라운드 산출물)를 확인했다.
프롬프트가 실질 소스 파일(파일 3~6)의 diff 를 크기 제한으로 생략했으므로, `Read` 로
현재 워크트리의 실제 파일을 직접 열어 대조했다:

- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규, 228줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규, 331줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` /
  `guide-error-code-scan.ts` (삭제분 — `git diff origin/main...HEAD` 로 삭제 전 내용 확인)
- `guide-sanitized-message-parity.test.ts` (docstring 참조만 갱신)

저장소는 뮤테이션하지 않았다(`git status --short` — 이 세션 산출물 디렉터리 외 변경 없음).
`git diff origin/main...HEAD -- codebase/ review/ plan/` 를 시크릿 패턴(`password=`,
`api[_-]?key`, `secret=`, `Bearer <token>`, `sk-...`, `AKIA...`, PEM 헤더 등)으로 grep 했고
매치 0건이었다.

## 발견사항

해당 없음 — CRITICAL/WARNING 없음.

이번 changeset 의 실질 코드(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`)는
유저 가이드 MDX 가 인용한 UPPER_SNAKE 식별자(에러 코드·환경변수 이름)가 backend/packages
소스 및 `.env.example`/`docker-compose*.yml` 선언처에 **문자열로 존재하는지**를 검사하는
빌드/테스트 시점 정적 스캐너다. 아래 8개 관점을 모두 확인했으며 어느 것도 해당하지 않는다.

- **인젝션**: 사용자 입력을 받지 않는다. `fs.readFileSync`/`fs.readdirSync` 대상 경로는
  `path.join(root, "codebase/backend/.env.example")` 류의 고정 리터럴이거나
  `walkTree`/`collectMdxFiles` 가 고정 디렉터리(`codebase/backend/src`, `codebase/packages`,
  `codebase/frontend/src/content/docs`)를 순회한 결과이며, 외부에서 주입 가능한 경로 조각이
  없다. `child_process`/`eval`/`new Function`/DB 쿼리/HTML 렌더링 어디에도 관여하지 않는다
  (grep 확인, 매치 0건) — SQL/커맨드/LDAP 인젝션·경로 탐색·XSS 표면 자체가 없다.
- **하드코딩된 시크릿**: 신규 코드에 API 키·비밀번호·토큰·인증서 리터럴이 없다.
  테스트 fixture 의 `"POSTGRES_PASSWORD: secret\n"` (`guide-identifier-existence.test.ts`
  compose 파싱 대조군)과 `envExampleTexts` 를 통해 읽는 `.env.example` 의
  `POSTGRES_PASSWORD` 참조는 **변수 이름 문자열**만 다루며 실제 값을 저장·출력·전송하지
  않는다 — `collectEnvDeclarations` 는 정규식으로 캡처한 **키 이름**만 `Set` 에 넣고 값은
  버린다. 이 스캐너가 새로 읽는 값이 있다면 그것은 저장소에 이미 커밋돼 있던
  `.env.example`(플레이스홀더 템플릿) 뿐이며, 이번 diff 는 그 파일을 수정하지 않는다.
- **인증/인가**: 해당 파일들은 vitest 로만 실행되는 빌드타임 검증 로직이며 HTTP
  엔드포인트·미들웨어·세션·권한 검사 코드를 포함하지 않는다.
- **입력 검증**: 이 도구가 다루는 "입력"은 저장소 안의 신뢰된 소스 파일뿐이며 런타임에
  외부/사용자 입력을 받지 않으므로 검증·새니타이징 대상이 아니다.
- **OWASP Top 10**: 웹 요청 경로에 있지 않으므로 나머지 OWASP 카테고리(취약한 접근제어,
  보안 설정 오류, 취약한 컴포넌트 등)도 해당 사항이 없다.
- **암호화**: 해시/암호화 연산이 없다. 평문 전송 우려도 없다(네트워크 I/O 자체가 없음 —
  `fetch`/`axios`/`http` grep 매치 0건).
- **에러 처리**: 신규 코드는 `throw` 하지 않으며(예외 없이 `Set`/`Array` 만 반환), 실패는
  vitest 의 `expect(...).toEqual([])` 단언 실패로만 드러난다. CI 로그에 노출될 수 있는 것은
  가이드 파일 경로·줄 번호·식별자 이름뿐으로 민감정보가 아니다.
- **의존성 보안**: `package.json`/lockfile 변경이 diff 에 없다. import 는 `vitest`(기존
  devDependency)와 Node 내장(`node:fs`, `node:path`), 동일 디렉터리 내부 유틸뿐이며 신규
  외부 패키지가 없다.

### ReDoS 형태 점검 (별도 확인)

정규식 5개(`FIELD_TABLE_NAME`, `CODE_FIELD`, `BACKTICK`, `collectEnvDeclarations` 내부
`envLine`/`composeLine`)를 개별 확인했다. 공통 부품 `UPPER_SNAKE =
"[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 는 중첩 정량자·중첩 그룹·겹치는 대안(alternation)이 없는
선형 패턴이다. `CODE_FIELD` 의 `(?<![A-Za-z])` 는 고정폭 부정 후방탐색이라 역추적 폭발
경로가 아니다. 다른 라운드(`review/code/2026/09/13/14_41_14/security.md` INFO#1, 별도
독립 리뷰)도 같은 결론에 도달했으며, 본 리뷰는 정규식 구조를 직접 재확인해 독립적으로
동의한다.

### 존재≠방출 한계는 보안 이슈가 아니라 정합성 트래킹 항목

이 가드 계열의 문서화된 한계("*존재* 검사이지 *방출* 검사가 아니다" —
`guide-identifier-scan.ts:53-76` 주석, CHANGELOG.md 갱신분)는 실제 코드가 `X_UNRESOLVED`
같은 토큰을 런타임에 발행하는지 여부와 무관하게 문서-소스 문자열 일치만 본다는 뜻이다.
이는 사용자에게 노출되는 보안 취약점이 아니라 **문서 검증 도구의 커버리지 갭**이며(사유·
후속 축이 가드 주석·plan 트래커에 이미 명시적으로 등재돼 있다), 별도 카테고리
(documentation/testing)로 다뤄지는 것이 맞다.

## 요약

이번 changeset 의 실질 코드는 backend/packages 소스와 env 선언처를 대조하는 순수·읽기
전용 정적 텍스트 스캐너(vitest 테스트 인프라)이며, 나머지는 `CHANGELOG.md`/`PROJECT.md`
문구 갱신, `plan/in-progress/**` 작업 추적 문서, 그리고 이전 `/ai-review`·
`/consistency-check` 라운드의 산출물(`review/**`) 커밋으로 구성된다. 네트워크·DB·인증·
쉘 실행·동적 코드 평가·사용자 입력 처리 어느 것도 관여하지 않으며, 하드코딩된 시크릿이나
민감정보 노출도 발견되지 않았다. 정규식은 선형 구조로 ReDoS 형태가 아니며, env 값 자체가
아니라 변수 이름만 다뤄 시크릿 노출 경로가 없다. 신규 외부 의존성도 없다. 보안 관점에서
지적할 사항이 없다.

## 위험도

NONE
