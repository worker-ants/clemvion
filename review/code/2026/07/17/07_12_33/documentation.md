# 문서화(Documentation) 리뷰

## 발견사항

- **[CRITICAL]** `§7.9` cross-reference 가 잘못된 spec 파일을 반복적으로 가리킴 (실제 존재하지 않는 섹션)
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts` (신설 JSDoc, `makeErroredConversationOutput` 위), `codebase/frontend/src/lib/websocket/use-execution-events.ts` (신규 인라인 주석, `output?: unknown` 필드 위), `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` (CT-S15 테스트 위 주석), `codebase/frontend/src/components/editor/run-results/result-detail.tsx` (`isConversationHistory` 위 주석, "실행 엔진 §7.9"), `spec/2-navigation/14-execution-history.md` (§3.4), `spec/3-workflow-editor/3-execution.md` (§10.6.1 블록쿼트 1곳 + §10.8 라이프사이클 표 1곳, 총 2곳), `spec/conventions/conversation-thread.md` (§8.5 Rationale, §9.10 CT-S15 행) — 총 9곳
  - 상세: 위 9곳 모두 `[실행 엔진 §7.9](../5-system/4-execution-engine.md)` 또는 `spec/5-system/4-execution-engine.md §7.9` 형태로 "엔진이 실패 시에도 outputData 를 영속·emit 한다" 는 근거를 인용한다. 그러나 실측 결과 `spec/5-system/4-execution-engine.md` 의 `## 7. 장애 복구` 절은 `§7.1 워커 크래시 복구` ~ `§7.5.2 continuation ack 에러 표면` 까지만 있고 **`§7.9` 자체가 존재하지 않는다** (완전히 다른 주제인 "장애 복구/재개"). 실제로 "Multi Turn 모드 — 오류(`error` 포트)" 를 다루는 `§7.9` 는 `spec/4-nodes/3-ai/1-ai-agent.md` 에 있다. 흥미롭게도 같은 diff 안 `conversation-thread.md` §9.3 신규 행(`오류 종결 · live 세션` 바로 위 행)은 **정확하게** `[AI Agent §7.9](../4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트)` 로 링크해 올바른 목적지를 알고 있었음을 보여준다 — 즉 나머지 9곳은 파일 취사선택 실수(오타가 아니라 반복된 오참조)로 보인다.
  - 제안: 위 9곳 전부 `spec/4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트` (라벨 "AI Agent §7.9")로 일괄 정정한다. `실행 엔진`이라는 라벨 자체도 오해를 유발하므로 함께 수정. 이 PR 이 "SoT 경계를 정확히 하자"는 취지(§8.5 Rationale 등)를 표방하는 만큼, 정작 새로 작성한 근거 인용이 존재하지 않는 섹션을 가리키는 것은 신뢰도에 직접 영향을 준다.

- **[CRITICAL]** `conversation-thread.md` §9.10 회귀 시나리오 표에 blank line 이 CT-S14 와 CT-S15 사이에 남아 GFM 테이블이 끊김
  - 위치: `spec/conventions/conversation-thread.md:599-604` (diff 상으로는 기존 context 인 blank line 뒤에 `+CT-S15/+CT-S16/+CT-S17` 세 행이 추가되고 그 뒤에 새 blank line 이 또 추가됨)
  - 상세: 실제 파일을 확인하면 599행(CT-S14) 바로 뒤 600행이 빈 줄이고, 601~603행에 CT-S15/16/17 이 이어진다. GFM(및 대다수 마크다운 렌더러)에서 표는 blank line 을 만나면 종료되며, 그 뒤에 헤더 구분자(`| --- | --- |`) 없이 이어지는 `| CT-S15 | ... |` 행들은 **표의 일부로 렌더링되지 않고** 파이프 문자가 그대로 노출되는 일반 텍스트/문단으로 표시될 가능성이 높다. 이 PR 이 회귀 방지를 위해 신설한 핵심 시나리오(CT-S15~17) 가 렌더링 시 표 밖으로 떨어져 나가 가독성·발견성이 크게 떨어진다 — 본 PR 이 고치려는 "정보는 있는데 도달할 UI 경로가 없다"는 증상과 같은 종류의 문제가 문서 쪽에서도 발생한 셈이다.
  - 제안: 600행의 빈 줄을 제거해 CT-S14 → CT-S15 → CT-S16 → CT-S17 이 하나의 연속된 테이블 블록이 되도록 하고, "본 시나리오들의 **입력 fixture**는…" 문단 앞에만 blank line 을 하나 유지한다.

