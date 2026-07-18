# 보안(Security) 코드 리뷰

## 리뷰 범위 요약

본 변경은 다음으로 구성된다:

1. `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` — 기존 AST 기반
   exhaustiveness 가드의 self-test fixture 보강 (union 타입 선언·객체 프로퍼티 값 형태 추가,
   정규식 리터럴 비오염 케이스 `ghost_regex` 명시 단언). 순수 테스트 코드.
2. `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` — JSDoc 주석 문구만
   "grep 가드" → "AST 가드"로 정정. 코드 동작(런타임 로직) 변경 없음.
3. `plan/in-progress/interaction-type-guard-comment-false-negative.md` — plan 문서 체크박스/서술
   갱신.
4. `review/consistency/2026/07/18/12_04_53/**` — consistency-check 세션 산출물(신규 생성된 리뷰
   리포트 markdown/json 파일들).

애플리케이션 런타임 코드(서버 API, 인증/인가, DB 쿼리, 사용자 입력 처리 경로)에 대한 변경은
전혀 없다. 모든 변경은 (a) 빌드/테스트 시점에만 실행되는 정적 가드 테스트, (b) 순수 주석
텍스트, (c) 문서/plan/리뷰 산출물이다.

## 발견사항

- **[INFO]** `readRepoFile`의 파일 경로 인자는 상수 배열에서만 옴 — 경로 탐색 위험 없음
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:146-149`
    (`readRepoFile`), 호출부 `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` (파일 상단 하드코딩 배열)
  - 상세: `readFileSync(join(__dirname, "../../../../../", relPath), "utf-8"))`은 형태상 경로
    조합이지만 `relPath`가 사용자 입력이 아니라 파일 내 하드코딩된 상수 문자열 배열
    (`REGISTRY_SITES`, `SOURCE_REGISTRY_SITES`)에서만 나온다. 이 파일은 vitest 테스트로만
    실행되며, CI/로컬 개발 환경에서 저장소 자체 소스를 읽는 정적 분석 가드다. 외부 입력이나
    네트워크 요청이 경로에 개입할 여지가 없어 경로 탐색(path traversal) 공격 표면이 아니다.
  - 제안: 조치 불요 — 참고 기록.

- **[INFO]** `ts.createSourceFile`로 파싱하는 소스는 신뢰된 저장소 자체 파일 — 신뢰 경계 없음
  - 위치: `collectCodeStringLiterals` (동일 파일 176-193행)
  - 상세: TypeScript 컴파일러 API로 파싱하는 대상은 (1) 테스트 파일 내 하드코딩된 fixture
    문자열, (2) `REGISTRY_SITES`에 등록된 저장소 소스 파일 자체다. 외부에서 전달되는 미신뢰
    입력을 파싱하는 경로가 아니므로 파서 취약점(예: 악의적으로 조작된 TS 소스로 인한 DoS)이
    실질적 위협 모델에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전체 diff
  - 상세: 5개 리뷰 대상 파일(테스트 코드, 주석 정정, plan 문서, consistency 리포트 markdown/json)을
    전수 확인한 결과 API 키·비밀번호·토큰·인증서 등 시크릿으로 의심되는 하드코딩된 값이 없다.
  - 제안: 조치 불요.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `interaction-type-exhaustiveness.test.ts:256-264`(누락 리스트를 던지는 `Error`)
  - 상세: 테스트 실패 시 던지는 에러 메시지는 등록 사이트 파일 경로(이미 공개된 저장소 상대
    경로)와 enum 값 이름만 포함한다. 이는 CI 로그에만 노출되며 최종 사용자에게 도달하는
    프로덕션 에러 경로가 아니다.
  - 제안: 조치 불요.

## 요약

이번 변경은 프로덕션 런타임 코드가 아니라 (1) 기존 컴파일타임/테스트타임 정적 AST 가드의
self-test fixture 보강, (2) 순수 주석 문구 정정("grep 가드"→"AST 가드", 동작 무변경),
(3) plan/consistency-review 문서 산출물로만 구성된다. 사용자 입력을 처리하는 API 엔드포인트,
인증/인가 로직, DB 쿼리, 외부 시스템 연동, 암호화/해시 처리, 신규 의존성 추가 등 OWASP Top 10
관련 공격 표면이 전혀 포함되지 않는다. 유일하게 "파일 경로 조합"처럼 보이는 `readRepoFile`도
입력이 하드코딩 상수뿐이라 경로 탐색 위험이 없다. 보안 관점에서 우려할 사항이 없다.

## 위험도

NONE
