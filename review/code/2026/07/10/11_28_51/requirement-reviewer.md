# 요구사항 충족 리뷰 — KB WS 이벤트 count drift 정정

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- base: `2aa4c8093` / HEAD: `8c3e95319`
- diff: `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/frontend/src/lib/websocket/use-kb-events.ts`(+test 신규), `spec/5-system/{6-websocket-protocol,8-embedding-pipeline,10-graph-rag}.md`

## 검증 결과 요약

1. **실제 emit 사이트 재확인** — 정확함.
   - `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`: `document:embedding_started`(159) / `_progress`(304) / `_completed`(206, 317) / `_retry`(112) / `_failed`(133) — 5종. `embedding_error` emit 없음 (전체 backend grep 에서도 emit 사이트 0건, JSDoc/union 선언만).
   - `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts`: `document:graph_started`(195) / `_progress`(244) / `_completed`(218, 261) / `_retry`(157) / `_failed`(177) — 5종. `graph_error` emit 없음.
   - `KbEventType` union(`websocket.service.ts:343-354`)은 정확히 11개 리터럴 (embedding 6 + graph 5, `graph_error` 없음). frontend `KB_EVENT_NAMES`(`use-kb-events.ts:18-30`)와 리터럴 단위로 1:1 일치.
   - 신규 테스트 `use-kb-events.test.ts` 5 케이스 통과 확인(`npx vitest run` 로 재실행, 5 passed). `tsc --noEmit` 도 해당 파일 관련 에러 없음.

2. **spec 서술 vs data-flow §2.5 권위 기록 vs 코드** — 세 곳(6-websocket-protocol §4.3, 8-embedding-pipeline §8.1/§8.2, 10-graph-rag §6/KB-GR-OB-02) 모두 "embedding_error = union 선언/미emit(forward-compat)", "graph_error = union 에서 제거(#443)/존재하지 않음"으로 정정되어 있고, `spec/data-flow/6-knowledge-base.md §2.5`(diff 밖, 기존 권위 기록) 및 `## Rationale > 폐기·정정된 과거 서술` 항목과 문구·숫자(11 = 6+5)가 정확히 일치. 코드 grep 결과와도 모순 없음.

## 발견사항

- **[WARNING]** 누락된 sink: `spec/2-navigation/5-knowledge-base.md` §2.7.1 이 여전히 graph 이벤트를 6종(`_error` 포함)으로 서술
  - 위치: `spec/2-navigation/5-knowledge-base.md:182`
  - 상세: `- WebSocket 이벤트 (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) 로 실시간 갱신...` — 이번 diff 로 정정된 "graph 는 `_error` 없음(5종)" 권위 사실과 정면으로 어긋난다. 이 문서는 diff 대상이 아니었고, 사용자가 명시한 검증 포인트 4("다른 spec/코드가 여전히 12종 또는 graph_error 를 존재하는 이벤트로 서술")에 정확히 해당하는 잔여 drift다.
  - 제안: 이 diff 의 sibling 수정으로 `_error` 를 제거해 5종(`_started`/`_progress`/`_completed`/`_retry`/`_failed`)으로 맞추거나, 최소한 이번 PR 범위 밖이면 후속 이슈로 명시 트래킹. requirement-reviewer 관점에서는 "이 PR 이 claim 하는 정합화가 실제로는 부분적"이라는 점을 CRITICAL 로 올리지 않은 이유는 §2.7.1 이 UI 내비게이션 설명 문단(비권위, 참고성 서술)이라 기능 동작에 직접 영향은 없기 때문 — 그러나 8-embedding-pipeline/10-graph-rag/6-websocket-protocol 과 같은 급의 spec 문서이므로 방치 시 재차 drift 재생산 위험이 있다.

- **[WARNING]** 누락된 sink: `spec/5-system/8-embedding-pipeline.md` Rationale 절에 "union 12개 이벤트" 잔존
  - 위치: `spec/5-system/8-embedding-pipeline.md:411`
  - 상세: `## Rationale > 결정: spec 정합성 정비` 문단 — "WebSocket 채널 명명을 KB 단위에서 문서 단위로 전환. backend `KbEventType` union (12개 이벤트) 과 `emitKbEvent` 구현이 권위이며..." 이번 diff 가 같은 파일의 §8.1/§8.2 본문은 정정했지만, 파일 하단 Rationale 의 이 문장은 손대지 않아 같은 문서 내에서 "본문 11개 vs Rationale 12개"로 자기모순이 발생한다.
  - 제안: `(12개 이벤트)` → `(11개 이벤트, embedding 6 + graph 5)` 로 갱신하거나 "당시엔 12개였으나 #443 에서 `graph_error` 제거로 11개" 식 역사적 각주 추가. Rationale 은 "결정 당시의 사실"을 기록하는 성격이라 굳이 고치지 않아도 무방하다는 반론도 가능하나, 이 문단은 "당시 결정"이 아니라 "현재도 유효한 권위 서술"(`backend union 이 권위이며 frontend 가 동일 구독`)로 쓰여 있어 시제상 현재형이다 — 즉 실수(코드/spec 불일치)에 가깝다.

- **[INFO]** frontend 훅 동작 변화 없음 (안전성 확인)
  - 위치: `codebase/frontend/src/lib/websocket/use-kb-events.ts:129,140`
  - 상세: `document:graph_error` 는 backend 가 애초에 emit 하지 않으므로, 구독 목록에서 제거해도 런타임 동작(캐시 invalidate 트리거 빈도)에 실질적 차이가 없다 — 순수 drift 정정이며 회귀 위험 없음. `KB_EVENT_NAMES` 를 함수 내부 지역 상수에서 모듈 top-level export 로 승격한 리팩터링도 매 렌더/effect 마다 배열을 재생성하지 않게 되어 사소한 개선이며 부작용 없음.

- **[INFO]** backend union JSDoc 갱신은 spec 권위 기록과 문구까지 정확히 대응
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:332-341`
  - 상세: "총 11종 = embedding 6 + graph 5", `embedding_error`=forward-compat 미emit, `graph_error`=#443 제거 — `data-flow/6-knowledge-base.md §2.5` 문구와 표현까지 거의 동일해 단일 진실 소스 원칙에 부합.

## 요약

핵심 변경(backend union JSDoc, frontend `KB_EVENT_NAMES`, 3개 대상 spec 문서, 신규 회귀 테스트)은 실제 emit 사이트 재확인 결과와 `data-flow/6-knowledge-base.md §2.5` 권위 기록에 line-level 로 정확히 일치하며, 회귀 방지 테스트도 유효하게 동작한다(functional risk 없음 — `graph_error` 는 애초에 emit 되지 않았으므로 구독 제거가 동작을 바꾸지 않음). 다만 사용자가 명시적으로 요청한 "누락 sink" 점검에서 `spec/2-navigation/5-knowledge-base.md:182`(graph 이벤트를 여전히 6종/`_error` 포함으로 서술)와 `spec/5-system/8-embedding-pipeline.md:411`(Rationale 의 "union 12개 이벤트" 잔존, 같은 파일 본문과 자기모순)이 이번 diff 범위 밖에 남아 있어, "권위에 정렬"이라는 PR 취지가 spec 전역에는 아직 완전히 전파되지 못했다. 두 건 모두 기능 코드가 아닌 문서 서술 불일치이며 CRITICAL 급 기능 결함은 아니다.

## 위험도

LOW
