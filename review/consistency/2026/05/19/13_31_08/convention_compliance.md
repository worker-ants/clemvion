# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-prep`
대상 작업: Cafe24 token lifecycle 로그 보강 (cafe24-token-lifecycle-logs-196308)
변경 파일: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
신규 spec / 식별자: 없음

---

## 발견사항

### INFO-1 — 기존 sanitize 패턴 계속 준수 필요 (단순 확인)
- target 위치: 추가될 `ensureFreshToken` / `refreshAccessToken` / `executeWithRateLimit` 내 log/debug 구문
- 위반 규약: `spec/conventions/node-output.md` Principle 7 절대 echo 금지 항목 ("자격증명 — password, apiKey, token, secret, oauth credentials") 및 기존 코드 내 SEC-C2 주석 패턴
- 상세: 현재 코드는 `sanitizeLastErrorMessage` 를 이미 두 곳 (`refreshAccessToken` L803, `executeWithRateLimit` L1201) 에서 일관되게 적용하고 있다. 계획 설명에서 "기존 sanitize 패턴 유지" 를 명시하고 있으므로 위반이 아닌 확인 사항. 신규 log 라인에 `access_token` / `refresh_token` 값이 직접 포함되지 않는 한 규약을 준수한다.
- 제안: `ttlSec` 계산 시 `resolveTokenExpiry` 결과와 `Date.now()` 의 차를 초 단위로 변환해 기록하면 충분. `access_token` / `refresh_token` 를 문자열로 포함하는 template literal 금지. 진단 레이블(`integrationId / mall_id / ttlSec / source`)만 포함하는 패턴은 기존 L672·L753 의 `logger.debug`/`logger.warn` 형식과 일치하므로 별도 조치 불요.

### INFO-2 — `source` 라벨 값은 기존 `Cafe24RefreshJobData['source']` 타입 범위 사용 권장
- target 위치: 추가될 `ensureFreshToken` log 구문의 `source` 라벨
- 위반 규약: 직접 위반 규약은 없음; `spec/conventions/cafe24-api-metadata.md` §7 MCP Bridge 매핑의 식별자 일관성 원칙에서 유추
- 상세: `refreshViaQueue` 의 `source` 파라미터는 이미 `'proactive' | 'reactive_401' | 'background'` 세 값으로 정의되어 있다. 새 log 라인이 임의의 문자열 리터럴(예: `'ensure_fresh'`)을 신규 도입하면 식별자 불일치가 생긴다.
- 제안: `source` 라벨은 기존 `Cafe24RefreshJobData['source']` 를 재사용하거나, log 전용 문자열을 명시적으로 주석에 기록할 것. 신규 enum 값이 필요하면 `cafe24-token-refresh.constants.ts` 의 타입 정의와 동시에 갱신한다.

---

## 요약

본 변경은 코드 내부에 `log/debug` 호출만 추가하는 purely-observability 변경으로, 신규 spec / API / DTO / 카탈로그 row / i18n 키 등 어떤 정식 규약 대상 식별자도 도입하지 않는다. 검토한 모든 정식 규약(`node-output.md`, `cafe24-api-metadata.md`, `swagger.md`, `migrations.md`, `i18n-userguide.md`, `cafe24-api-catalog/`, `cafe24-restricted-scopes.md`)과의 직접 충돌은 없다. INFO-1·INFO-2 두 건은 구현 시 주의할 코딩 관행 확인 수준이며, 기존 sanitize 패턴과 기존 `source` 타입을 그대로 따르면 자동으로 해소된다.

---

## 위험도

NONE
