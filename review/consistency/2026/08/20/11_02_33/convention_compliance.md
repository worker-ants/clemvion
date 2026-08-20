### 발견사항

이번 검토 대상(`spec/5-system/`, diff-base `origin/main`)의 실제 변경분은 `origin/main...HEAD` 두 커밋 — `45ba377`("`token` 계열이 값·키 두 축에서 마스킹 없이 나가고 있었다")과 그 리뷰 후속 `e2193f8`("미러라고 써 놓고 회귀 테스트가 없었다 — 리뷰 WARNING 5건 처분") — 으로, spec 쪽은 `2-api-convention.md`(§2.2 신규 예외 행 1건) · `11-mcp-client.md`(§8.3 표 + Rationale 각주) · `14-external-interaction-api.md`(§3.1 EIA-NX-03 · §11 WS 매핑 표 · §R12 · §R17 캐비엇 1문단)에 한정된다. 나머지는 backend 코드(`sanitize-error-message.ts` / `websocket.service.ts` / `mcp-error-codes.ts` + 각 `.spec.ts`)다. `spec/conventions/**` 대비 명명·출력 포맷·문서 구조·API 문서·금지 패턴 다섯 관점을 모두 점검했으며, **위반 항목을 발견하지 못했다.**

확인한 정합성 근거(위반 아님 — cross-check 결과):

- **`2-api-convention.md` §2.2 신규 예외 행** (`/api/external/{resource}` 인증 family 전용 네임스페이스): 이미 `14-external-interaction-api.md` R11("외부 endpoint 경로 prefix 분리")에 있던 결정을 §2.2 명명 규칙 표로 정식 승격한 것이다. 바로 위 "예외 — RPC-style sub-channel action" 행과 동일한 서술 포맷(`**예외 — <제목>**: 설명 | 예시`)을 그대로 따르고, 오히려 예시 칸에 `(좌측 예시 참조)` 대신 실제 URL 두 개를 채워 표 규약(예시 칸=실 예시)에 더 충실하다. 리소스명 `executions` 도 §2.2 "복수형 명사" 규칙 준수.
- **`11-mcp-client.md` §8.3·Rationale**(MCP 전용 추가 패턴 소멸, `MCP_EXTRA_SECRET_PATTERNS` 훅만 잔존): 실 코드(`codebase/backend/src/modules/mcp/mcp-error-codes.ts`)에서 `MCP_EXTRA_SECRET_PATTERNS: … = []`, `shared/utils/sanitize-error-message.ts`의 `SECRET_LEAK_PATTERNS`가 `[A-Za-z0-9_-]*token`으로 `token`/`access_token`/`csrf_token`/`csrfToken` 전 계열을 커버함을 diff로 직접 확인 — spec 서술과 정확히 일치한다. 상수명 `MCP_EXTRA_SECRET_PATTERNS`/`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`은 `error-codes.md`의 대상(`error.code` 값의 의미 기반 명명)이 아니라 TS 모듈 상수라 그 규약의 적용 범위 밖이다.
- **`14-external-interaction-api.md` §R12**(`AuthConfig.config.algorithm`로 출처 정정): `12-webhook.md` §4.2/§4.3에 이미 문서화된 `config.algorithm`/`config.header` 표기와 정확히 부합 — 오히려 "trigger config 에 보관"이라는 기존의 부정확한 서술을 실제 소유자(`AuthConfig.config`, `V066__trigger_config_strip_inline_auth.sql` 로 inline 필드 제거됨)로 정정한 drift 해소다.
- **§R17 신규 캐비엇 문단**(`token` 계열 확장 (2026-08-17)): 새 top-level Rationale ID를 만들지 않고 기존 R17 카탈로그 안의 병렬 불릿으로 추가했다 — R17 자체가 이미 다수의 독립 불릿(`언제 가리는가` · `nodeOutput 일반 키 allowlist` 등)을 그런 형태로 쌓아온 문서 관례이므로 정합. 이 문단은 review 라운드에서 "R17의 `token` 계열이 닫혔다는 서술이 구현(`maskSensitiveFields` 축 잔존)보다 넓었다"는 WARNING을 받고 그 턴에 caveat으로 정정된 것으로(`e2193f8a6`), "문서한 보장이 구현보다 넓으면 안 된다" 원칙에 부합하는 사후 수정이다.
- **`swagger.md` §2-1**의 `interaction-token` Bearer scheme 서술은 diff 범위 밖이며 이번 변경과 모순 없음(기존 상태 유지).
- **금지 패턴 점검**: `spec/conventions/**`가 명시 금지하는 항목(예: `audit-actions.md`의 prefix 없는 action, `secret-store.md`의 IV 재사용/평문 로그, `cafe24-api-catalog/_overview.md`의 `Promise.all` 사용 등) 중 이번 diff가 재현하는 것은 없다.

관찰(비-위반, 참고용 INFO):
- **[INFO] R17 카탈로그 비대화**: `14-external-interaction-api.md` §R17이 이번 라운드까지 포함해 계속 불릿을 누적하며 이제 스펙 파일 중 가장 긴 단일 Rationale 항목이 됐다(회고: consistency `--spec` 모드 예산이 이 파일 하나로 상당량을 소모하는 사례가 과거에도 있었다). 지금 당장 conventions 위반은 아니나(3섹션 구성 자체는 유지), 다음에 또 불릿이 추가될 때는 별도 convention 문서(`spec/conventions/egress-masking.md` 류)로 분리하는 안을 검토할 가치가 있다. — target 수정 불필요, 향후 참고.
