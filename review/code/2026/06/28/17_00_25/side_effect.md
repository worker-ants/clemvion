# 부작용(Side Effect) 리뷰 결과

검토 대상: 파일 1~13 (http-exception filter, client-ip, public-webhook-throttle guard, consistency review 산출물)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] `public-webhook-throttle.guard.ts` — `extractClientIp` export 제거로 인한 외부 의존성 영향
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (diff 삭제 블록, L985~993)
- 상세: `export function extractClientIp(...)` 가 파일에서 완전히 제거됐다. 변경된 spec 파일(`public-webhook-throttle.guard.spec.ts`)에서 해당 심볼 import 를 함께 제거했으므로, 이 파일에서의 의존성은 해소됐다. 그러나 이 export 를 다른 모듈(예: hooks 내 다른 파일, e2e 테스트, 제3의 서비스)에서 임포트하고 있었다면 컴파일 오류가 발생한다. diff 에서 제거된 JSDoc 주석("Exported for shared use")은 외부 소비자가 있었음을 시사한다.
- 제안: `extractClientIp` 를 참조하는 다른 파일(특히 `hooks/` 외 영역)이 없는지 코드베이스 전체를 grep 으로 확인해 누락된 import 교체가 없음을 보장한다. 변경된 spec 파일 외 제거가 이미 완결됐다면 위험 없음.

### [INFO] `public-webhook-throttle.guard.ts` — `logger.warn` → `logger.error` 레벨 상향의 모니터링 부작용
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L955~956
- 상세: trigger 조회 실패 시 로그 레벨이 `warn` 에서 `error` 로 상향됐다. 프로덕션 환경에서 기존에 `warn` 레벨 알람이 설정돼 있지 않다면 무시됐을 이벤트가 이제 `error` 레벨 알람을 트리거한다. 의도된 변경이지만(W2 설명에 "모니터링 알람" 명시), DB 일시 장애 시 알람 폭주(alert storm)가 발생할 수 있다. 기존 알람 임계값·de-duplication 설정 없이 `error` 레벨 알람이 연속 수십 건 발생할 경우 운영 노이즈가 증가한다.
- 제안: 모니터링 시스템에서 이 로그 패턴(`PublicWebhookThrottleGuard: trigger 조회 실패`)에 대해 rate-limit 또는 flapping 억제 정책을 설정할 것을 권장한다. 코드 자체의 부작용은 아니며 운영 절차 사항이다.

### [INFO] `client-ip.spec.ts` — `process.env.TRUST_CF_CONNECTING_IP` 변경의 테스트 간 격리
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L357~369 (신규 테스트 2건)
- 상세: 추가된 두 테스트 중 첫 번째(`empty/whitespace cf-connecting-ip → falls back to XFF`)는 `process.env.TRUST_CF_CONNECTING_IP = 'true'` 를 설정하지만 복원 코드를 직접 포함하지 않는다. `afterEach` 훅(L388~391)이 `orig` 값으로 복원하는 구조이므로 격리는 보장되나, 두 번째 테스트(`whitespace-only XFF → null`)는 환경 변수를 `'true'`로 설정한 상태에서 실행된다. `extractClientIpFromHeaders` 가 `TRUST_CF_CONNECTING_IP` 를 직접 읽지 않고 호출자(caller)가 전달하는 방식이거나 `shouldTrustCfConnectingIp` 를 통해 env 를 격리해 읽는 구조라면 문제없다. 현재 파일 컨텍스트에서 `extractClientIpFromHeaders` 의 구현을 확인할 수 없으므로 잠재적 위험으로 기재한다.
- 제안: 두 번째 신규 테스트(`whitespace-only XFF → null`)가 이전 테스트에서 설정된 `TRUST_CF_CONNECTING_IP='true'` 상태를 이어받지 않도록, afterEach 가 올바르게 원복되는지 또는 해당 테스트가 환경 변수에 독립적임을 명시적으로 확인한다. 현재 afterEach 는 `orig` 기준으로 복원하므로 설계상 안전하다.

### [INFO] `http-exception.filter.ts` — `mapHttpErrorLike` 반환 메시지 변경의 클라이언트 계약 영향
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` L178~181
- 상세: 4xx http-error-like 예외의 `message` 필드가 `exception.message` (원본 라이브러리 메시지) 에서 상태 코드 기반 일반 문구(`'Request payload too large.'` 또는 `'The request could not be processed.'`)로 변경됐다. CWE-209 정보 노출 방지를 위한 의도적 변경이다. 기존에 이 메시지를 파싱하거나 특정 문자열에 의존하는 클라이언트 코드(예: 프론트엔드 토스트 메시지, SDK, 통합 테스트)가 있다면 동작이 달라진다.
- 제안: `error.message` 값을 파싱하거나 `'request entity too large'` 원본 문자열을 expect 하는 e2e/통합 테스트가 있는지 확인한다. 변경된 `http-exception.filter.spec.ts` 는 새 문구를 올바르게 검증하므로 단위 테스트는 정합하다.

---

## 요약

이번 변경은 크게 세 영역으로 나뉜다. (1) `http-exception.filter.ts` 의 CWE-209 정보 노출 차단 — 내부 메시지를 echo 하지 않도록 `mapHttpErrorLike` 반환 메시지를 고정 문구로 교체했다. 반환 타입·시그니처 변화 없이 값만 달라지는 변경이므로 구조적 부작용은 없으나, 기존 클라이언트가 메시지 문자열에 의존하고 있었다면 동작 차이가 발생한다. (2) `public-webhook-throttle.guard.ts` 의 `extractClientIp` export 제거 및 공유 코어(`extractClientIpFromHeaders`)로의 위임 — export 시그니처 삭제이므로 외부 참조가 있으면 컴파일 오류가 발생하나, 동반된 spec 파일 수정이 해당 import 를 함께 제거했다. 로그 레벨 `warn → error` 상향은 의도된 변경으로 모니터링 운영 측면의 주의가 필요하다. (3) 일관성 리뷰 산출물 파일들(파일 6~13)은 신규 생성 md/json 파일이며 런타임에 영향을 주지 않는다. 전역 변수 수정, 파일시스템 의도치 않은 변경, 환경 변수 무단 쓰기, 네트워크 호출 추가, 이벤트/콜백 시그니처 변경은 이번 변경에서 발견되지 않았다.

## 위험도

LOW

---

STATUS: PASS
