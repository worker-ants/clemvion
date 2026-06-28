# 보안(Security) 리뷰 결과

리뷰 대상: codebase/backend — http-exception filter CWE-209 fix (후속 테스트 보강), client-ip 엣지 케이스 테스트, PublicWebhookThrottleGuard fail-open 로그 격상 및 extractClientIp 이관, 이전 리뷰 산출물
리뷰 일시: 2026-06-28

---

## 발견사항

### [INFO] CWE-209 개선 확인 — 비-413 4xx 분기 메시지 sanitize 테스트 보강 적절

- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` 추가 블록 (diff L51–68)
- 상세: 이전 리뷰(17_00_25)에서 지적된 W1(비-413 4xx 분기 `'The request could not be processed.'` 미검증)이 `{ status: 400 }` 케이스 추가로 해소됐다. `Logger.prototype.warn` spy 로 원문이 클라이언트로 노출되지 않고 서버 로그에만 남는 것까지 단언하는 구조는 CWE-209 방어를 테스트 계층에서 고정한다. 413과 비-413 경로 모두 sanitize 동작이 검증되므로 보안 커버리지가 충분하다.
- 제안: 현재 구현 및 테스트 적절. 추가 조치 불필요.

### [INFO] fail-open error 레벨 로깅 테스트 고정 — 모니터링 보장 확보

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` diff L188–196
- 상세: 이전 리뷰(17_00_25)에서 지적된 I16(fail-open `logger.error` 호출 미검증)이 `Logger.prototype.error` spy 1회 호출 단언으로 해소됐다. DB 장애 상황에서 공개 webhook 보호가 무력화될 때 `error` 레벨 로그가 반드시 남는다는 것이 테스트로 고정되어, 향후 로그 레벨 강등이나 로깅 제거 회귀를 탐지할 수 있다. 보안 모니터링 가시성 요구사항이 테스트에 반영된 바람직한 패턴이다.
- 제안: 현재 구현 및 테스트 적절.

### [INFO] extractClientIp 단일 구현 통합 완료 확인

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` diff (extractClientIp 제거 블록)
- 상세: 이전 리뷰(17_00_25)에서 I7로 지적된 `extractClientIp` 외부 참조 잔존 여부에 대해 RESOLUTION.md 가 "grep 확인 완료 — 외부 참조 없음(컴파일·lint·build 통과)"을 확인했다. 로컬 래퍼 함수가 제거되고 `auth/utils/client-ip.extractClientIpFromHeaders` 공유 코어만 남아 IP 추출 로직 사본 드리프트 위험이 제거됐다. 향후 IPv6 정규화·새 헤더 지원 등 보안 픽스가 단일 위치에만 적용하면 전파된다.
- 제안: 현재 구현 적절.

### [INFO] IP 미식별 fail-open 정책 — 설계 의도 명확, 인프라 위임 유지

- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L108 (`if (!ip) return true;`)
- 상세: IP 추출 불가 시 rate-limit 없이 통과하는 fail-open 설계는 이번 변경에서 코드 변경 없이 유지됐다. 공격자가 XFF 헤더를 제거/조작해 IP 추출을 의도적으로 실패시키면 rate-limit을 우회하는 경로가 열리나, body 크기 제한(step 3)은 IP 추출 전 적용되므로 대용량 페이로드 DoS는 차단된다. 이 설계 의도가 코드 주석("spec graceful degradation")과 RESOLUTION.md I5 보류 처리로 명시되어 있다.
- 제안: 인프라 수준 XFF 없는 요청 차단 또는 `req.socket.remoteAddress` 폴백 추가는 중장기 개선 사항으로 별도 plan 추적 권장 (본 PR 범위 외).

### [INFO] TRUST_CF_CONNECTING_IP 환경변수 기본 off(fail-safe) 검증 테스트 보강

- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` diff L133–145
- 상세: 공백 전용 cf-connecting-ip 값이 XFF 폴백으로 처리되는 동작과 공백 전용 XFF가 null 반환하는 동작이 신규 테스트로 추가됐다. CF-Connecting-IP를 신뢰하지 않는 환경(기본 off)에서 공격자가 빈 cf-connecting-ip를 전달해 IP 판정을 혼란시키려 시도해도 안전하게 처리됨이 검증된다. afterEach 환경 복원 구조도 적절하다.
- 제안: 현재 구현 및 테스트 적절.

### [INFO] 에러 처리 내 민감 정보 노출 — 신규 warn 로그 원문 포함 설계 확인

- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` diff L98–109 및 http-exception.filter.spec.ts diff L64–66
- 상세: 4xx http-error 처리 시 원본 `exception.message`는 서버 측 `logger.warn`으로만 남기고 클라이언트 응답에서는 제거된다. 이번 신규 테스트는 `warn`이 `'some internal 400 detail'`을 포함해 호출됨을 단언한다. 이는 원문이 서버 로그에 기록되는 것을 검증하는 동시에, 클라이언트 응답에서는 해당 문자열이 노출되지 않음을 확인한다. 서버 로그에 원문이 남는 것 자체는 보안상 올바른 설계이며, 로그 접근 통제가 인프라 레이어에서 보장된다는 가정 하에 적절하다.
- 제안: 현재 구현 적절. 서버 로그에 대한 접근 통제(RBAC, 로그 집계 시스템 권한 관리)는 운영 절차로 별도 관리.

### [INFO] 리뷰/일관성 검토 산출물 파일 — 런타임 보안 영향 없음

- 위치: `review/code/2026/06/28/17_00_25/` 및 `review/consistency/2026/06/28/16_50_18/` 하위 파일들
- 상세: 이 파일들은 워크플로 산출물(SUMMARY.md, security.md, RESOLUTION.md, _retry_state.json 등)로 런타임에 직접 로드되거나 실행되지 않는다. `_retry_state.json` 내 절대 경로 하드코딩은 로컬 세션 전용 상태 파일의 특성상 보안 위협이 아니다. 민감 정보(API 키, 토큰, 비밀번호)가 포함되어 있지 않다.
- 제안: 해당 없음.

---

## 요약

이번 변경 세트는 이전 리뷰(17_00_25)의 WARNING 1건(W1: 비-413 4xx 분기 테스트 미존재)과 INFO 2건(I15: logger.warn 원문 로깅 검증 누락, I16: fail-open logger.error 호출 미검증)을 모두 테스트 추가로 해소한 후속 보강이다. 핵심 보안 개선인 CWE-209 메시지 sanitize(413 고정 문구 + 비-413 4xx 일반 문구)와 extractClientIp 단일 구현 통합, fail-open error 레벨 로깅 격상은 이전 세션에서 이미 구현됐으며 이번 변경에서 테스트 커버리지가 완비됐다. 인젝션 취약점, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화 알고리즘, 알려진 취약 의존성은 발견되지 않았다. IP 미식별 fail-open 및 DB 장애 fail-open은 설계 의도가 명확히 문서화되어 있고 본 PR 범위 외 별도 추적이 적절하다. 모든 발견사항은 INFO 수준이며 즉각적인 코드 수정이 필요한 취약점은 없다.

## 위험도

NONE

---

STATUS: PASS
