# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 변경은 애플리케이션 런타임 코드가 아니라 **개발 도구(가드 테스트) 및 문서·plan 산출물**이다:

- `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 삭제 (리네임의 일부)
- `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 신규 — 유저 가이드(MDX 문서)가
  적은 UPPER_SNAKE 식별자(에러 코드·환경변수 이름)가 `codebase/backend/src` · `codebase/packages`
  소스 및 `.env.example`/compose 파일에 실재하는지 vitest 로 검증하는 정적 스캐너
- `PROJECT.md`, `plan/in-progress/*.md`, `review/consistency/**` — 문서/트래커/리뷰 산출물

이 스캐너는 CI/로컬 테스트 실행 시점에 **저장소 내부의 신뢰된 파일**(개발자가 커밋한 MDX 문서,
backend/packages 소스, `.env.example`, compose 파일)만 읽고 정규식으로 토큰을 추출해 집합 연산을
하는 순수 함수다. 외부 네트워크 요청, DB 접근, 사용자 입력 처리, 인증/인가 로직이 전혀 없다.

## 발견사항

- **[INFO]** 정규식 기반 토큰 추출은 신뢰된 저장소 콘텐츠에만 적용되어 ReDoS 위험이 사실상 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `UPPER_SNAKE`,
    `FIELD_TABLE_NAME`, `CODE_FIELD`, `BACKTICK`, `collectSourceTokens`/`collectEnvDeclarations`
    내부 `envLine`/`composeLine` 정규식
  - 상세: `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 형태는 그룹 반복마다 리터럴 `_`를
    앵커로 요구하므로 중첩 정량자 간 모호성이 없어 입력 길이에 선형이다(catastrophic
    backtracking 형태 아님). 설령 이차 이상이더라도 입력은 vitest 실행 시점에 개발자가 커밋한
    저장소 콘텐츠(MDX 문서·`.env.example`·compose·backend/packages 소스)로 한정되고 공격자가
    제어 가능한 런타임 요청 경로가 아니므로 실질 위험은 없음
  - 제안: 조치 불필요. 참고용 기록

- **[INFO]** `.env.example`·docker-compose 에서 걷는 것은 변수 **이름**뿐, 값이 아님 — 시크릿 노출 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:collectEnvDeclarations`
    (신규 파일 기준, 게이트 167~189행), 테스트 단언 `expect(envTokens.has("POSTGRES_PASSWORD")).toBe(true)`
    (`guide-identifier-existence.test.ts` 게이트 83행)
  - 상세: `envLine`/`composeLine` 정규식은 `KEY=` / `  KEY:` 좌변만 캡처하고 우측 값은 버린다.
    `.env.example`·compose 파일 자체도 관례상 플레이스홀더 값을 담는 파일이라, 이 스캐너가 실제
    시크릿 값을 코드나 테스트 출력에 옮기지 않는다. 테스트가 `POSTGRES_PASSWORD` 라는 **식별자
    문자열**을 집합에 포함하는지 확인할 뿐, 실제 비밀번호 값과는 무관함
  - 제안: 조치 불필요. `.env.example`에 실제 운영 자격증명이 들어있지 않은지는 별도 관례
    (`spec/conventions/secret-store.md`)의 지속적 관리 대상이며 이번 diff 로 새로 도입된 문제 아님

- **[INFO]** 가드의 알려진 한계(존재 검사 ≠ 방출 검사)는 보안 취약점이 아니라 문서 정확성 문제이며 이미 별도 트랙에서 처리 중
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단 주석 (`## 이 가드가 못 보는 것` — 이전 `guide-error-code-scan.ts`에 있던 동일 주석), 실측 사례 `MAKESHOP_UNRESOLVED_PATH_PARAM`
  - 상세: 이 가드는 "토큰이 backend 소스에 UPPER_SNAKE 문자열로 존재하는가"만 보고, 그 토큰이
    실제로 `output.error.code`로 **방출**되는지는 보지 않는다. 그 결과 에러 메시지 접두로만
    쓰이고 실제로는 다른 공용 에러코드로 폴백되는 토큰도 가이드에 실릴 수 있다. 이는 사용자
    가이드가 실제 API 응답과 어긋날 수 있다는 **문서-구현 정합성** 문제이며, 공격 표면을 열거나
    민감정보를 유출하는 보안 취약점은 아니다. PR 자체가 이 한계를 코드 주석·plan 체크리스트에
    명시했고, `--impl-done` naming_collision CRITICAL로 이미 별도 등재되어 후속 트랙(접두
    대조 축)으로 넘어가 있음(`plan/in-progress/spec-draft-nullable-notation-followups.md`)
  - 제안: 보안 리뷰 관점에서는 조치 불필요. 문서-구현 정합성 트랙에서 계속 추적

- **[INFO]** 신규 코드는 인증/인가/암호화/외부 통신을 전혀 다루지 않음 — 해당 점검 관점은 이 diff 에 적용 대상 없음
  - 위치: 전체 리뷰 대상 파일
  - 상세: SQL/커맨드/LDAP 인젝션, XSS, 경로 탐색, 인증 우회, 세션 관리, 안전하지 않은 해시/암호화,
    민감정보 에러 노출, 취약 의존성 도입 — 모두 이번 변경의 코드 성격(로컬 파일 read + 정규식
    매칭 + Set 연산 + vitest 단언)상 표면이 없음. `path.join(root, rel)`의 `rel`은 하드코딩된
    상수 문자열(`"codebase/backend/.env.example"` 등)이라 경로 탐색 벡터도 아님
  - 제안: 해당 없음

## 요약

이번 diff는 프로덕션 런타임에 영향을 주지 않는 **개발/CI 시점 문서-정합성 가드 테스트**와 그에
딸린 plan/리뷰 산출물이다. 외부 입력, 네트워크, DB, 인증/인가, 암호화 어느 것도 다루지 않으며,
정규식은 신뢰된 저장소 콘텐츠에만 적용되어 ReDoS 등 인젝션류 위험도 실질적으로 없다. 코드에
하드코딩된 시크릿 값도 없고(변수 *이름*만 수집), 에러 메시지·로그에 민감정보를 노출하는 경로도
없다. 코드가 스스로 명시한 "존재 검사 ≠ 방출 검사" 한계는 보안 취약점이 아니라 문서 정확성
이슈이며 이미 별도 트래커 항목으로 등재되어 있다. 보안 관점에서 차단 사유는 없다.

## 위험도

NONE
