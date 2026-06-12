# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다

## 전체 위험도
**CRITICAL** — 구현 코드가 기각된 대안을 사용 중이거나 spec 확정 결정이 미반영, 활성 PR 이 최근 확정 spec 을 롤백할 위험 존재

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `$helpers.base64` 비문자열 입력 시 spec 이 명시적으로 기각한 "silent `String(data)` 강제변환" 이 구현에 그대로 존재 | `codebase/backend/src/nodes/data/code/code.handler.ts` 398~407행 (`__host_b64encode`/`__host_b64decode` 콜백) | `spec/4-nodes/5-data/2-code.md §2.2` + `§Rationale "base64 비문자열 TypeError 정렬"` | `__host_b64encode`/`__host_b64decode` 에 `hostHash` 와 동일하게 `if (typeof data !== 'string') throw new TypeError(...)` 가드 추가, `String(data)` 래핑 제거 |
| 2 | Rationale Continuity | `CODE_NODE_MEMORY_LIMIT_MB` env 조정 + 512MB clamp 가 spec Rationale 에 완료 결정으로 명문화되어 있으나 구현은 상수 128 하드코딩(`W15` 주석만) | `codebase/backend/src/nodes/data/code/code.handler.ts` 16~20행 | `spec/4-nodes/5-data/2-code.md §7.2` + `§Rationale "메모리 한도 환경변수화"` | `ISOLATE_MEMORY_LIMIT_MB` 를 `Math.min(+(process.env.CODE_NODE_MEMORY_LIMIT_MB ?? 128), 512)` 로 교체 |
| 3 | Plan Coherence | 활성 PR #562 (`unified-model-mgmt-plan-close`, branch `claude/unified-model-mgmt-plan-close`) 가 PR #561 에서 확정된 `spec/4-nodes/5-data/2-code.md` 의 base64 타입 계약·dayjs 스냅샷·메모리 env 조정 내용을 -113줄 삭제하는 diff 를 포함 — 머지 시 최근 확정 spec 이 롤백됨 | `spec/4-nodes/5-data/2-code.md` (§2.2, §4 step3, §7.1, §7.2, §Rationale) | `plan/in-progress/unified-model-management.md`, PR #562 | PR #562 머지 전 `origin/main` 으로 rebase; `2-code.md` 삭제 diff 의 의도 확인 후 stale base 에 의한 실수라면 해당 패치 drop |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `syntaxIsolate` 가 모듈 수명 동안 재사용되나 기각된 "isolate 재사용" 대안과 형태 유사 — spec §6 및 Rationale 에 설계 근거 미기록 | `codebase/backend/src/nodes/data/code/code.handler.ts` 233~256행 | `spec/4-nodes/5-data/2-code.md §Rationale "dayjs per-exec 재컴파일 → 힙 스냅샷"` (기각: isolate 풀 재사용) | spec `§Rationale` 에 "syntax-check 전용 `syntaxIsolate` 장기 재사용" 항 추가 — project-planner 위임 |
| 2 | Plan Coherence | `code-node-isolated-vm-followups.md` 의 base64·memory env 항목이 PR #561 에서 spec 측 완료됐으나 plan 체크박스 `[ ]` 미갱신 | `plan/in-progress/code-node-isolated-vm-followups.md` (base64/memory env 2건) | PR #561 (`eb9cc631`) | 코드 구현 완료 여부 확인 후 체크 또는 "(spec 완료, 코드 잔여)" 분리 표기 |
| 3 | Plan Coherence | `code-node-isolated-vm-followups.md` 의 "§4 step3 / §7.1 snapshot 경로 기술" 항목이 PR #561 에서 완료됐으나 plan 체크박스 `[ ]` 미갱신 | `plan/in-progress/code-node-isolated-vm-followups.md` (snapshot 경로 기술 1건) | PR #561 (`eb9cc631`) | 해당 항목을 `[x]` (PR #561 완료) 로 표기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/4-nodes/0-overview.md §5` 메모리 제한이 `CODE_NODE_MEMORY_LIMIT_MB` env 및 512MB clamp 누락 — "128MB 고정"으로 읽힘 | `spec/4-nodes/0-overview.md §5` | 메모리 제한 행을 "기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능(상한 512MB)" 으로 동기화 |
| 2 | Cross-Spec | Code 노드 `$vars` 접근과 표현식 언어 `$var.` 자동완성 팝업의 관계 불명확 | `spec/4-nodes/5-data/2-code.md §2`, `spec/5-system/5-expression-language.md §8.4.2` | Code 에디터 내 표현식 언어 자동완성 팝업 미적용 여부 명시 추가 검토 |
| 3 | Cross-Spec | `node-output.md Principle 2` Code 행의 `meta.logs?` 선택 표기 vs `2-code.md` 예시의 항상-배열 반환 간 표기 차이 | `spec/conventions/node-output.md Principle 2`, `spec/4-nodes/5-data/2-code.md §5.1` | `node-output.md` 의 Code 행에 "항상 빈 배열 포함" 주석 명시 |
| 4 | Cross-Spec | `spec/4-nodes/0-overview.md §2.5` Code 노드 출력 "2" 로만 기술 — 다른 노드와 달리 포트 라벨 누락 | `spec/4-nodes/0-overview.md §2.5` | "2 (success/error)" 로 동기화 |
| 5 | Convention Compliance | `0-common.md`, `1-transform.md` Rationale 섹션 부재 | `spec/4-nodes/5-data/0-common.md`, `1-transform.md` | 빈 Rationale 추가 또는 "분배 문서로 설계 근거 없음" 명시 (강제 규약 아님) |
| 6 | Convention Compliance | `0-common.md §4` "Phase 1 (D)" vs `node-output.md` "Phase 1 D" 표기 차이 | `spec/4-nodes/5-data/0-common.md §4` | 표기 통일 (`Phase 1 D`) |
| 7 | Convention Compliance | `1-transform.md §5` pre-flight throw 케이스가 §5.8 번호 사용 — 다른 노드 §5.3 패턴과 다름 | `spec/4-nodes/5-data/1-transform.md §5` | `node-output.md Principle 11` 에 runtime 에러 포트 없는 노드의 §5.8 재사용 패턴 명시 검토 |
| 8 | Convention Compliance | `2-code.md §1` 설정 표의 필드명 backtick 미적용 — 동일 문서 내 §5.1/§5.3 표와 불일치 | `spec/4-nodes/5-data/2-code.md §1` | 설정 표 `필드` 컬럼 backtick 형식 통일 |
| 9 | Naming Collision | `CODE_NODE_MEMORY_LIMIT_MB` env var 가 `.env.example` 에 미등재 | `codebase/backend/.env.example` | 구현 착수 시 `CODE_NODE_MEMORY_LIMIT_MB=128` 등재 및 `code.handler.ts` W15 주석 갱신 |
| 10 | Naming Collision | `EXECUTION_TIMEOUT` 동명 이중 레이어 (Code 노드 legacy code vs 엔진 레벨 EIA) — 기존 수용된 항목 | `spec/conventions/error-codes.md §4` | 현상 유지 (`error-codes.md §4` 가 레이어 주의 명시 중) |
| 11 | Plan Coherence | target worktree `code-followups-impl-afebb8` 자체가 main 의 ancestor (stale) — 정리 미완료 | worktree `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8` | 완료된 worktree cleanup 권장 |
| 12 | Rationale Continuity | `meta.success` 가 Code 노드 필수 필드인지 `0-common.md` 에서 불명확 ("편의 필드" 로만 기술) | `spec/4-nodes/5-data/0-common.md §4` | `meta.success` 가 Code 노드 필수 필드임을 각주로 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 직접 모순 없음, INFO 4건 (표기 동기화 권장) |
| Rationale Continuity | HIGH | CRITICAL 2건 (base64 silent 변환, 메모리 env 미구현), WARNING 1건 (syntaxIsolate 근거 미기록) |
| Convention Compliance | NONE | 핵심 규약 전항 준수, INFO 4건 (형식 일관성) |
| Plan Coherence | CRITICAL | CRITICAL 1건 (PR #562 spec 롤백 위험), WARNING 2건 (plan 체크박스 미갱신) |
| Naming Collision | NONE | 충돌 없음, INFO 2건 (.env.example 등재, 기존 이중 레이어) |

## 권장 조치사항

1. **(BLOCK 해소 — 즉시)** `codebase/backend/src/nodes/data/code/code.handler.ts` `__host_b64encode`/`__host_b64decode` 콜백에 `if (typeof data !== 'string') throw new TypeError(...)` 가드 추가, `String(data)` 래핑 제거 (Critical #1)
2. **(BLOCK 해소 — 즉시)** `code.handler.ts` 의 `ISOLATE_MEMORY_LIMIT_MB` 상수를 `Math.min(+(process.env.CODE_NODE_MEMORY_LIMIT_MB ?? 128), 512)` 로 교체하고 `.env.example` 에 `CODE_NODE_MEMORY_LIMIT_MB=128` 등재 (Critical #2 + INFO #9)
3. **(BLOCK 해소 — 즉시)** PR #562 (`unified-model-mgmt-plan-close`) 를 머지하기 전에 `origin/main` 으로 rebase, `spec/4-nodes/5-data/2-code.md` 삭제 diff 의 의도 확인 후 stale base 실수라면 해당 패치 drop (Critical #3)
4. **(WARNING)** `spec/4-nodes/5-data/2-code.md §Rationale` 에 `syntaxIsolate` 장기 재사용 근거 추가 — project-planner 위임 (WARNING #1)
5. **(WARNING)** `plan/in-progress/code-node-isolated-vm-followups.md` 의 base64/memory env/snapshot 체크박스를 코드 구현 완료 여부에 따라 갱신 (WARNING #2, #3)
6. **(INFO)** `spec/4-nodes/0-overview.md §5` 메모리 제한 행 동기화 및 Code 노드 출력 포트 라벨 "2 (success/error)" 추가 (INFO #1, #4)