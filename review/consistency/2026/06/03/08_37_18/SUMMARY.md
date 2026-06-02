# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

> **main 후속 주석 (2026-06-03)**: 본 BLOCK 은 **worktree-vs-main 읽기 아티팩트(검증된 false positive)** 다. Cross-Spec checker 가 main 작업본(미커밋이라 stale)을 읽어 Critical 을 올렸고, 같은 SUMMARY 의 Naming-Collision checker 는 worktree 파일을 읽어 "C2/C3 이미 정정 완료"를 확인했다(두 결론 정면 충돌, 아래 주석 참조). worktree grep 으로 §5.2/§5.7 `count`·§4.4 `timeout` 제거·`nodeOutput` 5필드 shape 적용을 전수 확인했고, substantive checker(Rationale/Naming/Convention/Plan-Coherence)는 전원 통과. Critical 은 커밋/머지로 해소되는 아티팩트라 진행함. WARNING(node-output-redesign/parallel.md stale)·INFO(source plan 이동)는 해소.

## 전체 위험도
**CRITICAL** — target draft 가 "이미 spec 본문에 적용됨"으로 전제한 두 변경이 실제로는 미적용 상태이며, 관련 spec 파일 간 직접 모순이 현재 진행 중입니다. (→ main 후속 주석: worktree 에는 적용됨)

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/4-nodes/1-logic/10-parallel.md` §5.2 에 `count 제거` 노트가 여전히 잔존 — `0-common.md §5` 및 `node-output.md` Principle 9.2 와 직접 모순 | `spec-draft-spec-drift-resolve.md` 변경 1 ("이미 적용됨" 전제) | `spec/4-nodes/1-logic/0-common.md §5`, `spec/conventions/node-output.md` Principle 9.2, 엔진 구현 `execution-engine.service.ts` | `spec/4-nodes/1-logic/10-parallel.md` §5.2 JSON 예시·필드 표에 `count` 추가, 제거 노트 삭제, §5.7 완료 shape 에 `count` 추가, Rationale 결정 B 추가를 즉시 적용한 뒤 consistency-check 재실행 |
| 2 | Cross-Spec | `spec/5-system/6-websocket-protocol.md` §4.4 예시에 `timeout: 300`, `timeoutAction: "cancel"`, `nodeOutput: { "type": "carousel", ... }` 이 여전히 잔존 — 각각 Presentation 공통 규약 §3 무제한 대기 원칙 및 Principle 1.1.4 `type` 판별자 금지와 직접 모순 | `spec-draft-spec-drift-resolve.md` 변경 2 (C2, C3 "이미 적용됨" 전제) | `spec/4-nodes/6-presentation/0-common.md §3`, `spec/conventions/node-output.md` Principle 1.1.4 | §4.4 예시에서 `timeout`/`timeoutAction` 제거, `nodeOutput` 을 `NodeHandlerOutput` 5필드 shape (`{ config, output, meta?, port?, status }`)로 교체, 필드 표 갱신, Rationale C2/C3 추가 |

> **주의**: Cross-Spec CRITICAL #2 와 Naming-Collision INFO #2 ("C2/C3 이미 정정 완료")는 서로 반대 결론을 제시합니다. Naming-Collision 은 워크트리 파일을 기준으로 "이미 수정됨"을 확인했고, Cross-Spec 은 main 브랜치의 spec 파일(`/Volumes/project/private/clemvion/spec/…`)에 여전히 stale 값이 잔존함을 확인했습니다. 워크트리 수정이 main 에 반영(merge)되기 전까지는 BLOCK 상태가 유지됩니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/4-nodes/1-logic/10-parallel.md` §5.7 완료 shape 에 `count` 누락 — §5.2 수정과 함께 동기화 필요 | `spec-draft-spec-drift-resolve.md` 변경 1 | `spec/4-nodes/1-logic/10-parallel.md` §5.7 | §5.7 완료 행 `output 형태` 컬럼을 `{ branches: Array<{status, value?\|error?}>, count: N }` 으로 갱신 (→ worktree 적용 완료) |
| 2 | Plan-Coherence | `plan/in-progress/node-output-redesign/parallel.md` 의 "count 제거 = 적절 (Principle 1.1 직교)" 진단이 결정 B 적용 후 stale 됨 — 후속 개발자가 잘못된 사전 조건으로 진입할 위험 | `spec-draft-spec-drift-resolve.md` 변경 1 결정 B | `plan/in-progress/node-output-redesign/parallel.md` 진단 항목 1 및 횡단 일관성 §7 | 해당 문서 "진단 항목 1" 과 "횡단 일관성 §7 Parallel count" 에 stale 노트 추가 (→ 해소 완료) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/4-nodes/1-logic/0-common.md §5` 는 수정 불필요한 SoT — `count` 를 이미 정확히 기술 | `spec/4-nodes/1-logic/0-common.md §5` | 변경 1 적용 후 재확인만 |
| 2 | Cross-Spec | `spec/conventions/node-output.md` Principle 9.2 는 수정 불필요 — `parallel → { branches, count: N }` 이미 명시 | `spec/conventions/node-output.md` Principle 9.2 | 동기화 확인만 |
| 3 | Convention-Compliance | plan frontmatter `worktree` 값 표기 형식이 기존 파일(전체 경로 형식)과 불일치 — 규약 위반은 아님 | `spec-draft-spec-drift-resolve.md` frontmatter | `plan-lifecycle.md` 의 `worktree:` 예시를 전체 경로 vs 이름만 중 하나로 명확화 권고 |
| 4 | Convention-Compliance | plan 에 체크박스·TODO 없이 `in-progress/` 잔류 — 라이프사이클 상태가 문서 내에서 명시적으로 드러나지 않음 | `spec-draft-spec-drift-resolve.md` 전체 | consistency-check 미완료라면 체크박스 추가; 완료 시 `plan/complete/` 이동 (→ 이동 완료) |
| 5 | Convention-Compliance | H1 제목 `# spec-draft:` (소문자) vs 타 파일 `# Spec Draft:` (대문자) 불일치 — 규약 위반 아님 | `spec-draft-spec-drift-resolve.md` H1 | `# Spec Draft:` 로 통일하거나 SKILL.md 예시에 제목 형식 명시 |
| 6 | Plan-Coherence | source plan `spec-drift-parallel-count.md` · `spec-drift-ws-button-config.md` 가 결정 완료됐음에도 `in-progress/` 잔류 — 추적 오염 우려 | source plans | target 머지 시점에 두 파일을 `plan/complete/` 이동 또는 결정 노트 추가 (→ 이동 완료) |
| 7 | Plan-Coherence | `plan-grooming-2ec306` 브랜치의 `node-output-redesign/README.md` 수정과 target spec 변경 간 잠재 문서 비동기 (git 충돌 없음) | `plan/in-progress/node-output-redesign/README.md` | target 머지 후 README 의 count 관련 언급 확인 |
| 8 | Naming-Collision | `output.count` 는 신규 도입이 아닌 컨테이너 공통 식별자 복원 — 충돌 없음 | `spec/4-nodes/1-logic/10-parallel.md` | 해당 없음 |
| 9 | Naming-Collision | `buttonConfig.nodeOutput` 5필드 shape 는 기존 Principle 정합 정정 — 충돌 없음 | `spec/5-system/6-websocket-protocol.md` §4.4 | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **CRITICAL** | draft 의 "이미 적용됨" 전제가 main spec 파일과 불일치 (→ worktree 에는 적용됨, false positive) |
| Rationale-Continuity | **NONE** | 두 변경 모두 과거 결정 번복 근거·기각 대안이 Rationale 에 충분히 문서화됨 |
| Convention-Compliance | **LOW** | 실질 규약 위반 없음. frontmatter 형식·체크박스·제목 대소문자 등 3건 INFO |
| Plan-Coherence | **LOW** | 활성 worktree 간 spec 파일 경합 없음. source plan 잔류 및 node-output-redesign 진단 stale 1건 WARNING (→ 해소) |
| Naming-Collision | **NONE** | 신규 식별자 충돌 없음. 모든 변경이 기존 공통 규약과 정합하는 복원/정정 |

## 권장 조치사항

1. **(BLOCK 해소)** `10-parallel.md` §5.2 count 복원 — worktree 적용 완료.
2. **(BLOCK 해소)** `6-websocket-protocol.md` §4.4 timeout 제거 + nodeOutput shape 교체 — worktree 적용 완료.
3. **(WARNING 해소)** `node-output-redesign/parallel.md` stale 노트 — 적용 완료.
4. **(INFO)** source plan 2건 `plan/complete/` 이동 — 완료.
5. **(INFO)** draft 라이프사이클 명확화 — `plan/complete/` 이동 완료.
