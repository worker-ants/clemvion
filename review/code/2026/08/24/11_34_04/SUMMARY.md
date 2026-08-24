# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 4개 reviewer(documentation·requirement·testing·security) 전원 결과 확보(누락 없음, forced 화이트리스트 해당 없음), 전 발견사항이 INFO 수준이며 핵심 변경(`envelope.output` allowlist 확장)은 뮤테이션 재검증까지 통과했다. requirement·testing 두 reviewer 가 자체 위험도를 LOW 로 매겨 그 최댓값을 반영했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | JSDoc 줄바꿈 미조정 — "emit 6곳" 정정 문구가 135자로, 같은 블록 인접 줄 관례(63~119자)를 벗어남. 내용은 정확(RESOLUTION.md W3 실측과 일치) | `codebase/backend/src/modules/websocket/websocket.service.ts:493` | "emit **6곳**:" 뒤에서 줄바꿈해 인접 줄과 비슷한 길이로 재정렬(급하지 않음, 빌드/린트 영향 없음) |
| 2 | Testing | 신규 `envelope.output` 캐너리 3종(chat-channel 4키 보존·`_retryState` 제거·flat 폴백)이 전부 `NodeEventType.NODE_COMPLETED` 만 사용 — `.NODE_FAILED` 변형에 대한 직접 증거 없음. 단일 chokepoint 구조상 아키텍처적 위험은 낮음(이벤트 타입 분기 없음을 코드로 확인) | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:915,956,1007` | 필수 아님 — 캐너리 1종을 `NODE_FAILED` + error 포맷 변형으로 파라미터화하면 향후 이벤트 타입별 분기 리팩터 시 회귀를 직접 포착 |
| 3 | Testing | `nodeOutput` 과 `output` 이 한 envelope 에 동시 존재하는 케이스 미검증 (직전 라운드 `11_05_39` 에서 이미 지적, 이번 diff 추가 조치 없음). 순차 호출(`narrowTopLevelNodeOutput` 2회)의 체이닝 자체는 미검증 상태로 이월 | `codebase/backend/src/modules/websocket/websocket.service.ts:215-216` | 필수 아님 — 두 키가 실제로 공존하는 emit 사이트가 생기면 테스트 추가 |
| 4 | Testing | 신규 캐너리 3건이 무관한 `describe` 블록(`llmCalls strip — 외부 fanout 수신자 보호`) 안에 위치 — 기존 트래커에 이미 등재된 배치 이슈의 연장(새 지적 아님) | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:604~1007` | 조치 불요(트래커 소유), 후속 정리 시 별도 describe 블록으로 이동 고려 |
| 5 | 추적 중인 잔여 위험 | `ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? nodeOutputCache` flat 폴백이 `outputData` 에 flat view 를 쓰면 이 PR 의 allowlist 가 목록 밖 키를 fail-closed 로 떨어뜨림(egress 관점에서는 안전, e2e 285건 미발현). "flat view 를 `outputData` 로 영속하는 것이 데이터 계약상 옳은가"는 별건 무결성 문제로 이미 분리 등재됨 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:190-202`, `websocket.service.spec.ts:994-1029`(`[잔여 고정]` 캐너리) | 조치 불요 — 이미 별도 트래커 항목으로 추적 중, 이번 PR 스코프 밖 판단 타당 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | NONE | 이전 두 라운드(코드리뷰 `11_05_39`, consistency-check `10_44_28`) WARNING/CRITICAL 전건 해소를 직접 대조 확인. 신규 발견은 JSDoc 줄바꿈 INFO 1건뿐 |
| requirement | LOW | 대상 요구사항(`envelope.output` fail-closed 확장) 완전 충족. `npx jest` 직접 실행 62/62 GREEN, 버튼 재개 flat record 경로를 소스 레벨로 재검증. INFO 3건은 전부 "확인 결과 문제 없음"류 |
| testing | LOW | 핵심 배선을 직접 실행+뮤테이션 재검증(2건 RED, plan 사전 예측과 정확히 일치) — 실질적 회귀 위험 낮음. INFO 3건은 `.failed` 변형 미검증 등 커버리지 갭 |
| security | NONE | 순수 egress 노출 축소(하드닝) 변경. 신규 인젝션/인가/시크릿 노출 없음. breaking-change 고지 이미 반영 확인 |

## 발견 없는 에이전트

없음 — 4개 에이전트 전원 INFO 수준 항목을 최소 1건 이상 보고했으나, Critical/Warning 을 보고한 에이전트는 없다.

## 권장 조치사항

1. (선택) `websocket.service.spec.ts` 신규 캐너리 중 1종을 `NODE_FAILED` 변형으로 확장해 "논리적 보장 vs 직접 증거" 갭을 이 축에서도 좁힌다 — 이 PR 이 이미 채택한 원칙의 연장이라 비용 대비 가치가 있음(testing INFO #2).
2. (선택, 비긴급) `websocket.service.ts:493` JSDoc 줄바꿈을 인접 줄 관례에 맞춰 재정렬(documentation INFO #1).
3. `nodeOutput`/`output` 동시 존재 케이스, describe 블록 배치, flat 폴백 영속 계약은 이미 트래커에 등재되어 있으므로 이번 PR 에서 추가 조치 불요 — 머지를 막을 사안 없음.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(documentation·requirement·testing·security, 4명) 실행됨. skipped/forced 대상 없음(prompt 상 "forced 전원 결과 확보됨"으로 명시, 강제 화이트리스트 미이행 없음).