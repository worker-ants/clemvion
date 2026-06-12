# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 대상: `spec/4-nodes/5-data/` (0-common.md · 1-transform.md · 2-code.md)

---

## 발견사항

- **[CRITICAL]** `$helpers.base64` 비문자열 입력 — 기각된 "silent 강제변환 유지" 대안이 구현에 존재
  - target 위치: `spec/4-nodes/5-data/2-code.md §2.2` (base64 타입 계약), `§Rationale "base64 비문자열 TypeError 정렬"`
  - 과거 결정 출처: `spec/4-nodes/5-data/2-code.md §Rationale "base64 비문자열 TypeError 정렬"` — "**기각**: 현행 silent 유지 — hash 와의 비대칭을 영구화하고 타입 버그를 숨긴다."
  - 상세: spec Rationale는 base64.encode/decode 비문자열 입력에 TypeError를 던지도록 결정하고, silent `String(data)` 강제변환을 명시적으로 기각했다. 그러나 구현(`codebase/backend/src/nodes/data/code/code.handler.ts` 398~407행)은 `__host_b64encode` / `__host_b64decode` 콜백에서 `Buffer.from(String(data), ...)` 로 비문자열을 여전히 silent 강제변환하고 있다. 이는 spec `§2.2` 의 `"비문자열 입력은 TypeError"` 계약과도 직접 충돌한다.
  - 제안: `__host_b64encode` / `__host_b64decode` 콜백에 `hostHash` 와 동일하게 `if (typeof data !== 'string') throw new TypeError(...)` 가드를 추가하고, `String(data)` 래핑을 제거한다. spec은 변경 불필요(이미 TypeError 를 명시).

- **[CRITICAL]** `CODE_NODE_MEMORY_LIMIT_MB` 환경변수 조정 미구현 — spec Rationale 결정과 구현 불일치
  - target 위치: `spec/4-nodes/5-data/2-code.md §7.2`, `§Rationale "메모리 한도 환경변수화 (2026-06-12)"`
  - 과거 결정 출처: `spec/4-nodes/5-data/2-code.md §Rationale "메모리 한도 환경변수화"` — "운영자는 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수로 조정 가능(기본 `128`, **안전 상한 `512`** — 초과 설정은 512 로 clamp)." 및 "**기각**: 무제한 env — 단일 노드가 호스트 OOM 을 유발할 수 있다."
  - 상세: spec은 `CODE_NODE_MEMORY_LIMIT_MB` env var + 512MB clamp 를 이미 결정된 사항으로 기술하고 있다. 구현(`code.handler.ts` 16~20행)은 `W15: Currently hardcoded. Can be extracted to CODE_NODE_MEMORY_LIMIT_MB env var if runtime tuning is needed.` 주석과 함께 상수 128로 하드코딩되어 있다. spec Rationale가 이미 완료된 결정으로 명문화한 사항이 구현에 반영되지 않은 상태.
  - 제안: `ISOLATE_MEMORY_LIMIT_MB` 를 `Math.min(+(process.env.CODE_NODE_MEMORY_LIMIT_MB ?? 128), 512)` 로 교체하여 env 조정 및 512MB clamp 를 구현한다. spec은 변경 불필요.

- **[WARNING]** `syntaxIsolate` 장기 재사용 — "isolate 풀 재사용" 기각 결정의 경계와 부분 중첩
  - target 위치: `spec/4-nodes/5-data/2-code.md §6` (pre-flight throw, 컴파일 실패 경로)
  - 과거 결정 출처: `spec/4-nodes/5-data/2-code.md §Rationale "dayjs per-exec 재컴파일 → 힙 스냅샷"` — "**기각된 대안**: isolate 풀 재사용 — per-exec dispose(실행 간 메모리·상태 격리) 불변을 위반한다."
  - 상세: Rationale가 기각한 "isolate 재사용" 패턴이 syntax-check 전용 `syntaxIsolate` 에서는 모듈 수명 동안 재사용된다(`code.handler.ts` 233~256행). 다만 이 isolate는 `compileScriptSync` 만 수행하고 사용자 코드를 실행하지 않으므로, Rationale가 기각한 "실행 간 메모리·상태 격리 불변 위반" 과는 목적이 다르다. 그러나 spec 본문 §6 에는 "컴파일 실패 = pre-flight throw" 정의만 있고, syntax-check isolate 재사용에 대한 설계 근거가 spec에 기록되지 않았다. 기각된 대안(isolate 재사용)과 형태가 유사해 향후 혼동 가능성이 있다.
  - 제안: `spec/4-nodes/5-data/2-code.md §Rationale` 에 "syntax-check 전용 syntaxIsolate 장기 재사용 — 실행 isolate 와 다른 이유" 항을 추가하여 결정 근거를 명문화한다 (컴파일만 수행하여 실행 간 상태 격리 불변 무관, JS 단일 스레드라 직렬화 보장). project-planner 위임 필요.

- **[INFO]** `meta.success` 필드 — CONVENTIONS Principle 2 "Code 계열 권장 필드" 상태 확인
  - target 위치: `spec/4-nodes/5-data/0-common.md §4` (meta 필드 설명), `spec/4-nodes/5-data/2-code.md §5.1 / §5.3`
  - 과거 결정 출처: `spec/conventions/node-output.md Principle 2` — "`meta.success`" 를 Code 계열 전용 편의 필드로 정의
  - 상세: `0-common.md §4` 의 `meta` 행에 "runtime 에러는 `output.error` + `port:'error'` 로 처리 — `meta.error`/`meta.errorCode`/`exitReason` 별칭은 Phase 1 (D) 에서 폐기"라고 명시되어 있고, 구현에서도 폐기 별칭이 제거된 것을 확인. 단, `meta.success` 가 "권장(Code 계열 전용)" 수준인지 "필수" 인지 0-common.md 에서 명확히 표현되지 않아 향후 오해 소지 존재. 실제 구현은 `meta.success` 를 항상 반환하고 있어 spec 의도와 일치.
  - 제안: `0-common.md §4` meta 행에 `meta.success` 가 Code 노드 **필수** 필드임을 명시하는 간단한 각주 추가(현재는 "편의 필드"로만 기술).

---

## 요약

`spec/4-nodes/5-data/` 내 spec 문서의 Rationale 는 전반적으로 잘 구조화되어 있고 합의 원칙과의 일관성이 높다. 그러나 두 가지 CRITICAL 항목이 구현과 충돌한다: (1) `spec/4-nodes/5-data/2-code.md §Rationale`에서 명시적으로 기각한 "base64 비문자열 silent 강제변환 유지"가 `code.handler.ts`에 그대로 남아 있고, (2) 같은 Rationale에서 완료된 결정으로 명문화한 `CODE_NODE_MEMORY_LIMIT_MB` env 조정 + 512MB clamp 가 구현에 반영되지 않고 `W15` 주석으로만 남아 있다. 이 두 항목은 구현 착수 전에 수정해야 한다. WARNING 항목(syntaxIsolate 재사용 근거 미기록)은 보안 경계는 침해하지 않으나 기각된 대안과 형태적 유사성으로 인해 Rationale 보완이 필요하다.

---

## 위험도

HIGH
