# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 모든 checker 에서 Critical/Warning 발견 없음. Plan 정합성 checker 에서 워크플로 분리 원칙 미준수 1건(INFO)이 LOW 위험도로 분류됨. 나머지 4개 checker 는 NONE.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `1-auth.md` §2.3 클라이언트 IP 행에 두 함수명(`extractClientIp`, `extractClientIpFromHeaders`) 동시 인라인 기재로 표 행 길이 증가 | `spec/5-system/1-auth.md` §2.3 "클라이언트 IP" 행 | 선택적 — 본문에 짧은 포인터만 두고 상세는 §Rationale 2.3.B 에 위임하는 방향으로 추후 간소화 가능. 현행도 허용. |
| 2 | Convention Compliance | `12-webhook.md` §7e·§8b 함수명 정정이 `1-auth.md` §Rationale 2.3.B 에 직접 미반영 — Rationale 은 구현 함수명 기재 규약 없으나 독자 혼동 여지 | `spec/5-system/12-webhook.md` §7e, §8b; `spec/5-system/1-auth.md` §Rationale 2.3.B | 선택적 — Rationale 2.3.B 내 "세션·감사 IP `auth/utils/client-ip`" 옆에 "webhook/rate-limit/ip_whitelist 는 `extractClientIpFromHeaders`" 각주 추가. |
| 3 | Rationale Continuity | `12-webhook.md` 흐름 주석에 Rationale 2.3.B 역참조 포인터 없음 | `spec/5-system/12-webhook.md` §7e, §8b | 선택적 — `extractClientIpFromHeaders` 뒤에 `(Rationale 2.3.B m-3)` 인라인 주석 추가 권장, 필수 아님. |
| 4 | Plan Coherence | `webhook-hardening-cleanup.md` C 항목을 "별도 spec 묶음"으로 분리 예정이었으나 동일 PR 에서 처리됨 (내용 오류 아님, 워크플로 분리 원칙 미준수) | `plan/in-progress/webhook-hardening-cleanup.md` C 항목 | `webhook-hardening-cleanup.md` C 항목을 "(완료, 이 PR 에 포함)"으로 갱신해 추적 정합성 유지. 별도 spec-only PR 불필요. |
| 5 | Plan Coherence | `webhook-public-ip-failopen-hardening.md` 미해결 결정 2·3 확정 시 `1-auth.md` §2.3 행 갱신 필요 (해당 plan 이 이미 후속 메모로 명시) | `spec/5-system/1-auth.md` §2.3 "클라이언트 IP" 행 | 현재 상태 유지. 결정 2·3 확정 시 후속 메모에 따라 §2.3 행 갱신. |
| 6 | Naming Collision | `PublicWebhookReqShape` (신규) — `PublicWebhookReqExtension` (기존)과 유사 이름, 상속 관계로 역할 명확히 구분됨 | `public-webhook-throttle.guard.ts` L160 | 없음. 명명이 역할을 잘 구분함. |
| 7 | Naming Collision | `hooks.service.ts` 로컬 `extractClientIp` 래퍼 제거 — 기존 전역 동명 함수(`auth/utils/client-ip.ts`)와의 혼동 해소 (개선) | `hooks.service.ts` (삭제된 로컬 래퍼) | 없음. 개선 방향. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 충돌하는 정의·모순된 함수명·중복 요구사항 ID 없음. `1-auth.md` §2.3, `12-webhook.md`, `1-data-model.md`, `6-config.md`, `data-flow/1-audit.md` 간 정합 확인. |
| Rationale Continuity | NONE | 모든 변경이 기존 Rationale 2.3.B (m-3) 결정과 정합. 기각된 대안 재도입·합의 원칙 위반·근거 없는 번복 없음. |
| Convention Compliance | NONE | 명명·출력 포맷·문서 구조·API 문서·금지 항목 모두 위반 없음. INFO 2건(가독성·독자 혼동 방지 권고). |
| Plan Coherence | LOW | 실질 결정 충돌 없음. `webhook-hardening-cleanup.md` C 항목 워크플로 분리 원칙 미준수(plan 갱신으로 정리 가능). 미해결 결정 2·3 의존성은 plan 이 이미 추적 중. |
| Naming Collision | NONE | 신규 식별자(`PublicWebhookReqShape`, `UNKNOWN_ERROR_MESSAGE`, `UNHANDLED_ERROR_MESSAGE`) 충돌 없음. 로컬 래퍼 제거로 기존 혼동 해소. |

## 권장 조치사항

1. (BLOCK 사유 없음 — 즉시 조치 불필요)
2. **[LOW, 선택]** `plan/in-progress/webhook-hardening-cleanup.md` C 항목을 "(완료, 이 PR 에 포함)"으로 갱신 — 추적 정합성 유지 목적. 내용 오류 아님.
3. **[INFO, 선택]** `spec/5-system/1-auth.md` §Rationale 2.3.B 에 `extractClientIpFromHeaders` 함수명 각주 추가 — 독자 혼동 방지 목적.
4. **[INFO, 선택]** `spec/5-system/12-webhook.md` §7e·§8b 의 `extractClientIpFromHeaders` 뒤에 `(Rationale 2.3.B m-3)` 역참조 포인터 추가 — 근거 추적 목적.