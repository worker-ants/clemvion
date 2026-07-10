# Rationale 연속성 검토 — KB WS 이벤트 count drift 정정

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- diff: `origin/main..HEAD` (base=2aa4c8093, HEAD=31bbd1d3a)
- 대상 파일: `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/frontend/src/lib/websocket/use-kb-events.ts`(+test), `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/8-embedding-pipeline.md`, `CHANGELOG.md`

## 검토 방법

1. `git diff origin/main..HEAD` 전체 정독.
2. `git show 6898c4b3c`(#443, `fix(spec-sync §C): 코드정합성 동기화 발견 코드 갭/버그 19건 구현`)의 실제 코드 diff 확인 — `websocket.service.ts` 에서 `'document:graph_error'` 한 줄만 union 에서 제거됐음을 커밋 diff 로 직접 검증(C-16: "remove dead ... 'document:graph_error' KbEventType ...").
3. `spec/data-flow/6-knowledge-base.md §2.5` 및 `## Rationale`(폐기·정정된 과거 서술 이력) 열람 — target 이 이 파일을 **전혀 건드리지 않았음**을 `git diff origin/main..HEAD -- spec/data-flow/6-knowledge-base.md` (출력 0줄)로 확인. 즉 "union 11개(embedding 6 + graph 5), `embedding_error` 는 선언만 유지(미emit, forward-compat), `graph_error` 는 #443 제거" 라는 권위 기록은 이 브랜치 작업 **이전부터 origin/main 에 이미 존재**했다.
4. `spec/5-system/6-websocket-protocol.md`, `8-embedding-pipeline.md`, `10-graph-rag.md` 의 `## Rationale` 전문을 읽고 embedding_error/graph_error 관련 다른 결정·기각 대안이 있는지 확인.
5. 백엔드 코드에서 `document:embedding_error` 실제 emit 호출부 존재 여부를 `grep` 으로 실측 — `emitKbEvent` 호출은 `embedding.service.ts:334`, `graph-extraction.service.ts:467` 뿐이며 두 곳 모두 동적 `event` 변수(started/progress/completed/retry/failed 계열)로, `'document:embedding_error'` 리터럴 emit 호출은 코드베이스 전체에 없음을 확인 — spec/코드 docblock 의 "미emit" 서술과 일치.

## 발견사항

검토 관점 1~4 전부에서 CRITICAL/WARNING 급 위반은 발견되지 않았다. 아래는 완결성 보완 관점의 INFO 1건뿐이다.

- **[INFO]** `embedding_error` 유지 근거가 정식 `## Rationale` 섹션이 아니라 본문(§4.3)·코드 docblock 에만 명시됨
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.3 (표 내 `document:embedding_error` 행), `codebase/backend/src/modules/websocket/websocket.service.ts` `KbEventType` 상단 docblock
  - 과거 결정 출처: `spec/data-flow/6-knowledge-base.md ## Rationale` "폐기·정정된 과거 서술 (이력)" — `~~KbEventType 12개 + document:graph_error~~ → graph_error 는 #443 에서 제거, union 은 11개다 (§2.5)` 항목은 graph_error 제거만 명시하고, embedding_error 를 **왜 같은 논리(emit 경로 없는 이벤트 제거)로 함께 제거하지 않았는지**에 대한 대칭적 설명은 이 Rationale 목록에 없다(§2.5 본문 표에만 산재).
  - 상세: `graph_error`(#443, 죽은 선언 제거)와 `embedding_error`(현재도 미emit, 유지)는 구조적으로 동일한 상태("union 에 선언, emit 경로 없음")인데 처리가 다르다. target 은 이 비대칭을 "forward-compat 확보" 라는 명시적 이유로 §4.3 본문·backend docblock·`use-kb-events.ts` 코드 주석·테스트(`use-kb-events.test.ts` 마지막 두 `it`)에 **일관되게 반복 기술**했고, `data-flow/6-knowledge-base.md §2.5`(target 미변경분, 기존 권위 기록)와도 정확히 합치한다. 따라서 실질적으로는 근거가 이미 존재하고 여러 지점에 정합적으로 기록돼 있어 CRITICAL/WARNING 사유는 아니지만, 프로젝트 관례상 "결정의 배경·근거는 spec 문서 끝의 `## Rationale`" 에 두는 것이 SoT 원칙(CLAUDE.md "정보 저장 위치" 표)이므로, `6-websocket-protocol.md`(또는 `8-embedding-pipeline.md`)의 `## Rationale` "KB 채널 단위 전환" 항목에 이 비대칭 처리 근거를 한 문장 추가하면 향후 "왜 embedding_error 만 남았나" 재질문을 원천 차단할 수 있다.
  - 제안: (필수 아님, 선택) `spec/5-system/6-websocket-protocol.md ## Rationale` 의 "KB 채널 단위 전환" 항목 말미에 "`document:embedding_error` 는 #443 이후에도 union 에 유지된다 — graph 와 달리 향후 embedding 쪽 emit 경로가 열릴 가능성을 남겨 forward-compat 목적으로 선언만 보존한다(§4.3)" 1문장 추가.

## 결론 — 핵심 질문("embedding_error 유지가 #443 의 '죽은 선언 제거' 원칙과 상충하는가")에 대한 답

상충하지 않는다고 판단한다. 근거:

1. **#443 은 `embedding_error` 를 다룬 적이 없다.** 실제 코드 diff(`git show 6898c4b3c`)를 확인한 결과 #443 커밋(C-16)이 제거한 것은 `'document:graph_error'` 한 줄뿐이며, `document:embedding_error` 는 그 커밋에서도, 그 이후 어떤 커밋에서도 건드려진 적이 없다. 즉 "embedding_error 를 제거하기로 했다가 다시 살렸다" 는 이력 자체가 없으므로 **결정 번복이 성립하지 않는다** — 애초에 그런 결정이 없었다.
2. **#443 의 원칙은 "선언만 있고 emit 경로가 없는 이벤트는 일괄 제거" 라는 명문화된 일반 원칙이 아니라, C-16 이라는 개별 dead-code 정리 항목(`CAFE24_RESOURCE_LABELS`, `graph_error`, 미시행 `@Unique` 데코레이터를 묶은 1회성 청소)이었다.** `## Rationale` 어디에도 "미emit 이벤트는 반드시 제거한다" 는 형태의 일반 invariant 선언은 없다. 따라서 embedding_error 를 남긴 것이 "합의된 원칙" 을 위반한다고 볼 근거가 spec 텍스트 상 존재하지 않는다.
3. **오히려 이미 권위 기록(`data-flow/6-knowledge-base.md §2.5`, target 미변경분)이 "embedding_error 는 union 멤버로 유지, graph_error 는 #443 제거" 를 명시적으로 구분해 기술하고 있다.** target 은 이 기존 권위 기록과 정확히 일치하는 방향으로 하위 spec 3개(`6-websocket-protocol`, `8-embedding-pipeline`, `10-graph-rag`, `2-navigation/5-knowledge-base`)와 frontend 구독 목록·테스트를 정합화했을 뿐이다. 즉 이번 변경은 **새 결정의 도입이 아니라 이미 존재하던 권위 결정을 나머지 문서/코드에 전파(propagate)한 drift-fix** 다.
4. **frontend 변경 방향도 원칙과 합치한다.** frontend 가 구독하던 `document:graph_error` (union 에 없는 죽은 구독)를 제거해 11종으로 맞췄고, `document:embedding_error` 구독은 유지했다 — 이는 backend 권위 union 과 1:1 정렬이라는 §4.3 신설 문구("frontend `useKbEvents` 가 이 union 과 1:1 로 구독한다")를 그대로 실행한 것으로, 오히려 **정렬 원칙을 강화**한다.

## 요약

target 은 KB WS 이벤트 union 을 둘러싼 과거 결정(#443 의 `graph_error` 제거, 및 그 이전부터 존재하던 `embedding_error` union 유지)을 신규로 뒤집거나 기각된 대안을 재도입하지 않았다. 실제 코드 diff(`git show 6898c4b3c`)와 `spec/data-flow/6-knowledge-base.md §2.5`(target 이 건드리지 않은 기존 권위 기록)를 직접 대조한 결과, `embedding_error` 는 애초에 #443 에서 제거 대상이 된 적이 없고, target 은 이미 확정돼 있던 권위 기록(11개 union, graph_error 만 제거, embedding_error 는 forward-compat 유지)을 하위 spec 3개·frontend 구독 목록·회귀 테스트에 뒤늦게 정합화(propagate)한 drift-fix 다. 이는 Rationale 연속성 관점에서 권장되는 패턴("코드 우선 drift 를 발견해 spec 을 코드/권위 기록에 맞춰 정정")이며, 새로운 CRITICAL/WARNING 사유는 없다. 유일한 보완 여지는 INFO 1건 — embedding_error 유지 근거가 정식 `## Rationale` 섹션 대신 본문·코드 docblock 에만 기술돼 있어, 향후 재질문 방지를 위해 `## Rationale` 에도 한 문장 백필하면 더 견고해진다는 제안이다.

## 위험도

NONE
