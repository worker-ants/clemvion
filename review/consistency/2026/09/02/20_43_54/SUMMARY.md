# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5/5 checker 완료, 전문 확보)

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(결정③ `INVALID_PASSWORD` §3 등재의 Rationale 편향·근거 오류, 소스 plan 체크박스 미전환) 존재하나 둘 다 차단 사유는 아님.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | — | — | — | — | — |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 결정③(`INVALID_PASSWORD` §3 등재)이 `error-codes.md §2` 의 "rename 금지" 절반만 인용하고 같은 절의 "의미 분기 시 신규 코드 신설" 원칙·형제 코드 선례(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`, `REAUTH_REQUIRED`/`PASSWORD_INVALID`)·§5 grade A/B 프레임을 다루지 않음. 근거로 든 e2e 인용 중 `users-email-change.e2e-spec.ts:101` 은 실제로 `PASSWORD_INVALID` 를 단언(`INVALID_PASSWORD` 아님) — breaking-비용 근거가 실측과 어긋남 | `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md:110-119` (`### rename 하지 않는 근거`) | `spec/conventions/error-codes.md` §2·§5 Rationale, `codebase/backend/test/users-email-change.e2e-spec.ts:101` | (a) §2 "신설" 절반·형제 선례·grade A/B 프레임을 인용해 "왜 이 케이스는 §3 등록이 맞는지" Rationale 문장 추가, 또는 (b) missing-password 조건에 신규 코드(예: `PASSWORD_NOT_SET`) 신설 + grade 표기로 등재. 어느 쪽이든 e2e 인용을 `PASSWORD_INVALID` 로 정정하거나 제거 |
| 2 | plan_coherence | 소스 plan(`ws-token-expired-socket-lifetime-impl.md`)의 두 미해결 체크박스(65행 §6 202/410 W1, 69행 `INVALID_PASSWORD`/`PASSWORD_INVALID` W2) 전환이 "변경안" 표에 없음. 자매 draft `spec-draft-ws-badge-flip-tracker-close.md` 는 이미 이 패턴("해소하는 소스 plan 체크박스 전환을 변경안에 명시")을 관례로 정착시켰는데 target 은 따르지 않음 | `## 변경안 — spec 5곳` 표 (spec 편집 5건만 나열, plan 갱신 항목 없음) | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:65,69` | "변경안" 표(또는 별도 "plan" 절)에 6번째 행을 추가해 `ws-token-expired-socket-lifetime-impl.md:65,69` 두 체크박스를 `[x]` 로 전환하는 작업을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `3-error-handling.md` Overview 의 "API 규약 §5.3 기본 코드를 override" 서술이 결정②("410 은 매핑이 없다") 도입 후 410 케이스에는 부정확해짐(override 대상 기본값이 없으므로) | `spec/5-system/3-error-handling.md` Overview 문단 vs target 결정② | target 범위 밖. 후속 소정정 시 "기본값 있는 코드는 override, 410 처럼 없는 코드는 explicit-only" 로 구절 분리 |
| 2 | cross_spec | §6 신규 `410 Gone` 행의 일반화 설명이 chat-channel 예외(비활성 트리거도 202 반환, R-CC-12)를 담지 않음 | 변경안 표 #2 (`410 Gone` 행 추가) | 실제 반영 시 §6 410 행에 도메인 spec(12-webhook·15-chat-channel) 링크 부기 — 결정①이 이미 위임 패턴 선언했으므로 확인만 필요 |
| 3 | convention_compliance | `## Rationale` 헤딩에 `(본 draft 의 결정 근거)` 접미 문구 — SKILL.md 문언은 순수 `## Rationale` 요구, 형제 draft 17/19 는 순수형 | `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md:143` | 접미 설명을 헤딩 아래 첫 문장으로 이동, 또는 이 변형을 정식 허용할 거면 SKILL.md 문언 갱신 |
| 4 | convention_compliance | `swagger.md §2-4` 데코레이터 매핑 표에 202/410 대응 없음 (target 스코프 밖, SoT 캐논 표 아님) | `spec/conventions/swagger.md §2-4` | 이번 draft 범위 확대 불필요. `swagger.md` 관리자 후속 검토 사항으로만 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 5곳 변경안 모두 기존 다영역(webhook/EIA/chat-channel/triggers) 실무·코드 발행 패턴과 정합. INFO 2건(override 서술 정밀도, chat-channel 예외 위임 확인) |
| rationale_continuity | MEDIUM | 결정①·②는 모범적(대안 명시 기각). 결정③은 §2 원칙 절반만 인용 + e2e 근거 오류 — WARNING |
| convention_compliance | NONE | SoT 경계·rename 금지·규약 확장 자제·"문서한 보장≤구현" 원칙 모두 준수. INFO 2건(헤딩 접미, swagger.md 별개 후속) |
| plan_coherence | LOW | 소스 plan WARNING 2건을 정확히 겨냥해 해소하나, 해소 후 소스 plan 체크박스 전환 작업이 변경안에 누락 — WARNING |
| naming_collision | NONE | 6개 축(상태코드/에러코드/요구사항ID/DTO/endpoint/파일경로) 전수 검증, 전부 기존 전역 용례 등재일 뿐 신규 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK:NO)
2. rationale_continuity WARNING: target `### rename 하지 않는 근거` 절에 §2 "신규 코드 신설" 원칙·형제 코드 선례·§5 grade A/B 프레임 검토 문장을 추가하거나, missing-password 조건에 신규 코드를 신설. `users-email-change.e2e-spec.ts:101` 인용을 `PASSWORD_INVALID` 로 정정.
3. plan_coherence WARNING: "변경안" 표에 `ws-token-expired-socket-lifetime-impl.md:65,69` 체크박스 전환 행을 추가.
4. INFO 4건은 선택 사항 — 이번 draft 반영을 막지 않음.
