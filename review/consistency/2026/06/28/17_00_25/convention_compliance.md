# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`  
대상 영역: `spec/5-system/`  
diff-base: `origin/main`

---

## 변경 범위 요약

워킹트리 HEAD 의 diff(`origin/main` 대비)는 `spec/5-system/` 을 전혀 수정하지 않았다.  
변경된 파일은 모두 `codebase/` 에 국한된다:

| 파일 | 성격 |
|------|------|
| `codebase/backend/src/common/filters/http-exception.filter.ts` | 413 응답 message sanitize (CWE-209) |
| `codebase/backend/src/common/filters/http-exception.filter.spec.ts` | 위의 테스트 보강 |
| `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` | `extractClientIpFromHeaders` 엣지 케이스 테스트 추가 |
| `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` | fail-open 로그레벨 `warn→error` + `extractClientIp` 로컬 함수 제거, 공유 코어 직접 호출 |
| `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` | `extractClientIp` 테스트 `client-ip.spec.ts` 로 이관 |

---

## 발견사항

### [INFO] 413 `PAYLOAD_TOO_LARGE` 응답 message 필드의 고정 문자열 spec 미선언
- **target 위치**: `codebase/backend/src/common/filters/http-exception.filter.ts` — 추가된 `message: 'Request payload too large.'` 분기
- **관련 규약**: `spec/5-system/3-error-handling.md §1.3` (`PAYLOAD_TOO_LARGE` 정의) · `spec/5-system/2-api-convention.md §6` (413 응답)
- **상세**: 구현은 413 응답의 `error.message` 를 내부 body-parser 메시지(`'request entity too large'`) 대신 일반 고정 문구(`'Request payload too large.'`)로 교체해 CWE-209 정보 노출을 차단한다. 이 변경 자체는 기존 규약(에러 봉투 형식, `PAYLOAD_TOO_LARGE` 코드)에 위반이 없다. 다만 413 응답의 `message` 필드 기대값이 `spec/5-system/3-error-handling.md §1.3` 또는 `§2.1` 에 명시되어 있지 않다. 테스트는 `'Request payload too large.'` 를 하드코딩하는데, 규약에 이 문자열이 정의되어 있지 않으면 향후 spec·구현 간 drift 를 감지하기 어렵다.
- **제안**: `3-error-handling.md §1.3` 의 `PAYLOAD_TOO_LARGE` 항목 또는 `§2.1` 에 `"error.message": "Request payload too large."` 및 내부 body-parser 메시지 비echo 원칙(CWE-209)을 한 줄 주석으로 기술하면 spec-impl 일치를 보장할 수 있다. 규약 자체가 없는 상황이므로 spec 갱신이 적절하며, 이번 구현이 올바른 방향이라면 규약이 실태를 반영해야 한다.

---

### [INFO] `extractClientIp` 로컬 함수 export 제거 — `extractClientIpFromHeaders` 공유 코어 위임
- **target 위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — 하단 `export function extractClientIp(...)` 제거, `extractClientIpFromHeaders` 직접 호출로 대체
- **관련 규약**: `spec/5-system/1-auth.md §2.3` (클라이언트 IP 추출 정책 — `TRUST_CF_CONNECTING_IP` 환경변수 기반 분기)
- **상세**: spec §2.3 의 IP 추출 정책(`CF-Connecting-IP` 우선 → `X-Forwarded-For` 첫 항목 → `req.ip` → `req.socket.remoteAddress`)은 `auth/utils/client-ip.ts` 의 `extractClientIpFromHeaders` 가 단일 구현으로 통합됐다. 변경 전에는 `public-webhook-throttle.guard.ts` 에 그 사본(`extractClientIp`)이 있었는데, 이번 PR 이 그것을 제거하고 공유 코어만 사용하도록 정리했다. 명명 규약(`extractClientIpFromHeaders` vs 구 `extractClientIp`) 측면에서도 정식 함수명이 단일화된다. 위반 사항 없음 — 오히려 spec §2.3 의 단일 구현 원칙에 부합하는 개선.
- **제안**: 없음. 현재 상태가 spec 과 정합.

---

### [INFO] fail-open 알람 로그레벨 `warn→error` 변경 — spec 미기재
- **target 위치**: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `this.logger.warn(...)` → `this.logger.error(...)`
- **관련 규약**: `spec/5-system/12-webhook.md` (보안 고려사항) — 해당 spec 에 로그레벨 규약이 별도 존재하는지
- **상세**: 공개 webhook의 `PublicWebhookThrottleGuard` 가 DB 조회 실패 시 fail-open(통과)으로 처리하는데, 이 경우 모니터링 알람이 조기에 발화하도록 로그레벨을 `warn`에서 `error`로 상향했다. spec에 로그레벨 결정이 명시돼 있지 않으며, 이는 구현 세부사항으로 규약 위반이 아니다.
- **제안**: 없음. 로그레벨은 spec 명세 범위 밖의 구현 결정이다.

---

## 요약

검토 대상 diff 는 `spec/5-system/` 변경이 없고 `codebase/` 만 수정한 impl-done 검토다. 명명 규약·API 응답 봉투 포맷·에러 코드 표기(`UPPER_SNAKE_CASE`)·audit-actions 구조 등 핵심 정식 규약과 충돌하는 항목은 발견되지 않았다. 413 응답 `error.message` 의 고정 문구가 spec 에 문서화되지 않은 것이 사소한 spec-impl drift 위험으로 존재하나, 이번 구현 방향(내부 메시지 비echo)은 `spec/5-system/4-execution-engine.md §7.5.2` · `12-webhook.md` 등 타 영역에서 일관되게 적용된 "내부 메시지 클라이언트 미전달" 원칙과 일치한다. spec 갱신이 권장되나 차단 사항은 없다.

## 위험도

NONE
