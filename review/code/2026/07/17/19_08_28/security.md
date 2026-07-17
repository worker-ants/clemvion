# 보안(Security) Review

- 대상: `git diff origin/main..HEAD`
- 핵심 변경 파일:
  - `codebase/frontend/eslint.config.mjs`
  - `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
  - `review/code/2026/07/17/18_06_36/**`, `review/code/2026/07/17/18_43_17/**` (선행 리뷰 세션 산출물, 신규 파일)

## 변경 개요

이번 diff는 `src/lib/**` → `@/components/**` 레이어 역전을 차단하는 ESLint 커스텀 가드(`no-restricted-imports` / `no-restricted-syntax`)를 강화하는 작업이다.

1. `eslint.config.mjs`: 정적 import/require 경로 매칭에 쓰이던 정규식 리터럴을 `COMPONENTS_PATH_RE` 상수로 통합하고, 백틱(템플릿 리터럴) 형태의 동적 `import()`/`require()` specifier(`import(\`@/components/foo\`)`)까지 selector 를 추가해 이전에 뚫려 있던 우회 경로를 막았다.
2. `eslint-layering-guard.test.ts`: flat config 병합 순서("나중 블록 우선") 재현, 실제 TS 파서 재사용, rule severity(`error`/`2`) 명시적 검증, bare-path·백틱·`import type`·re-export·근접 오탐(`components-legacy`) 등 fixture 커버리지 확대.
3. `review/**`: 앞선 두 코드 리뷰 세션(`18_06_36`, `18_43_17`)의 산출물(SUMMARY/RESOLUTION/reviewer 리포트/상태 JSON) 신규 파일 추가 — 문서 아티팩트로 실행 코드 아님.

이 변경은 애플리케이션 런타임 코드가 아니라 **빌드타임 lint 설정 + 그 설정을 검증하는 테스트**다. 사용자 입력, 네트워크 요청, DB 접근, 인증/세션, 암호화, 외부 시스템 호출 등 보안 공격 표면에 해당하는 요소가 diff 안에 존재하지 않는다.

## 관점별 점검

1. **인젝션 취약점** — 없음. `COMPONENTS_PATH_RE` 는 소스코드 내 고정 문자열 상수이며 사용자 입력이나 외부 데이터로부터 생성되지 않는다. esquery selector 문자열도 상수 조합(`literalSpecifier`/`backtickSpecifier` 헬퍼가 고정 경로 문자열만 삽입)이라 selector 인젝션 여지가 없다. 정규식 자체(`^(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)$`)도 중첩 수량자·backtracking 폭발 패턴이 없어 ReDoS 우려도 없으며, 설령 있더라도 실행 주체가 개발자의 로컬/CI lint 프로세스일 뿐 외부에서 트리거 가능한 입력이 아니다.
2. **하드코딩된 시크릿** — 없음. diff 전체(코드 2파일 + review 산출물 다수)를 API 키/토큰/비밀번호/인증서 패턴으로 검색했으나 매치 없음 (`token` 관련 매치 1건은 리뷰 문서 내 "파서 배선" 등 무관한 한국어 문장).
3. **인증/인가** — 해당 없음. 인증·세션·권한 코드 변경 없음.
4. **입력 검증** — 해당 없음. 런타임에 사용자 입력을 받는 코드가 아니다 (개발 시점 lint 규칙 정의 + 그 규칙을 검증하는 단위테스트).
5. **OWASP Top 10** — 해당 사항 없음. 웹 애플리케이션 요청/응답 경로, 저장소, 세션 관리와 무관.
6. **암호화** — 해당 없음.
7. **에러 처리** — `eslint-layering-guard.test.ts` 의 fail-open 가드가 던지는 `Error` 메시지(`"eslint.config.mjs 에서 ... 찾지 못했습니다"` 등)는 내부 개발자 대상 진단 메시지이며 스택트레이스나 파일 경로 외에 자격증명·세션 토큰·PII 등 민감정보를 포함하지 않는다. 테스트 실행 실패 시 CI 로그에만 노출되고 최종 사용자에게 도달하지 않는다.
8. **의존성 보안** — 신규 의존성 추가 없음. 오히려 주목할 점은, 테스트가 `@typescript-eslint/parser` 를 직접 import 하지 않고 `eslint.config.mjs` 가 이미 로드한 파서 인스턴스를 재사용하도록 설계되었다는 점이다(주석: "frontend 매니페스트에 선언된 의존이 아니라 phantom-dependency 로 깨진다"). 이는 `node-linker=isolated` 환경에서 미선언 전이 의존성(phantom dependency)에 의존하는 것을 피하는 방향으로, 공급망 관점에서 오히려 안전한 설계 선택이다.

## review/** 신규 문서 파일에 대한 부가 확인

`review/code/2026/07/17/18_06_36/**`, `review/code/2026/07/17/18_43_17/**` 는 선행 코드 리뷰 세션의 산출물(SUMMARY.md, RESOLUTION.md, 각 reviewer 리포트, `_retry_state.json` 등)이 신규 파일로 diff 에 포함된 것이다. 절대경로(`/Volumes/project/private/clemvion/...`)가 다수 노출되어 있으나 이는 로컬 개발 환경의 워크트리 경로이며 자격증명·시크릿·개인정보가 아니다. 실행 가능한 코드나 설정이 아니므로 보안 관점에서 조치 불요.

## 발견사항

없음. 이번 diff 범위 안에서 보안 관점의 Critical/Warning/Info 급 발견사항이 확인되지 않았다.

## 요약

이번 변경은 프론트엔드 ESLint 레이어링 가드(빌드타임 정적 분석 규칙)와 그 가드를 검증하는 단위 테스트를 강화하는 작업으로, 런타임 애플리케이션 코드·사용자 입력 처리·인증/인가·암호화·네트워크 통신 등 보안 공격 표면과 전혀 접점이 없다. 정규식·selector 문자열은 전부 고정 상수이며 사용자 제어 입력으로부터 파생되지 않아 인젝션/ReDoS 우려도 없다. 신규 의존성 추가가 없고 오히려 phantom-dependency 를 피하는 방향으로 설계되어 공급망 리스크 관점에서도 중립~긍정적이다. 함께 diff 에 포함된 `review/**` 문서 파일들도 실행 코드가 아닌 리뷰 산출물이며 하드코딩된 시크릿이나 민감정보 노출이 없음을 확인했다.

## 위험도

NONE
