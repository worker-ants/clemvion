# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 Critical 0건, 위험도 NONE.

## 전체 위험도
**NONE** — `spec/5-system/` 델타는 0파일(코드 전용 구현 턴, `spec_impact: none`). 기확정된 `#1323` spec 계약(400/502 분기·`code` 프로퍼티 계약·CWE-209 원문 비노출)을 코드가 정확히 따라잡았고, 신규 식별자·rationale·plan 트래커 모두 정합.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Convention Compliance | `3-error-handling.md §1` 중앙 에러 카탈로그에 chat-channel setupChannel 코드(`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`) 전용 서브섹션 부재 — 다른 도메인(webhook §1.7·KB §1.8·trigger endpointPath §1.10 등)과 비대칭 | `spec/5-system/3-error-handling.md §1` | 이번 PR 책임 범위 밖(pre-existing, `spec_impact: none`). `plan/in-progress/spec-draft-nullable-notation-followups.md:2806` 에 `§1.12` 가칭으로 이미 등재·추적 중 — 다음 planner 턴에서 신설 또는 §1 Overview 목록에 의도적 생략 사유 명시 |
| 2 | Cross-Spec | Slack 자격 증명 거부 값 목록 drift — 코드 화이트리스트 5값(`invalid_auth`·`not_authed`·`account_inactive`·`token_revoked`·`token_expired`) vs `slack.md §3.1` 예시 4값+개방형 `...` | `spec/4-nodes/7-trigger/providers/slack.md §3.1` / `slack.adapter.ts SLACK_CREDENTIAL_REJECTED_ERRORS` | 모순은 아님(spec 자체가 비-완결 목록 표시). 이미 `spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 신설 등재됨 — 다음 spec 편집 시 5값 확정 열거 또는 "정본은 코드 상수" cross-link 권고 |
| 3 | Cross-Spec | `getCodeFromStatus`(http-exception filter) 502 기본 코드 행 부재, 현재 도달 불가 | `codebase/backend/src/common/filters/http-exception.filter.ts` (무변경) / `2-api-convention.md §6` | 조치 불요. `spec-draft-nullable-notation-followups.md:2911` 에 "두 번째 502 소비자 발생 시 추가" 조건으로 이미 등재 |
| 4 | Convention Compliance | `chat-channel-adapter.md` frontmatter/§1.1.2 자기-반증형 소정정 편집 — CLAUDE.md 5조건 형식상 부합, governance 축은 이 checker 범위 밖 | `spec/conventions/chat-channel-adapter.md` | 조치 불요, 정보 제공 목적. plan_coherence 가 별도로 `ESCALATE=spec`(커밋 `3c47885a3`) 경로 준수를 확인함 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 400/502 분기·`code` 계약·provider 원문 비노출·swagger 데코레이터 4개 SoT 문서와 라인 단위 대조, 모순 없음. INFO 3건(모두 pre-existing, 트래커 등재 확인) |
| Rationale Continuity | NONE | R-CCA-9(message 접두 기각 재도입 없음)·§1.1.2 제거조건 미앞지름·CWE-209 원칙 확장 적용·502/503 축 비충돌 등 7개 반증 시도 전부 실패(=정합). 발견 없음 |
| Convention Compliance | NONE | 명명(UPPER_SNAKE_CASE)·API 문서 데코레이터 페어링·에러 메시지 정보노출 방지 위반 없음. INFO 2건(카탈로그 gap pre-existing, governance 참고) |
| Plan Coherence | NONE | `impl-setup-error-code.md` 곁가지 발견 전부 `spec-draft-nullable-notation-followups.md` 에 owner 명시 등재 확인. 미해결 결정 우회·선행조건 미해소 없음 |
| Naming Collision | NONE | 신규 식별자(`CredentialRejectedError`/`credentialRejectedError`/`isCredentialRejectedError`/provider별 `*_CREDENTIAL_REJECTED_*` 등) 전부 저장소 유일 정의, 기존 코드(`BOT_TOKEN_INVALID`/`INVALID_BOT_TOKEN`)와 재정의 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 이번 PR 은 merge 진행 가능.
2. 후속(별도 planner 턴)에서 `3-error-handling.md §1`에 chat-channel setupChannel 코드 서브섹션(`§1.12` 가칭) 신설 — 이미 `spec-draft-nullable-notation-followups.md` 에 등재된 항목을 그때 처리.
3. 같은 후속 턴에서 `slack.md §3.1` Slack 자격 증명 거부 값 목록을 코드 기준 5값으로 확정 열거 또는 cross-link.