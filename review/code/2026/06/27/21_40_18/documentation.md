# 문서화(Documentation) 리뷰

## 발견사항

### [WARNING] `spec/5-system/17-agent-memory.md` 가 changeset 에 없음 — AGM-08 watermark 경로 spec 미확인
- 위치: 전체 diff — `spec/5-system/17-agent-memory.md` 부재
- 상세: 직전 리뷰 세션(21_13_52) RESOLUTION.md W#1 는 `spec/5-system/17-agent-memory.md` §3·§7(실현됨)·§7(Rationale) 4곳의 AGM-08 watermark 경로를 `_resumeState.memoryState.lastExtractionTurnSeq` 로 갱신하고 in-flight 폴백을 병기하도록 FIX 지정했다. 그러나 현재 changeset(21_40_18) 에 해당 spec 파일이 포함되지 않아, 구현(I12) 에 맞춰 spec 이 실제로 갱신됐는지 확인할 수 없다. 구 평면 키 `_resumeState.lastExtractionTurnSeq` 기준으로 남아있는 spec 은 새 기여자/리뷰어에게 잘못된 계약을 전달한다.
- 제안: `spec/5-system/17-agent-memory.md` §3·§7 실현됨·§7 Rationale 에서 watermark 위치를 `_resumeState.memoryState.lastExtractionTurnSeq` 로 갱신하고, in-flight 파킹 실행 하위호환 폴백(`_resumeState.lastExtractionTurnSeq`) 도 병기했는지 확인 후 해당 커밋을 이 PR 에 포함한다.

---

### [INFO] `saveMemories` options 객체 — `workspaceId`·`scopeKey`·`items` 인라인 JSDoc 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — 신규 options 객체 시그니처
- 상세: 리팩토링(I3)으로 positional 파라미터에서 options 객체로 전환됐다. `embedCfgSource` 와 `ttlDays` 는 인라인 JSDoc 이 추가됐으나(`embedCfgSource`: 회수와 동일 ModelConfig 차원·endpoint 일치; `ttlDays`: expires_at 계산·무만료 조건), `workspaceId`·`scopeKey`·`items` 는 인라인 설명이 없다. 이 세 필드는 메서드 레벨 JSDoc 에서도 별도 기술되지 않아, `scopeKey` 형식 제약이나 `items` 유효성 규칙(`content.trim()` 검사 등)을 코드 독자가 구현을 직접 탐색해야 파악할 수 있다.
- 제안: 최소한 `embedCfgSource`·`ttlDays` 와 동등한 수준으로 `scopeKey` 와 `items` 에 짧은 인라인 JSDoc 을 추가한다 (예: `/** 네임스페이스 격리 키 (§5, AGM-07) */`, `/** 저장할 메모리 항목 배열 — content 가 비거나 공백이면 필터링 */`).

---

### [INFO] `_resumeState.memoryState` 스키마 변경 — 외부 규약 문서 미확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`, `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
- 상세: `_resumeState` 루트의 `lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq` 서브 네임스페이스 마이그레이션(I12)은 두 핸들러(ai_agent·information_extractor)가 공유하는 resume-state 스키마 계약 변경이다. 각 파일의 인라인 주석에는 I12 근거와 하위호환 폴백이 명시되어 있으나, `_resumeState` 전체 스키마를 단일 진실로 정의하는 외부 spec 또는 convention 문서(예: `spec/5-system/17-agent-memory.md`)가 이번 diff 에 없어 중앙화된 기록 여부를 확인할 수 없다. 향후 세 번째 핸들러가 resume-state 를 소비할 때 `memoryState` 네임스페이스를 찾지 못하고 구 평면 키를 신설할 위험이 있다.
- 제안: spec 문서 갱신(위 WARNING 과 동일 작업)으로 해소 가능. `spec/5-system/17-agent-memory.md` 또는 `spec/conventions/` 에 `_resumeState.memoryState` 서브 네임스페이스 도입 근거와 폴백 전략을 단일 진실로 기재한다.

---

### [INFO] 인라인 태그(I3·I5·I-7·I12·W-8) — 코드 내 범례 부재
- 위치: 전 변경 파일 인라인 주석 전반
- 상세: `I3`, `I5`, `I-7`, `I12`, `W-8` 등의 태그가 광범위하게 사용된다. `plan/in-progress/ai-context-memory-followup-v2.md` 에 항목별 설명이 있어 탐색은 가능하나, 코드를 직접 읽는 기여자가 태그만으로는 의미를 파악하지 못한다. plan 파일 참조는 태그를 처음 접하는 독자에게 비직관적이다.
- 제안: 현재 `plan/` 항목이 범례 역할을 하므로 큰 위험은 없다. 다만 `spec/conventions/` 또는 CONTRIBUTING 문서에 "I-번호 = plan/in-progress 의 세부 항목 참조" 규약을 한 줄 추가하면 진입 장벽을 낮출 수 있다.

