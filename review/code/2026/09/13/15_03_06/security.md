# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 애플리케이션 런타임 코드가 아니라 **개발/CI 시점 문서-정합성 가드 테스트 + 문서·plan·리뷰 산출물**이다:

- `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` — 삭제(구 가드, `#1330`)
- `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` — 신규(대체 가드) — 유저 가이드(MDX)가
  적은 UPPER_SNAKE **식별자**(에러 코드 + 환경변수)가 `codebase/backend/src` · `codebase/packages` 소스,
  `.env.example`, `docker-compose*.yml` 에 실재하는지 vitest 로 검증하는 순수 정규식 스캐너
- `guide-sanitized-message-parity.test.ts` — 주석 한 줄만 변경(자매 파일 리네임 반영)
- `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/*.md`, `review/consistency/**`, 이전 라운드
  (`review/code/2026/09/13/14_41_14/**`)의 리뷰 산출물 커밋 — 전부 문서/트래커/리포트

실제 워크트리 파일을 직접 열어(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`,
`guide-sanitized-message-parity.test.ts`) 프롬프트에서 생략된 diff 내용을 확인했고, 직전 라운드
(`14_41_14`) `RESOLUTION.md` 가 주장하는 수정 사항(compose 필터 `docker-compose*.yml` 로 좁힘,
"이 주석을 지우지 말 것" 절 복원, 자매 파일 상호참조 정정)이 소스에 실제로 반영돼 있음을 직접 확인했다.
이 스캐너는 CI/로컬 테스트 실행 시점에 **저장소 내부의 신뢰된 파일**(개발자가 커밋한 MDX 문서,
backend/packages 소스, `.env.example`, compose 파일)만 `fs.readFileSync`/`readdirSync` 로 읽고
정규식으로 토큰을 추출해 `Set` 연산을 하는 순수 함수다. 외부 네트워크 요청, DB 접근, 사용자 입력
처리, 인증/인가 로직이 전혀 없다.

## 발견사항

- **[INFO]** 정규식 기반 토큰 추출은 신뢰된 저장소 콘텐츠에만 적용되어 ReDoS 위험이 사실상 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `UPPER_SNAKE`(90행),
    `FIELD_TABLE_NAME`(102행), `CODE_FIELD`(105행), `BACKTICK`(113행), `collectSourceTokens`(163행)·
    `collectEnvDeclarations`(197·205행) 내부 `envLine`/`composeLine`
  - 상세: `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 는 그룹 반복마다 리터럴 `_` 를 앵커로
    요구해 중첩 정량자 간 모호성이 없다(입력 길이에 선형, catastrophic backtracking 형태 아님).
    설령 이차 이상이더라도 입력은 vitest 실행 시점에 개발자가 커밋한 저장소 콘텐츠(MDX·`.env.example`·
    compose·backend/packages 소스)로 한정되고 공격자가 제어 가능한 런타임 요청 경로가 아니므로 실질
    위험은 없다.
  - 제안: 조치 불필요.

- **[INFO]** `.env.example`·compose 에서 걷는 것은 변수 **이름**뿐, 값이 아님 — 시크릿 노출 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:192-214`
    (`collectEnvDeclarations`), 테스트 단언 `guide-identifier-existence.test.ts:88`
    (`expect(envTokens.has("POSTGRES_PASSWORD")).toBe(true)`)
  - 상세: `envLine`(197행) `^#?\s*(UPPER_SNAKE)=` 과 `composeLine`(205행) `^\s+(UPPER_SNAKE):\s`
    는 좌변 키만 캡처하고 `=`/`:` 우측 값은 정규식 캡처 그룹에 포함하지 않아 버려진다. `.env.example`·
    compose 파일 자체도 관례상 플레이스홀더 값을 담는 파일이라, 이 스캐너가 실제 시크릿 값을 코드나
    테스트 출력(assertion message 등)에 옮기지 않는다. 테스트는 `POSTGRES_PASSWORD` 라는 **식별자
    문자열**이 집합에 있는지만 확인하며 실제 비밀번호 값과는 무관하다.
  - 제안: 조치 불필요. `.env.example` 에 실제 운영 자격증명이 들어있지 않은지는 별도 관례
    (`spec/conventions/secret-store.md`)의 지속 관리 대상이며 이번 diff 로 새로 생긴 문제가 아니다.

- **[INFO]** compose 파일 판별을 `docker-compose*.yml` 명시 패턴으로 좁힘 — 이전 라운드에서 지적된
  "이름보다 넓은 구현"이 이번 diff 에서 이미 정정돼 있음(회귀 방지 확인)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:53-56`
    (`composeTexts`)
  - 상세: 직전 라운드(`14_41_14`) 리뷰가 `f.endsWith(".yml") || f.endsWith(".yaml")` 필터가
    저장소 루트의 `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml` 까지 읽어 이름/JSDoc 이 약속한
    "compose 파일" 범위보다 구현이 넓다고 지적했다(성능/유지보수 관점, 보안 이슈는 아니었음). 이번
    diff 는 `/^docker-compose.*\.ya?ml$/` 로 좁혀 이 문제를 해소했다 — 직접 실행해 필터 결과를
    확인했다. 보안 관점에서는 애초에 값이 아니라 이름만 수집하므로 넓은 시절에도 시크릿 유출
    위험은 없었지만, 신뢰 경계 밖 파일(예: 향후 저장소 루트에 추가될 임의의 `.yml`)이 조용히
    기준집합에 편입될 잠재 경로 하나가 좁혀진 것은 공급망/입력 표면 관점에서 긍정적이다.
  - 제안: 조치 불필요(이미 반영됨).

- **[INFO]** 가드의 알려진 한계("존재 검사 ≠ 방출 검사")는 보안 취약점이 아니라 문서 정확성 문제이며
  코드 주석·PROJECT.md·plan 트래커에 이미 disclose 되어 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:53-76`
    (`## 이 가드가 못 보는 것 — 존재 검사이지 방출 검사가 아니다`)
  - 상세: 이 가드는 "토큰이 backend/packages 소스나 env 선언처에 문자열로 존재하는가"만 보고, 그
    토큰이 실제로 `output.error.code` 로 **방출**되는지, 또는 실제 `process.env` 로 **읽히는지**는
    보지 않는다. 그 결과 에러 메시지 접두로만 쓰이고 실제로는 다른 공용 에러코드로 폴백되는 토큰
    (실측 사례 `MAKESHOP_UNRESOLVED_PATH_PARAM`)이나, 선언처에만 있고 아무도 읽지 않는 env 변수도
    가이드에 실릴 수 있다. 이는 사용자 가이드가 실제 API 응답/동작과 어긋날 수 있다는
    **문서-구현 정합성** 문제이며, 공격 표면을 열거나 민감정보를 유출하는 보안 취약점은 아니다.
    PR 자체가 이 한계를 코드 주석(69-76행, "이 주석을 지우지 말 것" 포함)·`PROJECT.md:300`·
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 일관되게 disclose 했다.
  - 제안: 보안 리뷰 관점에서는 조치 불필요. 문서-구현 정합성 트랙(별도 축)에서 계속 추적.

- **[INFO]** 신규 코드는 인증/인가/암호화/외부 통신을 전혀 다루지 않음 — 해당 점검 관점은 이 diff 에
  적용 대상 없음
  - 위치: 리뷰 대상 코드 파일 전체(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)
  - 상세: SQL/커맨드/LDAP 인젝션, XSS, 경로 탐색, 인증 우회, 세션 관리, 안전하지 않은 해시/암호화,
    민감정보 에러 노출, 취약 의존성 도입 — 모두 이번 변경의 코드 성격(로컬 파일 read + 정규식 매칭 +
    `Set` 연산 + vitest 단언)상 표면이 없다. 파일 읽기에 쓰이는 상대경로(`"codebase/backend/.env.example"`,
    `["codebase/backend/src", "codebase/packages"]` 등)는 전부 하드코딩된 리터럴 문자열이고 사용자
    입력이 개입하지 않으므로 경로 탐색 벡터가 아니다. `CHANGELOG.md`/`PROJECT.md`/`plan/**` 변경은
    산문 텍스트 갱신이며 코드 실행에 관여하지 않는다.
  - 제안: 해당 없음.

- **[INFO]** 커밋된 이전 라운드 리뷰 산출물(`review/code/2026/09/13/14_41_14/**`)에 하드코딩된
  시크릿·자격증명 없음 — 확인됨
  - 위치: `review/code/2026/09/13/14_41_14/{RESOLUTION,SUMMARY,api_contract,architecture,
    concurrency,database,dependency,documentation,maintainability,meta,performance,requirement,
    scope,security,side_effect,testing}.{md,json}`
  - 상세: `password|api[_-]?key|secret|BEGIN (RSA|PRIVATE) KEY` 패턴으로 grep 한 결과, 이번 diff
    가 새로 추가하는 파일에는 매치가 없다(`CHANGELOG.md` 의 매치는 전부 과거 릴리스 노트의 서술적
    언급이며 이번 diff 범위 밖 기존 라인). 리뷰 산출물은 파일 경로·토큰 이름·통계 수치만 담고 있고
    실제 자격증명 값은 포함하지 않는다.
  - 제안: 해당 없음.

## 요약

이번 diff는 프로덕션 런타임에 영향을 주지 않는 **개발/CI 시점 문서-정합성 가드 테스트**(`guide-error-code-*` → `guide-identifier-*` 리네임 + 환경변수 축 확장)와 그에 딸린 plan/문서/이전 라운드 리뷰 산출물이다. 외부 입력, 네트워크, DB, 인증/인가, 암호화 어느 것도 다루지 않으며, 정규식은 신뢰된 저장소 콘텐츠에만 적용되어 ReDoS 등 인젝션류 위험도 실질적으로 없다. `collectEnvDeclarations`는 환경변수 **이름**만 수집하고 값은 절대 캡처하지 않아 시크릿 노출 경로가 없으며, 직전 라운드에서 지적된 "compose 필터가 이름보다 넓다"(성능/유지보수 이슈)는 `docker-compose*.yml` 명시 패턴으로 이미 정정돼 신뢰 경계 밖 파일을 읽을 잠재 경로도 좁혀졌다. 가드가 스스로 disclose 하는 "존재 검사 ≠ 방출 검사" 한계는 문서-구현 정합성 이슈이지 보안 취약점이 아니다. 커밋되는 리뷰 산출물에도 하드코딩된 시크릿은 없다. 보안 관점에서 차단 사유는 없다.

## 위험도

NONE
