# 유지보수성(Maintainability) 리뷰

## 발견사항

### resolveTokenExpiry 함수 — 변경 핵심

- **[INFO]** 함수 책임이 명확하게 유지됨
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 라인 1456–1483
  - 상세: 변경 후에도 "토큰 만료 시각을 epoch ms 로 반환하는 순수 함수" 라는 단일 책임을 지킨다. 3단계 fallback chain(JWT exp → tokenExpiresAt → credentials.expires_at)은 순서가 명확하고 각 분기가 `return`으로 즉시 탈출하므로 중첩 깊이가 최대 1이다. 복잡도 증가는 최소화되어 있다.
  - 제안: 현 상태 양호. 별도 조치 불필요.

- **[INFO]** 인라인 주석이 TZ 버그 배경을 충분히 설명함
  - 위치: 라인 1460–1463
  - 상세: "구 코드 KST→UTC 9h 회귀", "TZ-bugged 저장값을 무력화하는 유일한 ground truth" 등 why를 상세히 담고 있어 미래 독자가 이 코드가 왜 존재하는지 즉시 이해할 수 있다. JSDoc의 Precedence 설명과 인라인 주석이 서로 보완적이다.
  - 제안: 현 상태 양호.

- **[INFO]** `creds` 변수의 선언 위치 이동이 가독성을 개선함
  - 위치: diff — `const creds = ...` 가 함수 최상단으로 이동
  - 상세: 기존 코드에서 `creds`는 fallback chain의 세 번째 분기 직전에 선언되어 "이 변수는 마지막 폴백에서만 쓴다"는 오독을 유발했다. 이동 후에는 JWT exp 추출에도 `creds`를 사용하므로 최상단 선언이 논리적으로 맞다.
  - 제안: 현 상태 양호.

- **[WARNING]** `creds` 타입 캐스팅 패턴이 두 곳에 산재함
  - 위치: `cafe24-api.client.ts` 라인 1464, 그 외 동일 파일 내 다른 위치
  - 상세: `(integration.credentials ?? {}) as Cafe24Credentials` 패턴이 이 함수뿐 아니라 동일 파일의 다른 함수에서도 반복된다. 현재 변경 범위에서는 신규 중복을 추가하지 않고 기존 패턴을 그대로 踏襲했으므로 이 변경이 문제를 만든 것은 아니다. 그러나 향후 개선 시점에는 헬퍼 함수(`getCredentials(integration)`)로 추출하면 중복을 제거할 수 있다.
  - 제안: 이번 변경 범위에서는 즉시 수정 불필요. 별도 리팩터링 태스크로 추적 권장.

### parseJwtExp 함수 (신규 파일)

- **[INFO]** 함수가 단일 책임(JWT payload에서 exp 추출)에 충실하고 모든 예외 경로가 null 반환으로 통일되어 있음
  - 위치: `codebase/backend/src/modules/integrations/jwt-exp.ts`
  - 상세: 입력 타입 체크, segment 수 검사, base64url 디코드, JSON 파싱, exp 타입/범위 검사를 5단계로 명확히 구분한다. 각 단계는 early return 패턴으로 작성되어 중첩 깊이 0을 유지한다. 함수 길이는 23줄로 짧다.
  - 제안: 현 상태 양호.

- **[INFO]** JSDoc이 "왜 signature 검증 없이 디코드만 하는가"를 명시적으로 해명함
  - 위치: `jwt-exp.ts` 라인 1–26
  - 상세: 보안 관련 결정(검증 생략 이유), 라이브러리 선택 이유, 반환 규약, spec 참조 링크까지 담고 있다. 향후 담당자가 "왜 검증 안 하지?"라는 의문을 가질 때 코드만 읽어도 답을 찾을 수 있다.
  - 제안: 현 상태 양호.

### 테스트 코드

- **[INFO]** 회귀 테스트 주석의 날짜·버그 체인 설명이 충분함
  - 위치: `cafe24-api.client.spec.ts` 추가된 테스트 블록, `cafe24-token-refresh.processor.spec.ts` 추가된 테스트
  - 상세: `// 2026-05-19 — resolveTokenExpiry 가 JWT exp 를 최우선으로 쓰므로...` 형태의 날짜+버그 체인 주석은 이 테스트가 왜 존재하는지, 어떤 버그를 방어하는지 명확히 알려준다. 기존 프로젝트의 다른 회귀 테스트 스타일과 일관되다.
  - 제안: 현 상태 양호.

- **[INFO]** `makeFakeJwt` 헬퍼 임포트로 테스트 코드 중복 없음
  - 위치: `cafe24-token-refresh.processor.spec.ts` 라인 4
  - 상세: 새로운 테스트가 기존 `__test-utils__/make-fake-jwt` 헬퍼를 재사용하여 인코딩 로직을 중복 작성하지 않는다.
  - 제안: 현 상태 양호.

### 빌드·테스트 로그

- **[WARNING]** lint 단계 실패 — `eslint: command not found`
  - 위치: `_test_logs/lint-20260519-211359.log`
  - 상세: `npm run lint` 시 eslint 바이너리를 찾지 못했다. 이는 로컬 환경 설정 문제(PATH나 node_modules/.bin 누락)로 보이며, 변경된 소스 코드의 문제가 아니다. 그러나 CI에서 동일 환경 재현 시 lint가 누락된 상태로 통과될 수 있어 유지보수 관점에서 확인이 필요하다.
  - 제안: `npx eslint` 또는 `./node_modules/.bin/eslint` 호출로 스크립트 수정 여부 검토. 혹은 npm scripts에서 `eslint` 대신 `node_modules/.bin/eslint`를 절대 경로로 지정.

- **[INFO]** unit(93 tests) 및 e2e(93 tests, 16 suites) 모두 통과
  - 위치: `_test_logs/unit-20260519-212701.log`, `_test_logs/e2e-20260519-212743.log`
  - 상세: 신규 추가된 회귀 테스트를 포함한 전체 테스트가 통과하므로 변경이 기존 동작을 깨지 않음을 확인할 수 있다.
  - 제안: 현 상태 양호.

### .claude/test-stages.sh

- **[INFO]** 스크립트 구조가 단순·일관적
  - 위치: `.claude/test-stages.sh`
  - 상세: 4개의 `cmd_*` 함수가 각 1~2줄이며 함수 길이, 네이밍 컨벤션(`cmd_` 접두사), 포맷이 균일하다. `cd codebase/backend &&` 패턴이 3곳 반복되지만 이 파일의 성격(도구 설정 파일)상 추출 대상은 아니다.
  - 제안: 현 상태 양호.

---

## 요약

이번 변경(`resolveTokenExpiry`에 JWT exp 최우선 소스 추가)은 유지보수성 관점에서 매우 양호하다. 핵심 변경인 10줄의 코드 추가는 단일 책임을 유지하며, why를 명시한 인라인 주석과 JSDoc이 TZ 버그의 배경·근거를 충분히 문서화한다. early return 패턴 덕분에 중첩 깊이와 순환 복잡도가 낮게 유지되며, `creds` 변수 선언 위치 이동은 오독 가능성을 줄인다. 신규 `parseJwtExp` 함수는 짧고 명확한 단일 함수로 분리되어 재사용성과 테스트 용이성을 높인다. 회귀 테스트 주석은 날짜+버그 체인을 담아 기존 프로젝트 컨벤션에 부합한다. 유일한 실질적 우려는 lint 단계의 `eslint: command not found` 오류로, 변경된 코드의 문제는 아니나 환경 설정 점검이 권장된다.

## 위험도

LOW
