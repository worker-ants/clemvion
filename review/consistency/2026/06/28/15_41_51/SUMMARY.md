# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(plan 이동 누락, 구현 갭 plan 추적 미확인). INFO 다수는 문서 동기화 및 Rationale 보강 권장.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `spec-sync-webhook-gaps.md` 의 모든 항목이 완료됐으나 `plan/in-progress/` 에 잔류하고, `12-webhook.md` frontmatter `status: partial` · `pending_plans` 미갱신 | `spec/5-system/12-webhook.md` frontmatter; `plan/in-progress/spec-sync-webhook-gaps.md` | `.claude/docs/plan-lifecycle.md §2` — 완료 시 same-PR 이동 강제 | 동일 PR 에서 (1) plan 파일을 `plan/complete/`로 이동, (2) `12-webhook.md` frontmatter `status` → `implemented`, `pending_plans` 항목 제거 |
| 2 | Convention Compliance | `spec/5-system/16-system-status-api.md §1` 의 `agent-memory-extraction` 큐 구현 갭이 인라인 주석으로만 표기되고, 갭을 추적하는 `plan/in-progress/` 파일이 확인되지 않음 | `spec/5-system/16-system-status-api.md §1` 대상 큐 레지스트리 | `spec/conventions/spec-impl-evidence.md` — spec-impl 갭 추적 원칙 | V-15 갭을 추적하는 plan 파일이 있는지 확인하고, 없다면 신규 생성하거나 기존 plan 에 항목을 연결 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `data-flow/10-triggers.md` L98 "인증 webhook 무제한 통과" 표현이 1MB body-parser 게이트를 미반영해 오독 여지 | `spec/data-flow/10-triggers.md` L98 | Guard 범위에 한정된 qualifier 추가 ("본문 크기는 `/api/hooks/*` 라우트 스코프 1MB body-parser 별도 게이트") |
| 2 | Cross-Spec | `spec/7-channel-web-chat/4-security.md` L143 rate-limit 주석의 "인증 webhook 무제한 통과"가 body 크기 제한 맥락을 누락 | `spec/7-channel-web-chat/4-security.md` L143 | "rate-limit에 한함. 본문 크기는 라우트 스코프 body-parser 별도 게이트(SoT: WH-NF-02)" 단서 추가 |
| 3 | Cross-Spec | `12-webhook.md` 프런트매터 `code:` 목록에 `hooks-body-parser.ts` 누락 | `spec/5-system/12-webhook.md` frontmatter `code:` | `codebase/backend/src/bootstrap/hooks-body-parser.ts` 를 `code:` 목록에 추가 |
| 4 | Rationale Continuity | WH-NF-02 옵션 C 결정 근거(기각 옵션 A·B, `bodyParser: false` 순서 의존성, OOM 상한 클램프)가 `12-webhook.md ## Rationale` 에 미기재 | `spec/5-system/12-webhook.md ## Rationale` | "WH-NF-02 옵션 C — 분리 임계 구현" 항 추가; plan 완료 후 결정 소실 방지 |
| 5 | Rationale Continuity | `2-api-convention.md` · `3-error-handling.md` 에 `PAYLOAD_TOO_LARGE` 전역 표준 봉투 코드 등재 근거(도메인 전용 vs 전역 표준 공존 이유) 미기재 | `spec/5-system/2-api-convention.md ## Rationale`; `spec/5-system/3-error-handling.md ## Rationale` | 1~2행으로 두 코드 공존 근거 기재 |
| 6 | Convention Compliance | `spec/5-system/10-graph-rag.md` 에 `## Overview` 이중 선언(`## Overview (제품 정의)` + `## 1. 개요`) | `spec/5-system/10-graph-rag.md` | 두 Overview 섹션을 단일화 |
| 7 | Convention Compliance | `spec/5-system/_product-overview.md` 에 문서 수준 `## Overview` 섹션 부재 | `spec/5-system/_product-overview.md` | 최상단에 1~2줄 짜리 `## Overview` 맥락 설명 추가 (강제 아님) |
| 8 | Convention Compliance | `spec/5-system/10-graph-rag.md` 에 `## Rationale` 섹션 미존재 (`§4 기술 결정 사항` 이 대역하나 명칭 불일치) | `spec/5-system/10-graph-rag.md` | `## Rationale` 섹션 추가 후 `§4` 근거 열 내용 이식 |
| 9 | Naming Collision | `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING` 환경변수가 `.env.example` 에 미등재 | `codebase/backend/.env.example` | "Webhook Body Limits" 블록에 `HOOKS_MAX_BODY_BYTES=1048576` 및 `HOOKS_MAX_BODY_BYTES_CEILING` 주석 예시 추가 |
| 10 | Naming Collision | 프론트엔드 사용자 문서(`triggers.mdx`, `triggers.en.mdx`)가 인증 webhook 1MB 한도를 아직 "Planned"로 표기 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` L97·L151; `triggers.en.mdx` L86·L140 | 구현 완료 상태로 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | INFO 3건 — `data-flow/10-triggers.md` 및 `7-channel-web-chat/4-security.md` 의 "무제한 통과" 표현 qualifier 부재, frontmatter `code:` 누락. 직접 모순 없음. |
| Rationale Continuity | LOW | INFO 2건 — WH-NF-02 옵션 C 결정 근거 및 413 공존 근거 미기재. plan 완료 후 결정 추적 소실 위험. |
| Convention Compliance | LOW | WARNING 1건 (`agent-memory-extraction` 갭 plan 추적 미확인) + INFO 다수. CRITICAL 없음. |
| Plan Coherence | LOW | WARNING 1건 — 완료된 plan 이 `in-progress/`에 잔류, spec frontmatter stale. plan-lifecycle.md §2 위반. |
| Naming Collision | NONE | 식별자 충돌 0건. INFO 2건(`.env.example` 미등재, 프론트엔드 문서 stale). |

## 권장 조치사항
1. **(WARNING 해소 — 현행 PR 내)** `plan/in-progress/spec-sync-webhook-gaps.md` → `plan/complete/spec-sync-webhook-gaps.md` 이동 + `spec/5-system/12-webhook.md` frontmatter `status: partial` → `implemented`, `pending_plans` 항목 제거.
2. **(WARNING 해소)** `spec/5-system/16-system-status-api.md §1` 의 `agent-memory-extraction` V-15 갭을 추적하는 plan 파일 유무 확인 후 없으면 생성 또는 기존 plan 에 연결.
3. **(INFO 권장)** `spec/5-system/12-webhook.md ## Rationale` 에 WH-NF-02 옵션 C 결정 근거(기각 옵션 A·B, `bodyParser: false` 순서 의존성, OOM 상한 클램프) 추가.
4. **(INFO 권장)** `spec/data-flow/10-triggers.md` L98 및 `spec/7-channel-web-chat/4-security.md` L143 의 "무제한 통과" 표현에 body-parser 게이트 qualifier 추가.
5. **(INFO 권장)** `codebase/backend/.env.example` 에 `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING` 주석 예시 추가.
6. **(INFO 권장)** 프론트엔드 사용자 문서(`triggers.mdx`, `triggers.en.mdx`)의 인증 webhook 1MB 한도를 구현 완료 상태로 갱신.
7. **(INFO 낮은 우선순위)** `spec/5-system/12-webhook.md` frontmatter `code:` 에 `hooks-body-parser.ts` 추가; `2-api-convention.md` · `3-error-handling.md` Rationale 에 413 공존 근거 1~2행 기재; `10-graph-rag.md` Overview 이중 선언 단일화 및 `## Rationale` 섹션 추가.