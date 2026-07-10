# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (+ ai-agent.md / information-extractor.md)

## 검토 배경

본 브랜치는 origin/main(`01e68001c`)으로 rebase 됐고, 그 base 에는 PR #877(`d6ae32da3`, resume 턴 통합 usage-log attribution 복원)과 PR #879(`79669505c`, resume 턴 llm_usage_log attribution 소비 사이트 교정 — IE 오적재 + ai_agent 메인 chat)가 **이미 포함**돼 있다. 대상 변경(`spec/5-system/4-execution-engine.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`)은 working tree 의 **미커밋 docs-only diff**이며 코드 파일 변경은 없다(`buildRetryReentryState`/`ai-turn-executor.ts`/`information-extractor.handler.ts` 는 이미 #877·#879 로 정합).

## 발견사항

### 이전 라운드 CRITICAL — 해소 확인

- **[INFO]** "addendum 이 ai_agent 소비 정합을 실제보다 앞서 주장" CRITICAL → **RESOLVED**
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale "resume/retry 턴 usage-log attribution — 식별 필드 재유도 불변식 (#501, 2026-07)" (диff 상 line 1378-1384)
  - 과거 발견: 직전 라운드에서는 이 addendum 이 "코드는 이미 정합(본 PR)" 류 표현으로 아직 base 에 없는 소비 사이트 수정을 자신의 것으로 주장한다는 CRITICAL 이었다.
  - 현재 상태: 텍스트는 정확히 "코드는 이미 정합(재구성 재유도 **PR #877** — 회귀 복원, `llm_usage_log` 소비 사이트 교정 **PR #879**)이므로 본 addendum·§1.3·§10.3 갱신은 **순수 문서 정합화**다" 로 attribution 을 명시한다. "적용 범위" 단락도 "이 IE 소비 교정과 `ai_agent` 메인 chat 재개의 유사 `llm_usage_log` NULL 누락 교정은 **PR #879**(`task_1543860b`)로 함께 완료됐고 회귀 테스트로 pin 됐다"로 정확히 귀속한다. `git log`/`git merge-base --is-ancestor` 로 #877·#879 가 현재 HEAD 의 조상임을 확인했고, `execution-engine.service.ts:4845` `buildRetryReentryState`(workflowId/nodeExecutionId/workspaceId 재주입) · `ai-turn-executor.ts`(2599-2756 라인대 `llmContext`) · `information-extractor.handler.ts`(789-895 라인대 `llmContext`) 실제 코드가 addendum 서술과 정확히 일치함을 확인했다. "본 PR" 류 자기귀속 언어는 diff 전체에서 검색되지 않는다.
  - 결론: 이 라운드에서는 위반이 아니다 — 재도입도, 무근거 번복도, 원칙 위반도 없다.

### 신규 관찰 — 문제 없음, 참고용

- **[INFO]** `_resumeCheckpoint` 재유도 서술의 "정정" 은 근거를 갖춘 번복이다
  - target 위치: `spec/5-system/4-execution-engine.md` §1.3 "shape: `_retryState` 와 동일 부분집합…" 문단(diff 상 line 168 부근) — 종전 "재개 시 `node.config` 재평가로 재유도" 단일 채널 서술을 "**두 재유도 채널**(조작 필드=`node.config`, 식별 필드=호출측 컨텍스트)"로 분리.
  - 과거 결정 출처: 동일 문서 §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" 항(원 결정, Phase B).
  - 상세: 종전 서술은 "credential/context-binding 필드는 미동봉, 재개 시 `node.config` 재평가로 재유도" 라고만 했는데, 이는 부정확했다(§Rationale 신규 addendum 이 "이 단순화가 갭을 가렸다" 고 스스로 인정) — `workflowId`/`nodeExecutionId` 는 `node.config` 가 아니라 호출측 컨텍스트에서 와야 하기 때문. 이번 diff 는 그 부정확한 서술을 정확한 two-channel 서술로 교체하면서, 동시에 새 §Rationale 항목("resume/retry 턴 usage-log attribution")에 "왜 정정하는가" 근거를 남겼다. Rationale 연속성 관점의 check #3("결정의 무근거 번복")에 정확히 해당하는 패턴이지만 **근거(Rationale)를 동반**했으므로 위반이 아니라 모범 사례에 해당한다.
  - 제안: 없음(현재로 충분).

- **[INFO]** `_selectedPort` fan-out 배열 서술 추가는 기존 convention 과 정합, 신규 결정 아님
  - target 위치: `spec/5-system/4-execution-engine.md` §2.1 "back-edge 활성화 조건" + "`_selectedPort` 메타데이터 처리" (diff 상 line 225, 242), §5.1 `NodeHandlerOutput.port` 타입 (`string` → `string | string[]`, diff 상 line 491-492).
  - 과거 결정 출처: `spec/conventions/node-output.md` §Principle 5 "`port` 활성화 모델" (기존, 미변경) — `port: string[]` 로 fan-out(parallel/text_classifier) 을 이미 규정하고 있었다.
  - 상세: 이번 diff 는 실행 엔진 문서가 그동안 Principle 5 를 반영하지 못해 `port` 를 `string` 단수로만 문서화하고 back-edge 활성화 조건도 문자열 일치만 서술하던 **문서 갭**을 메운 것이다. `graph-traversal.service.ts` `isPortFiltered`(`.includes()` 분기, line 106-138) 와 `execution-engine.service.ts` `findActivatedBackEdge`(line 6141-6158, 동일 `isPortFiltered` 재사용)를 코드로 확인했고 실제 동작과 새 서술이 일치한다. 신규 대안 채택이 아니라 기존 convention과의 정합화이므로 Rationale 재도입/번복 이슈 없음.
  - 제안: 없음.

- **[INFO]** `pending_plans` 에서 `exec-park-durable-resume.md` 제거는 정당
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter, `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter.
  - 상세: `plan/complete/exec-park-durable-resume.md` 로 이미 이동 완료된 plan 이다(`find plan -iname` 로 확인). dangling pending_plans 정리이며 Rationale 위반과 무관.

## 요약

대상 docs-only diff 는 (a) PR #877/#879 로 이미 base 에 반영된 코드 동작을 문서에 정확히 반영·귀속하고, (b) 종전에 부정확했던 "`node.config` 단일 채널 재유도" 서술을 근거(#501 addendum)와 함께 정정하며, (c) `_selectedPort`/`port` fan-out 서술과 §10.3/§10.4 위치를 기존 convention(Principle 5)·기존 §10 구조에 맞춰 보정한다. 직전 라운드에서 CRITICAL 로 지적됐던 "미완료 코드 수정을 문서가 선반영·자기귀속" 문제는 rebase 로 #879 가 base 에 편입되고 텍스트가 "PR #877"/"PR #879" 로 정확히 귀속되면서 해소됐다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회는 발견되지 않았다.

## 위험도

NONE
