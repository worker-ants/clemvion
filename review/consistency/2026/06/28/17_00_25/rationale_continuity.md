# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
검토 일시: 2026-06-28

---

## 검토 대상 변경 파일

- `codebase/backend/src/common/filters/http-exception.filter.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`

---

## 발견사항

### [INFO] `http-exception.filter.ts` — 비-`HttpException` 4xx 메시지 제거: Rationale 원칙 강화

- target 위치: `http-exception.filter.ts` L110–L116 (`errStatus >= 400 && errStatus < 500` 브랜치)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §7.5.2` 및 `Rationale "typed/plain 분기"`, `spec/5-system/6-websocket-protocol.md §4.2` 누출 차단 정책, `spec/5-system/3-error-handling.md §1.3 PAYLOAD_TOO_LARGE`
- 상세: 변경 전에는 비-`HttpException` 4xx 에러(body-parser 413 등)의 `exception.message` 를 그대로 클라이언트 응답 `message` 필드로 전달하고 있었다. 변경 후에는 413 은 `'Request payload too large.'`, 그 외는 `'The request could not be processed.'` 로 고정 generic 문구를 반환하고 원본 메시지는 서버 로그에만 기록한다 (CWE-209 대응). `spec/5-system/4-execution-engine.md §7.5.2` 및 `6-websocket-protocol.md §4.2` 는 "비-typed(plain) `Error` 의 내부 `error.message` 를 client 에 전달하지 않는다; 고정 generic 문자열만 반환한다" 를 보안 게이트 원칙으로 명시하고 있다. 이번 변경은 해당 원칙을 `GlobalExceptionFilter` 의 4xx 경로에까지 일관되게 적용하는 것으로, Rationale 에 기재된 기각 대안(내부 메시지 echo)이 제거되고 원칙이 강화되는 방향이다. 충돌 없음.
- 제안: 이 강화 결정의 근거(CWE-209, 4xx 경로 일관성)를 `spec/5-system/3-error-handling.md § Rationale` 또는 `GlobalExceptionFilter` 의 filter-level Rationale 항목으로 한 줄 추가하면 추후 검토자가 의도를 즉시 파악할 수 있다.

---

### [INFO] `public-webhook-throttle.guard.ts` — fail-open 로그 레벨 `warn` → `error`: 암묵적 모니터링 강화

- target 위치: `public-webhook-throttle.guard.ts` L77–L81 (trigger 조회 실패 catch 블록)
- 과거 결정 출처: `spec/5-system/12-webhook.md §6` "Redis 미가용 시 fail-open", Rationale "WH-NF-02 본문 크기 — 분리 임계(옵션 C)"
- 상세: 변경 전 코드는 trigger 조회 실패 시 `logger.warn` 으로 기록하고 fail-open(통과) 했다. 변경 후 `logger.error` 로 승격해 DB 장애가 지속될 때 모니터링 알람이 공개 webhook 보호 우회를 조기 탐지하도록 했다. spec/5-system/12-webhook.md 는 "Redis 미가용 시 fail-open" 을 정책으로 명시하지만, trigger DB 조회 실패 시의 로그 레벨을 Rationale 로 고정한 결정은 없다. fail-open 정책(통과) 자체는 유지되므로 spec 의 invariant 와 충돌하지 않으며, 로그 레벨 상향은 보안 관측성 강화를 위한 구현 개선이다.
- 제안: DB 장애 지속 시 장기 보호 우회 우려가 있다는 점을 `spec/5-system/12-webhook.md §6` fail-open 절에 INFO 수준으로 한 문장 보완하면("trigger 조회 실패는 error 레벨 로그로 기록 — 장기 장애 모니터링 목적") 문서와 구현의 정합이 높아진다.

---

### [INFO] `public-webhook-throttle.guard.ts` — 로컬 `extractClientIp` 래퍼 제거: Rationale 2.3.B 단일 구현 원칙 적용

- target 위치: `public-webhook-throttle.guard.ts` L104–L106, 제거된 L157–L176 로컬 함수
- 과거 결정 출처: `spec/5-system/1-auth.md §2.3 세션 정책` 및 `Rationale 2.3.B` "본 신뢰 플래그는 IP 를 읽는 세 경로(세션·감사 IP `auth/utils/client-ip`, 공개 webhook rate-limit, `ip_whitelist` 검증)에 일관 적용한다"
- 상세: 기존 코드는 guard 파일 내에 `extractClientIp` 함수를 로컬 복사본으로 두었다. Rationale 2.3.B 는 IP 추출을 `auth/utils/client-ip` 단일 구현으로 통합해 "사본 drift 방지" 를 명시하고 있으며, 코드 내 주석("04 후속: `auth/utils/client-ip` 단일 구현으로 통합해 사본 drift 방지")도 동일 의도를 기록했다. 이번 변경에서 로컬 래퍼를 제거하고 공유 `extractClientIpFromHeaders` 를 직접 호출하므로, Rationale 에 명시된 단일 구현 원칙이 실현되었다. 충돌 없음.
- 제안: 없음 — 기록된 원칙이 정확히 반영되었다.

---

### [INFO] `client-ip.spec.ts` — 화이트스페이스 엣지케이스 테스트 추가

- target 위치: `client-ip.spec.ts` L42–L53 (두 개 추가 테스트 케이스)
- 과거 결정 출처: `spec/5-system/1-auth.md Rationale 2.3.B` TRUST_CF_CONNECTING_IP 정책
- 상세: 빈/공백 `cf-connecting-ip` 헤더 시 XFF 폴백, 공백만 있는 XFF 시 null 반환을 검증하는 테스트가 추가되었다. Rationale 2.3.B 의 "CF_CONNECTING_IP 신뢰 시 1순위, 아니면 XFF 첫 항목" 흐름과 일치하는 방어 코드 검증이다. 충돌 없음.
- 제안: 없음.

---

## 요약

이번 impl-done 변경 세트(`http-exception.filter.ts`, `public-webhook-throttle.guard.ts`, `client-ip.spec.ts`)를 `spec/5-system/` 의 기존 Rationale 와 대조한 결과, 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하거나 과거 결정을 새 Rationale 없이 번복한 사례가 없다. `http-exception.filter.ts` 의 비-HttpException 4xx 메시지 제거는 실행엔진·WebSocket 프로토콜 spec 이 공통으로 정한 "내부 메시지 client 미전달" 보안 게이트 원칙을 `GlobalExceptionFilter` 에까지 일관 적용하는 강화다. `extractClientIp` 로컬 래퍼 제거는 Rationale 2.3.B 의 "단일 구현, 사본 drift 방지" 원칙 구현이다. fail-open 로그 레벨 상향은 spec 이 선언한 fail-open 정책 자체(통과)는 그대로 유지하면서 모니터링 가시성만 높인다. 모든 변경이 기존 Rationale 의 방향성과 일치하며, INFO 수준의 문서 보완 제안만 있다.

## 위험도

NONE
