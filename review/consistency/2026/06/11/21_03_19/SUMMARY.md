# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — spec 간 격리 방식(node:vm vs isolated-vm) 직접 모순 및 캔버스 요약 포맷 SoT 불일치 2건의 Critical 위배 존재. 신규 에러 코드 미등록 Warning 2건 추가.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/4-nodes/0-overview.md §5` 가 `node:vm + buildSandbox + 메모리 제한 미구현(Planned)` 을 기술하여 target 의 `isolated-vm + 128MB 하드 리밋(구현됨)` 과 직접 모순 | `spec/4-nodes/5-data/2-code.md §7.1, §7.2, §Rationale` | `spec/4-nodes/0-overview.md §5` 실행 격리·메모리 제한 행 | `0-overview.md §5` 의 "실행 격리" 행을 `isolated-vm (V8 Isolate, memoryLimit: 128)` 으로, "메모리 제한" 행을 "구현됨 (128MB, code 노드)" 으로 갱신. `buildSandbox` 참조 제거 |
| 2 | Cross-Spec | target §8 의 캔버스 요약 포맷 `{language} · {N} lines` 가 SoT(`0-common.md §3`) 의 `{language}` 전용 정의와 모순. `0-common.md` 는 개행 카운트를 summaryTemplate DSL 미지원으로 명시 | `spec/4-nodes/5-data/2-code.md §8` | `spec/4-nodes/5-data/0-common.md §3` summaryTemplate 정의 | target §8 의 `{language} · {N} lines` → `{language}` 로 수정하거나, `0-common.md §3` 를 변경하고 DSL 개행 카운트 지원을 별도 작업으로 계획 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Rationale | `spec/4-nodes/0-overview.md §5` 갱신 누락으로 `data/0-common.md §2` 와 target `§7` 인트로가 공히 `0-overview.md §5` 를 참조해 outdated 정보 전파 (Critical#1 파급) | `spec/4-nodes/5-data/2-code.md §7` 서두, `0-common.md §2` | `spec/4-nodes/0-overview.md §5` | Critical#1 해소 후 자동 정합됨. 별도 수정 불필요 |
| 2 | Cross-Spec | `error-codes.md §3` 에 `CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT` 이 historical-artifact 레지스트리에 미등록. `legacyCode` API 노출로 클라이언트 분기 유발 가능 | `spec/4-nodes/5-data/2-code.md §5.3` legacyCode 열 | `spec/conventions/error-codes.md §2, §3` | `error-codes.md §3` 에 두 legacyCode 등록 + "클라이언트 분기 금지, 내부 분류용" 명시. 또는 `legacyCode` 를 `output.error.details` 에서 제거하고 내부 로깅 전용으로 격하 |
| 3 | Naming Collision | `CODE_MEMORY_LIMIT` 가 `error-codes.ts` ErrorCode enum 미등록, `spec/5-system/3-error-handling.md §1.4·§3.2` 미반영, `conventions/chat-channel-adapter.md` 분류 표 미포함. 로드맵 식별자를 live 코드로 격상했으나 다운스트림 정의 없음 | `spec/4-nodes/5-data/2-code.md §5.3, §7.2` | `codebase/backend/src/nodes/core/error-codes.ts`, `spec/5-system/3-error-handling.md §1.4·§3.2`, `spec/conventions/chat-channel-adapter.md §3.2` | (1) `error-codes.ts` 에 `CODE_MEMORY_LIMIT` 추가. (2) `3-error-handling.md §1.4·§3.2` 에 추가. (3) `chat-channel-adapter.md §3.2` 분류 표에 추가 |
| 4 | Naming Collision | `EXECUTION_MEMORY_EXCEEDED` 가 handler 에 미구현. `(로드맵)` 한정자 없이 매핑 표에 기재됐으나 실제 분기 코드 없으면 `CODE_EXECUTION_FAILED` fallback 으로 흡수되어 `CODE_MEMORY_LIMIT` 가 발행되지 않는 silent 충돌 | `spec/4-nodes/5-data/2-code.md §5.3` legacyCode 열 | `codebase/backend/src/nodes/data/code/code.handler.ts` | handler 에서 isolated-vm 메모리 초과 에러 타입을 확인하고 `EXECUTION_MEMORY_EXCEEDED` 캡처 분기를 추가. 주석에 "Code 노드 메모리 초과 전용" 스코프 명시 |
| 5 | Convention Compliance | §5 intro blockquote 에 구 구현 용어 `vm.Script 구문 오류` 잔류. §4 / §6 는 `isolate compileScript` 로 올바르게 갱신됨. 독자가 node:vm 코드패스 잔존으로 오해 가능 | `spec/4-nodes/5-data/2-code.md §5 intro blockquote` | §4 step 2, §6 에러 코드 표 | `vm.Script 구문 오류` → `isolate compileScript 구문 오류` 로 교체 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale | §Rationale 에 "이전 spec §7.1 로드맵 항목을 본 결정으로 종결함" 명시 누락 | `spec/4-nodes/5-data/2-code.md §Rationale` | "구 spec §7.1 선택 근거 로드맵 항목을 2026-06-11 결정으로 종결" 한 줄 추가 |
| 2 | Rationale | §5 intro `vm.Script 구문 오류` 잔류 (Convention Compliance Warning#5 와 동일 위배) | `spec/4-nodes/5-data/2-code.md §5` | Warning#5 해소로 충분 |
| 3 | Rationale | 기각 대안 "frozen-prototype" 이 구 spec 어디서 논의됐는지 cross-link 부재 | `spec/4-nodes/5-data/2-code.md §Rationale` 기각 대안 3번째 항목 | 구 spec §7.1 선택 근거 또는 커밋 메시지 참조 링크 추가 (선택적) |
| 4 | Convention Compliance | §7.1 inline `> 선택 근거` blockquote 와 §Rationale 신규 섹션 간 중복 수준이 높아 SoT 불명확 | `spec/4-nodes/5-data/2-code.md §7.1, §Rationale` | §7.1 inline blockquote 를 "상세: §Rationale 참조" 한 줄로 축약하거나 역할 분리 명시 |
| 5 | Convention Compliance | `CODE_MEMORY_LIMIT` 케이스 출력 예시(§5.3.3) 미제공. 타임아웃과 달리 JSON 예시 없음 | `spec/4-nodes/5-data/2-code.md §5.3` | `#### 5.3.3 메모리 초과 (CODE_MEMORY_LIMIT)` 케이스 추가 |
| 6 | Convention Compliance | §8 캔버스 요약 포맷 `{language} · {N} lines` — `0-common.md §3` 와 불일치 (Critical#2 와 동일, INFO 병기) | `spec/4-nodes/5-data/2-code.md §8` | Critical#2 해소로 충분 |
| 7 | Plan Coherence | `plan/in-progress/refactor/04-security.md` C-2·M-2 체크박스가 여전히 `결정 대기` 상태. 결정 이행이 spec 에 반영됐으나 plan 미갱신 | `plan/in-progress/refactor/04-security.md` C-2, M-2 | 머지 후 C-2·M-2 를 `[x]` 로 갱신, worktree 링크 및 결정 날짜 메모 추가 |
| 8 | Plan Coherence | `plan/in-progress/node-output-redesign/code.md §8` gap (c) 분석이 `node:vm` 전제로 작성돼 isolated-vm 전환 후 stale | `plan/in-progress/node-output-redesign/code.md §8 gap (c)` | "isolated-vm 전환 후 무효화됨 (2026-06-11 결정)" 주석 1줄 추가 권장 |
| 9 | Plan Coherence | `plan/in-progress/spec-draft-conventions-code-data.md` 가 PR MERGED 상태이나 `plan/complete/` 로 미이동 | `plan/in-progress/spec-draft-conventions-code-data.md` | `plan/complete/` 로 이동 (plan-lifecycle 규칙) |
| 10 | Cross-Spec | `spec/4-nodes/0-overview.md §5` `buildSandbox` 함수명 — isolated-vm 전환 후 outdated. Critical#1 해소 작업 시 함께 교체 | `spec/4-nodes/0-overview.md §5` 실행 격리 행 | Critical#1 해소 시 함께 갱신 |
| 11 | Cross-Spec | `spec/4-nodes/_product-overview.md` ND-CD-06 ✅ 와 `0-overview.md §5` "메모리 제한 미구현(Planned)" 불일치 — Critical#1 해소 시 자동 정합 | `spec/4-nodes/0-overview.md §5` | Critical#1 해소로 충분 |
| 12 | Naming Collision | `ivm.Isolate`, `ivm.Callback`, `ExternalCopy` 등 isolated-vm API 식별자 — 기존 네임스페이스 충돌 없음. 버전 pin(`6.x`) §Rationale 에 기재됨 | `spec/4-nodes/5-data/2-code.md §4, §7.1` | 현재 적절. 변경 불필요 |
| 13 | Naming Collision | `memoryLimit: 128` 하드코딩 — 향후 운영 튜닝 필요 시 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수 추출 여지 | `spec/4-nodes/5-data/2-code.md §4, §7.1, §7.2` | Rationale 에 환경변수 추출 가능성 언급 고려 (선택적) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | `0-overview.md §5` node:vm vs isolated-vm 직접 모순(Critical#1), 캔버스 요약 SoT 불일치(Critical#2), legacyCode 레지스트리 미등록(Warning) |
| Rationale Continuity | LOW | isolated-vm 전환 Rationale 구조 양호. `0-overview.md §5` 갱신 누락(Warning), vm.Script 잔류·기각 대안 cross-link 부재(INFO) |
| Convention Compliance | LOW | §5 intro vm.Script 잔류(Warning), CODE_MEMORY_LIMIT 출력 예시 누락·캔버스 포맷 불일치(INFO). Frontmatter·에러 코드·output 구조는 규약 준수 |
| Plan Coherence | NONE | 결정 이행 확인됨. 백로그 체크박스 동기화·stale 분석 문서·MERGED plan 이동 등 INFO 3건 |
| Naming Collision | MEDIUM | CODE_MEMORY_LIMIT 다운스트림 미등록(error-codes.ts, error-handling spec, chat-channel-adapter), EXECUTION_MEMORY_EXCEEDED handler 미구현 — silent 충돌 위험 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/4-nodes/0-overview.md §5` 갱신 — 실행 격리 행을 `isolated-vm (V8 Isolate, memoryLimit: 128)` 으로, 메모리 제한 행을 "구현됨 (128MB)" 으로 교체. `buildSandbox` 참조 제거.
2. **(BLOCK 해소 필수)** `spec/4-nodes/5-data/2-code.md §8` 캔버스 요약 포맷 수정 — `{language} · {N} lines` → `{language}` (0-common §3 일치). 또는 0-common §3 변경 + DSL 개행 카운트 지원 계획 수립.
3. **(Warning 선해소 권장)** `CODE_MEMORY_LIMIT` 다운스트림 등록 — `error-codes.ts` ErrorCode enum, `spec/5-system/3-error-handling.md §1.4·§3.2`, `spec/conventions/chat-channel-adapter.md §3.2` 에 추가.
4. **(Warning 선해소 권장)** `code.handler.ts` 에 isolated-vm 메모리 초과 에러 분기 추가 (`EXECUTION_MEMORY_EXCEEDED` 캡처), 또는 spec §5.3 매핑 표에 `(로드맵)` 한정자 복원.
5. **(Warning 선해소 권장)** `spec/4-nodes/5-data/2-code.md §5 intro blockquote` 의 `vm.Script 구문 오류` → `isolate compileScript 구문 오류` 교체.
6. **(Warning 등록 조치)** `spec/conventions/error-codes.md §3` 에 `CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT` legacyCode 등록 + "클라이언트 분기 금지" 명시.
7. **(INFO, 머지 후)** `plan/in-progress/refactor/04-security.md` C-2·M-2 체크박스 `[x]` 갱신.
8. **(INFO, 선택적)** `plan/in-progress/node-output-redesign/code.md §8 gap (c)` 에 "isolated-vm 전환 후 무효화됨" 주석 추가.
9. **(INFO, 선택적)** `plan/in-progress/spec-draft-conventions-code-data.md` → `plan/complete/` 이동.