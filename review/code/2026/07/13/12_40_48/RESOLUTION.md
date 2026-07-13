# Resolution — edge §1.3 ai-review (2026-07-13 12:40)

원 리뷰 위험도 **HIGH** (CRITICAL 1 + WARNING 3). disk-write gap 로 scope/testing/documentation/user_guide_sync 4개 리뷰어 출력이 미기록 → journal.jsonl 로 복구해 함께 반영.

## Critical

| # | 발견 | 조치 |
|---|------|------|
| 1 | reconnect 드래그를 **자기연결(무효) 핸들에 드롭**하면 RF `isValidConnection`=false 라 `onReconnect` 가 안 불리고, `useEdgeReconnect` 가 "success 플래그 false=빈영역 드롭" 으로 오판해 엣지를 **삭제**(빈영역 드롭과 무효핸들 드롭을 구분 못 함) | **반영** — `useEdgeReconnect` 를 success 플래그가 아니라 **드롭 위치**(`onReconnectEnd` 의 `connectionState.toNode`)로 재설계. `toNode` 가 null(=pane)일 때만 detach 삭제하고, 무효 핸들 위 드롭(toNode 있음)은 원상 유지. `onReconnectStart`/ref 제거. renderHook 회귀 가드 테스트 추가("무효 핸들 드롭이면 삭제하지 않는다"). |

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 2 | architecture/maintainability | onConnect/onReconnect 검증+엣지데이터 파생 로직 중복(drift 위험) | **반영** — `evaluateConnectionRejection(nodes, edges, connection)`(null=유효, ""=조용히 거부, 문자열=toast 거부) + `buildEdgeDataForConnection(nodes, connection)` 공용 헬퍼 추출, 양쪽에서 호출. |
| 3 | requirement | 신규 테스트에 `Connection` 미-import(TS2304, tsconfig `__tests__` exclude + vitest 타입 strip 이중 은닉) | **반영** — `import type { Connection }` 추가. |
| 4 | side_effect | store `deleteEdge` 가 `workflowsApi.deleteEdge`(즉시 REST DELETE dead code)와 동명 — 부작용 프로파일 정반대 | **반영** — store 메서드를 `removeNode` 와 대칭인 `removeEdge` 로 개명(인터페이스·구현·canvas·훅·테스트 전파). |

## disk-write gap 복구(journal.jsonl)

| 리뷰어 | 결과 | 조치 |
|--------|------|------|
| scope | NONE(범위 이탈 없음, emit 강화는 plan "부수" 명기됨) | — |
| user_guide_sync | NONE(connecting-nodes ko/en 동반 갱신 확인) | — |
| testing | WARNING: 재연결 self-제외 미테스트 / 컨테이너 충돌 거부 경로 미테스트 | **반영** — self-제외 "제자리 재연결" 테스트 추가. ⚠️ 정정: "onConnect 경로와 동일 코드라 이미 검증됨" 이라는 최초 스킵 근거는 **사실과 달랐다**(onConnect 경로에도 컨테이너 충돌 테스트가 0건이었음, 다음 라운드 `13_06_50` 리뷰가 지적). 후속 커밋에서 `evaluateConnection` 공용 경로의 컨테이너 충돌 거부(onReconnect body→이미 다른 컨테이너 child) 테스트를 실제로 추가했다. |
| documentation | WARNING: 신규 파일이 유저가이드 frontmatter `code:` 미반영 | **반영** — `connecting-nodes.mdx` frontmatter `code:` 에 `use-edge-reconnect.ts`·`edge-utils.ts` 추가. |

## INFO(선택/이월)
- 예약 포트 상수 FE/BE 중복(원소 1개, 증가 시 공유 검토) · 구조적 엣지(body/emit) 재연결 표면(의도) · onReconnect/removeEdge 무변경-undo(영향 미미) — 이월/무조치.

## 검증
- tsc `--noEmit` clean · vitest **122 passed**(reconnect 훅 4 CRITICAL 가드 포함 + store 60 + edge-utils 59) · eslint 0 errors
- e2e `make e2e-test-full` + fresh `/ai-review` 후속.
