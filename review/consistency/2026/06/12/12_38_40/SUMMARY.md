# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**MEDIUM** — 변경 3(메모리 env 조정 가능화)이 3개 외부 spec 문서에 하드코딩된 "128MB" 수치와 drift를 유발한다. 기능 계약 자체는 변하지 않으므로 Critical 수준은 아니지만, 동기화 갱신 없이 spec PR을 머지하면 설명문 불일치가 발생한다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | 변경 3 이후 `spec/4-nodes/0-overview.md §5` "메모리 제한" 행이 `memoryLimit: 128(MB) 하드 리밋` 으로 하드코딩된 채 stale 해짐 | 변경 3-a (§7.2), 변경 3-b (§5.3.3) | `spec/4-nodes/0-overview.md §5` "메모리 제한" 행 | 변경 3 spec PR 에서 해당 행을 "기본 128MB 하드 리밋 (env 조정 가능)" 로 동시 갱신 |
| W2 | Cross-Spec | 변경 3 이후 `spec/conventions/error-codes.md §4` 의 `EXECUTION_MEMORY_EXCEEDED` 설명에 "isolate 128MB 하드 리밋 초과" 수치가 부정확해짐 | 변경 3-a (§7.2) | `spec/conventions/error-codes.md §4` `EXECUTION_MEMORY_EXCEEDED` 설명 | 설명을 "isolate 메모리 하드 리밋 초과 (기본 128MB, CODE_NODE_MEMORY_LIMIT_MB env 조정 가능 — isolated-vm hard-kill)" 로 갱신하거나 수치 제거 |
| W3 | Cross-Spec | 변경 3 이후 `spec/5-system/3-error-handling.md` 의 `CODE_MEMORY_LIMIT` 설명 "isolate 128MB 하드 리밋 초과" 가 stale 해짐 | 변경 3-a | `spec/5-system/3-error-handling.md` `CODE_MEMORY_LIMIT` 설명 | 해당 설명을 "기본 128MB" 로 갱신하거나 수치 제거 |
| W4 | Plan Coherence | spec PR 머지 후 `code-node-isolated-vm-followups.md` 의 open 항목 체크박스(변경 1·2·3 대응 3건)가 자동으로 닫히지 않아 미완 추적이 잔류할 수 있음 | `## 후속 code PR (developer)` 섹션 | `plan/in-progress/code-node-isolated-vm-followups.md` spec open 항목 3건 | target plan 의 후속 섹션에 "spec PR 머지 후 followups plan 의 snapshot·base64·env 항목을 `[x]` 처리" 항목 명시 추가, 또는 spec PR 커밋 시 followups plan 동시 갱신 |
| W5 | Naming Collision | `CODE_NODE_MEMORY_LIMIT_MB` (env var) 와 기존 코드 상수 `ISOLATE_MEMORY_LIMIT_MB` 의 명칭 전환이 spec 에 명시되지 않아 후속 code PR 작성자가 상수 교체 여부를 알 수 없음 | 변경 3, `## 후속 code PR` 절 | `codebase/backend/src/nodes/data/code/code.handler.ts` line 20 `ISOLATE_MEMORY_LIMIT_MB` | "후속 code PR" 설명에 `ISOLATE_MEMORY_LIMIT_MB` 모듈 상수도 동시 교체·삭제된다는 점 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | 변경 2 — `$helpers.base64` 비문자열 `TypeError` 는 §7.3 허용 목록과 일치. 정합 확인 완료 | 변경 2-a (§2.2 표) | 선택적으로 §7.3 cross-ref 추가하면 독자 명확성 향상 |
| I2 | Cross-Spec | 변경 1 — `spec/4-nodes/0-overview.md §5` "실행 격리" 행은 code.handler.ts 를 참조하는 구조라 snapshot 최적화 NOTE 동기화 불필요 | 변경 1-b (§7.1 NOTE) | 별도 조치 불필요 |
| I3 | Rationale Continuity | 변경 1 — isolate 풀 재사용 기각 근거가 기존 Rationale (per-exec dispose 불변) 과 완전 정합 | 변경 1, 1-c 기각 항목 (a) | 기존 Rationale 절 내부 cross-ref(`§Rationale — 격리 방식 isolated-vm 전환`) 추가 권장 |
| I4 | Rationale Continuity | 변경 3 — 기존 128MB 확립 결정과의 명시적 연결 문장 미약. "하드코딩 번복인지 상한 유지 확장인지" 모호성 | 변경 3-c Rationale | 3-c 에 "기존 결정 의도는 상한 설정이었으므로 clamp 를 둔 env 조정은 확장" 이라는 연결 문장 한 줄 추가 |
| I5 | Convention Compliance | plan frontmatter 에 `spec_impact` 미선언 — in-progress 단계라 의무 아님 | frontmatter | `complete/` 이동 PR 에서 `spec_impact: spec/4-nodes/5-data/2-code.md` 추가 |
| I6 | Convention Compliance | "후속 code PR" 절의 `ISOLATE_MEMORY_LIMIT_MB → CODE_NODE_MEMORY_LIMIT_MB` 기술이 코드 상수 리네임인지 env var 신규 도입인지 오해 유발 가능 | 변경 3, line 92 | "`CODE_NODE_MEMORY_LIMIT_MB` env var 파싱 추가 (기본 128, clamp ≤512)" 로 명확화 |
| I7 | Plan Coherence | followups plan line 20 의 "spec §2.2 NOTE 로 문서화된 의도" 설명이 사실과 다름 — 해당 NOTE 는 현 spec 에 존재하지 않음 | `plan/in-progress/code-node-isolated-vm-followups.md` line 20 | spec PR 머지 후 followups plan 해당 행을 "spec §2.2 NOTE 신규 등재 완료" 로 갱신 |
| I8 | Naming Collision | `ivm.Isolate.createSnapshot` — spec 신규 도입 식별자. 기존 사용처와 충돌 없음 | 변경 1, §1-b | 없음 |
| I9 | Naming Collision | `CODE_MEMORY_LIMIT` 에러코드 — 기존 정의와 일치하여 충돌 없음 | 변경 3, §3-a | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 변경 3이 `spec/4-nodes/0-overview.md §5`, `spec/conventions/error-codes.md §4`, `spec/5-system/3-error-handling.md` 3개 문서의 "128MB" 하드코딩과 drift 유발 (WARNING 3건) |
| Rationale Continuity | LOW | 변경 1·2는 기존 원칙 완전 정합. 변경 3은 기존 128MB 확립 결정과의 연결 문장 보강 필요 (INFO) |
| Convention Compliance | NONE | 정식 규약 직접 위반 없음. frontmatter `spec_impact` 는 완료 이동 시 의무 (INFO) |
| Plan Coherence | LOW | followups plan open 항목 자동 미닫힘 위험 (WARNING). active worktree 충돌 0건. stale worktree 5건 식별 |
| Naming Collision | LOW | `CODE_NODE_MEMORY_LIMIT_MB` vs `ISOLATE_MEMORY_LIMIT_MB` 레이어 명칭 혼동 위험 (WARNING). 실질 의미 충돌 없음 |

