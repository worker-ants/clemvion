# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 구현 착수 가능

## 전체 위험도
**MEDIUM** — Warning 5건 존재(에러 코드 카탈로그 누락 2건, Rationale 이중화 1건, API catalog id 명명 불일치 1건, spec 이중 구조 1건); 구현 차단 사유 없으나 착수 전 인지 필요

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale Continuity (통합) | R-2 Rationale 이 R-14 채택 이후에도 폐기된 `config.hmacSecret` inline 경로와 `POST /api/triggers/:id/auth/rotate-secret` v1.1 예약 경로를 유효한 것처럼 기술 | `spec/2-navigation/2-trigger-list.md §Rationale R-2` | 동일 파일 §Rationale R-14 및 §3 API 주석 | R-2 도입부에 "본 결정은 R-14 로 대체됨 — `config.hmacSecret` inline 경로 및 v1.1 rotate 예약 경로 모두 폐기" 명시. 또는 R-2 를 삭제하고 R-14 를 인증 정책 단일 SoT 로 지정 |
| W-2 | Naming Collision | `TRIGGER_ENDPOINT_PATH_CONFLICT` 에러 코드가 공식 카탈로그에 미등록; 구현 코드에도 해당 문자열 확인 불가 | `spec/2-navigation/2-trigger-list.md §2.3.1, §3` | `spec/5-system/3-error-handling.md §1.2` 카탈로그 | `3-error-handling.md §1.2` 에 `TRIGGER_ENDPOINT_PATH_CONFLICT` 행 추가(`RESOURCE_CONFLICT` 특화, 409); 구현 코드(`triggers.service.ts`)에도 문자열 리터럴 추가 확인 |
| W-3 | Naming Collision | `AUTH_CONFIG_NOT_FOUND` 에러 코드가 공식 카탈로그에 미등록; 구현(`triggers.service.ts` line 502)에는 발행 중 | `spec/2-navigation/2-trigger-list.md §3` | `spec/5-system/3-error-handling.md §1.2` 카탈로그 | `3-error-handling.md §1.2` 에 `AUTH_CONFIG_NOT_FOUND` 행 추가(`RESOURCE_NOT_FOUND` AuthConfig 특화, 404), 또는 generic `RESOURCE_NOT_FOUND` 로 통일 후 spec 본문 수정 |
| W-4 | Convention Compliance | `spec/conventions/cafe24-api-catalog/application.md` 의 `webhooks_update` id 가 sub-resource `setting` 을 생략 (`<resource>_<sub>_<verb>` 패턴 위반) | `application.md` 표 `webhooks_update` 행 | `spec/conventions/cafe24-api-catalog/_overview.md §2` 명명 규칙; 동일 파일 `webhooks_logs_list` 등 복합 경로 선례 | `webhooks_update` → `webhooks_setting_update` 로 변경; backend 메타데이터(`application.ts`) 및 `catalog-sync.spec.ts` 연동 갱신; 클라이언트-노드 계약 파급 범위 선확인 |
| W-5 | Convention Compliance | `spec/2-navigation/14-execution-history.md` 에 `## Overview (제품 정의)` 와 `## 1. 개요` 가 이중으로 공존 — 영역 내 다른 spec 파일과 패턴 불일치 | `14-execution-history.md` 18행, 75행 | `spec/conventions/` 3섹션 권장 구조; 동일 영역 `0-dashboard.md` 등 단일 패턴 파일 | `## Overview (제품 정의)` 내용을 `_product-overview.md` 로 이관하거나, `## 1. 개요` 를 삭제해 단일 구조로 통합 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | §2.1 더보기(⋮) 카드 목록에 "Chat Channel 카드" 가 암묵적으로 누락; §2.3 에서 명시 정의됨 | `spec/2-navigation/2-trigger-list.md §2.1` | "메타·인증·Schedule·EIA·Chat Channel(해당 시) 카드 노출" 로 동기화 |
| I-2 | Rationale Continuity | §4.2 이름 타이핑 삭제 패턴이 `_layout.md` / `spec/conventions/` 로 미이전 (spec 주석에 이전 예고 있음) | `spec/2-navigation/2-trigger-list.md §4.2` | 삭제 UX 구현이 포함될 경우 convention 먼저 정의 후 교차 참조; 범위 외이면 보류 가능 |
| I-3 | Convention Compliance | `spec/2-navigation/15-system-status.md`, `16-agent-memory.md` — `## Overview` 절 없이 본문 직접 시작 (영역 norm 과 일치) | `15-system-status.md` 14행, `16-agent-memory.md` 17행 | 다음 spec 편집 시 `## Overview (제품 정의)` 절 추가 고려 (의무 아님) |
| I-4 | Convention Compliance | `spec/2-navigation/2-trigger-list.md` — `## Overview` 절 없이 본문 시작 (영역 norm; Rationale 절은 충분히 구현됨) | `2-trigger-list.md` 21행 | I-3 과 동일 |
| I-5 | Convention Compliance | `spec/conventions/cafe24-api-catalog/application/apps.md` — `entity: apps` (단수)와 operation id `applications_list` (복수) 혼재; docs 원문 불일치의 결정적 전사 | `apps.md` frontmatter, `application.md` 표 | docs 원문 불일치는 카탈로그 변경 대상 아님; `plan/in-progress/cafe24-backlog-residual.md §G-2` 기존 추적 트랙 유지 |
| I-6 | Plan Coherence | `spec/2-navigation/2-trigger-list.md` frontmatter 에 `pending_plans` 미등재 — M-8 plan 미참조 | `2-trigger-list.md` frontmatter | 필수 아님 (M-8 은 구현 리팩터, spec 변경 아님); 원할 경우 planner 트랙에서 처리 |
| I-7 | Plan Coherence | TBD 미결정 항목(R-2, `hmacSecret` v1.1 rotate) — M-8 구현 범위와 직교하나, WebhookConfigCard 구현 시 오해 가능성 | `2-trigger-list.md §Rationale R-2` | M-8 에서 `hmacSecret` rotate UI 추가하지 않도록 주의; TBD 는 별도 spec 결정 트랙 |
| I-8 | Plan Coherence | `trigger-review-deferred-fixes.md` W1(`endpoint_path` 서버 UUID 강제 미적용) — M-8 완료 후 W1 fix 시 `lib/api/triggers.ts` 재방문 필요 | `2-trigger-list.md §3, §5` | M-8 구현 메모 등록; W1 착수 시 `lib/api/triggers.ts` 변경 범위 재확인 |
| I-9 | Naming Collision | `spec/2-navigation/` 파일 번호 시퀀스에 `12-` 번 공백 | `spec/2-navigation/` 폴더 목록 | `_product-overview.md` 또는 `_layout.md` 에 "12번 의도적 공백 또는 예약" 주석 한 줄 추가 |
| I-10 | Naming Collision | `systemStatus.counts.failed` i18n 키 의미 변경 — spec 이 갱신 지시를 포함하나 구현 연동 누락 시 불일치 창 발생 | `spec/2-navigation/15-system-status.md §3` | 구현 착수 시 i18n 파일과 신규 키를 단일 커밋으로 묶어 갱신 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | R-2 Rationale 미갱신(W-1 통합); 타 영역 spec 과 교차 일관성 양호 |
| Rationale Continuity | LOW | R-2 가 R-14 에 의해 부분 무효화됐으나 갱신 미완료(W-1 통합); 나머지 Rationale 연속성 이상 없음 |
| Convention Compliance | MEDIUM | `webhooks_update` id 명명 불일치(W-4), `14-execution-history.md` 이중 구조(W-5); 핵심 출력 형식 규약 전반 준수 |
| Plan Coherence | NONE | M-8 착수 조건 충족; CRITICAL 충돌 없음; 선행 plan 미해소 차단 없음 |
| Naming Collision | LOW | 에러 코드 2건 카탈로그 미등록(W-2, W-3); 요구사항 ID·API 엔드포인트 충돌 없음 |