---

### [INFO] CHANGELOG 부재 — `saveMemories` 공개 API 시그니처 변경
- 위치: 전체 diff
- 상세: `saveMemories` 가 positional 5파라미터에서 단일 options 객체로 변경됐다(I3). 이는 `AgentMemoryService` 의 공개 메서드 시그니처를 파괴적으로 변경한다. 프로젝트가 CHANGELOG 를 유지하는지 이 diff 로는 확인되지 않으나, 서비스를 직접 호출하는 외부 모듈(있다면)은 빌드 실패로 탐지되므로 실질적 영향은 TS 컴파일이 흡수한다.
- 제안: 프로젝트 CHANGELOG 가 있다면 `saveMemories` API 변경(옵션 객체화)을 항목으로 추가한다. 없다면 무시해도 무방하다.

---

### [POSITIVE] 신규 공개 메서드 JSDoc 전반적으로 충실
- 위치: 아래 세 파일
- 상세:
  - `readExtractionWatermark` (`/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`): 신 namespace 우선 읽기·구 평면 키 폴백 근거(I12 하위호환)·undefined 반환 계약·두 핸들러 단일화 이유 모두 기술됨. 이전 리뷰 세션의 W#7 확인 결과와 일치.
  - `buildCosineMatch` (`/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/modules/agent-memory/agent-memory.service.ts`): 파라미터 순서 계약(`$1`~`$4`) · `scoreExpr`/`whereClause` 반환값 의미 · HNSW 인덱스 조건 일치 이유까지 포함한 comprehensive JSDoc.
  - `updateSummaryState` (`/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts`): I-7 단일 변이 경로 · Redis 직렬화 영속 · DB 컬럼 없음 · "두 필드 함께 제공" 계약 경고까지 충실히 기술됨.
- 제안: 없음. 변경으로 추가된 세 공개/shared 함수 모두 기존 프로젝트 주석 수준 대비 상위 품질.

---

### [POSITIVE] `MultiTurnState.memoryState` 타입 필드 주석 개선
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `MultiTurnState` 인터페이스
- 상세: `lastExtractionTurnSeq?: number` → `memoryState?: { lastExtractionTurnSeq?: number }` 전환과 함께 필드 JSDoc 이 갱신됐다. I12 연계, "현재 forward-looking 슬롯" 의 명시적 한계, A3 교훈(반드시 resume state 로 운반), 하위호환 폴백 언급까지 포함돼 인터페이스 계약이 코드 수준에서 자기 문서화된다.
- 제안: 없음.

---

### [POSITIVE] 제거된 이중 읽기 주석 처리 정확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-backend-refactor/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`
- 상세: "두 호출은 목적이 다르다 — 중복 호출이 아니다"라는 구 설명 블록이 단일 읽기 전환과 함께 정확히 제거됐고, 대체 주석이 W-8(I/O-backed 전환 대비) 및 in-memory 파생 방식을 명확히 설명한다. 오래된 주석이 남아있지 않다.
- 제안: 없음.

---

## 요약

이번 changeset(Batch 2)은 `saveMemories` 옵션 객체화(I3), `buildCosineMatch` 빌더 추출(I5), `updateSummaryState` 단일 변이 경로(I-7), `memoryState` 서브 네임스페이스 마이그레이션(I12)으로 구성된 내부 리팩토링이다. 신규 공개/공유 함수(`readExtractionWatermark`, `buildCosineMatch`, `updateSummaryState`) 전부 comprehensive JSDoc 을 갖추었고, 인라인 주석은 변경된 코드와 잘 일치하며 오래된 주석은 정확히 제거됐다. `saveMemories` options 객체의 `embedCfgSource`·`ttlDays` JSDoc 도 추가됐다. 주요 미결 사항은 하나: `spec/5-system/17-agent-memory.md` 가 이 changeset 에 없어 직전 리뷰 RESOLUTION W#1 로 지정된 AGM-08 watermark 경로 spec 갱신이 실제로 완료됐는지 확인되지 않는다. 나머지 발견사항(workspaceId·scopeKey 인라인 JSDoc, 태그 범례, CHANGELOG)은 전부 INFO 수준으로 기능 정확성에 영향이 없다.

## 위험도

LOW

STATUS: SUCCESS
