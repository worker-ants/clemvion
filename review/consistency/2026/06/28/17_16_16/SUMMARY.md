# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 두 spec 파일의 소규모 정책 명문화. 규약 위반·식별자 충돌·plan 충돌 없음. 참조 문서 동기화 권장 항목(INFO) 6건.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `web-chat/4-security.md` §4·R3 에 trigger DB 조회 fail-open 정책 미반영 | `spec/7-channel-web-chat/4-security.md` L128, L141-144, L191-196 | §4 blockquote 와 R3 에 "Redis 미가용 외에도 trigger DB 조회 실패 시 동일하게 fail-open + `error` 레벨 로깅" 추가 (우선순위 낮음, SoT 는 webhook.md) |
| 2 | Cross-Spec | `2-api-convention.md` §5.3 에 `error.message` 내용 정책(echo 금지·고정 문구) 미반영 | `spec/5-system/2-api-convention.md` §5.3 (L141-163) | §5.3 에 "`error.message` 는 내부 구현 원문 echo 금지 — CWE-209. 세부: [error-handling §1.3]" 짧은 포인터 추가 |
| 3 | Rationale Continuity | `12-webhook.md` Rationale 에 DB 조회 실패 fail-open 결정 근거 항목 부재 | `spec/5-system/12-webhook.md` Rationale 섹션 | fail-open 이유(Guard 의 rate-limit 역할, 운영 가용성 우선, 모니터링 보완) + fail-closed 대안 기각 이유 항목 추가 |
| 4 | Rationale Continuity | `3-error-handling.md` Rationale 에 `PAYLOAD_TOO_LARGE` message 고정 문구 정책(CWE-209) 항목 부재 | `spec/5-system/3-error-handling.md` Rationale 섹션 | body-parser 원문 echo 차단 이유·비-413 4xx 동일 정책 적용 범위 항목 추가 (WebSocket `EXECUTION_INTERNAL_ERROR` 고정 문구 결정과 일관) |
| 5 | Convention Compliance | `3-error-handling.md` `## Overview` 섹션 부재 (pre-existing) | `spec/5-system/3-error-handling.md` 문서 구조 | 후속 작업에서 Overview 절 추가 권장. 이번 변경 유발 아님, 즉시 수정 의무 없음 |
| 6 | Plan Coherence | `http-ssrf-all-auth-followups.md` 의 열린 SSRF 메시지 일반화 항목과 CWE-209 주제 인접 | `plan/in-progress/http-ssrf-all-auth-followups.md` (SSRF 메시지 항목) | 해당 항목 처리 시 `3-error-handling.md` 의 CWE-209 근거 참고해 일관된 문구 적용 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 참조 문서 2건에 단방향 포인터 누락. 모순 없음 |
| Rationale Continuity | LOW | 신규 정책 2건의 Rationale 항목 부재. 기존 결정 위반 없음 |
| Convention Compliance | NONE | 에러 코드 명명·출력 포맷·규약 위반 없음. Overview 부재는 pre-existing |
| Plan Coherence | NONE | in-progress plan 48개 전수 검토 — 충돌·미해결 결정 의존 없음 |
| Naming Collision | NONE | 신규 식별자 없음. 모듈-private `extractClientIp` 삭제로 혼동 요소 감소 |

## 권장 조치사항

1. (선택, 낮은 우선순위) `spec/7-channel-web-chat/4-security.md` §4·R3 에 trigger DB 조회 fail-open + `error` 레벨 로깅 언급 추가 — 독자 오해 방지.
2. (선택, 낮은 우선순위) `spec/5-system/2-api-convention.md` §5.3 에 `error.message` echo 금지 정책 단방향 포인터 추가.
3. (선택, 권장) `spec/5-system/12-webhook.md` Rationale 에 DB 조회 실패 fail-open 결정 근거 항목 추가.
4. (선택, 권장) `spec/5-system/3-error-handling.md` Rationale 에 `PAYLOAD_TOO_LARGE` message 고정 문구(CWE-209) 항목 추가.
5. (선택, 낮은 우선순위) `spec/5-system/3-error-handling.md` 에 `## Overview` 절 추가 — 후속 작업 기회에.
