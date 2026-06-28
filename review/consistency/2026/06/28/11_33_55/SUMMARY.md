# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — 동일 문서 내 §3.1 본문 크기(1MB) 기술이 WH-NF-02·§8 과 불일치하고, §1 아키텍처 다이어그램이 chatChannel 분기 선행 invariant 를 미반영. 두 항목 모두 기존 합의를 표/다이어그램에 반영하지 않은 누락이며, 신규 결정 번복 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale / Plan | §3.1 API 표 "요청 본문 최대 크기 1MB" 가 WH-NF-02·§8 의 "현행 공개 32KB / 인증 무제한 (1MB 통일 Planned)" 와 불일치. 외부 영역 `spec/7-channel-web-chat/4-security.md` 의 32KB 기술과도 표면 충돌 | `spec/5-system/12-webhook.md` §3.1 표 | 동일 파일 WH-NF-02·§8 / `spec/7-channel-web-chat/4-security.md §4` / `plan/in-progress/spec-sync-webhook-gaps.md` 항목 2 (A/B/C 결정 미확정) | plan 결정 옵션(A/B/C) 사용자 확정 후 §3.1 표를 단일 진실로 동기화. 결정 전까지 §3.1 표에 "결정 전 Planned — WH-NF-02 참조" 명시 보정 권장 |
| W-2 | Rationale | §1 아키텍처 다이어그램이 `chatChannel` 분기 선행 + 인증-then-isActive 순서를 표현하지 않아 WH-EP-07·§7 step 5·Chat Channel R-CC-12 의 합의 invariant 와 어긋나는 misleading 표현 | `spec/5-system/12-webhook.md` §1 다이어그램 (`2. isActive 확인` → `3. 인증 검증`) | 동일 파일 WH-EP-07·§7 step 5 / `spec/5-system/15-chat-channel.md ## Rationale R-CC-12 (d)` | 다이어그램에 chatChannel 분기 선행 경로를 간략히 추가하거나, "※ chatChannel 트리거는 단계 2–3 순서 반전 — §7 참조" 주석 추가. 또는 일반 webhook 경로만임을 명시 |
| W-3 | Convention | `AUTH_FAILED`(401)가 `spec/5-system/3-error-handling.md §1.7` 공용 카탈로그에 미등재. webhook spec 에서 인증 실패 단일 응답으로 반복 사용되나 카탈로그 진입점 없음 | `spec/5-system/12-webhook.md` WH-SC-04·WH-SC-09·§4·§7 step 6c/6g | `spec/5-system/3-error-handling.md §1.7` | `3-error-handling.md §1.7` 에 `AUTH_FAILED \| 401 \| 인증 실패(type 무관 단일 응답 — WH-SC-04) \| 구현` 행 추가 |
| W-4 | Convention | 내부 throw `reason` 값(`missing_required` / `coerce_failed`)이 `spec/conventions/error-codes.md §4` 내부 전용 코드 등재 패턴에 따라 공식 등재되지 않아 컨벤션 정합이 명시적으로 입증되지 않음 | `spec/5-system/12-webhook.md` §5.2 현행 블록 내 note | `spec/conventions/error-codes.md §4` | `error-codes.md §4` 에 `missing_required` / `coerce_failed` 를 내부 분류 코드 행으로 추가하거나, §5.2 note 에 "이 값들은 `error-codes.md §4` 내부 전용 분류 코드이며 클라이언트로 surface 되지 않는다" 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | WH-EP-03 "GET/PUT 미지원" 표현이 API 규약 §11.6의 `405 Method Not Allowed` 명시 없이 기술 | `spec/5-system/12-webhook.md` WH-EP-03 | WH-EP-03에 "미지원 메서드는 `405 Method Not Allowed`" 추가 |
| I-2 | Cross-Spec | webhook spec §5 adapter input 표에 다운스트림 접근 경로(`$node["Manual Trigger"].output.request.*`) 누락 | `spec/5-system/12-webhook.md` §5 | §5 표에 "다운스트림 expression 경로는 [manual-trigger §5.2] 참조" 크로스링크 추가 (기능 충돌 아님) |
| I-3 | Cross-Spec | WH-SC-09 ip_whitelist fail-closed 정책이 data-model §2.17.5 Rationale 과 일관 — 추가 조치 불필요 | `spec/5-system/12-webhook.md` WH-SC-09 | 모니터링만 |
| I-4 | Rationale | WH-MG-04 "사용자 명시 토글" 표현이 R-4·R-16·EIA R6 와 완전 정합 — 추가 조치 불필요 | `spec/5-system/12-webhook.md` WH-MG-04 | 추가 조치 불필요 |
| I-5 | Convention | `§5.2` 목표 JSON 예시의 `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` 가 `UPPER_SNAKE_CASE` 규약 준수 확인 (양호) | `spec/5-system/12-webhook.md` §5.2 목표 블록 | 구현 PR 시 `3-error-handling.md §1.7` note 를 Planned → 구현으로 업그레이드 |
| I-6 | Convention | `## Overview` 내 `### 1~4` 번호와 본문 `## 1~10` 번호가 공존해 독자가 "1번이 두 개"로 혼란 가능. Anchor URL 실충돌은 없음 | `spec/5-system/12-webhook.md` 문서 구조 | Overview 내 하위 절을 번호 없이 `### 개요` / `### 사용 시나리오` 등으로 표기 (선택사항) |
| I-7 | Convention | `§5.2` 내 `error-handling §1.6` 참조 — 논리적으로 맞으나 §1.7(webhook 자체 선례)도 함께 참조하는 것이 더 명확 | `spec/5-system/12-webhook.md` §5.2 목표 블록 | `§1.6 (EIA 선례) 및 §1.7 (webhook 자체 선례)` 로 두 곳 병기 (선택사항) |
| I-8 | Plan | §5.2 현행/목표 이중 구조는 plan 과 정합 유지 중. 구현 완료 시 현행 블록 제거 및 plan 항목 1 체크박스 닫기 필요 | `spec/5-system/12-webhook.md` §5.2 | 구현 완료 후 후속 조치 |
| I-9 | Naming | `spec/7-channel-web-chat/5-admin-console.md` 의 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 언급이 SoT(`WH-EP-02`) 역참조 누락 | `spec/7-channel-web-chat/5-admin-console.md` L154/L266 | `NEXT_PUBLIC_WEBHOOK_BASE_URL` 관련 행에 "SoT: WH-EP-02" 주석 추가 |
| I-10 | Naming | `AUTH_FAILED` 식별자가 data-model·data-flow·webhook spec 에서 동일 의미로 사용 — 의미 충돌 없음. 카탈로그 미등재는 W-3 에서 처리 | 여러 파일 | W-3 처리로 해소 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §3.1 본문 크기 1MB 가 외부 영역 spec 과 표면 충돌(W-1 공유). WH-EP-03 405 코드 미명시(I-1) |
| Rationale Continuity | MEDIUM | §1 다이어그램이 chatChannel 분기 선행 invariant 미반영(W-2). §3.1 표가 Planned 합의 역행(W-1 공유) |
| Convention Compliance | LOW | AUTH_FAILED 카탈로그 미등재(W-3). 내부 reason 값 §4 미등재(W-4). 기타 INFO 수준 형식 이슈 |
| Plan Coherence | LOW | §3.1 "1MB" 가 A/B/C 미확정 결정을 사전 채택한 것처럼 읽힘(W-1 공유). §5.2 이중 구조는 정합 유지 중 |
| Naming Collision | NONE | 요구사항 ID·타입명·엔드포인트·에러 코드 모두 충돌 없음. ENV var SoT 역참조 누락 INFO 1건 |

