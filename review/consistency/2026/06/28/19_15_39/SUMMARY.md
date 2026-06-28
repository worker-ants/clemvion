# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 기능 충돌 없음. 일부 spec 파일에서 webhook 경로 IP 추출 함수명(`extractClientIp` → `extractClientIpFromHeaders`) 동기화가 권장되며, `webhook-public-ip-failopen-hardening` plan 에 후속 추적 메모 추가가 바람직함.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | webhook 경로 IP 추출 함수명 불일치 — `extractClientIp` 로 기술되어 있으나 실제 구현은 `extractClientIpFromHeaders` 직접 호출 | `spec/1-data-model.md:479`, `spec/2-navigation/6-config.md:339`, `spec/5-system/12-webhook.md:358,365` | 해당 행을 `extractClientIpFromHeaders` 로 동기화하거나 "헤더 기반 IP 추출"로 추상화 표현 통일. `spec/data-flow/1-audit.md:86` 감사 경로는 정확 — 수정 불필요 |
| 2 | Cross-Spec | `data-flow/1-audit.md` `extractClientIp` 참조 — 감사 경로는 정확, 표기 일관성 점검 시 함께 확인 권장 | `spec/data-flow/1-audit.md:86` | 현상 유지. 필요 시 두 경로(세션·감사 vs webhook/rate-limit)의 함수명 차이 설명 추가 고려 |
| 3 | Cross-Spec | `GlobalExceptionFilter` 에러 메시지 상수화(`UNKNOWN_ERROR_MESSAGE` / `UNHANDLED_ERROR_MESSAGE`) — spec 기재 불필요 | `codebase/backend/src/common/filters/http-exception.filter.ts` | 스펙 변경 불필요. 코드 내부 개선으로 완결 |
| 4 | Plan Coherence | `webhook-public-ip-failopen-hardening` plan 의 미결 결정(폴백 추가 여부)과의 관계 — spec §2.3 "req.ip/socket 폴백 없음" 명시로 향후 결정 시 spec 갱신 후속 부담 발생 | `plan/in-progress/webhook-public-ip-failopen-hardening.md` §결정 2·3항 | 해당 plan 에 "1-auth §2.3 클라이언트 IP 행이 현행 헤더 전용 상태를 기술함 — 폴백 추가 결정 시 해당 행도 갱신 필요" 추적 메모 추가 |
| 5 | Naming Collision | `PublicWebhookReqShape` 신규 export — 기존 `ReqShape` alias와 관계 | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` | 현행 유지. 필요 시 JSDoc에 "public-webhook request shape — guard와 테스트가 공유" 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | webhook 경로 IP 추출 함수명(`extractClientIp`)이 3개 spec 파일에서 실제 구현(`extractClientIpFromHeaders`)과 명칭 불일치. 기능 충돌 아님 |
| Rationale Continuity | NONE | `spec/5-system/1-auth.md` §2.3 변경은 기존 Rationale 2.3.B 확정 결정의 본문 동기화. 기각된 대안 재도입·합의 위반 없음 |
| Convention Compliance | 재시도 필요 | output_file 미생성 — checker 결과 없음 |
| Plan Coherence | LOW | `webhook-hardening-cleanup.md` 소유 범위와 일치. `failopen-hardening` plan 미결 결정과 직접 충돌 없으나 후속 추적 메모 권장 |
| Naming Collision | NONE | 신규 식별자 4종 모두 충돌 없음. `hooks.service.ts` 지역 래퍼 제거로 동명 혼동 해소 |

## 권장 조치사항

1. (선택) `spec/1-data-model.md:479`, `spec/2-navigation/6-config.md:339`, `spec/5-system/12-webhook.md:358,365` 의 `extractClientIp` 언급을 `extractClientIpFromHeaders` 로 동기화하거나 추상화 표현으로 통일 — 기능 충돌이 아닌 명명 정합성 개선으로 BLOCK 요인 아님.
2. (선택) `plan/in-progress/webhook-public-ip-failopen-hardening.md` 에 "1-auth §2.3 클라이언트 IP 행이 현행 헤더 전용 상태를 기술함 — 폴백 추가 결정 시 해당 행도 갱신 필요" 추적 메모 추가.
3. Convention Compliance checker 가 output_file 을 생성하지 못했음 — 재시도 권장. 현재 통합 보고서는 나머지 4개 checker 결과 기준이며, convention 위반이 발견될 경우 위험도가 상향될 수 있음.