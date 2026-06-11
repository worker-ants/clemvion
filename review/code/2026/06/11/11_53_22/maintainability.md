# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: codebase/backend/README.md

- **[INFO]** 배포 주의 문장이 단일 문장에 여러 조건을 나열해 가독성이 다소 떨어짐
  - 위치: 추가된 blockquote 라인 (diff +55)
  - 상세: "`JWT_SECRET`·`ENCRYPTION_KEY` 가 미설정이거나 `.env.example` 기본값이면, 또는 `MCP_ALLOW_INSECURE_URL=true` 이면" 처럼 세 조건이 하나의 긴 문장에 묶여 있어 처음 읽는 운영자가 조건 경계를 바로 파악하기 어렵다.
  - 제안: 불릿 목록으로 조건을 분리하거나, 조건 세 개를 짧은 세미콜론 구분 목록으로 표기. 예시: "다음 상황에서 `assertProductionConfig` 가 부팅을 거부합니다: (1) `JWT_SECRET`/`ENCRYPTION_KEY` 미설정 또는 기본값, (2) `MCP_ALLOW_INSECURE_URL=true`."

### 파일 2: codebase/backend/src/common/config/production-guards.spec.ts

- **[INFO]** `parseEnvExampleValue` 헬퍼가 `describe` 블록 내부에 인라인으로 정의되어 있어, 향후 다른 키 검증 테스트 추가 시 재사용 범위가 명시적으로 제한됨
  - 위치: `blacklist Set sync` describe 내 `parseEnvExampleValue` 함수 정의 (전체 파일 431-437행)
  - 상세: 현재 이 describe 에서만 쓰이므로 지금 위치가 적절하나, 추가 키(예: `MAIL_*` 시크릿) 검증 시 describe 스코프 밖으로 이동해야 하는 이동 비용이 발생. 동일 패턴의 파싱 함수가 미래에 중복될 수 있다.
  - 제안: 현 범위에서는 문제없음. 향후 다른 키 검증 케이스가 추가되면 파일 상단 테스트 유틸리티로 승격할 것.

- **[INFO]** `process.env.JWT_SECRET` 원복 로직이 `try/finally` 패턴으로 올바르게 처리되고 있으나, `delete` + restore 패턴이 반복될 경우 중복 발생 가능성 있음
  - 위치: `INSECURE_JWT_SECRETS contains the jwt.config.ts dev fallback` 테스트 (전체 파일 448-462행)
  - 상세: 현재 env 조작 테스트는 이 케이스 하나뿐이라 중복이 아니지만, 유사 env 조작 케이스가 늘어날 경우 `withEnvOverride(key, value, fn)` 스타일 헬퍼 추출을 고려할 수 있다.
  - 제안: 현 상태에서 중복 없음. 향후 env 조작 테스트가 두 곳 이상 생기면 헬퍼로 추출.

- **[INFO]** `it.each` 와 일반 `it` 이 혼재하는 패턴이 파일 전반에 걸쳐 일관되게 적용되고 있으며, 새로 추가된 `isFlagOn` describe 도 동일 패턴을 따르고 있어 일관성 양호
  - 위치: 전체 파일
  - 상세: 기존 `MCP_ALLOW_INSECURE_URL` describe 의 `it.each` 패턴과 신규 `isFlagOn` describe 의 `it.each` 패턴이 동형. 컨벤션 일관성 유지됨.
  - 제안: 해당 없음.

### 파일 3: codebase/backend/src/common/config/production-guards.ts

- **[INFO]** `@throws` JSDoc 태그가 `assertProductionConfig` 에만 추가되고 `fail` 내부 함수(로컬 `never` 반환)에는 없음 — 이는 올바른 설계이나, `fail` 함수 이름 자체가 일반적 용어라 향후 다른 "fail" 패턴(e.g. 로깅 실패)과 혼동 가능성이 미미하게 존재
  - 위치: `assertProductionConfig` 내부 `fail` 상수 (전체 파일 610행)
  - 상세: `fail` 은 스코프가 함수 내부로 제한되므로 실제 충돌 위험은 없음. 의도는 명확하다.
  - 제안: 현 상태 유지. 필요 시 `failGuard` 또는 `rejectBoot` 같은 더 도메인 특화된 이름으로 변경 가능하나 필수 아님.

- **[INFO]** `MIN_JWT_SECRET_LENGTH = 32` 상수에 32 의 근거(바이트 기준, HMAC-SHA256 최소 권장 길이)가 줄 옆 주석으로 설명됨
  - 위치: 전체 파일 594행
  - 상세: 주석이 "약한 secret 무차별 대입 방어(CWE-521)" 으로 충분히 의도를 설명. 매직 넘버 문제 없음.
  - 제안: 해당 없음.

## 요약

이번 변경은 production fail-closed 가드의 테스트 커버리지를 강화하고 문서화를 보완하는 방어적 개선이다. 세 파일 모두 기존 코드베이스의 네이밍·포맷·주석 컨벤션을 일관되게 따르며, 새로 추가된 `isFlagOn` describe 블록은 기존 `it.each` 패턴과 동형으로 작성되어 가독성이 높다. `blacklist Set sync` describe 의 `parseEnvExampleValue` 헬퍼와 env 원복 `try/finally` 패턴은 현재 범위에서 중복 없이 명확하다. README 의 배포 주의 문장이 단일 문장에 세 조건을 압축해 초독 부담이 다소 있으나 전반적인 유지보수성에 영향을 주는 수준은 아니다. 전체적으로 유지보수성 관점에서 심각한 문제는 없다.

## 위험도

NONE
