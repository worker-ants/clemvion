### 발견사항

이번 검토 대상은 `spec/5-system/` 디렉토리 전체이며, `origin/main` 대비 실제 diff 는 `2-api-convention.md`(§2.2 신규 예외 행 1건) · `11-mcp-client.md`(§8.3·Rationale 각주) · `14-external-interaction-api.md`(§3.1 EIA-NX-03·§11 WS 매핑 표·R12) 세 파일, 커밋 `45ba377`("`token` 계열이 값·키 두 축에서 마스킹 없이 나가고 있었다") 한 건에 한정된다. `spec/conventions/**` 대비 명명·출력 포맷·문서 구조·API 문서·금지 패턴 다섯 관점을 모두 점검했으며, 위반 항목은 발견되지 않았다.

확인한 정합성 근거(위반 아님 — cross-check 결과):

- **`2-api-convention.md` §2.2 신규 예외 행** (`/api/external/{resource}` 인증 family 전용 네임스페이스): 이미 `14-external-interaction-api.md` R11("외부 endpoint 경로 prefix 분리")에 존재하던 결정을 §2.2 명명 규칙 표에 정식 등재한 것으로, 바로 위 "RPC-style sub-channel action" 예외 행과 동일한 서술 포맷(`**예외 — <제목>**: 설명 | 예시`)을 따른다. 리소스명 `executions` 도 §2.2 "복수형 명사" 규칙을 그대로 준수한다. 위반 없음 — 오히려 기존 결정을 conventions 표로 승격한 정합화.
- **`11-mcp-client.md` §8.3·Rationale**("MCP 전용 추가 패턴 없음", `MCP_EXTRA_SECRET_PATTERNS` 훅 신설): `codebase/backend/src/modules/mcp/mcp-error-codes.ts:54`에서 `const MCP_EXTRA_SECRET_PATTERNS: ... = []`로 실측 확인. `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts:42`)의 정규식이 실제로 `[A-Za-z0-9_-]*token`을 포함해 `token`/`access_token`/`csrf_token`/`csrfToken` 전 계열을 커버함을 코드로 확인 — spec 서술과 정확히 일치. `error-codes.md`(UPPER_SNAKE_CASE 명명 규약) 대상은 아니고(상수명이지 `error.code` 값이 아님) 위반 소지 없음.
- **`14-external-interaction-api.md` R12**("`AuthConfig.config.algorithm`"로 출처 정정): `spec/1-data-model.md` §2.17 AuthConfig `hmac` 타입 정의(`{ secret, header, algorithm: "sha256"|"sha512" }`, §2.17.2 마스킹 정책에서 `config.algorithm` 평문 노출로 명시)와 정확히 부합. 참조된 `V066__trigger_config_strip_inline_auth.sql`도 `codebase/backend/migrations/`에 실존하며 `migrations.md` §1 명명 규약(`V<번호>__snake_case`)을 준수.
- **`14-external-interaction-api.md` §11 WS 명령 매핑 표 수정**(`execution.stop`/`execution.start` 행 재작성): 수정 전 `execution.start` 행은 파이프(`|`) 3개가 아니라 2개뿐인 마크다운 테이블 형식 오류였다(열 불일치). 수정 후 `6-websocket-protocol.md` §4.6("본 §4.6 의 매핑 표가 권위적이며, 외부 spec 의 §11 표는 이 표와 정합해야 한다")의 표와 주석(`_(WS 명령 §4.2 won't-do)_`) 형식·문구가 정확히 일치하도록 고쳐졌다 — 오히려 기존 비정합을 해소한 개선.
- **`swagger.md` §2-1**의 `interaction-token` Bearer scheme 관련 서술은 이미 등재돼 있고 `14-external-interaction-api.md`의 참조와 모순 없음(diff 범위 밖, 기존 상태 유지 확인).

### 요약

이번 diff(3개 target 파일, 1커밋)는 `spec/conventions/**`의 명명·출력 포맷·API 문서·구조 규약을 위반하지 않았다. 오히려 (1) 기존 `/api/external/*` 예외를 `2-api-convention.md` §2.2 명명 규칙 표로 정식 등재하고, (2) `14-external-interaction-api.md` §11 표의 마크다운 열-불일치 오류를 `6-websocket-protocol.md` §4.6 권위 표와 정합하도록 고치고, (3) HMAC algorithm 필드 소유자를 실제 데이터 모델(§2.17 `AuthConfig`)과 일치시키고, (4) MCP secret redaction 서술을 실제 코드(`SECRET_LEAK_PATTERNS` 정규식, `MCP_EXTRA_SECRET_PATTERNS` 빈 배열)와 정확히 맞춘 정합화 커밋이다. 코드(`mcp-error-codes.ts`, `sanitize-error-message.ts`, `V066` 마이그레이션)까지 대조했을 때 서술과 구현이 어긋나는 지점은 찾지 못했다.

### 위험도
NONE
