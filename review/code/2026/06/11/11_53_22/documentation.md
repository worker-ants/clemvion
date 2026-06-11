# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[INFO]** `README.md` 배포 주의 블록이 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 거부 조건을 누락함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/README.md` line 36
  - 상세: 추가된 주의 블록은 `JWT_SECRET`·`ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL` 세 가지 거부 조건만 열거한다. 그러나 `assertProductionConfig` 는 `OAUTH_STUB_MODE=true` 와 `LLM_STUB_MODE=true` 도 부팅을 거부하며, `.env.example` 에도 `!! Boot fails if NODE_ENV=production AND OAUTH_STUB_MODE=true. !!` 주석이 명시되어 있다. README 와 실제 가드 동작 사이에 불일치가 존재한다.
  - 제안: 주의 블록을 다음과 같이 확장. `JWT_SECRET`·`ENCRYPTION_KEY` 미설정/예시값, `OAUTH_STUB_MODE=true`, `LLM_STUB_MODE=true`, `MCP_ALLOW_INSECURE_URL=true` 다섯 조건을 모두 나열하거나, 간결하게 "stub 모드 플래그(OAUTH_STUB_MODE, LLM_STUB_MODE), 예시/미설정 secret(JWT_SECRET, ENCRYPTION_KEY), SSRF 우회 플래그(MCP_ALLOW_INSECURE_URL)" 를 포함.

- **[INFO]** `jwt.config.ts` 에 공개 함수·export 에 대한 JSDoc 없음 (이번 변경과 간접 연관)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/jwt.config.ts` (전체)
  - 상세: `production-guards.spec.ts` 가 이번 변경에서 `jwtConfig` 를 직접 import 해 테스트하며, 그 함수가 `registerAs` 래퍼 내부에서 dev fallback(`'dev-jwt-secret'`)을 반환한다는 사실이 테스트에 중요한 전제로 쓰인다. 그러나 `jwt.config.ts` 에는 이 fallback 값이 블랙리스트 의무와 연결되어 있다는 주석이 전혀 없다.
  - 제안: `jwtConfig` 함수 또는 파일 상단에 "dev fallback(`'dev-jwt-secret'`)은 `production-guards.ts` `INSECURE_JWT_SECRETS` 와 동기화되어야 한다" 는 주석 추가. 동기화 의무를 단방향(production-guards → 테스트 검증)이 아닌 양방향(소스 파일 주석)으로 명시하면 미래 변경자가 놓치지 않는다.

- **[INFO]** `blacklist Set sync` 테스트 describe 블록에서 `parseEnvExampleValue` 함수 문서 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.spec.ts` line 202–207 (추가된 블록)
  - 상세: `parseEnvExampleValue` 는 describe 블록 상단 코멘트에서 "행 형식: `KEY=<value>` (주석 아님, 미주석 행만)" 라고 설명하나, 파싱 정규식이 `^KEY=(.+)$` 형태로 인라인 `#` 주석이 붙은 행도 값에 포함시킬 수 있다(`ENCRYPTION_KEY=xxx # comment` → `xxx # comment` 로 파싱). `.env.example` 의 실제 형식과 일치하는지 확인이 필요하다. 이 동작이 의도적이라면 주석에 명시해야 한다.
  - 제안: 정규식 또는 trim 로직이 인라인 주석을 처리하지 않는다는 점을 명시하거나, 필요시 `^KEY=([^#\s]+)` 형태로 보강. 혹은 현재 `.env.example` 에 인라인 주석이 없음을 확인했다면 그 전제를 주석에 기록.

- **[INFO]** `MIN_JWT_SECRET_LENGTH` 상수에 대한 JSDoc 단선(single-line) 주석이 `@see` 참조 없이 독립 표현됨 — 검토 불필요 수준이나 일관성 차원 언급
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` line 62
  - 상세: `assertProductionConfig` 함수 내부 오류 메시지에서 `MIN_JWT_SECRET_LENGTH` 를 참조하는데, 단선 주석이 값(32)의 근거(CWE-521)를 이미 포함하고 있어 실질적 문제는 없다. 단, 이 상수를 외부 모듈이 import 해 검증에 쓸 경우를 위해 모듈 수준 JSDoc 에 `@since` 또는 spec 참조를 추가하면 좋다.
  - 제안: 현 상태로도 충분하나, `/** production JWT_SECRET 최소 길이 ... @see spec/5-system/1-auth.md */` 형태로 spec 링크 추가 고려.

## 요약

이번 변경은 `production-guards.ts` 의 `assertProductionConfig` 와 `isFlagOn` 에 `@throws`/`@param`/`@returns` JSDoc 태그를 추가하고, `README.md` 에 배포 주의 블록을 삽입하며, 테스트 파일에 블랙리스트 동기화 회귀 방어 테스트를 추가한 것으로 문서화 품질이 전반적으로 양호하다. 모듈 수준 JSDoc, 상수 주석, 인라인 설명 모두 충분히 작성되어 있다. 다만 `README.md` 의 배포 주의 블록이 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 부팅 거부 조건을 누락해 실제 가드 동작과 불일치하는 점이 유일한 실질적 결함이다. 나머지 발견 사항은 일관성 또는 미래 변경자 안내 개선 수준이며 즉각적 수정 의무는 없다.

## 위험도

LOW
