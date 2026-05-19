# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep`
**검토 대상**: Cafe24 `cafe24-api.client.ts` 토큰 lifecycle 로그 보강 (plan: `cafe24-token-lifecycle-logs.md`)
**검토 일시**: 2026-05-19

---

## 발견사항

### [INFO] sanitizeLastErrorMessage import 경로 — re-export 경유 사용 중
- **target 위치**: `cafe24-api.client.ts` line 14
- **충돌 대상**: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (2026-05-19 arch-C2 이전 위치: `modules/integrations/integration-oauth.service.ts`)
- **상세**: `cafe24-api.client.ts`는 `sanitizeLastErrorMessage`를 `modules/integrations/integration-oauth.service.js`에서 import하고 있다. 2026-05-19 arch-C2 리팩터링으로 이 함수는 `shared/utils/sanitize-error-message.ts`로 이동되었고, `integration-oauth.service.ts`는 기존 import 경로 호환을 위해 해당 함수를 re-export하고 있다. 기능적 충돌은 없으나, 신규 로그를 추가하는 이 PR 에서 import 경로를 새 canonical 위치(`../../shared/utils/sanitize-error-message`)로 갱신하면 cross-layer 의존 제거(통합 서비스 모듈 → 공유 유틸)의 완결성이 높아진다.
- **제안**: 기존 import 경로를 `../../../shared/utils/sanitize-error-message.js`로 갱신하는 것을 검토한다. 필수 차단 이슈는 아니며 기능 영향 없음.

---

### [INFO] plan 의 로그 레벨 `log` — NestJS Logger.log() 는 info 레벨
- **target 위치**: `plan/in-progress/cafe24-token-lifecycle-logs.md` §결정사항
- **충돌 대상**: NestJS `Logger` API (`this.logger.log()` = info, `this.logger.debug()` = debug)
- **상세**: plan 문서가 "log (info) 레벨"이라고 명시하며 `this.logger.log()` 사용을 의도하고 있다. 기존 `cafe24-api.client.ts`는 `this.logger.debug()`와 `this.logger.warn()`만 사용 중이며 `this.logger.log()`는 미사용 상태다. NestJS Logger의 `log()` 메서드는 표준 info 레벨이므로 spec 정의와 어긋나지 않는다. 다만 구현 시 `this.logger.log()` 메서드 시그니처가 `this.logger.debug()`와 동일하게 단일 인자 문자열만 받음을 확인하고 일관적으로 적용할 것.
- **제안**: 추가 조치 불필요. 구현 시 기존 패턴(`this.logger.debug()`, `this.logger.warn()`)과 일관된 문자열 포맷(prefix `Cafe24 token …`) 유지.

---

### [INFO] 신규 로그의 mall_id 노출 — spec §4 / SEC-C2 패턴 준수 확인
- **target 위치**: `plan/in-progress/cafe24-token-lifecycle-logs.md` §결정사항 "mall_id 동봉"
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §4`, `SEC-C2` sanitize 정책, `shared/utils/sanitize-error-message.ts`
- **상세**: plan 이 신규 로그에 `integrationId`, `mall_id`, `ttlSec`, `source` 라벨을 포함한다고 명시하고, `access_token` / `refresh_token` 은 절대 노출하지 않는다고 명시한다. 기존 코드의 `sanitizeLastErrorMessage`는 bearer token·client_secret·refresh_token 등의 패턴을 `***`로 마스킹하는 로그 안전망이다. 신규 `this.logger.log()` / `this.logger.debug()` 호출은 템플릿 리터럴로 직접 생성되므로 `sanitizeLastErrorMessage`를 거치지 않는다. `mall_id`는 secret이 아니나, 개발 실수로 `${creds.access_token}` 등이 문자열에 포함되면 sanitize 우회 경로가 생긴다.
- **제안**: 신규 로그 템플릿 리터럴에서 `creds.access_token`, `creds.refresh_token`, `creds.client_secret` 변수를 직접 삽입하지 않도록 코드 리뷰 시 명시적으로 확인한다. `ttlSec`는 `Math.round((expiresAtMs - Date.now()) / 1000)` 같은 숫자값이므로 안전하다.

---

### [INFO] ensureFreshToken 의 null expiresAt 분기 — spec §10.5 단일 진실과 정합
- **target 위치**: `cafe24-api.client.ts:551–563` (ensureFreshToken), `plan/in-progress/cafe24-token-lifecycle-logs.md` §"null tokenExpiresAt 분기"
- **충돌 대상**: `spec/2-navigation/4-integration.md §10.5`, `spec/4-nodes/4-integration/4-cafe24.md §4 step 6`
- **상세**: plan 은 `tokenExpiresAt === null` 분기에 `ttlSec=null source=proactive_null_expiry` 라벨 로그를 추가한다고 명시한다. 현재 코드(line 561)는 `expiresAtMs !== null && expiresAtMs - Date.now() > REFRESH_WINDOW_MS`이면 skip, 그 외(null 포함)는 refresh 진행이다. spec §10.5 도 null은 "needs refresh"로 해석한다고 명시한다. 로그 추가 자체는 분기 로직을 변경하지 않으므로 spec 충돌 없음.
- **제안**: 추가 조치 불필요. 단, 로그 메시지 내 `source` 라벨 구분을 명확히 해 null 경로와 proactive(TTL 임박) 경로를 구별하여 grep 가능하게 할 것(plan 의 의도대로 이미 계획됨).

---

## 요약

이번 구현 착수 대상은 `cafe24-api.client.ts`의 토큰 lifecycle 로그 보강으로, **신규 spec 정의나 요구사항 ID가 없는 순수 운영 진단 코드 추가**다. 검토 결과 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 어디에서도 CRITICAL 또는 WARNING 수준의 기존 spec 충돌은 발견되지 않는다. INFO 수준으로 3건이 확인되었으며, 모두 구현 착수를 차단할 수준이 아니다. 첫 번째는 `sanitizeLastErrorMessage` import 경로가 2026-05-19 arch-C2 이후 re-export 경유 방식임을 인지하고 이번 PR에서 canonical 경로로 함께 갱신할지 여부 결정 권장이며, 두 번째는 NestJS `Logger.log()` 사용 패턴 확인, 세 번째는 신규 템플릿 리터럴 로그가 비밀값(access_token 등)을 직접 삽입하지 않도록 리뷰 시 확인하는 주의사항이다. 기존 sanitize 패턴(`sanitizeLastErrorMessage` + `SECRET_LEAK_PATTERNS`)은 새 로그 경로를 직접 통과하지 않으므로, 구현 시 새 로그 템플릿에 민감 변수를 삽입하지 않는 것을 코드 리뷰에서 명시적으로 점검해야 한다.

## 위험도

LOW
