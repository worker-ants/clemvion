# 정식 규약 준수 검토 — C-2 2차(완결) impl-prep

> 검토 모드: `--impl-prep` (구현 착수 전)
> 대상 범위: `03-maintainability C-2 2차` — `ai-turn-executor.ts` 잔여 god-method 분해 (tool-loop/completion 및 processMultiTurnMessage)
> 기준 규약: `spec/conventions/**`

---

## 발견사항

### 1. **[WARNING]** 분해 대상 `processMultiTurnMessage` 내 `console.warn` spec 명문과 plan m-1 Logger 교체 규약 충돌

- **target 위치**: 분해 범위 — `processMultiTurnMessage`(~768줄) c.fallback 경로 (`ai-turn-executor.ts:1957`)
- **위반 규약**: `spec/conventions/` 소속 plan `03-maintainability.md §m-1` 은 backend NestJS 서비스 내 `console.warn` 을 `Logger` 로 교체하도록 규정 (`3-error-handling.md §6.2` 구조화 JSON 로그 형식 우회 금지). 그러나 `spec/4-nodes/3-ai/1-ai-agent.md §6.2 c.fallback` 은 진단 라인을 **명문으로** `console.warn('[processMultiTurnMessage] form submission without pendingFormToolCall — fallback to plain user message', ...)` 로 지정한다.
- **상세**: 현재 worktree 의 `ai-turn-executor.ts:1957` 은 이미 `AiTurnExecutor.logger.warn(...)` 으로 구현돼 spec 원문의 `console.warn` 과 불일치한다. C-2 분해 중 c.fallback 경로를 private helper 로 추출하고 method doc 에 `§6.2 c.fallback` 단계번호를 명기하면, spec 원문(`console.warn`)·현 구현(`Logger.warn`)·m-1 규약(Logger 교체 의무) 삼중 불일치가 코드 주석에 드러난다. 분해 자체가 불일치를 심화시키지는 않으나, 독자 혼란과 향후 spec 정오표 누락 위험이 있다.
- **제안**: C-2 분해 착수 전 planner 에게 `spec/4-nodes/3-ai/1-ai-agent.md §6.2 c.fallback` 의 `console.warn` 명문을 `Logger.warn` 으로 정정 위임(plan m-1 §개선방안 3번 — "ai-agent.md 한 줄 (planner)")을 선행 완료할 것. 또는 추출한 private helper doc 에 "spec §6.2 c.fallback 원문은 console.warn 이나 m-1 Logger 교체 선반영" 을 명시해 불일치 의도를 투명하게 기록.

---

### 2. **[INFO]** 분해 메서드 명명 (`buildTurnMessages` / `classifyTurnResult` / `executeToolBatch` / `handleTurnCompletion`) — 정식 규약과 일치

- **target 위치**: C-2 plan §개선방안 1 — 추출 예정 private method 명칭
- **위반 규약**: 해당 없음. camelCase TypeScript private method 명명은 정식 규약 위반이 아니다. `spec/conventions/audit-actions.md §1` 의 underscore 토큰 구분자 규약은 audit action 식별자에 한정되며 TypeScript method 명명에 적용되지 않는다. spec `1-ai-agent.md §6.2` 가 제시한 단계 경계와 자연 정렬된 명칭이다.
- **제안**: 변경 불요.

---

### 3. **[INFO]** method doc 에 `§6.1`/`§6.2` 단계번호 명기 — spec 추적성 패턴 정합

- **target 위치**: C-2 plan — "각 메서드 doc 에 §6.1/§6.2 단계번호 명기"
- **위반 규약**: 해당 없음. `spec-impl-evidence.md` 는 spec frontmatter `code:` 글로브로 구현 경로를 추적하고, method 레벨 JSDoc 에 spec 섹션 번호를 기재하는 패턴은 `spec/conventions/swagger.md §1-1` JSDoc 추가 권장과 정합한다.
- **제안**: 변경 불요.

---

### 4. **[INFO]** 클러스터 plan 문서 frontmatter 면제 정합 확인

- **target 위치**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/03-maintainability.md` — frontmatter 없음
- **위반 규약**: 해당 없음. `plan-lifecycle.md §4` 는 top-level `plan/in-progress/*.md` 에만 `worktree`/`started`/`owner` 세 필드를 의무화하며, 하위 그룹 폴더(`refactor/`)의 부속 문서는 클러스터 면제 대상이다. `plan-frontmatter.test.ts` 가드도 subfolder 클러스터를 면제한다.
- **제안**: 변경 불요.

---

### 5. **[INFO]** "spec 변경 불요" 선언 — `spec-impl-evidence.md §3` 라이프사이클 전이와 정합

- **target 위치**: C-2 plan — "spec 변경 불요"
- **위반 규약**: 해당 없음. `spec/4-nodes/3-ai/1-ai-agent.md` 는 `status: implemented` 로 선언됐고, behavior-preserving 분해에 spec 본문·frontmatter 갱신이 불필요한 것은 `spec-impl-evidence.md §3` 라이프사이클과 일치한다.
- **제안**: 변경 불요.

---

## 요약

C-2 2차(완결) 분해 범위는 정식 규약(`spec/conventions/**`)과 대체로 일치한다. 실질 우려는 WARNING 1건이다: `processMultiTurnMessage` c.fallback 경로에 대해 spec `1-ai-agent.md §6.2` 가 `console.warn(...)` 을 명문화한 반면, 현 구현은 이미 `AiTurnExecutor.logger.warn(...)` 으로 교체돼 있고 plan m-1 도 Logger 교체를 요구한다. C-2 분해로 해당 경로를 private helper 로 추출하고 method doc 에 spec 단계번호를 명기하면 삼중 불일치가 주석에 노출된다. 분해 착수 전 planner 에게 spec 정정 위임을 선행하거나, helper doc 에 불일치 의도를 명시 기록하는 것이 권장된다. 나머지 4건은 INFO 등급(이상 없음 확인)이다.

## 위험도

LOW
