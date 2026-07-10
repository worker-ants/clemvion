# Scope Review — KB WebSocket 이벤트 count drift 정정

worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
base: `2aa4c8093` / HEAD: `8c3e95319` (단일 커밋)

의도된 범위: frontend 구독 목록·backend union JSDoc·3개 spec 을 union 권위(11종)에 정렬 + 회귀 테스트. `document:embedding_error` 는 forward-compat 목적으로 union 에 유지(#443 결정 존중).

## 발견사항

- **[WARNING]** spec 정정이 완료되지 않음 — `spec/5-system/8-embedding-pipeline.md` 의 Rationale 서술이 여전히 "12개 이벤트"를 현재형 사실처럼 진술
  - 위치: `spec/5-system/8-embedding-pipeline.md:411` (`## Rationale` → `### 결정: spec 정합성 정비`)
  - 상세: 해당 문장 "WebSocket 채널 명명을 KB 단위(...)에서 문서 단위(...)로 전환. backend `KbEventType` union (**12개 이벤트**) 과 `emitKbEvent` 구현이 권위이며, frontend `useKbEvents` 가 동일하게 구독한다."는 이번 diff 에서 손대지 않았다. 본문(§8.1/§8.2, line 285/289/293)은 이미 5+5(=10, `embedding_error` 미emit 별도 서술 포함 총 11) 로 정정됐지만, 같은 파일의 Rationale 절에는 옛 "12개" 가 그대로 남아 본문과 모순된다. 참고로 `spec/data-flow/6-knowledge-base.md` 의 동일 성격 Rationale(§"폐기·정정된 과거 서술")은 line 416-417 에서 `~~KbEventType 12개 + document:graph_error~~ → graph_error 는 #443 에서 제거, union 은 11개다 (§2.5)` 로 이미 취소선 처리해 과거/현재를 명확히 구분해 두었다 — 동일 패턴을 8-embedding-pipeline.md 에는 적용하지 않아 리뷰 프롬프트가 지정한 grep 기준(`12개`)에 실제로 걸리는 잔존 drift다.
  - 제안: 6-knowledge-base.md 와 같은 취소선/정정 패턴으로 "12개" → "11개(§8.1/§8.2 정정, #443)" 형태로 갱신하거나, 최소한 각주로 "당시 12개였고 현재는 11개" 임을 명시. 본 PR 의 grep 검증 포인트(`grep -rn "12개" spec codebase`)가 실제로 이 라인을 잡아내므로 범위 미달(under-scope)로 판단.

- **[INFO]** `KB_EVENT_NAMES` export 승격은 최소·정당한 리팩터
  - 위치: `codebase/frontend/src/lib/websocket/use-kb-events.ts:18-30` (구 위치: `useEffect` 내부 지역 상수, line 66 부근)
  - 상세: 배열을 함수 내부에서 모듈 최상위로 옮기고 `export` 만 추가했을 뿐 값·용도·호출부(`for (const name of KB_EVENT_NAMES) ws.on(name, handler)` / `ws.off(...)`)는 그대로다. 순수하게 신규 회귀 테스트(`__tests__/use-kb-events.test.ts`)가 import 할 수 있도록 하기 위한 최소 변경이며, 그 외 로직 변경은 없다. 정당한 범위.

- **[INFO]** 나머지 diff는 의도 범위와 정확히 일치
  - 위치: 전체 6개 변경 파일(`git diff --name-status`) — backend union JSDoc, frontend 훅 주석/배열(`document:graph_error` 제거, `document:embedding_error` 유지), 신규 테스트, 3개 spec 파일(`6-websocket-protocol.md`, `8-embedding-pipeline.md` §8.1/§8.2, `10-graph-rag.md`)
  - 상세: 코드 diff 는 `websocket.service.ts` 에서 JSDoc 주석만 변경(타입 union 실제 멤버는 무변경 — 여전히 11종, `graph_error` 없음)했고, `use-kb-events.ts` 는 위 export 승격 + 주석 갱신 + `graph_error` 제거(구 12종→11종)만 수행했다. lint/config/package.json/무관 파일 변경 없음. 포맷팅 노이즈·불필요 리팩터·기능 확장 없음.

## 검증 결과 (프롬프트 지정 3개 포인트)

1. **범위 이탈 여부**: 없음. 6개 파일 모두 KB WS 이벤트 drift 정정과 직접 관련.
2. **`KB_EVENT_NAMES` export 승격**: 테스트 가능화를 위한 최소 필요 리팩터로 타당함.
3. **범위 미달(놓친 sink)**: `spec/5-system/8-embedding-pipeline.md:411` 의 Rationale 서술이 여전히 "12개 이벤트"를 현재 사실처럼 진술 — 프롬프트가 지정한 `grep -rn "12개"` 로 실제 검출됨. 그 외 `graph_error`/`1:1 대응` grep 결과는 모두 (a) 이미 정정된 본문, (b) 무관한 동음이의 hit(`agree_restriction_period` 12개월, Logic 노드 12종, `graph_error_message` 컬럼 등), (c) 이미 취소선 처리된 `data-flow/6-knowledge-base.md` 의 과거 서술 로 분류되어 추가 조치 불요.

## 요약

diff 자체(6개 파일)는 의도된 범위에 정확히 정합하며 무관한 변경·포맷 노이즈·과도한 리팩터·기능 확장이 없다. `KB_EVENT_NAMES` export 승격도 회귀 테스트를 가능케 하기 위한 최소 변경으로 정당하다. 다만 grep 기반 완결성 점검에서 `spec/5-system/8-embedding-pipeline.md` 의 Rationale 절(line 411)에 "12개 이벤트" 라는 옛 진술이 본문과 모순된 채 남아 있는 것이 확인됐다 — 동일 파일 안에서 상단 §8.1/§8.2 는 11개로 정정됐지만 하단 Rationale 은 갱신되지 않아 drift 정정이 해당 파일 내에서 완결되지 않았다. 이는 과잉 변경이 아니라 과소 변경(범위 미달) 이슈이므로 CRITICAL 은 아니나, "권위 정렬" 이라는 PR 목표상 동일 파일 내 자기모순을 남기는 것은 후속 혼동을 유발할 수 있어 WARNING 으로 분류한다.

## 위험도

LOW