## 권장 조치사항

1. **(W-1 — 착수 전 권장)** `spec/2-navigation/2-trigger-list.md §Rationale R-2` 에 "R-14 채택으로 폐기됨" 주석 추가 또는 R-2 삭제 — M-8 `WebhookConfigCard` 구현 시 `hmacSecret` 필드를 잘못 추가하는 오해 예방.
2. **(W-2 / W-3 — 구현과 병행 또는 후속)** `spec/5-system/3-error-handling.md §1.2` 에 `TRIGGER_ENDPOINT_PATH_CONFLICT`(409) 및 `AUTH_CONFIG_NOT_FOUND`(404) 카탈로그 행 추가; 구현 코드(`triggers.service.ts`)와 대조해 문자열 일치 확인.
3. **(W-4 — 차기 catalog 편집 시)** `spec/conventions/cafe24-api-catalog/application.md` 의 `webhooks_update` → `webhooks_setting_update` id 변경; 파급 범위 선확인 후 backend 메타데이터 동시 갱신.
4. **(W-5 — 차기 spec 정비 시)** `spec/2-navigation/14-execution-history.md` Overview 이중 구조 해소 — planner 트랙에서 처리.
5. **(I-7 주의)** M-8 구현 중 `WebhookConfigCard` 에 `hmacSecret` rotate UI 를 추가하지 않도록 주의 (TBD 미결정 항목).