## 권장 조치사항

1. **(W1 · W2 · W3 — 동기화 필수)** 변경 3 spec PR 에서 `spec/4-nodes/5-data/2-code.md` 와 함께 다음 3개 파일도 동시 갱신한다:
   - `spec/4-nodes/0-overview.md §5` "메모리 제한" 행 → "기본 128MB (env 조정 가능)"
   - `spec/conventions/error-codes.md §4` `EXECUTION_MEMORY_EXCEEDED` 설명 → 수치 제거 또는 "기본 128MB" 명시
   - `spec/5-system/3-error-handling.md` `CODE_MEMORY_LIMIT` 설명 → "기본 128MB" 또는 수치 제거
2. **(W4 — plan 동기화)** spec PR 커밋 또는 후속 code PR 착수 시 `code-node-isolated-vm-followups.md` 의 snapshot·base64·env 관련 open 항목을 `[x]` 로 닫는다. target plan 의 `## 후속 code PR` 섹션에 이 작업을 명시 추가 권장.
3. **(W5 — spec 명세 보완)** target plan 의 "후속 code PR" 설명에 `ISOLATE_MEMORY_LIMIT_MB` 내부 상수의 교체·삭제 여부를 명시한다.
4. **(I4 — Rationale 보강)** 변경 3-c Rationale 에 "기존 128MB 결정의 의도는 상한 설정이었으므로 clamp를 둔 env 조정은 번복이 아니라 확장" 연결 문장 한 줄 추가.
5. **(I7 — plan 사실 오류 정정)** spec PR 머지 후 `code-node-isolated-vm-followups.md` line 20 의 "spec §2.2 NOTE 로 문서화된 의도" 설명을 사실에 맞게 갱신한다.