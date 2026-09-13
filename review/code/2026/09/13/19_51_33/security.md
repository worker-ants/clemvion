# 보안(Security) 코드 리뷰 — error-code-emission-axis (라운드 2)

## 검토 범위 · 방법

이 배치는 20개 파일로 구성되지만 실질 "코드"는 두 파일뿐이다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 정규식 3종 +
수집기 3종 + `GUIDE_NON_EMITTED_VOCABULARY` 신규 면제 목록)와
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(그 위의 단언
7종, `where` grep 검증 포함). 나머지는 `CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`(가이드
문장 정정)·`plan/**`·`review/code/2026/09/13/19_23_22/**`·`review/consistency/2026/09/13/18_40_54/**`
로, 전부 문서/plan/이전 리뷰 라운드 산출물이다. 프롬프트가 두 핵심 `.ts` 파일의 diff 를
크기 제한으로 생략했으므로 `Read` 로 전체 파일을 직접 열어 독립 검증했다(`guide-identifier-scan.ts`
전문, `guide-identifier-existence.test.ts` 의 `readFileSync`/`path.join`/`where` grep 관련
구간). 이 배치는 동일 세션의 `/ai-review` 라운드 1(`review/code/2026/09/13/19_23_22/security.md`)
이 이미 위험도 NONE 으로 판정했고, 이번 라운드는 그 판정을 독립적으로 재검증한다.

## 발견사항

- **[INFO]** 런타임 프로덕션 코드 변경 없음 — 전 범위가 dev-time 정적 스캐너·테스트·문서
  - 위치: 전 파일. 코드 변경은 `guide-identifier-scan.ts` 전체(533줄) · `guide-identifier-existence.test.ts` 전체(772줄) 로 한정
  - 상세: 두 파일 모두 Vitest 스위트/그 스캐너 모듈이고, `spec/**`·`.env.example`·`docker-compose*.yml`·`codebase/frontend/src/content/docs/**mdx`·`codebase/backend/src/**` 를 **읽기 전용**으로 스캔해 가이드 문서가 인용하는 UPPER_SNAKE 식별자가 실재/발행되는지 검증한다. 백엔드 API·인증/인가·DB 쿼리·외부 네트워크 호출·시크릿 취급 경로는 이번 diff 에 포함되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 정규식 5종(`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE`/`collectMatches` 호출부·기존 `BACKTICK_INNER` 재사용)의 ReDoS 가능성 — 없음, 직접 재확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:260`(`QUOTED_LITERAL`), `:263`(`MESSAGE_PREFIX`), `:266`(`CATALOG_CODE`)
  - 상세: 세 정규식 모두 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"`(:137)를 감싸는 형태다. 첫 그룹은 `_`를 만들 수 없고 둘째 그룹은 반드시 `_`로 시작해 두 정량자의 매치 구간이 겹치지 않으므로 모호한 부분 반복(중첩 정량자로 인한 catastrophic backtracking) 조건이 성립하지 않는다 — "정적 형태 판단"에 그치지 않고 패턴 구조(문자 클래스 분리)로 실제로 선형임을 확인했다. `matchAll` 사용으로 공유 `lastIndex` 오염도 없다(설계 근거가 주석에 명시됨). 입력도 저장소 자신의 정적 텍스트(가이드 mdx·spec·소스·env)이며 외부/사용자 입력이 아니다.
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **[INFO]** 파일 경로 구성 — 전부 하드코딩된 상대경로, 경로 탐색(path traversal) 벡터 없음 (직접 재확인)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:38`(`const root = repoRoot()`), `:89-90`(`fs.readFileSync(path.join(root, "spec/5-system/3-error-handling.md"), "utf8")`), `:214-217`(`walkTree(root, ["codebase/backend/src"], { includeFile: (n) => n === path.basename(file) })`)
  - 상세: `root` 는 `__dirname` 기반으로 한 번 계산되고, 그 뒤 모든 `path.join`/`walkTree` 호출은 리터럴 문자열 경로(`"spec/5-system/3-error-handling.md"`, `"codebase/backend/src"`)를 쓴다. 신규로 추가된 `where` 필드 grep 검증(`:202-231`)도 `GUIDE_NON_EMITTED_VOCABULARY` 배열의 **소스 코드에 하드코딩된** `where: "execution-engine.service.ts:7121·7125 — …"` 문자열에서 정규식 `/([\w./-]+\.ts):(\d+)/` 로 파일 basename 을 추출해 `walkTree` 의 `includeFile` 술어(정확히 일치하는 basename만)로 검색한다 — 외부 입력이나 사용자 제어 값이 경로 구성에 개입하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음 (전 파일 재확인)
  - 위치: 리뷰 대상 20개 파일 전체
  - 상세: API 키·비밀번호·토큰·인증서 패턴을 찾지 못했다. 언급되는 모든 UPPER_SNAKE 토큰(`CONTAINER_MISSING_EMIT`, `MAKESHOP_UNRESOLVED_PATH_PARAM`, `MAX_ITERATIONS_EXCEEDED` 등)은 에러 코드/환경변수 **이름**이지 값이 아니며, `.env.example`/`docker-compose*.yml` 자체는 이번 diff 의 변경 대상이 아니다(스캐너가 읽기만 한다).
  - 제안: 조치 불필요.

- **[INFO]** 가이드 문서 정정(`logic.mdx`/`logic.en.mdx`)의 방향은 보안적으로 개선
  - 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`, `logic.en.mdx:103`
  - 상세: "`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 로 실행 실패해요" → "실패 메시지 앞에 붙어요 — 전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요"로 정정한 것은, 사용자가 존재하지 않는 구조화 `error.code` 필드를 신뢰해 오동작(예: 잘못된 코드 분기 처리)하는 것을 막는 방향이며 새로운 취약점 표면을 열지 않는다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 유저 가이드 문서 2건(KO/EN)의 서술 정정과, 그 정확성을 검증하는 dev-time 전용 정적 스캐너(`guide-identifier-scan.ts`)·테스트(`guide-identifier-existence.test.ts`)에 "발행(emission) 축"을 추가한 것이 전부다. 프로덕션 런타임 코드(백엔드 API, 인증/인가, DB 쿼리, 외부 네트워크 호출, 시크릿 취급)에 대한 수정은 없으며, 신규 정규식은 기존에 검증된 `UPPER_SNAKE` 패턴을 재사용해 구조적으로 ReDoS 가 불가능함을 문자 클래스 분리로 직접 확인했다. 파일 경로는 전부 저장소 내 하드코딩된 상대경로/basename 매칭이라 경로 탐색 벡터가 없고, 하드코딩된 시크릿도 없다. 이전 라운드(`review/code/2026/09/13/19_23_22/security.md`)가 내린 NONE 판정을 두 핵심 `.ts` 파일 전문을 직접 읽어 독립 재검증했으며 동일 결론에 도달한다. 인젝션·인증/인가·입력 검증·암호화·에러 정보 노출·의존성 보안 어느 관점에서도 지적할 결함이 없다.

## 위험도
NONE
