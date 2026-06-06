# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 차단 사유 없음.

## 전체 위험도
**LOW** — spec 명칭 동기화 미완료(WARNING 3건 통합) 및 plan lifecycle 정리 권고(INFO 3건). Critical 위반 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec / Rationale Continuity / Convention Compliance / Naming Collision (4개 checker 공통) | `driveResumeDetached` → `driveResumeAwaited` rename 이 코드에서 완료됐으나 spec 본문에 구 이름 잔존 | `spec/5-system/4-execution-engine.md` L128, L903, L1306, L1311; `spec/data-flow/3-execution.md` L111, L113 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (rename 완료) | `spec/5-system/4-execution-engine.md` 4곳 및 `spec/data-flow/3-execution.md` 2곳의 `driveResumeDetached` 를 `driveResumeAwaited` 로 교체. `project-planner` 범주 spec 갱신 (developer 는 spec 읽기 전용). plan `exec-park-polish.md §A1` "spec 2곳 rename" 미완료 상태이므로 이번 PR 내 완료 권장. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec / Rationale Continuity / Convention Compliance | `InteractionTokenService` 생성자 prod fail-closed(부팅 throw) 동작이 spec §8.3 에 미반영 — 현재 spec 은 "권고" 수준 서술 | `spec/5-system/14-external-interaction-api.md §8.3` | §8.3 에 "프로덕션(`NODE_ENV=production`)에서 `INTERACTION_JWT_SECRET`·`JWT_SECRET` 둘 다 미설정 시 서버 부팅 차단(fail-closed)" 을 명시. `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 부팅 가드 패턴과 동형으로 기술. `project-planner` 위임. |
| I2 | Cross-Spec | `.env.example` `LLM_STUB_MODE=false` 추가 — `spec/5-system/7-llm-client.md §7.1` 과 완전 정합 | `.env.example` L207-211 | 조치 불필요. |
| I3 | Rationale Continuity | `ProcessTurnResult` named type alias 도입 — Rationale 미기록이나 충돌 없음 | `execution-engine.service.ts` L285 | 필요 시 Rationale 에 "처리기 반환 타입을 `ProcessTurnResult` named alias 로 통일 (ai-review W11)" 한 줄 추가해 추적성 확보. |
| I4 | Convention Compliance | `spec/5-system/4-execution-engine.md` 에 `## Overview` 섹션 미존재 — 제목 직하 `> 관련 문서:` 블록이 암묵 대체 | `spec/5-system/4-execution-engine.md` 전체 구조 | 현상 유지 가능(프로젝트 전체 관행). 향후 spec 개정 시 `## Overview` 추가 또는 규약에 "관련 문서 블록이 Overview 대역으로 인정" 명시 고려. |
| I5 | Plan Coherence | `exec-park-durable-resume.md` 및 `exec-park-b2a-followup.md` 가 PR MERGED 완료 후에도 `plan/in-progress/` 에 잔존 | `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/exec-park-b2a-followup.md` | 두 파일을 `plan/complete/` 로 이동 (plan-lifecycle 규약). `exec-park-polish.md` "비차단 후속" 메모에서도 이 이동이 명시됨. |
| I6 | Plan Coherence | `security-jwt-secret-fallback.md` 의 글로벌 `JWT_SECRET` 부팅 가드 결정이 열려 있으며, target B2(InteractionTokenService fail-closed)와 scope 가 구분됨 | `plan/in-progress/security-jwt-secret-fallback.md` | `security-jwt-secret-fallback.md` 에 "InteractionTokenService fail-closed 는 exec-park-polish 에서 별도 완료" 메모 추가 권장. |
| I7 | Naming Collision | `ProcessTurnResult`, `LLM_STUB_MODE`, `INTERACTION_JWT_SECRET` — 기존 사용처와 완전 정합, 신규 충돌 없음 | 각 신규 도입 위치 | 조치 불필요. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `driveResumeDetached` spec 잔존(W1), `InteractionTokenService` fail-closed spec 미반영(I1) |
| Rationale Continuity | LOW | `driveResumeDetached` spec/Rationale 잔존(W1), `InteractionTokenService` Rationale 보완 권고(I1) |
| Convention Compliance | LOW | `driveResumeDetached` spec 잔존(W1), Overview 섹션 미존재(I4) |
| Plan Coherence | NONE | plan lifecycle 정리 권고(I5, I6), 구현 정합 완전 |
| Naming Collision | LOW | `driveResumeDetached`/`driveResumeAwaited` spec-code 명칭 불일치(W1), 신규 충돌 없음 |

## 권장 조치사항
1. **(WARNING 해소 — 이번 PR 내 완료 권장)** `spec/5-system/4-execution-engine.md` L128, L903, L1306, L1311 과 `spec/data-flow/3-execution.md` L111, L113 의 `driveResumeDetached` 를 `driveResumeAwaited` 로 교체. `project-planner` 가 spec 갱신 수행. plan `exec-park-polish.md §A1` 명시 범위.
2. **(INFO — 후속 spec 갱신)** `spec/5-system/14-external-interaction-api.md §8.3` 에 `InteractionTokenService` 프로덕션 fail-closed 동작 명시. `project-planner` 위임.
3. **(INFO — plan lifecycle)** `plan/in-progress/exec-park-durable-resume.md` 및 `plan/in-progress/exec-park-b2a-followup.md` 를 `plan/complete/` 로 이동.
4. **(INFO — 추적성)** `security-jwt-secret-fallback.md` 에 InteractionTokenService scope 분리 메모 추가.