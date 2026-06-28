# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target 범위: `spec/5-system/`
diff-base: `origin/main`

---

## 실제 구현 변경 사항 (diff 요약)

본 branch(`claude/webhook-hardening-followups`)의 `origin/main` 대비 코드 변경은 `spec/5-system/` 문서 자체는 변경하지 않고, 다음 세 코드 파일만 수정했다:

1. `codebase/backend/src/common/filters/http-exception.filter.ts` — 4xx(`http-errors` 경유) 응답의 `message` 필드를 내부 메시지 echo 대신 상태별 일반 문구로 대체 (CWE-209; 413 → `"Request payload too large."`, 그 외 4xx → `"The request could not be processed."`)
2. `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — trigger 조회 실패 시 fail-open log 레벨 `warn` → `error` 승격 + 로컬 `extractClientIp` wrapper 제거(공유 `extractClientIpFromHeaders` 직접 사용)
3. `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` — 빈 문자열/공백 전용 CF-Connecting-IP·XFF 헤더 엣지 케이스 단위 테스트 2건 추가

---

## 발견사항

### [INFO] 3-error-handling.md — message 필드 값 미명시, 구현 일방 결정에 해당하지 않음

- target 위치: `spec/5-system/3-error-handling.md` §1.3 `PAYLOAD_TOO_LARGE` 항목
- 관련 plan: 없음 (해당 메시지 문구 결정을 유보한 미해결 plan 없음)
- 상세: spec 은 `PAYLOAD_TOO_LARGE` 코드(413)와 `GlobalExceptionFilter` 매핑을 명시하나, `message` 필드의 구체 문자열은 규정하지 않는다. 구현이 body-parser 내부 문구 대신 일반화된 문구를 채택한 것은 CWE-209 보안 처방으로, plan 에서 "결정 필요" 로 유보된 사항이 아니다. spec 미명시 범위 내 구현이므로 충돌 없음.
- 제안: 없음.

---

### [INFO] 12-webhook.md — fail-open log 레벨은 spec 에 미명시, plan 미결 항목과 충돌 없음

- target 위치: `spec/5-system/12-webhook.md` §6 공개 webhook 보호 절 (Redis 미가용 시 fail-open 명시, trigger 조회 fail-open 에 대한 log 레벨 미명시)
- 관련 plan: 없음 (log 레벨을 결정 보류한 in-progress plan 없음)
- 상세: spec §6 는 "Redis 미가용 시 fail-open" 을 규정하지만 DB 조회 실패 시 fail-open 의 로그 레벨까지는 규정하지 않는다. `warn` → `error` 승격은 보안 모니터링 알람 개선 목적이며 plan 에서 합의를 요하는 미결 결정이 아니다. 충돌 없음.
- 제안: 없음.

---

### [INFO] 이전 --impl-prep 검토 경고 항목 — 본 변경과 교차 없음

- target 위치: `spec/5-system/1-auth.md` §1.5.3, `spec/5-system/13-replay-rerun.md` §10.2, `spec/5-system/11-mcp-client.md` §3.2, `spec/5-system/14-external-interaction-api.md`
- 관련 plan: `spec-code-cross-audit-2026-06-10.md` §V-09·§V-14, `http-ssrf-all-auth-followups.md` SSRF 동기화 보류, `spec-sync-structural-followups.md` console.warn stale
- 상세: 이전 `--impl-prep` 검토(`16_50_18`)에서 경고된 항목들(초대 수락 자동화 V-09, Re-run 모달 V-14, SSRF 전 인증 동기화 보류, console.warn stale)은 본 구현 변경이 건드리지 않는 코드 영역이다. 본 변경은 `hooks/public-webhook-throttle.guard.ts`와 `common/filters/http-exception.filter.ts` 에만 국한되어, 위 경고 항목의 미결 상태에 영향을 주지도 받지도 않는다.
- 제안: 없음 (이전 WARNING 은 여전히 유효하나 본 변경과 무관).

---

### [INFO] spec-sync-auth-gaps.md — pending_plans 포인트 정합 확인

- target 위치: `spec/5-system/1-auth.md` frontmatter `pending_plans`, §1.3
- 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md`
- 상세: `spec-sync-auth-gaps.md` 는 LDAP/SAML 미구현 두 항목만 open 상태이며, 본 구현 변경은 그 영역과 무관하다. spec `1-auth.md` 에 기술된 `extractClientIp` 관련 정책(`TRUST_CF_CONNECTING_IP`, IP 추출 순서 §2.3 표)은 이번 변경으로 로컬 wrapper 가 제거되고 공유 유틸이 직접 사용되었으나, 추출 로직 자체는 동일하므로 spec 기술 내용과 충돌하지 않는다.
- 제안: 없음.

---

### [INFO] http-ssrf-all-auth-followups.md — SSRF 메시지 일반화 open 항목과 겹침 범위 확인

- target 위치: `spec/5-system/3-error-handling.md` (간접 관련)
- 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` 코드 항목 "SSRF 에러 메시지 클라이언트 일반화" (open checkbox)
- 상세: http-ssrf plan 의 open 항목은 `http-safety.ts` 의 `SSRF_BLOCKED: hostname "..."` 메시지 일반화이며, 본 변경의 `http-exception.filter.ts` 메시지 일반화(`PAYLOAD_TOO_LARGE` body-parser 경유 4xx)와는 **다른 코드 경로**다. 둘 다 메시지 일반화이나 적용 위치·에러 종류가 분리되어 있다. 본 변경이 SSRF 플랜 open 항목을 대신 완료하거나 우회하지 않는다.
- 제안: 없음 (두 항목은 독립적으로 추적 가능).

---

## 요약

`spec/5-system/` 전체와 진행 중 plan 문서를 대조한 결과, 본 구현 변경(webhook 하드닝 후속 — http-exception 메시지 일반화, fail-open log 레벨 승격, 로컬 IP 추출 wrapper 제거, 엣지 케이스 단위 테스트)은 어떤 in-progress plan 의 미해결 결정과도 충돌하지 않는다. 변경 범위가 `hooks/public-webhook-throttle.guard.ts`·`common/filters/http-exception.filter.ts`·`auth/utils/client-ip.spec.ts` 세 파일에 국한되며, spec 이 명시적으로 규정하지 않은 세부 구현(log 레벨, message 문자열 내용)에 대한 보안 처방이다. 이전 `--impl-prep` 검토에서 경고된 V-09·V-14·SSRF 동기화·console.warn stale 항목은 본 변경과 교차하지 않아 여전히 별도 추적 대상이다.

## 위험도

NONE
