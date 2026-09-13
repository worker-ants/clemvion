# 보안(Security) 코드 리뷰

## 리뷰 범위 및 검증 방법

`git diff --stat origin/main...HEAD -- codebase/ CHANGELOG.md PROJECT.md plan/` 로 실제 코드
diff 를 확인했다(9 files, +770/-393). 이번 changeset 은 애플리케이션 런타임 코드가 아니라
**개발 도구(가드 테스트) 및 문서·plan 산출물**이다:

- `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 삭제
- `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 신규 — 유저 가이드(MDX)가
  적은 UPPER_SNAKE 식별자(에러 코드 + 환경변수)가 `codebase/backend/src` · `codebase/packages`
  소스 및 `.env.example`/`docker-compose*.yml` 에 실재하는지 vitest 로 검증하는 정적 스캐너
  (문맥 게이팅 제거 → 백틱 전수 축 + 외부 어휘 허용목록 4강제로 재설계)
- `guide-sanitized-message-parity.test.ts` — 자매 파일명 참조 주석 1줄 갱신
- `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/*.md` — 문서/트래커 갱신

이 PR 은 이미 3라운드의 `/ai-review`(`review/code/2026/09/13/{14_41_14,15_03_06,15_24_12}`)를
거쳤고 세 라운드 모두 security 관점 위험도는 NONE 이었다. 이번 라운드 대상 diff 에 그 세 라운드
이후로 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 를 추가로 바꾼 커밋
(`b75fe0ace`)이 포함되므로, 두 핵심 소스 파일을 다시 전문 `Read` 하여 직접 재검증했다(뮤테이션
없음 — 읽기만 수행, `git status --short` 로 워크트리 무변경 확인).

## 발견사항

- **[INFO]** 정규식 기반 토큰 추출은 신뢰된 저장소 콘텐츠에만 적용되어 ReDoS 위험이 사실상 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `UPPER_SNAKE`
    (`"[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"`), 이를 사용하는 `FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK`,
    `collectSourceTokens`/`collectEnvDeclarations` 내부 `envLine`/`composeLine`
  - 상세: 각 반복 그룹이 리터럴 `_` 를 앵커로 요구해 중첩 정량자 간 모호성이 없다 — 입력
    길이에 선형이며 catastrophic backtracking 형태가 아니다. 설령 이차 이상이더라도 입력은
    vitest 실행 시점에 개발자가 커밋한 저장소 콘텐츠(MDX 문서·`.env.example`·
    `docker-compose*.yml`·backend/packages 소스)로 한정되고 공격자가 제어 가능한 런타임 요청
    경로가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** env/compose 선언처 수집기는 변수 **이름**만 걷고 값은 버린다 — 시크릿 노출 아님
  - 위치: `guide-identifier-scan.ts:192-214`(`collectEnvDeclarations`) — `envLine`/`composeLine`
    정규식이 `=`/`:` **좌변만** 캡처그룹(`m[1]`)으로 반환하고 우변 값은 정규식에 포함되지도
    않는다. 테스트 단언 `guide-identifier-existence.test.ts:90` (`expect(envTokens.has
    ("POSTGRES_PASSWORD")).toBe(true)`)도 식별자 문자열 존재 여부만 확인한다.
  - 상세: `.env.example`/`docker-compose*.yml` 자체가 관례상 플레이스홀더 값만 담는 파일이고,
    이 스캐너는 그 값을 코드·테스트 출력·리포트 어디로도 옮기지 않는다. `git diff` 전수 확인
    결과 이번 changeset 은 `.env.example`/compose 파일 본문을 전혀 수정하지 않았다(스캐너 코드만
    추가).
  - 제안: 조치 불필요.

- **[INFO]** 경로는 전부 하드코딩된 상수 — 경로 탐색(path traversal) 벡터 없음
  - 위치: `guide-identifier-existence.test.ts:30-58` — `readIfPresent("codebase/backend/.env.example")`
    등, `path.join(root, rel)` 의 `rel` 인자
  - 상세: `rel` 은 소스에 리터럴로 박힌 문자열뿐이고 사용자·외부 입력을 경유하지 않는다.
    `composeTexts` 필터는 `fs.readdirSync(root)` 결과에 `/^docker-compose.*\.ya?ml$/` 를
    적용하므로 저장소 루트 밖으로 나갈 수 없다(디렉터리 진입 없이 파일명만 필터).
  - 제안: 해당 없음.

