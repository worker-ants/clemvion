---
worktree: fix-bg-context-followups
started: 2026-06-03
owner: resolution-applier
completed: 2026-06-10
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/conventions/execution-context.md
---
# Spec Update Draft — execution-context options-bag & [ctx-trace] policy

> **✅ APPLIED 2026-06-03** — `/consistency-check --spec` BLOCK: NO (`review/consistency/2026/06/03/21_00_19/`) 확인 후 본 draft 의 3개 변경을 spec 에 반영 완료:
> 1. `spec/5-system/4-execution-engine.md` §6.1 createContext 시그니처 → options-bag.
> 2. `spec/conventions/execution-context.md` §Rationale 기각 범위 한정 주석 추가.
> 3. `spec/conventions/execution-context.md` 신규 `## 3. 진단 정책 ([ctx-trace])` 섹션 (별 섹션 배치 — consistency I3/I6 반영). best-effort no-op+warn vs strict throw+error 표 포함.
>
> consistency W1/W2/I4/I5 의 "코드가 positional/silent no-op 유지" 지적은 **stale-read false positive** (실제 코드는 f102dc0b+06c92d41 로 options-bag + `[ctx-trace]` warn 적용 완료 — `options: CreateContextOptions = {}`, `warnContextMissing` 헬퍼). draft 기술이 코드와 일치함을 확인하고 그대로 반영.

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — 구현이 spec 을 의도적으로 개선·확장하였으며 spec 이 따라와야 한다. 코드 수정 금지.

Sources:
- ai-review SUMMARY INFO#1, INFO#2, WARNING#6
- consistency-check `review/consistency/2026/06/03/20_37_33/SUMMARY.md` WARNING W1, W2

---

## 원본 발견사항

**SUMMARY INFO#1 / consistency W1**: `spec/5-system/4-execution-engine.md` §6.1 (line ~645)의 `createContext` 시그니처 기술이 옛 positional 형태(`createContext(executionId, …, contextKey?)`)로 남아 있음 — 코드는 이미 options-bag(`createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey? })`)으로 변경돼 있으며 의도적·합리적 개선이므로 코드 유지, spec 갱신 필요.

**SUMMARY INFO#2 / consistency W2**: `spec/conventions/execution-context.md` §Rationale "기각된 대안 — `ExecutionOptions` 추출" 단락이 기각 범위를 한정하지 않아, `createContext` options-bag 변경이 기각된 안을 재도입한 것으로 오독될 수 있음.

**SUMMARY WARNING#6**: `spec/conventions/execution-context.md` 에 context-miss 시 no-op + `[ctx-trace]` warn 정책이 미반영.

---

## 제안 변경

### 1. `spec/5-system/4-execution-engine.md` §6.1 (line ~645)

**Before:**
```
`createContext(executionId, …, contextKey?)` 에서 Map 키 = `contextKey ?? executionId`
```

**After (전체 문장 교체):**
> **엔진 내부 Map 키 (`_contextKey`)**: `ExecutionContextService` 의 in-memory `Map<key, ExecutionContext>` 라우팅 키. `createContext(executionId, workflowId, options?: { initialVariables?, recursionDepth?, contextKey? })` 에서 Map 키 = `options?.contextKey ?? executionId` — 비-background 호출은 `contextKey` 를 생략해 항상 `executionId` 와 동일(동작 불변). background 본문만 `bg:<executionId>:<backgroundRunId>` 를 전달해 부모 컨텍스트와 키 격리한다 (§3.3, [Background §4](../../spec/4-nodes/1-logic/12-background.md#4-실행-로직)). **이 키는 in-memory 전용** — Redis 키 패턴(§9.1)과 무관하다. 결정 SoT: [execution-context 규약 §Rationale](../../spec/conventions/execution-context.md#rationale).

### 2. `spec/conventions/execution-context.md` §Rationale "기각된 대안 — `ExecutionOptions` 추출"

기각 단락 말미에 범위 한정 주석 추가:

**Before (현재 말미):**
```
…컨테이너별 `extends` 분리가 타입 안전성과 책임 경계 모두에서 우월해 채택하지 않았다.
```

**After:**
```
…컨테이너별 `extends` 분리가 타입 안전성과 책임 경계 모두에서 우월해 채택하지 않았다.

> **주의 — 기각 범위**: 본 기각은 핸들러에 주입되는 `ExecutionContext` 필드 집합을 단일 options 객체로 묶는 안에 대한 것이다. `ExecutionContextService.createContext()` 메서드 인자 시그니처를 options-bag 으로 구성하는 것은 별개 사안으로 본 기각의 적용 범위 밖이다 (2026-06-03, ai-review INFO#3).
```

### 3. `spec/conventions/execution-context.md` — `[ctx-trace]` 진단 정책 추가

§원칙 4 또는 말미 별도 섹션에 추가:

```markdown
**`[ctx-trace]` 진단 prefix 정책**: `ExecutionContextService` 는 context 생명주기의
핵심 이벤트(createContext OVERWRITE, deleteContext, setNodeOutput MISSING,
setStructuredOutput/setEngineResolvedConfig MISSING)를 `[ctx-trace]` prefix 로
구분된 로그로 남긴다. production 로그에서 `[ctx-trace]` 로 grep 해 context
race·키 라우팅 오류를 추적한다.

best-effort setter (`setStructuredOutput`, `setEngineResolvedConfig`) 는 context
미존재 시 **no-op + warn** (데이터 유실 무시, 키 라우팅 오류 신호). strict setter
(`setNodeOutput`) 는 **throw + error** (핸들러 출력 전달 보장 필요).
```

---

## 관련 파일

- `spec/5-system/4-execution-engine.md` §6.1 (line ~645)
- `spec/conventions/execution-context.md` §Rationale + §원칙 4(또는 신규 §진단 정책 섹션)

## 후속 절차

project-planner 가 `/consistency-check --spec` 실행 → BLOCK:NO 확인 후 위 변경 반영.
main 이 resolution-applier 재호출 시 이미 처리된 코드 항목은 idempotency 로 skip.
