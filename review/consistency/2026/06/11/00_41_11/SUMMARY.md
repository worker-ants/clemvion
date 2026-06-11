# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**MEDIUM** — spec/2-navigation/14-execution-history.md 의 문서 구조 비표준(WARNING 3건)과 Rationale 동기화 누락(WARNING 2건)이 있으나, 구현 정합성 또는 로직 오류를 유발하는 Critical 항목은 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `spec/1-data-model.md` §2.10 `status_reason` 열거에 `unknown` 이 `unknown_error` 로 갱신되지 않음 | `spec/1-data-model.md` §2.10 `Integration.status_reason` `error` 허용값 목록 | `spec/2-navigation/4-integration.md` §5.4 및 `spec/data-flow/5-integration.md` §3.2 (두 파일 모두 `unknown_error` 사용) | `spec/1-data-model.md` §2.10 의 `unknown` → `unknown_error` 로 교체. "현행" 주석 삭제 또는 업데이트. `INTEGRATION_STATUS_REASONS` union 이 SoT |
| W-2 | Rationale Continuity | `integration_action_required` 정식 도입 후에도 Rationale 의 "향후 신설 검토" 문구가 잔존 | `spec/2-navigation/4-integration.md` `## Rationale` "refresh 실패 시 status_reason 통일" 항 | `spec/2-navigation/4-integration.md` §11.1/§11.2 본문 (active 알림 발사 이미 명시) | Rationale 해당 항 문구를 결정 완료로 갱신: "`integration_action_required` 를 §11.2 에 정식 도입해 error(*) 전이 시 active 알림 발사 결정 — passive `integration_expired` 와의 구분 원칙 유지" |
| W-3 | Rationale Continuity | `isRefreshCapable` 에 makeshop 포함 결정 근거가 Rationale 에 없음 | `spec/2-navigation/4-integration.md` §11.1 표·의사코드·MakeShop 주석 | 동 파일 `## Rationale` (cafe24 전용 refresh 경로만 기술, makeshop 포함 결정 미기록) | Rationale 에 `isRefreshCapable — makeshop 포함 결정` 항 신설. 핵심: (a) cafe24·makeshop 모두 refresh_token 보유→`expired` 격하 거짓양성 방지, (b) makeshop 은 in-call proactive/reactive_401 자가회복으로 배경-큐 불필요, (c) 기각 대안: makeshop 을 스캐너에서 `expired` 격하→정상 동작 integration 이 불필요하게 재연결 요청 받는 UX 문제 |
| W-4 | Convention Compliance | `14-execution-history.md` — 하나의 파일 안에 PRD 성격 Overview 레이어와 기술 명세 본문이 병렬 배치 (3섹션 문서 구조 권장 위배) | `spec/2-navigation/14-execution-history.md` 라인 1242–1316 (`## Overview (제품 정의)` 블록) 및 이하 본문 섹션 | CLAUDE.md "정보 저장 위치" 규약 (`spec/<영역>/_product-overview.md` 분리 또는 `## Overview` 단일 절 권장) | `## Overview (제품 정의)` 내용을 `_product-overview.md` 로 통합하거나 파일 상단 `## Overview` 단일 절로 정리. `(제품 정의)` 부가어 제거 |
| W-5 | Convention Compliance | `14-execution-history.md` — `code:` frontmatter 에 `executions.controller.ts` 누락 가능성 | `spec/2-navigation/14-execution-history.md` frontmatter `code:` 필드 | `spec/conventions/spec-impl-evidence.md §2.1` (`status: implemented` 이면 ≥1 매치 의무) | `codebase/backend/src/modules/executions/executions.controller.ts` 를 `code:` 에 추가 |
| W-6 | Convention Compliance | `14-execution-history.md` §3.5 에러 상태 표에 `error.code` 값 미정의 — 타 spec 파일과 일관성 차이 | `spec/2-navigation/14-execution-history.md` §3.5 에러 상태 표 | `spec/conventions/error-codes.md §1` (에러 코드 `UPPER_SNAKE_CASE` 표기) / 타 spec 파일 (`1-workflow-list.md §3` 등 에러 code 명시) | §3.5 에러 상태 표에 API 응답 `error.code` 값을 `UPPER_SNAKE_CASE` 로 병기 (`NOT_FOUND`, `INTERNAL_SERVER_ERROR` 등) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/1-data-model.md` §2.20 `Notification.type` 의 `integration_expired` 설명에 refresh-capable 제외 맥락 미동기 | `spec/1-data-model.md` §2.20 `integration_expired` 설명 행 | "refresh-capable provider (cafe24·makeshop) 는 발사 제외 — §11.2 참조" 한 줄 추가 (강제 아님) |
| I-2 | Cross-Spec | `spec/data-flow/5-integration.md` §1.4 sequenceDiagram 에서 `Scan->>Noti` 행이 `isRefreshCapable` alt 블록 바깥에 위치 — diagram 이 "refresh-capable 에도 알림 발사"처럼 읽힘 | `spec/data-flow/5-integration.md` §1.4 `connected-expiry` sequenceDiagram | `Scan->>Noti` 행을 `else refresh_token 없는 provider` 블록 안으로 이동 |
| I-3 | Rationale Continuity | `unknown` → `unknown_error` 리네이밍의 근거가 Rationale 에 미기록 | `spec/2-navigation/4-integration.md` §5.4 / `## Rationale` | Rationale 또는 §5.4 인라인 주석에 "에러 코드 정규화 컨벤션과의 통일" 한 줄 추가 |
| I-4 | Convention Compliance | `14-execution-history.md` `## Overview (제품 정의)` 바로 아래 `---` 위치 이상 | `spec/2-navigation/14-execution-history.md` 라인 1243–1244 | 구분선을 섹션 종료 후로 이동하거나 제거 |
| I-5 | Convention Compliance | `15-system-status.md` Rationale 하위 항목 번호 형식 `### R-N.` 혼용 (규약 강제 아님) | `spec/2-navigation/15-system-status.md` `## Rationale` R-1, R-2, R-3 | 영역 내 `### R-N.` 형식 유지로 충분 |
| I-6 | Convention Compliance | `16-agent-memory.md` `## 3. 요구사항` 절이 위임 문장 한 줄만 보유 | `spec/2-navigation/16-agent-memory.md` §3 | 절 제거 또는 `_product-overview.md` 특정 앵커 링크 추가 |
| I-7 | Plan Coherence | 병렬 active worktree `unified-model-mgmt-5af7ee` 가 `spec/2-navigation/` 수정 중이나 `4-integration.md` 는 미접촉 — 파일 경합 없음 | `plan/in-progress/unified-model-management.md` | 인지용 기록. 충돌 없음 |
| I-8 | Plan Coherence | spec-sync gap plan 들의 `worktree: spec-sync-audit` 필드가 존재하지 않는 브랜치를 가리킴 (stale sentinel) | `plan/in-progress/spec-sync-config-gaps.md` 외 다수 | `worktree` 필드를 `(unstarted)` 로 초기화하거나 실제 작업 시 새 worktree 배정 |
| I-9 | Plan Coherence | `spec-code-cross-audit-2026-06-10.md` 의 "코드 주석 stale" 후속 항목이 본 PR 확정 `isRefreshCapable` 네이밍을 전제해야 함 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 해당 계획서에 `isCafe24RefreshCapable` → `isRefreshCapable` 전제 메모 추가 |
| I-10 | Naming Collision | `token_expired` (DB 슬러그) vs `TOKEN_EXPIRED` (JWT REST 에러 코드) vs `auth.token_expired` (WS 이벤트) — 유사 표기 동시 존재 | `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md` | spec diff 에 "별개 네임스페이스" 주석 이미 추가됨. 추가로 `integration-status-reason.ts` 의 `token_expired` 항목 주석에 "JWT REST `TOKEN_EXPIRED`·WS `auth.token_expired` 와 별개" 경고 추가 권장 |
| I-11 | Naming Collision | `unknown_error` 대체 확정 — DB 에 잔존하는 `status_reason='unknown'` 레거시 행 존재 가능성 | DB `integrations.status_reason` 컬럼 | `normalizeStatusReason` 이 API 레벨에서 변환하므로 즉각 위험 없음. 향후 DB 정리 마이그레이션 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `spec/1-data-model.md` §2.10 `status_reason` 열거 `unknown_error` 동기화 누락(WARNING 1건) + INFO 2건 |
| Rationale Continuity | LOW | `integration_action_required` 정식 채택 후 Rationale 문구 미갱신(WARNING) + `isRefreshCapable` makeshop 포함 결정 Rationale 미기록(WARNING) |
| Convention Compliance | MEDIUM | `14-execution-history.md` 문서 구조 비표준 3건(WARNING) — 타 파일은 INFO 2건 |
| Plan Coherence | NONE | 파일 경합 없음, stale worktree sentinel 1건(INFO) |
| Naming Collision | LOW | `token_expired` 유사 표기 공존(INFO, 이미 주석 대응), `unknown_error` 대체 DB 레거시(INFO) |

