# Code Review 통합 보고서

## 전체 위험도
**NONE** — Critical/Warning 급 발견 없음. `documentation`·`requirement` 두 reviewer 모두 위험도 NONE 보고, 실질 로직 4개 TS 파일(`node-output-allowlist.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`, `interaction.service.ts`(JSDoc)/`.spec.ts`)이 spec(§R17·§4.4·§8.4·§(c))과 라인 단위로 정합함을 두 reviewer가 독립적으로 재검증했다. forced reviewer 없음, 전원 정상 실행·결과 확보.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | plan frontmatter 주석에 대상 없는 섹션 참조 `(CLAUDE.md §)` — `§` 뒤 절 번호/이름이 비어 있음. CLAUDE.md 는 `spec/**`식 절 번호 체계를 안 쓰고 `###` 제목만 씀 | `plan/complete/sse-nodeoutput-allowlist.md` frontmatter `spec_impact:` 블록 주석 | `(CLAUDE.md § 자기-반증형 소정정)` 처럼 섹션 제목을 채우거나, `(CLAUDE.md "자기-반증형 소정정" 절)` 로 표기 변경 |
| 2 | documentation | (기지정·의도적 defer 재확인) 신규 `nodeOutput` allowlist 캐너리 4~5건이 `llmCalls strip — 외부 fanout 수신자 보호` describe 블록 안에 위치해 블록명이 실제 검증 대상과 어긋남. 이전 라운드(`23_16_40` RESOLUTION #14·#12)에서 이미 지적·의식적 defer 됨 — 이번 라운드는 그 상태가 그대로 남아있음을 재확인한 것 | `codebase/backend/src/modules/websocket/websocket.service.spec.ts` `describe` 줄 604, 내부 762·803·848·882·931줄 | 조치 불요(우선순위 낮음). 다음에 이 파일을 만질 때 `describe` 분리 또는 이름 확장 |
| 3 | requirement | REST `getStatus`가 SSE와 `NODE_OUTPUT_ALLOWED_KEYS`를 공유하면서 chat-channel 전용 4키(`payload`/`title`/`rendered`/`nodeType`)가 REST 응답에도 열림(부수 효과). 이전 라운드(`22_51_46` side_effect W1)에서 지적됐고 같은 라운드 RESOLUTION에서 캐너리(`interaction.service.spec.ts:733-763`)로 "의도된 결과"임을 코드로 못박아 이미 해소됨 | `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:733-763` | 조치 불요(이미 처리됨, 확인용 기재) |
| 4 | requirement | `execution.node.completed`/`.failed`의 `envelope.output`은 이번 PR이 의도적으로 닫지 않은 잔여 표면(`_retryState` 등 내부 필드 계속 샘). `execution-engine.service.ts:6109`(NODE_COMPLETED)·`:6369`(NODE_FAILED)가 `output: nodeExecution.outputData`를 실음. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:136`에 후속 tracker 항목으로 등재, `[잔여]` 캐너리가 방향 고정 | `codebase/backend/src/modules/websocket/websocket.service.spec.ts` `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다` | 조치 불요 — 후속 작업이 별도 tracker 항목으로 이미 잡혀 있음 |
| 5 | requirement | spec fidelity 재검증 — §R17 범위 표·`NODE_OUTPUT_ALLOWED_KEYS` 3그룹 JSDoc 표가 코드 배열과 1:1 대응, §4.4 blockquote·`conversation-thread.md` 자기-반증형 소정정 블록도 구현과 일치. 저장소 전역 재스윕 결과 취소선 처리 안 된 잔존 서술 없음 | `spec/5-system/14-external-interaction-api.md:1747-1751`, `codebase/backend/src/shared/utils/node-output-allowlist.ts:44-93` | 조치 불요(양호, 확인용 기재) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | NONE | CHANGELOG·JSDoc·spec 2편·convention 1편·plan 2편 사이 서술 정합성 재검증 완료. plan frontmatter 주석 1건 순수 가독성 결함, describe 블록명 불일치 재확인(둘 다 INFO) |
| requirement | NONE | 핵심 로직(allowlist chokepoint 통일, null/배열/`__proto__`/copy-on-change 방어, chat-channel 4키 확장)이 spec·렌더러 코드와 라인 단위 정합. 의도적 잔여 갭(`envelope.output`) 근거·트래커·캐너리 삼중 확인 |

## 발견 없는 에이전트

없음 (두 reviewer 모두 INFO 발견사항 보고, Critical/Warning 없음).

## 권장 조치사항
1. (낮은 우선순위, 선택) `plan/complete/sse-nodeoutput-allowlist.md` frontmatter 주석의 `(CLAUDE.md §)` 를 `(CLAUDE.md § 자기-반증형 소정정)` 등으로 구체화.
2. (낮은 우선순위, defer 유지) `websocket.service.spec.ts` 의 `nodeOutput` allowlist 캐너리를 `llmCalls strip` describe 블록에서 분리하거나 블록명을 확장 — 다음에 해당 파일을 만질 때 처리.
3. 그 외 INFO 항목들은 모두 이미 처리됨(캐너리로 의도 고정) 또는 별도 tracker(`spec-sync-external-interaction-api-gaps.md`)에 등재 완료 — 이번 라운드에서 추가 조치 불요.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용. 전체 reviewer(documentation, requirement) 실행. forced whitelist 없음(`forced: (none)`), 두 reviewer 모두 정상 실행·결과(success, 전문 확보) — 강제 화이트리스트 미이행 없음.