- **[INFO]** 가드의 알려진 한계("존재 검사 ≠ 방출 검사")는 보안 취약점이 아니라 문서-구현
  정합성 문제이며 별도 트랙에서 이미 추적 중
  - 위치: `guide-identifier-scan.ts:53-76` (`## 이 가드가 못 보는 것` 주석), 실측 사례
    `MAKESHOP_UNRESOLVED_PATH_PARAM`
  - 상세: 이 가드는 "토큰이 소스·env 선언처에 UPPER_SNAKE 문자열로 존재하는가"만 보고, 그
    토큰이 실제로 `output.error.code` 로 **방출**되는지는 보지 않는다. 에러 메시지 접두로만
    쓰이고 다른 공용 코드로 폴백되는 토큰도 가이드에 실릴 수 있다. 이는 사용자 가이드가 실제
    API 응답과 어긋날 수 있다는 문서-구현 정합성 문제이며, 공격 표면을 열거나 민감정보를
    유출하는 것은 아니다. `--impl-done`(`review/consistency/2026/09/13/11_33_51`) naming_collision
    CRITICAL 로 이미 별도 등재돼 있고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    가 후속 축(접두 대조)을 추적한다.
  - 제안: 보안 관점 조치 불요. 문서-구현 정합성 트랙에서 계속 추적.

- **[INFO]** 신규 코드는 인증/인가/암호화/외부 통신/사용자 입력 처리를 전혀 다루지 않음
  - 위치: `guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` 전체
  - 상세: SQL/커맨드/LDAP 인젝션, XSS, 인증 우회, 세션 관리, 안전하지 않은 해시/암호화, 민감정보
    에러 노출, 취약 의존성 도입 — 모두 이번 변경의 코드 성격(로컬 파일 read + 정규식 매칭 +
    Set 연산 + vitest 단언)상 표면이 없다. `guide-identifier-scan.ts` 는 `import` 문이 0개인
    순수 모듈이고, 신규 외부 패키지·`package.json`/lockfile 변경도 diff 에 없다(확인 완료).
  - 제안: 해당 없음.

- **[INFO]** `CHANGELOG.md`/`PROJECT.md`/`plan/**` 문서 diff 에 시크릿·자격증명 패턴 없음
  - 위치: `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/*.md` 전체 diff
  - 상세: `password|secret|token|api[_-]?key|BEGIN (RSA|PRIVATE)|AKIA` 로 diff 를 grep 한 결과
    매치는 `POSTGRES_PASSWORD`(변수 이름 언급)·`rotate-bot-token`(기능명) 등 식별자/기능명
    문자열뿐이고 실제 비밀 값은 없다.
  - 제안: 해당 없음.

## 요약

이번 diff 는 프로덕션 런타임에 영향을 주지 않는 개발/CI 시점 문서-정합성 가드 테스트(구
`guide-error-code-*` → 신 `guide-identifier-*`, 문맥 게이팅 제거 후 백틱 전수 축 + 환경변수
축 + 외부 어휘 허용목록 4강제로 재설계)와 그에 딸린 CHANGELOG/PROJECT.md/plan 산출물이다. 외부
입력, 네트워크, DB, 인증/인가, 암호화 어느 것도 다루지 않으며 정규식은 신뢰된 저장소 콘텐츠에만
적용되어 인젝션류 위험이 실질적으로 없다. 환경변수 선언처 수집기는 변수 **이름**만 수집하고
값은 다루지 않으므로 시크릿 노출 경로가 아니며, 경로는 전부 하드코딩 상수라 경로 탐색 벡터도
없다. 코드가 스스로 명시한 "존재 검사 ≠ 방출 검사" 한계는 보안 취약점이 아니라 문서 정확성
이슈이며 이미 별도 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md`)으로
등재돼 추적 중이다. 이전 3라운드의 security 리뷰 결론(NONE)과 일치하며, 이번 라운드의 추가 수정
(라운드 3 fix 커밋 `b75fe0ace`)도 보안 관점에서 새로운 위험을 만들지 않았다. 보안 관점에서
차단 사유는 없다.

## 위험도

NONE
