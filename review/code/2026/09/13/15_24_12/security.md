# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 애플리케이션 런타임 코드가 아니라 **개발 도구(문서 가드 테스트) + 문서/plan/리뷰 산출물**로 구성된다.

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` — 삭제(구 가드)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` — 신규(대체 가드). 유저 가이드(MDX) 문서가 이름 붙인 UPPER_SNAKE 식별자(에러 코드 + 환경변수)가 `codebase/backend/src`·`codebase/packages` 소스 및 `.env.example`/`docker-compose*.yml` 선언처에 실재하는지 검증하는 순수 정적 스캐너(vitest)
- `guide-sanitized-message-parity.test.ts` — docstring 크로스레퍼런스 문구만 갱신
- `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/*.md`, `review/**` — 문서·트래커·이전 리뷰 라운드 산출물

신규 로직(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)은 vitest 실행 시점에 **저장소 내부의 신뢰된 파일**(커밋된 MDX 문서, backend/packages 소스, `.env.example`, docker-compose 파일)만 `fs.readFileSync`/`fs.readdirSync`로 동기 read 하고 정규식으로 토큰을 추출해 `Set` 연산을 하는 순수 함수다. 네트워크 요청, DB 접근, 사용자 입력 처리, 인증/인가 로직, 외부 프로세스 실행이 전혀 없다.

## 발견사항

- **[INFO]** 신규 정규식(`UPPER_SNAKE`, `FIELD_TABLE_NAME`, `CODE_FIELD`, `BACKTICK`, `envLine`, `composeLine`)은 ReDoS 형태가 아니고, 설령 그렇더라도 입력이 공격자 비제어 저장소 콘텐츠로 한정된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`UPPER_SNAKE` 정의부, `collectSourceTokens`/`collectEnvDeclarations` 내부 정규식)
  - 상세: `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 는 반복되는 그룹마다 리터럴 `_` 를 앵커로 요구해 인접 정량자 간 문자 클래스가 겹치지 않는다 — 중첩 정량자 모호성(고전적 ReDoS 형태, `(a+)+` 류)이 없어 입력 길이에 선형이다. 설령 이차 이상이더라도 입력은 vitest 실행 시점에 개발자가 커밋한 MDX·env·compose·소스 파일로 한정되고 런타임에 공격자가 제어 가능한 요청 경로가 아니므로 실질 위험이 없다.
  - 제안: 조치 불요.

- **[INFO]** `collectEnvDeclarations` 가 `.env.example`/compose 에서 걷는 것은 변수 **이름**뿐, 값이 아니다 — 시크릿 노출 경로 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 함수 `collectEnvDeclarations`(정규식 `envLine`/`composeLine` 모두 좌변 키만 캡처 그룹으로 잡고 우변 값은 버림)
  - 상세: 테스트(`guide-identifier-existence.test.ts` 함수 `describe("유저 가이드 식별자 실재성 가드", ...)` 안 `expect(envTokens.has("POSTGRES_PASSWORD")).toBe(true)`)도 식별자 문자열의 존재만 단언하며 실제 값을 다루지 않는다. `.env.example`/compose 자체가 플레이스홀더 값을 담는 관례 파일이라 실 자격증명이 코드·테스트 출력·리포트에 흘러들 경로가 없다.
  - 제안: 조치 불요. `.env.example`에 실 운영 값이 없도록 하는 것은 이 PR과 무관한 기존 관례(`spec/conventions/secret-store.md`)의 지속 관리 대상.

- **[INFO]** 가드의 명시된 한계("존재 검사 ≠ 방출 검사")는 보안 취약점이 아니라 문서-구현 정합성 이슈이며 별도 트랙에 이미 등재됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단 주석 (`## 이 가드가 못 보는 것` 절), 실측 사례 `MAKESHOP_UNRESOLVED_PATH_PARAM`
  - 상세: 이 가드는 "토큰이 backend/packages 소스 또는 env 선언처에 문자열로 존재하는가"만 판정하고, 그 토큰이 실제로 `output.error.code`로 **방출**되는지는 보지 않는다. 그 결과 에러 메시지 접두로만 쓰이고 실제로는 공용 폴백 코드로 대체되는 토큰이나, 소스에 선언만 있고 아무도 읽지 않는 env 변수도 가이드 문서에 실려 통과한다. 이는 사용자 가이드 문서가 실제 동작과 어긋날 수 있다는 문서-정합성 문제이며, 공격 표면을 새로 열거나 민감정보를 유출하는 종류의 보안 결함이 아니다. PR 이 이 한계를 코드 주석·plan(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 명시적으로 등재해 두었다.
  - 제안: 보안 관점 조치 불요. 문서-구현 정합성 트랙에서 계속 추적.

- **[INFO]** 인증/인가/암호화/외부 통신/인젝션 표면이 이번 diff 전체에 걸쳐 해당 없음
  - 위치: 리뷰 대상 파일 전체 (신규 스캐너 2파일, 삭제된 구 스캐너 2파일, 문서·plan·리뷰 산출물)
  - 상세: SQL/커맨드/LDAP 인젝션, XSS, 경로 탐색, 인증 우회, 세션 관리, 하드코딩된 시크릿, 안전하지 않은 해시/암호화, 에러 메시지의 민감정보 노출, 취약 의존성 도입 — 모두 이 diff의 코드 성격(로컬 신뢰 파일 read + 정규식 매칭 + `Set` 연산 + vitest 단언, 신규 외부 패키지 없음)상 표면이 없다. `readIfPresent`/`collectMdxFiles` 등에 넘기는 상대경로는 전부 소스에 하드코딩된 상수 문자열(`"codebase/backend/.env.example"` 등)이라 경로 탐색 벡터가 아니다.
  - 제안: 해당 없음.

## 요약

이번 변경 세트는 프로덕션 런타임에 영향을 주지 않는 개발/CI 시점 문서-정합성 가드 테스트(에러 코드 전용 `guide-error-code-*` 를 식별자 전반 `guide-identifier-*` 로 확장·리네임)와 그에 딸린 plan/리뷰 산출물이다. 외부 입력, 네트워크, DB, 인증/인가, 암호화 어느 것도 다루지 않으며, 정규식은 신뢰된 저장소 콘텐츠에만 적용되어 ReDoS 등 인젝션류 위험이 실질적으로 없다. env 스캐너는 변수 이름만 수집하고 값은 버려 시크릿 노출 경로가 없으며, 코드 스스로 명시한 "존재 검사 ≠ 방출 검사" 한계는 보안 결함이 아니라 별도 트랙에 등재된 문서-정합성 이슈다. 이전 라운드(`review/code/2026/09/13/14_41_14`, `15_03_06`)의 보안 리뷰 결론(NONE)과 이번 재작성본을 대조해도 새로 도입된 보안 표면은 없다. 보안 관점에서 차단 사유 없음.

## 위험도

NONE