- **[WARNING]** `Inv-8` 표 행이 `Inv-6` 과 `Inv-7` 사이에 삽입되어 숫자 순서가 어긋남
  - 위치: `spec/conventions/conversation-thread.md:574` (§9.9 UI Invariants 표) — `Inv-6` 행 다음, `Inv-7` 행 이전에 `Inv-8` 행이 위치
  - 상세: 표시 순서가 `Inv-1, Inv-2, ..., Inv-6, Inv-8, Inv-7` 이 되어 읽는 사람이 `Inv-7` 을 찾다가 `Inv-8` 을 먼저 마주치게 된다. 같은 diff 가 바로 위에서 "다음 6가지 불변량" → "다음 8가지 불변량" 오기(off-by-one)를 정정하는 등 이 섹션의 정확성에 신경 쓰고 있어서, 새로 추가한 행이 숫자 순서를 깨는 것은 의도치 않은 실수로 보인다 (아마 `Inv-7` 이 원래 나중에 소급 추가된 이력 때문에, diff 작성자가 "새 행은 맨 끝(Inv-6 다음)에 붙인다"는 습관을 따르다가 이번엔 실제 끝이 `Inv-7` 이라는 걸 놓친 것으로 추정).
  - 제안: `Inv-8` 행을 `Inv-7` 행 뒤로 옮겨 `Inv-1 ~ Inv-7, Inv-8` 순서로 정렬한다.

- **[WARNING]** 중요 변경인데 `CHANGELOG.md` 항목 미추가
  - 위치: 저장소 루트 `CHANGELOG.md` (본 diff 에 미포함)
  - 상세: 본 저장소는 최근 커밋들(`693e52fe1`, `734864d4b`, `ad24261af`, `2ccc442eb` 등)에서 예외 없이 "## Unreleased — <제목>" 형식으로 `CHANGELOG.md` 에 변경 요약·breaking behavior·신규 env 등을 기록하는 강한 컨벤션을 유지하고 있다. 본 PR 은 (a) 사용자 제보 회귀를 고치고, (b) **디폴트 탭 선택 동작을 바꾸며**(non-retryable 오류 종결도 Preview 기본 선택 — 기존 "Error 최우선" 예외 확장), (c) `Inv-8` 신설 등 spec 불변량을 추가하는 명백히 "중요한 변경"이지만 `CHANGELOG.md` 항목이 diff 에 없다.
  - 제안: `## Unreleased` 섹션에 본 수정(R1: `node.failed` payload 의 `output` 보존, R2: 렌더 게이트에서 `status` 제거 + 탭 정책 확장)을 요약하는 항목을 추가한다.

- **[INFO]** `result-detail.tsx` 의 옛 사문(死文) 주석이 정확하게 정정됨 (검증 완료, 칭찬)
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx` (`isCompletedConversation` → `isConversationHistory` 분기 아래 주석)
  - 상세: 삭제된 옛 주석("failed 상태의 multi-turn 종결 노드도 conversation preview 노출... history 의 system_error 는 nodeId 가 빈 문자열이므로... `showRetry = retryable && !!nodeId`")은 실제로는 어떤 오류 경로에서도 도달한 적 없는 사문이었다는 게 plan 의 실측으로 확인됐고, 새 주석("history 는 outputData 재구성이라 system_error 에 nodeExecutionId 가 없어... `showRetry = retryable && !!onRetry && !!nodeExecutionId`")은 `conversation-inspector.tsx:744-745` 의 실제 구현(`showRetry = se.retryable && !!onRetry && !!se.nodeExecutionId`)과 정확히 일치함을 확인했다. `isCompletedConversation` 식별자도 코드베이스 전체에서 잔존 참조 없이 깨끗이 치환됐다(`plan/` 문서의 역사적 서술 제외). 요청받은 점검 항목("옛 사문 주석을 정정했는지")에 대한 답은 **정정 완료, 정확함**.

- **[INFO]** 앵커 링크 유효성 — 검증한 범위 내에서는 정확함
  - 위치: `spec/conventions/conversation-thread.md#85-inv-8--store-보존과-렌더-도달성의-분리`, `#99-ui-invariants`, `#93-데이터-소스-선택`, `#121-system_error-data-shape`, `#79-multi-turn-모드--오류-error-포트`(ai-agent.md); `spec/3-workflow-editor/3-execution.md#1061-서브-탭-completedfailedcancelledwaiting-노드`
  - 상세: GitHub-style slug 규칙(구두점 제거, 공백 개별 → `-` 치환, 붙어있던 em dash 제거로 인한 이중 하이픈 보존)으로 직접 재계산해 위 앵커들이 실제 헤딩과 정확히 일치함을 확인했다(예: `§8.4` 기존 앵커의 `채택--durable` 이중 하이픈 패턴과 신규 `§8.5` 앵커의 `inv-8--store` 이중 하이픈 패턴이 같은 규칙을 따름). 상대 경로(`../conventions/...`, `../3-workflow-editor/...`, `../4-nodes/3-ai/...`, `./3-execution.md`)도 각 파일의 실제 디렉터리 위치 기준으로 모두 올바르다. (단, 위 CRITICAL 항목의 execution-engine.md 링크 자체는 파일 경로는 유효하나 인용한 섹션 번호가 그 파일에 존재하지 않는다는 점에서 별개 문제.)

