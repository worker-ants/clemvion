# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**HIGH** — active worktree 간 동일 파일 동시 수정 충돌(merge 직전 직렬화 필수) + spec↔구현 역방향 드리프트 2건, 설계 근거 삭제 1건

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | active worktree `unified-model-mgmt-5af7ee` 가 `spec/5-system/1-auth.md` 와 `spec/5-system/16-system-status-api.md` 를 동시에 수정 — merge 전 직렬화 없으면 충돌 | `spec/5-system/1-auth.md` 전체, `spec/5-system/16-system-status-api.md` §2 규칙 3 + R-4 | `plan/in-progress/spec-draft-unified-model-management.md` (branch `claude/unified-model-mgmt-5af7ee`, active) | 두 branch 중 하나를 먼저 merge 하고 나머지가 rebase 후 충돌 해소. `1-auth.md` 는 섹션이 달라 수동 해소 가능. `16-system-status-api.md` getter→상수 치환은 동일 내용이므로 rebase 시 자동 skip 가능 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `security-backlog-invitation-token-hash.md` (미해결 결정 추적 plan) 삭제 + 연동된 `1-auth.md §1.5.D` Rationale 제거 — plan lifecycle 규칙 위반, 결정이 내려지지 않은 채 폐기 | `spec/5-system/1-auth.md` Rationale §1.5.D (삭제), `plan/in-progress/security-backlog-invitation-token-hash.md` (삭제) | plan lifecycle 규칙 — 미해결 결정은 `plan/complete/` 이동 전 결정 명시 필요 | target plan 에 security-backlog plan 삭제 근거 명시(해시 전환 확정 or 폐기). 삭제가 의도적이라면 `plan/complete/` 로 lifecycle 이동하고 Rationale 에 "구 결정 폐기" 사유 기록 |
| 2 | Plan Coherence / Rationale Continuity | `spec/5-system/1-auth.md §1.5.1` Rate Limit 행을 기존 구현값("분당 10건, `INVITATION_THROTTLE`")에서 "구현 시 결정"으로 되돌림 — spec↔구현 역방향 드리프트, health probe 작업 범위 외 변경 | `spec/5-system/1-auth.md` §1.5.1 Rate Limit 행 | origin/main 구현 현실 (`workspaces.controller.ts` invite·resend 엔드포인트, `data-flow/12-workspace.md §1.2`) | 되돌림 이유를 target plan 에 명시하거나 변경을 취소. 구현이 정확하다면 origin/main 값 유지 |
| 3 | Rationale Continuity | `spec/5-system/1-auth.md` Rationale 1.5.D 전체 삭제 — raw 토큰 저장 근거 소실, `§1.1` SHA-256 해시 원칙과의 예외 관계 설명이 사라짐 | `spec/5-system/1-auth.md` Rationale §1.5.D | `spec/5-system/1-auth.md §1.1` SHA-256 해시 저장 원칙 | 완전 삭제 대신 "(현재 raw 저장; 해시 전환 검토 중 — plan 참고)" 한 줄 축약 + plan link 유지. 삭제가 의도적이면 폐기 사유를 Rationale 에 명시 |
| 4 | Cross-Spec | `spec/data-flow/9-observability.md §1.4` 큐 수 "13개"가 SoT(`data-flow/0-overview.md §4`, 15개) 및 target spec(`16-system-status-api.md §1`, 15개)과 수치 불일치 | `spec/data-flow/9-observability.md §1.4` Mermaid 라벨·본문 | `spec/data-flow/0-overview.md §4` (SoT, 15개), `spec/5-system/16-system-status-api.md §1` (15개) | `9-observability.md §1.4` 의 Mermaid 라벨과 본문 "13개"를 "15개"로 교체 |
| 5 | Convention Compliance | `spec/5-system/16-system-status-api.md §2` swagger.md §5 응답 DTO 파일 위치·`ApiOkWrappedResponse` 헬퍼 사용 규약 적합성 미확인 | `spec/5-system/16-system-status-api.md` §2 응답 봉투 선언 | `spec/conventions/swagger.md §5-1`, `§5-3` | `codebase/backend/src/modules/system-status/dto/responses/system-status-response.dto.ts` 존재 여부 및 컨트롤러의 `ApiOkWrappedResponse` 헬퍼 사용 여부 구현 리뷰에서 확인 |
| 6 | Naming Collision | `spec/5-system/16-system-status-api.md` 규칙 3이 `@deprecated` 상수명(`FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD`)을 공식 식별자로 표기 — 실제 서비스 코드는 getter 함수 사용 | `spec/5-system/16-system-status-api.md` §2 규칙 3 | `system-status.service.ts:248-249` (getter 사용), `system-status.constants.ts:118,120` (`@deprecated` export) | spec 규칙 3 표현을 `recentFailed >= getFailedDegradedThreshold()` getter 형식으로 되돌리거나, "코드상수"→"코드 getter"로 기술 수정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | target spec 이 선언한 코드 레지스트리 미등재 2건(`makeshop-token-refresh`, `agent-memory-extraction`)이 `data-flow/9-observability.md §1.4`에 미반영 — API 계약(15개)과 실제 응답(13개) 불일치 방치 | `spec/5-system/16-system-status-api.md §1` NOTE, `spec/data-flow/9-observability.md §1.4` | 구현 갭(V-15) 해소 후 NOTE 제거 또는 "해소됨" 업데이트. 해소 전까지 `9-observability.md §1.4`에 갭 참조 병기 |
| 2 | Cross-Spec | `data-flow/9-observability.md §1.4` Mermaid edge 라벨이 `getFailed` 스캔 비용 특성 미반영 (기능 충돌 없음) | `spec/data-flow/9-observability.md §1.4` | 라벨을 `getJobCounts + isPaused + getFailed (recentFailed window scan)`으로 보강 가능. 선택적 |
| 3 | Rationale Continuity | `/api/health` probe 역할 liveness→readiness 번복 — Rationale 동봉 양호, 구 결정 폐기 명시됨 | `spec/5-system/3-error-handling.md §7.2`, `spec/data-flow/9-observability.md` Rationale | 조치 불필요 (처리 완료) |
| 4 | Rationale Continuity | `16-system-status-api.md §2` getter→상수 표현 교체 — dead code 제거 동기화, 의미·env 불변 | `spec/5-system/16-system-status-api.md §2` 규칙 3 | 필요 시 Rationale R-3에 getter→상수 전환 경위 한 줄 보존. 필수 아님 |
| 5 | Convention Compliance | `spec/5-system/16-system-status-api.md` 명시적 `## Overview` 섹션 부재 | `spec/5-system/16-system-status-api.md` 최상단 | `## Overview` 섹션 추가 또는 현 패턴을 공식 예외로 CLAUDE.md 에 명시. 기능적 문제 없음 |
| 6 | Convention Compliance | `spec/conventions/execution-context.md` 에서 `structuredOutputCache` 삭제 — 코드베이스 cross-reference 정합성 미확인 | `spec/conventions/execution-context.md` §1 | `spec/` 전체에서 `structuredOutputCache` 텍스트 검색으로 stale reference 유무 확인 권장 |
| 7 | Convention Compliance | `spec/5-system/16-system-status-api.md §1` 구현 갭 inline callout이 frontmatter `status: implemented`와 모순 | `spec/5-system/16-system-status-api.md` frontmatter + §1 callout | `status: partial` + `pending_plans: [V-15 plan 경로]`로 frontmatter 갱신 권장 |
| 8 | Naming Collision | `structuredOutputCache` — spec에서 제거됐으나 `node-handler.interface.ts` 및 다수 테스트 픽스처에 잔존. "Stable core" 목록 표현 범위 축소로 해석 가능 | `spec/conventions/execution-context.md`, `codebase/backend/src/nodes/core/node-handler.interface.ts` | `execution-context.md` 기존 "이 목록은 발췌" 주석으로 일관성 유지. 향후 제거 계획 시 `@deprecated` 마킹 권장 |
| 9 | Naming Collision | frontend k8s liveness probe가 `/api/health` 유지 — 의도적 설계, Rationale에 명시됨 | `k8s/base/frontend-deployment.yaml` | 조치 불필요 |
| 10 | Naming Collision | `HEALTH_CHECK_LOG` 신규 env var — 기존 사용처 없음, 충돌 없음 | `spec/5-system/16-system-status-api.md` | 조치 불필요 |
| 11 | Naming Collision | `/api/health/live` 신규 endpoint — 기존 사용처 없음, NestJS 라우팅 충돌 없음 | `codebase/backend/src/modules/health/health.controller.ts` | 조치 불필요 |
| 12 | Plan Coherence | `spec/5-system/16-system-status-api.md` §2 getter→상수 치환이 `unified-model-mgmt-5af7ee`와 동일 내용 중복 — 먼저 merge 된 쪽이 흡수하면 나머지 clean rebase 가능 | `spec/5-system/16-system-status-api.md` §2 규칙 3 | 먼저 merge 된 branch 변경이 포함되면 나머지 rebase 시 자동 skip 또는 동일 내용으로 해소 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `data-flow/9-observability.md §1.4` 큐 수 "13개" stale (WARNING), 구현 갭 data-flow 미반영 (INFO). CRITICAL 없음 |
| Rationale Continuity | LOW | `1-auth.md` Rate Limit 행 후퇴 + Rationale 1.5.D 삭제 (WARNING). probe 역할 번복 Rationale 양호 |
| Convention Compliance | LOW | swagger.md §5 응답 DTO 규약 구현 적합성 확인 필요 (WARNING). CRITICAL 없음 |
| Plan Coherence | HIGH | active worktree 간 동일 파일 동시 수정 (CRITICAL 1건), security-backlog plan 삭제 + Rate Limit 되돌림 (WARNING 2건) |
| Naming Collision | LOW | `@deprecated` 상수를 spec 공식 식별자로 표기 (WARNING). 신규 식별자 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 — 필수)** `unified-model-mgmt-5af7ee` branch 와 직렬화: 둘 중 하나를 먼저 merge 하고 나머지가 rebase 후 충돌 해소. `spec/5-system/1-auth.md` 는 섹션 분리라 수동 해소 단순. `spec/5-system/16-system-status-api.md` getter→상수 치환은 동일 내용이므로 rebase 시 자동 처리 가능.
2. **(WARNING 해소)** `security-backlog-invitation-token-hash.md` plan 삭제 결정을 target plan 에 명시: "해시 전환 보류·폐기" 여부를 결정하고 plan lifecycle 에 따라 `plan/complete/` 로 이동. 삭제한다면 Rationale 에 폐기 사유 기록.
3. **(WARNING 해소)** `spec/5-system/1-auth.md §1.5.1` Rate Limit 행 되돌림을 취소하거나 되돌린 이유를 target plan 에 명시. 기존 구현(분당 10건, `INVITATION_THROTTLE`)이 정확하다면 origin/main 값 복원.
4. **(WARNING 해소)** `spec/5-system/1-auth.md` Rationale 1.5.D 를 완전 삭제하지 말고 "(raw 저장 유지 — 해시 전환 검토 보류 또는 폐기)" 한 줄 + plan link 로 대체.
5. **(WARNING 해소)** `spec/data-flow/9-observability.md §1.4` 큐 수 "13개" → "15개" 교체 (Mermaid 라벨 + 본문).
6. **(WARNING 해소)** 구현 리뷰에서 `system-status` 모듈의 응답 DTO 파일 위치(`dto/responses/`) 및 `ApiOkWrappedResponse` 헬퍼 사용 여부 확인.
7. **(WARNING 해소)** `spec/5-system/16-system-status-api.md` §2 규칙 3 에서 `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` (`@deprecated`) 를 getter 함수명 또는 "코드 getter" 기술로 교체.
8. **(INFO — 권장)** `spec/5-system/16-system-status-api.md` frontmatter `status: partial` 로 변경 + `pending_plans` 에 V-15 plan 경로 등재.
9. **(INFO — 권장)** stale worktree `integration-expiry-fixes-1d7c7d`, `ws-resumed-ack-spec` 정리: `cleanup-worktree-all.sh --yes --force` 실행.