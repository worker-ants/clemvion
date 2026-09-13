# 보안(Security) 코드 리뷰

## 발견사항

해당 없음.

이번 changeset 은 다음으로만 구성된다:

- `CHANGELOG.md`, `PROJECT.md` — 가드 카탈로그 문구 갱신 (문서)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` — 삭제(구 가드)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` — 신규(대체 가드)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` — 주석(자매 파일명 참조) 1줄 수정
- `plan/in-progress/*.md`, `review/consistency/**`, `review/code/**` — 작업 추적·이전 리뷰 산출물

핵심 신규 코드(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)를 직접 열어
아래 8개 관점으로 점검했다.

1. **인젝션**: 스캐너는 저장소 내 로컬 파일(`codebase/backend/src`, `codebase/packages`,
   `.env.example`, `docker-compose*.yml`, `content/docs/**/*.mdx`)만 `fs.readFileSync` 로 동기
   읽어 정규식 매칭한다. 입력은 전부 저장소 자신의 커밋된 텍스트이고 외부 사용자 입력·HTTP
   요청·쉘 명령·SQL·LDAP 질의 경로가 전혀 없다. 정규식은 `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 를
   기반으로 5개(`FIELD_TABLE_NAME`·`CODE_FIELD`·`BACKTICK`·`collectSourceTokens` 의 `\b…\b`·
   `collectEnvDeclarations` 의 두 `^` 앵커 정규식)로 구성되는데, 반복 그룹이 전부 리터럴
   구분자(`_`, `` ` ``, 줄 시작)로 앵커되어 있어 `(a+)+` 류의 중첩 모호 정량자가 없다 —
   ReDoS(파국적 백트래킹) 형태가 아니다. 파일 경로도 테스트 코드에 하드코딩된 상대경로만
   `path.join(root, rel)` 로 결합하며 사용자 입력이 개입하지 않아 경로 탐색(path traversal)
   여지가 없다.
2. **하드코딩된 시크릿**: 없음. 오히려 `collectEnvDeclarations`(guide-identifier-scan.ts:222-244)는
   `.env.example`/compose 텍스트에서 **변수 이름만** 정규식 캡처 그룹으로 추출하고 `=` 뒤
   **값은 애초에 캡처하지 않고 버린다** — 시크릿 값이 산출물(테스트 실패 메시지 등)에 노출될
   경로가 설계상 없다.
3. **인증/인가**: 해당 없음 — 런타임 HTTP 엔드포인트·미들웨어·가드/데코레이터 코드가
   diff 에 없다. 신규 코드는 vitest 로만 실행되는 빌드/CI 시점 정적 스캐너이며 요청 처리
   경로나 세션 관리와 무관하다.
4. **입력 검증**: 스캐너의 "입력"은 저장소에 커밋된 MDX 문서·소스 코드이며 신뢰 경계를
   넘는 사용자 입력이 아니다. 검증 대상 자체가 이 가드의 목적(가이드가 인용한 식별자가
   실재하는지)이므로 별도 새니타이징 이슈는 없다.
5. **OWASP Top 10**: 해당 항목 없음(웹 애플리케이션 런타임 표면이 아님).
6. **암호화**: 해시/암호화 로직 없음. 평문 전송 관련 코드 없음.
7. **에러 처리**: `expect(...).toEqual([])` 형태의 vitest 단언 실패 메시지에는 가이드 파일의
   상대경로·줄 번호·토큰 이름만 포함되며(예: `missing.map(c => \`${c.file}:${c.line} [${c.axis}] ${c.token}\`)`),
   비밀번호·토큰 값·스택트레이스 등 민감정보가 노출되지 않는다. 이 출력은 CI 로그에만
   남고 최종 사용자에게 전달되는 에러 메시지가 아니다.
8. **의존성 보안**: `package.json`/lockfile 변경 없음. import 는 `vitest`(기존 devDependency)와
   Node 내장 모듈(`node:fs`, `node:path`), 동일 폴더 기존 유틸(`tree-walk`, `impl-anchor-parse`)뿐이며
   신규 외부 패키지가 없다.

참고로 이전 라운드(`review/code/2026/09/13/14_41_14`, `15_03_06`)의 security reviewer 도
동일 결론(ReDoS 아님·env 스캔은 이름만 수집하고 값은 버림·"존재≠방출"은 보안이 아니라
정합성 트랙)에 이미 도달해 있으며, 이번 라운드에서 직접 소스를 재확인한 결과도 그와
일치한다. 위 "존재 검사이지 방출 검사가 아니다"라는 한계(guide-identifier-scan.ts:53-76)
자체는 보안 취약점이 아니라 문서-코드 정합성 가드의 커버리지 한계이므로 이 리뷰의 범위
밖으로 판단한다.

## 요약

이번 변경은 유저 가이드(MDX)가 인용한 UPPER_SNAKE 식별자(에러 코드 + 환경변수)가
backend/packages 소스 및 env 선언처에 실재하는지 검증하는 순수 정적 텍스트 스캐너의
리네임·기능 확장(`guide-error-code-*` → `guide-identifier-*`)과 관련 문서·plan·리뷰 산출물
갱신으로 구성된다. 신규 코드는 동기 파일 읽기 + 정규식 매칭만 수행하는 빌드/CI 시점
테스트 도구이며, 외부 입력·네트워크·DB·인증/인가·암호화·시크릿 저장과 접점이 전혀 없다.
정규식은 리터럴 앵커로 구성되어 ReDoS 위험이 없고, env 값은 설계상 캡처되지 않아 시크릿
노출 경로가 없으며, 신규 외부 의존성도 없다. 보안 관점에서 지적할 사항이 없다.

## 위험도

NONE
