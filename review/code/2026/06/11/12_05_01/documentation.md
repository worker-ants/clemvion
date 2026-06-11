### 발견사항

- **[INFO]** README 환경변수 섹션에 `OAUTH_STUB_MODE` / `LLM_STUB_MODE` 항목 미열거
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/README.md` L24-34 (환경 변수 섹션)
  - 상세: 배포 주의 callout 에서 `OAUTH_STUB_MODE=true` / `LLM_STUB_MODE=true` 가 production 부팅을 거부함을 명시했지만, 바로 위 환경변수 목록(`DB_*`, `REDIS_*`, … `ENCRYPTION_KEY`)에는 이 두 변수가 없다. `.env.example` L218-226에는 설명 주석과 기본값이 있으므로 README 목록에도 한 줄 추가하면 독자가 목록과 callout 을 함께 읽을 때 연결성이 생긴다.
  - 제안: 환경변수 목록에 `- \`OAUTH_STUB_MODE\` / \`LLM_STUB_MODE\` - 비보안 stub 토글 (production 에서 \`true\` 불허)` 항목 추가.

- **[INFO]** README 환경변수 섹션에 `MCP_ALLOW_INSECURE_URL` 항목 미열거
  - 위치: 같은 파일 L24-34
  - 상세: `MCP_ALLOW_INSECURE_URL` 도 배포 주의 callout 에 등장하지만 목록에 없다. `.env.example` L264에는 항목이 있다.
  - 제안: `- \`MCP_ALLOW_INSECURE_URL\` - MCP SSRF 방어 우회 플래그 (production 에서 \`true\` 불허)` 항목 추가.

- **[INFO]** `production-guards.spec.ts` 파일 최상위 JSDoc 이 변경된 `beforeAll` 패턴을 반영하지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.spec.ts` L1-4 (파일 최상위 블록 주석)
  - 상세: 최상위 docblock 은 "순수 함수라 env 맵을 주입해 전 분기를 검증한다 — 실제 부팅 불필요" 만 설명하고, `blacklist Set sync` describe 블록의 파일 I/O 방어 패턴(`beforeAll` 로 이동한 이유)에 대한 언급이 없다. 파일 상단 주석과 실제 테스트 구성 사이의 간극이 있어 첫 독자가 "이 파일은 전부 순수 함수 테스트" 로 오해할 수 있다.
  - 제안: 최상위 docblock 에 "단, `blacklist Set sync` 블록은 `.env.example` 파일을 읽는다 — `beforeAll` 에서 지연 로드해 Jest 수집 실패를 해당 블록으로 국소화한다." 한 줄 추가.

- **[INFO]** `jwt.config.ts` 에 docstring 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/jwt.config.ts` (전체, 7줄)
  - 상세: `registerAs` 로 반환된 팩토리 함수를 `jwtConfig` 로 export 하지만 모듈 수준 JSDoc 이 없다. `production-guards.spec.ts` L393-395 의 새 주석("jwtConfig 는 registerAs 가 반환한 팩토리 함수 자체이므로 직접 호출하면 설정 객체를 반환한다")은 테스트 파일에만 있고 소스에는 없다. 이번 커밋이 이 사실을 정정한 계기이므로 소스에도 한 줄 JSDoc 을 추가하면 혼동 예방 효과가 높다. 단, 파일이 매우 짧고 코드 자체로 의도가 명확해 누락이 치명적이지는 않다.
  - 제안: `export const jwtConfig = registerAs(...)` 위에 `/** JWT 설정 팩토리. registerAs 가 반환한 함수 자체이므로 직접 호출 시 설정 객체를 반환한다. */` 추가.

### 요약

이번 변경의 핵심 문서화 작업(README 배포 주의 callout 에 `OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `JWT_SECRET<32` 조건 추가 및 불릿 분리)은 실제 `assertProductionConfig` 거부 조건과 정합하도록 잘 수행됐다. 테스트 파일의 인라인 주석도 `beforeAll` 이동 이유와 `registerAs` 동작을 정확히 기술하고 있다. 소규모 보완 사항으로, README 환경변수 목록이 callout 에 언급된 `OAUTH_STUB_MODE`/`LLM_STUB_MODE`/`MCP_ALLOW_INSECURE_URL` 를 포함하지 않아 callout 과의 연결성이 떨어지며, `jwt.config.ts` 소스에는 테스트 주석이 정정한 `registerAs` 동작 설명이 반영되지 않았다. 모두 INFO 수준이며 기능·안전성에 영향을 주지 않는다.

### 위험도
LOW
