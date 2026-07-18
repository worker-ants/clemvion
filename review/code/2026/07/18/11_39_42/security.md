# 보안(Security) 코드 리뷰

## 리뷰 대상

- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` — AST 가드 테스트에 `scriptKindForFile` 헬퍼, `treeContainsJsx` 헬퍼, self-test fixture 3건 추가
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` — 주석 문구만 변경("grep 가드" → "AST 가드"), 로직 변경 없음
- `plan/in-progress/interaction-type-guard-comment-false-negative.md` — plan 체크리스트 갱신 (문서)

세 파일 모두 **테스트/개발 인프라 코드** 및 **작업 문서**이며, 런타임에 사용자 입력을 처리하는 애플리케이션 경로가 아니다. `interaction-type-registry.ts` 는 상수 값 목록과 컴파일타임 타입 단언만 포함하고, 변경분은 JSDoc 주석 문자열 교체뿐이다.

## 발견사항

해당 diff 범위 내에서 보안 관점의 실질적 발견사항은 없다. 점검한 항목별 근거는 다음과 같다.

- **[INFO]** 파일 경로 조합에 사용자 입력이 개입하지 않음 (경로 탐색 무관)
  - 위치: `interaction-type-exhaustiveness.test.ts` `readRepoFile()` (`join(__dirname, "../../../../../", relPath)`)
  - 상세: `relPath` 인자는 모두 파일 내부에 하드코딩된 상수 배열(`REGISTRY_SITES`, `SOURCE_REGISTRY_SITES`)에서만 오며, 외부/네트워크/사용자 입력 경로가 아니다. 테스트 실행 프로세스 로컬에서만 동작하고 CI/개발자 머신 밖으로 결과가 노출되지 않는다. 경로 탐색(path traversal) 공격면이 성립하지 않는다.
  - 제안: 없음(현행 유지 타당).

- **[INFO]** `ts.createSourceFile` 로 임의 소스 파싱 — 코드 실행이 아닌 정적 파싱
  - 위치: `collectCodeStringLiterals`, `treeContainsJsx`
  - 상세: TypeScript 컴파일러 API 의 `createSourceFile` 은 파싱만 수행하고 파싱 대상 코드를 **실행(eval)** 하지 않는다. 대상 소스도 리포지토리 내 고정된 `REGISTRY_SITES` 파일 또는 테스트 내 리터럴 fixture 문자열뿐이라 외부에서 주입 가능한 입력이 없다. 코드 인젝션/임의 코드 실행 위험 없음.
  - 제안: 없음.

- **[INFO]** 신규 정규식 리터럴 미도입, ReDoS 무관
  - 위치: self-test fixture 내 `"const tag = /regex_only_token/g;"`, `"const userInput = /\\[\\/?user-input\\]/g;"` 등
  - 상세: 이 문자열들은 **파서에 넣을 소스 텍스트**로만 쓰이며 JS 엔진이 정규식으로 컴파일·실행하지 않는다(AST 노드로만 취급). 즉 런타임에 정규식이 평가되지 않으므로 ReDoS 벡터가 아니다. 기존 grep 기반 가드에 있던 `new RegExp(...)` 동적 정규식 생성 로직도 이번 diff 로 AST 기반 리터럴 수집으로 대체되어 오히려 이전보다 정규식 관련 표면이 줄었다.
  - 제안: 없음.

- **[INFO]** 하드코딩 시크릿/자격증명 없음
  - 위치: 3개 파일 전체
  - 상세: API 키, 토큰, 비밀번호, 인증서 등 민감정보 문자열이 diff 에 없다. `interaction-type-registry.ts` 의 상수 배열은 도메인 enum 값(`"form"`, `"buttons"` 등)일 뿐이다.
  - 제안: 없음.

- **[INFO]** 인증/인가, 암호화, 에러 처리(사용자 노출), 의존성 변경 해당 없음
  - 위치: 전체 diff
  - 상세: 이번 변경은 프런트엔드 테스트 도구(빌드타임 exhaustiveness 가드)와 주석/문서 수정뿐이며, 인증/세션/암호화 로직이나 `package.json` 의존성 변경을 포함하지 않는다. 테스트 실패 시 `throw new Error(...)` 로 던지는 메시지는 CI 로그/개발자 콘솔에만 노출되는 내부 파일 경로·enum 값이며, 자격증명이나 시스템 내부 스택 정보가 아니다.
  - 제안: 없음.

## 요약

이번 변경은 프런트엔드 `WaitingInteractionType`/`ConversationTurnSource` exhaustiveness 를 검사하는 **AST 기반 테스트 가드**에 `.tsx` 확장자 인지(`scriptKindForFile`) 기능과 self-test fixture 를 보강하고, 관련 주석 문구를 "grep 가드"에서 "AST 가드"로 정정한 순수 테스트/문서 변경이다. 모든 입력(파일 경로, 파싱 대상 소스)이 리포지토리 내 하드코딩된 상수이거나 테스트 리터럴 fixture 이며, 외부·사용자 입력이 개입하는 경로가 전혀 없다. 시크릿 하드코딩, 인젝션, 인증/인가, 암호화, 에러 노출, 의존성 취약점 등 OWASP Top 10 관점의 공격면이 이번 diff 로 신설되거나 확대되지 않았다.

## 위험도

NONE
