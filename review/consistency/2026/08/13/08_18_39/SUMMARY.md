# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — Critical 없음. target(`plan/in-progress/backend-lint-gate-broken-on-main.md`)이 이번 turn에 착지시킨 EIA idempotency 캐시 스코프(`interaction:idempotency:${executionId}:${route}:${rawKey}`)는 spec SoT(`5-system/14`·`data-flow/15`) 및 실제 코드와 정확히 일치해 신규 충돌 없음. target이 스스로 이미 추적 중인 두 미해결 항목(chat-channel EIA 메커니즘 오적용 전제, EIA Redis 키 §9.1/§9.2 레지스트리 미등재)이 여러 checker에 의해 독립적으로 재확인됐으며 모두 WARNING 수준. plan_coherence가 이번 uncommitted 편집에서 새로 생긴 인접배치 오독 소지 하나를 추가 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없어 인계 대상 없음. 단, 아래 WARNING 중 §9.1/§9.2 레지스트리 갭과 `CCH-SE-02` 계층 충돌은 developer 권한 밖(spec 정정)이라 target 문서가 이미 planner 인계 항목으로 열어 두었으며, 이 보고서는 그 유효성만 재확인함.)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, naming_collision (중복 통합) | EIA 계열 Redis 키(`interaction:idempotency:*`, `iext:blacklist:<jti>`)가 실행 엔진 §9.1 "**모든** Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}`" 전역 선언 및 §9.2 예외 각주 목록 어디에도 등재되지 않음 | `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 (`- [ ]` 미완료 항목) | `spec/5-system/4-execution-engine.md` §9.1/§9.2 ↔ `spec/data-flow/15-external-interaction.md` §2.2 / `spec/5-system/14-external-interaction-api.md` §R8 | planner 턴에서 (a) EIA 계열 키를 §9.2 예외 목록에 등재하거나 (b) §9.1의 "모든"을 실행 엔진 자체 소유 키로 범위 축소. `spec_impact`에 `4-execution-engine.md` 포함 |
| 2 | cross_spec | `CCH-SE-02`가 EIA HTTP-only `Idempotency-Key` 메커니즘이 chat-channel in-process 경로(`scope: 'in_process_trusted'`, HTTP 파이프라인 우회)에도 적용된다고 전제 — `ChannelUpdate.idempotencyKey`가 dead field로 남음 | `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 (`- [ ]` 미완료 항목) | `spec/5-system/15-chat-channel.md` L88 (`CCH-SE-02`) ↔ `spec/5-system/14-external-interaction-api.md` §3.3.1 (`EIA-AU-08`) / L76 (`EIA-IN-06`) | planner 결정 필요: (a) chat-channel 전용 in-process dedup 신설, 또는 (b) `CCH-SE-02`를 "어댑터 자체 dedup"으로 재기술 |
| 3 | plan_coherence | 신규 §9.1 인용이 같은 문서가 열어 둔 "EIA 키는 §9.1/§9.2에 없다" 미해결 항목과 인접 배치되어, §9.1이 마치 fail-open 동작 근거인 것처럼 오독될 소지 | `spec/data-flow/15-external-interaction.md` §4 외부 의존 표 (uncommitted, 현재 308행) | 같은 문서 §Rationale (다섯 경로 warn 서술) ↔ target 문서의 "EIA 키 §9.1/§9.2 미등재" 미해결 항목 | §9.1 링크 제거 후 "아래 §Rationale"만 남기거나, "키 형태 참고용, 이 EIA 키는 아직 미등재(별도 항목)" 한정 문구 추가. 우선순위 낮음(단정 아닌 암시 문제) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `node-cancellation.md §parallel-p2 A+H` 인용 — 해당 절 표제가 그 문서에 없음(실제로는 `plan/complete/parallel-p2-followups.md`의 결정 A/H) | target "원인 확정" 항목 | `node-cancellation.md §2.3/§5` + `parallel-p2-followups.md 결정 A·H` 식으로 분리 인용 |
| 2 | naming_collision | `.github/actions/pnpm-workspace/` 디렉터리명이 루트 `pnpm-workspace.yaml`과 문자열 공유(실충돌 없음, grep 탐색 시 혼재만) | `.github/actions/pnpm-workspace/action.yml` | 조치 불요, 필요시 `pnpm-setup`으로 개명 |
| 3 | naming_collision | worktree 식별자 `eia-r8-cache-scope` vs `eia-r8-cache-scope-4ae434` 병기(1차 실패 시도 vs 재시도, 순서 명시돼 있어 실충돌 아님) | target 문서 내 두 절 | 조치 불요, 향후 "1차(실패)/재시도" 라벨 병기 권장 |
| 4 | naming_collision | EIA 도메인 내 Redis 키 접두사 불일치(`interaction:` vs `iext:`) | `interaction:idempotency:*` vs `iext:blacklist:<jti>` | WARNING#1 인계에 접두사 통일 축도 함께 포함 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `CCH-SE-02` 계층 충돌 + EIA Redis 키 §9.1/§9.2 미등재(둘 다 target이 이미 추적 중, 신규 충돌 아님) |
| rationale_continuity | NONE | 캐시 제외조건/캐시키 스코프/fail-open 정책 모두 과거 Rationale과 정합, 기각 대안 재도입 없음. §9.1/§9.2 갭은 pre-existing |
| convention_compliance | NONE | plan 문서 특성상 접점 좁음. 사소한 절 인용 오류(INFO) 1건 외 규약 위반 없음 |
| plan_coherence | LOW | 직전 라운드 WARNING 2건 해소 확인. 신규 §9.1 인용의 인접배치 오독 소지 1건(WARNING) |
| naming_collision | NONE | 신규 식별자 전수 grep 대조 결과 CRITICAL/WARNING 없음. INFO 3건(문자열 유사·접미사 병기·접두사 불일치) |

## 권장 조치사항
1. (BLOCK 무관, planner 인계) EIA 계열 Redis 키를 `spec/5-system/4-execution-engine.md` §9.1/§9.2 예외 목록에 등재하거나 §9.1 "모든"의 범위를 축소 — `spec_impact`에 이미 반영 대상으로 열려 있음.
2. (BLOCK 무관, planner 인계) `CCH-SE-02`의 EIA 메커니즘 적용 전제를 정정(chat-channel 자체 dedup 신설 또는 서술 재기술).
3. (선택, 낮은 우선순위) `spec/data-flow/15-external-interaction.md` §4 표의 §9.1 인용을 제거하거나 한정 문구 추가해 인접 배치 오독 방지.
4. (선택) `node-cancellation.md` 절 인용 표기 정정, worktree 식별자 라벨 병기 — 다음 편집 시 함께 처리.
