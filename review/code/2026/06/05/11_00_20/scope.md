# Scope Review — summaryModel / extractionModel 옵션

**worktree**: `agent-memory-summary-model-fa4efb`
**diff**: `origin/main..HEAD` (2 commits)

---

## CRITICAL

없음.

---

## WARNING

### [WARNING] summaryModel 이 멀티턴 resume state 에 저장되지 않음

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `multiTurnStateBase` (line ~2152), `state.summaryModel` 참조 (line 2527)
- **상세**: `processMultiTurnMessageInner` 의 resume 경로(line 2527)에서 `state.summaryModel` 을 읽지만, `multiTurnStateBase` 에 `summaryModel` 필드가 포함되지 않아 멀티턴의 2번째 이후 turn 에서는 항상 `undefined` 가 된다. 결과적으로 멀티턴 `summary_buffer`/`persistent` 노드에서 `summaryModel` 을 설정해도 첫 turn 에서만 적용되고 이후 turn 의 롤링 요약 LLM 콜은 `undefined || args.model` 폴백으로 노드 메인 모델을 쓰게 된다. 기능적 회귀는 아니나(폴백 동작), 설정한 값이 무시되는 silent drop 이다. `extractionModel` 은 멀티턴 추출 경로(line 1146)에서 `args.config.extractionModel` 로 읽히는데, 이때 `args.config` 는 `state` 자체이므로 동일하게 `state.extractionModel` 이 `undefined` 다.
- **대비**: `memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTtlDays` 는 모두 `multiTurnStateBase` 에 명시적으로 저장된다. `summaryModel`/`extractionModel` 만 누락.
- **제안**: `multiTurnStateBase` 에 두 필드 추가.

```typescript
// multiTurnStateBase 에 추가 필요
summaryModel: config.summaryModel as string | undefined,
extractionModel: config.extractionModel as string | undefined,
```

---

## INFO

### [INFO] conversation-thread §9 부모 heading 추가 — 정당, 분리 양호

- **위치**: `spec/conventions/conversation-thread.md` line 377 (`## 9. 미리보기 UI 렌더 규칙` 추가)
- **상세**: origin/main 에서 `## 9` 부모 heading 없이 `### 9.1` 이 직접 시작돼 있었고, `spec/4-nodes/3-ai/1-ai-agent.md` (line 691) 과 `spec/5-system/6-websocket-protocol.md` (line 692, 983 등) 에서 `#9-미리보기-ui-렌더-규칙` 앵커를 참조한다. heading 부재 시 앵커가 깨진 pre-existing 상태를 수정한 것으로, 본 기능(summaryModel/extractionModel)과 무관하다. 별도 커밋(`31e3effd`)으로 분리돼 있어 혼입 추적도 양호하다.
- **평가**: 정당한 선행 픽스. 분리 여부: YES (독립 커밋).

### [INFO] ai.mdx / ai.en.mdx 문서 갱신 — 적정 범위

- **위치**: `codebase/frontend/src/content/docs/02-nodes/ai.mdx`, `ai.en.mdx`
- **상세**: 신규 필드 `summaryModel`/`extractionModel` 에 대한 PropTable 행 추가(2행) + 산문 설명 1행 추가. 기존 다른 필드의 문구·포맷팅 변경 없음. 필드 추가 시 문서 동기화는 본 기능 범위에 해당한다.
- **평가**: 적정.

### [INFO] backend-labels.ts i18n 추가 — 적정 범위

- **위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts`
- **상세**: `"Extraction Model"` / `"Summary Model"` LABEL_KO 2개 + HINT_KO 2개 추가. 기존 항목 수정·삭제 없음. 알파벳 순서 삽입 위치 정확.
- **평가**: 적정.

### [INFO] spec §12.12 Rationale 번복 기술 — 적정 범위

- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.12
- **상세**: 기존 "scope-freeze 로 전용 필드 기각" 결정을 "번복" 으로 명시하고 번복 근거를 상세히 기술. 과거 결정과 현재 결정이 나란히 남아 있어 히스토리 추적이 가능하다. spec 문서 Rationale 섹션 갱신은 구현 변경에 동반되는 정상 범위다.
- **평가**: 적정.

### [INFO] plan 파일 신규 생성 — 정상

- **위치**: `plan/in-progress/agent-memory-summary-model.md`
- **상세**: 본 작업의 계획 파일로 CLAUDE.md 규약(`plan/in-progress/`)에 따른 생성. worktree, started, owner 등 frontmatter 정상.
- **평가**: 정상.

---

## 요약

변경 범위는 전반적으로 목적(summaryModel/extractionModel 필드 도입)에 집중되어 있다. 스펙(2개 파일), 백엔드 스키마·핸들러·서비스·큐(5개 파일), 프론트엔드 문서·i18n(3개 파일), 플랜 파일(1개)이 일관된 하나의 기능을 구성한다. `conversation-thread §9` heading 추가는 pre-existing 깨진 앵커 보강으로 독립 커밋으로 분리되어 정당하다. 불필요한 리팩토링이나 무관한 포맷팅 변경은 없다. 단, **멀티턴 resume 경로에서 `summaryModel`/`extractionModel` 이 `multiTurnStateBase` 에 저장되지 않아** 설정값이 2번째 이후 turn 에서 silent drop 된다 — 기능 회귀는 아니나 멀티턴 비용 절감 의도를 실현하지 못하는 결함으로 수정이 필요하다.

---

## BLOCK: NO