## 권장 조치사항
1. **(W-1 해소 — 우선)** `spec/1-data-model.md` §2.10 `status_reason` 행의 `error` 허용값 목록에서 `unknown` → `unknown_error` 교체 및 "현행" 주석 갱신.
2. **(W-2·W-3 해소)** `spec/2-navigation/4-integration.md` `## Rationale` 에 (a) `integration_action_required` 정식 채택 완료 문장으로 갱신, (b) `isRefreshCapable — makeshop 포함 결정` 항 신설.
3. **(W-4 해소)** `spec/2-navigation/14-execution-history.md` 의 `## Overview (제품 정의)` 블록을 `_product-overview.md` 로 분리하거나 단일 `## Overview` 절로 통합. `(제품 정의)` 부가어 제거.
4. **(W-5 해소)** `spec/2-navigation/14-execution-history.md` frontmatter `code:` 에 `codebase/backend/src/modules/executions/executions.controller.ts` 추가.
5. **(W-6 해소)** `spec/2-navigation/14-execution-history.md` §3.5 에러 상태 표에 `error.code` 값을 `UPPER_SNAKE_CASE` 로 병기.
6. **(I-2 권장)** `spec/data-flow/5-integration.md` §1.4 sequenceDiagram 의 `Scan->>Noti` 행을 `else` 블록 안으로 이동해 diagram 판독을 spec 의사코드와 일치.
7. **(I-8 권장)** stale `worktree: spec-sync-audit` 가 적힌 gap plan frontmatter 를 `(unstarted)` 로 일괄 초기화.