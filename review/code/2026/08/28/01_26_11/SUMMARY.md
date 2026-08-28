# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 핵심 수정(WS `execution.node.failed`/`node.completed` 구조화 에러 파싱을 `rawOutput.output.error` 2단 언래핑으로 정정 + `handleNodeFailed` 의 `payload.output` 배선 교정)은 spec §4.1-a·백엔드 emit 4곳과 line-level 로 일치하며 87/87 테스트 GREEN 이 직접 재확인됐다. 남은 발견사항은 전부 주석 정합성(방금 고친 함수의 JSDoc/자매 주석이 옛 shape·"legacy" 표현을 남김)과 테스트 위생(fixture 복제, `direct` 분기 커버리지 0)에 국한되며 런타임 동작에는 영향 없음. Forced whitelist(7개 reviewer) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation / requirement / maintainability | `extractNodeErrorPayload` 최상단 JSDoc 이 이번 수정과 모순되는 옛 서술을 그대로 둠 — "arrived on `error`/`output.error`(1단계)" + `error: string` 을 "legacy" 로 표기 + SoT 인용이 `§4.1`(구). 실제로는 구조화 값이 `output.output.error`(2단계, 래퍼 통과)에만 있고, 문자열 `error` 가 현재 유일한 정상 형태이며, 본문/인라인 주석은 이미 `§4.1-a` 를 정확히 인용해 JSDoc 만 낙후됨. 새 헬퍼 `asRecord` 삽입으로 JSDoc 과 대상 함수가 물리적으로도 분리됨 | `codebase/frontend/src/lib/websocket/use-execution-events.ts:51-66` (JSDoc 52-59, `asRecord` 61-66) | JSDoc 을 `§4.1-a` + "`error` 는 문자열, 구조화 값은 `output.output.error`" 로 갱신하고 "legacy" 표현 삭제. `asRecord` 를 함수 위/파일 하단 유틸 섹션으로 이동해 JSDoc-함수 인접성 복원 |
| 2 | documentation | 자매 호출부(`handleNodeCompleted`) 위 주석이 이번 diff 대상이 아니라 옛 표현("`output.error` 를 운반한다", 1단계)을 그대로 유지 — `handleNodeFailed` 쪽은 정확히 정정됐는데 같은 헬퍼를 쓰는 인접 주석만 불일치 | `codebase/frontend/src/lib/websocket/use-execution-events.ts:808-811` | `handleNodeFailed` 주석(842-849)에 적용한 `output.output.error` 정정을 동일하게 반영 |
| 3 | maintainability | production shape 반영 fixture(`{ output: { <domain>, config: {}, meta: {} } }`)가 테스트 5곳에 손으로 복제되어 공유 빌더가 없음 — 이번 결함의 근본 원인 자체가 "fixture 가 production shape 을 못 따라가서 결함을 가림" 이었는데, 정정 방식이 동일 drift 위험을 다시 심음 | `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1999-2015, 2045-2056, 2075-2091, 2157-2170, 2196-2214` | `wrapNodeHandlerOutput(domain)` 류 테스트 헬퍼로 추출해 wrapper shape 변경 시 단일 지점만 고치도록 함 |
| 4 | testing | `extractNodeErrorPayload` 의 `direct` 분기(객체 형태 `rawError`)가 뮤테이션 실증 결과 테스트 커버리지 0 — `const direct = null;` 로 강제 치환 후 재실행해도 87/87 GREEN 유지. 이번 fixture 정정(CT-S9/CT-S10 객체→문자열 전환)으로 이 분기를 양성 확인하던 유일한 테스트가 `nested` 경로로 옮겨감. 현재 프로덕션 호출부 2곳 모두 `rawError` 가 항상 `undefined`/문자열이라 도달 불가능하지만, 코드 주석은 "다른 호출자를 위한 방어"라는 계약을 명시 | `codebase/frontend/src/lib/websocket/use-execution-events.ts` `extractNodeErrorPayload` 내 `const direct = ...` 블록 | 객체 형태 `error` 조합의 양성 테스트 1건 추가로 계약을 고정하거나, 도달 불가능이 확실하면 YAGNI 로 분기 제거 (developer 설계 판단) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | 이전에 항상 `null` 을 반환해 죽어있던 `system_error` 배너 APPEND 경로가 이번 수정으로 프로덕션에서 처음 실질 조건을 만족해 발동함(의도된 활성화, PR 의 명시적 목적과 일치) | `use-execution-events.ts:906-911`(`handleNodeFailed`), `:812`(`handleNodeCompleted`) | 배포 노트/PR 설명에 "이 변경으로 system_error 배너가 처음 노출된다"는 점을 명시해 관측 시 회귀로 오인 방지 |
| 2 | security | 위 신규 활성 렌더 경로를 직접 확인 — 렌더 사이트가 전부 JSX 텍스트 자식(`{item.content}` 등)만 사용하고 `dangerouslySetInnerHTML` 없어 백엔드발 에러 문자열이 섞여도 XSS 로 이어지지 않음 | `codebase/frontend/src/components/editor/run-results/conversation-timeline-item.tsx:45,68,95,98` | 조치 불필요 — 향후 마크다운 렌더러 추가 시 재검토 |
| 3 | requirement | `handleNodeCompleted` 의 기존 호출부(diff 밖)도 이번에 바뀐 `nested` 해석(2단계)의 영향을 받으며 테스트는 GREEN 이나, 엔진 레벨에서 이 분기가 실제 production 이벤트로 도달 가능한지는 100% 확증되지 않음(회귀/결함은 아님) | `use-execution-events.ts:812`; 백엔드 `execution-engine.service.ts:6085-6099` | 필요 시 후속으로 도달 가능성 재검증 |
| 4 | maintainability | `handleNodeCompleted`/`handleNodeFailed` 의 errorPayload→append 블록이 diff 이전부터 거의 동일하게 중복(~20줄) — 이번 PR 이 정확히 그 블록의 호출 인자를 고친 지점이라 향후 변경 시 양쪽 동시 갱신 위험이 같은 패턴으로 재발 가능 | `use-execution-events.ts:808-834` vs `:903-933` | 여유 있을 때 공유 헬퍼로 추출 (이번 PR 범위 밖) |
| 5 | documentation | 기존 테스트 제목이 갱신된 fixture shape 과 불일치 — "output.error" 로만 표기하나 실제 payload 는 `output.output.error`(래퍼 한 겹 추가) | `use-execution-events.test.ts:2150` | 제목을 `"output.output.error"` 등으로 갱신 |
| 6 | testing | 회귀 캐너리 테스트가 백엔드 실제 emit 코드(`execution-engine.service.ts:8018`, `:6360`대역, `ai-turn-orchestrator.service.ts:1513-1537`)와 대조해 wrapper 중첩 구조가 정확히 일치함을 직접 확인 — mock 이 production shape 을 충실히 반영 | `use-execution-events.test.ts` CT-S9/S10 인접 캐너리 블록 | 조치 불필요 (확인 기록) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 활성 렌더 경로 XSS 안전 확인, details 화이트리스트 소비, 시크릿 없음 |
| requirement | LOW | 결함 원인·수정·spec(§4.1-a) 정합 확인, 87/87 GREEN. JSDoc 낙후만 지적 |
| scope | NONE | diff 3파일이 plan 체크리스트와 1:1 대응, 무관 변경 없음 |
| side_effect | LOW | 죽어있던 콜백 첫 발동(의도됨), 전역/네트워크/mutate 부작용 없음 |
| maintainability | LOW | JSDoc-함수 분리, fixture 5곳 복제, 기존 중복 블록 |
| testing | LOW | `direct` 분기 커버리지 0(뮤테이션 실증), 캐너리 backend 대조 완료 |
| documentation | LOW | JSDoc·자매 주석·테스트 제목 3곳 낙후, plan 문서는 모범적 |

## 발견 없는 에이전트

- scope, security — 실질 결함 없음(NONE)

## 권장 조치사항
1. `extractNodeErrorPayload` JSDoc(51-66행)을 `§4.1-a` + `output.output.error` shape 으로 갱신하고 "legacy" 표현 제거, `asRecord` 위치 이동 (WARNING #1)
2. `handleNodeCompleted` 위 주석(808-811)도 동일하게 정정 (WARNING #2)
3. 테스트 wrapper boilerplate 를 공유 헬퍼(`wrapNodeHandlerOutput`)로 추출 (WARNING #3)
4. `direct` 분기 양성 테스트 1건 추가 또는 도달 불가능 확정 시 제거 (WARNING #4)
5. (선택) INFO #5 테스트 제목 정정, INFO #1 배포 노트 기록

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: 명시되지 않음(router_safety 에 의해 전체 reviewer 7명이 forced 로 지정되어 실행됨). 전체 reviewer 실행.
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: security, requirement, scope, side_effect, maintainability, testing, documentation — 전원 결과 확보됨(누락 없음)