## 권장 조치사항

1. **(W-1 해소 우선)** `plan/in-progress/spec-sync-webhook-gaps.md` 의 본문 크기 결정 옵션(A/B/C)을 사용자와 확정한 뒤, `spec/5-system/12-webhook.md` §3.1 표·WH-NF-02·§8 을 단일 진실로 동기화. 확정 전까지 §3.1 표에 "Planned — WH-NF-02·spec-sync-webhook-gaps.md 참조" 보정 추가.
2. **(W-2)** `spec/5-system/12-webhook.md` §1 아키텍처 다이어그램에 chatChannel 분기 선행 경로 표현 추가 또는 "일반 webhook 경로만" 명시 주석 추가.
3. **(W-3)** `spec/5-system/3-error-handling.md §1.7` 에 `AUTH_FAILED | 401 | 인증 실패(WH-SC-04)` 행 추가.
4. **(W-4)** `spec/conventions/error-codes.md §4` 에 `missing_required` / `coerce_failed` 내부 분류 코드 등재, 또는 `spec/5-system/12-webhook.md §5.2` note 에 `error-codes.md §4` 내부 전용 명시 추가.
5. **(I-9 — 선택)** `spec/7-channel-web-chat/5-admin-console.md` L154/L266 의 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 행에 "SoT: WH-EP-02" 주석 추가.