- **[INFO]** `output-shape.ts` 의 `endReason` 화이트리스트 신규 주석 — 실제 backend enum 과 대조해 정확함 확인
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:645-650`
  - 상세: 주석이 인용하는 `ai-turn-executor.ts` 의 멀티턴 `endReason: 'user_ended' | 'max_turns' | 'condition' | 'error'` (실제 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3147` 등)와 Information Extractor 의 `'completed'`/`'max_retries'` (`information-extractor.handler.ts`) 를 모두 grep 으로 대조해 정확함을 확인했다. `error`/`condition` 을 화이트리스트에 추가한 변경(drift 정정)도 이 근거와 일치한다.

- **[INFO]** `conversation-thread.md` §9.9 "6가지"→"8가지" 오기 정정 — 정확함
  - 위치: `spec/conventions/conversation-thread.md:567`
  - 상세: `Inv-8` 신설 후 표에 실제 존재하는 행 수(Inv-1~8, 8개)와 서두 서술이 일치하도록 정정됐다. 배경 지시사항에 언급된 정정 항목 중 하나로, 검증 결과 올바르게 반영됨.

- **[INFO]** §9.10 "적용 대상 파일 목록"에 `result-detail.tsx` 추가 — 정확함
  - 위치: `spec/conventions/conversation-thread.md:582`
  - 상세: 배경에서 요구한 대로 기존 목록(`conversation-inspector.tsx`, `conversation-utils.ts`, `use-execution-events.ts`, `result-timeline.tsx`, `conversation-timeline-item.tsx`)에 `result-detail.tsx` 가 "탭 가시성·데이터 소스 선택의 렌더 게이트 소유자"라는 근거와 함께 추가됐다. 이번 회귀가 `result-detail.tsx` 단독 수정 PR 로는 §9.10 테스트 의무를 트리거하지 못했던 구조적 원인을 없앤다는 plan 의 서술과 일치한다.

- **[INFO]** (경미, 우선순위 낮음) §9.10 하단 "구현 상태" 충족 테스트 매핑 표가 CT-S9~CT-S17 을 포함하지 않음
  - 위치: `spec/conventions/conversation-thread.md:607-618`
  - 상세: "CT-S1 ~ CT-S8 모두 기존 단위 테스트로 충족된다"는 서술과 매핑 표가 이번 diff 이전부터 CT-S9 이상을 다루지 않던 기존 갭이며, 본 PR 이 새로 만든 문제는 아니다(CT-S15~17 은 §9.10 메인 표에는 "1차 테스트 파일" 컬럼으로 이미 명시돼 있어 실질적 추적성은 있음). 다만 이 섹션을 손보는 김에 CT-S9~S17 까지 확장했으면 더 완결됐을 것.

## 요약

이번 diff 는 문서화 측면에서 두 축으로 나뉜다. (1) 코드 주석의 사실 정확성은 대체로 훌륭하다 — `result-detail.tsx` 의 옛 사문 주석이 실측을 거쳐 정확하게 정정됐고, `output-shape.ts` 의 `endReason` 화이트리스트 근거도 backend 코드와 대조해 정확함을 확인했으며, 요청받은 Inv 번호 오기(6→8가지) 및 §9.10 파일 목록 갱신도 올바르게 반영됐다. (2) 반면 spec 상호참조 정확성에서는 반복적인 결함이 있다 — "실행 엔진 §7.9"(`spec/5-system/4-execution-engine.md`)를 근거로 인용하는 곳이 코드 주석 4곳·spec 5곳 총 9곳에 이르지만, 그 파일에는 §7.9 자체가 없다(올바른 목적지는 `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 이며, 같은 diff 의 `conversation-thread.md §9.3` 신규 행 한 곳만 정확히 이를 참조했다). 또한 이번 PR 의 핵심 산출물인 CT-S15~17 회귀 시나리오 행이 §9.10 표에서 blank line 으로 인해 표 밖으로 떨어져 나가는 마크다운 렌더링 결함, `Inv-8` 행이 `Inv-6`/`Inv-7` 사이에 삽입돼 순서가 어긋나는 문제, 그리고 프로젝트 컨벤션상 기대되는 `CHANGELOG.md` 항목 누락도 발견됐다. 이 결함들은 런타임 동작에는 영향이 없지만, 이 PR 이 표방하는 "SoT 경계 명확화"라는 목적과 정면으로 배치되는 성격이라 우선 정정이 필요하다.

## 위험도

HIGH
