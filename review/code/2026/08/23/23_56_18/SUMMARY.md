# Code Review 통합 보고서

## 전체 위험도
**LOW** — 신규 CRITICAL 없음. 이번 라운드(`23_56_18`)의 실질 diff 는 직전 consistency-check(`23_29_27`) CRITICAL("REST 와 SSE 는 같은 강도" 라는 spec 서술이 구현보다 넓었다)을 해소한 자기반증형 spec/plan/CHANGELOG 정정과 캐너리 테스트 1건뿐이며, 핵심 프로덕션 코드(`websocket.service.ts`, `node-output-allowlist.ts`)는 직전 두 라운드(`22_51_46`, `23_16_40`)와 바이트 단위로 동일함을 다수 reviewer 가 직접 확인했다. 11개 reviewer(forced 7명 포함) 전원 결과 확보 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/API계약 (side_effect, api_contract, security) | SSE/webhook/chat-channel fanout 의 `nodeOutput`(및 `buttonConfig.nodeOutput`) 이 fail-open deny-list 에서 fail-closed 13키 allowlist 로 전환되어, 이미 운영 중인 외부 API 응답 바디가 이 배포 시점부터 소급 축소된다. 알려진 두 소비처(위젯, chat-channel)는 실측으로 무손실 확인됨. 제3자 webhook 구독자 실 트래픽 감사는 세션 범위 밖. | `codebase/backend/src/modules/websocket/websocket.service.ts:182-205`(`allowlistFanoutNodeOutput`), `:468-476`(`toFanoutEnvelope`); `codebase/backend/src/shared/utils/node-output-allowlist.ts:66-92` | 조치 불요 — 이미 CHANGELOG 자기반증형 정정 + spec §R17 flip + REST/WS 양쪽 캐너리로 완화됨(직전 두 라운드부터 이어진 항목, 신규 코드 변경 없음). 향후 운영 로그 접근 시 배포 전/후 `nodeOutput` 키 분포 표본 감사 권장 |
| 2 | 보안 | `execution.node.completed`/`.failed` fanout 의 `envelope.output` 은 여전히 fail-open — 엔진 내부 전용 필드(`_retryState`)가 SSE/webhook/chat-channel 로 여전히 샌다. 이번 PR 의 스코프에서 의식적으로 닫지 않기로 확정된 잔여 표면. | `codebase/backend/src/modules/websocket/websocket.service.ts:182-205,373-401,468-476`; emit 원본은 `execution-engine.service.ts:6112-6120`, `:6372-6381` | 조치 불요(이미 올바른 스코프 판단 + 캐너리 고정: `websocket.service.spec.ts` `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다`, spec §R17 정정 표, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 신규 미체크 항목). 후속 작업 착수 시 `outputData` shape 전수 판별 선행 필요(허술한 동일 allowlist 재적용은 버튼 재개 record 를 `{}` 로 무너뜨림, 실측 확인됨) |
| 3 | 문서화 | `toFanoutEnvelope` JSDoc(이번 PR 신설)이 이미 CRITICAL 로 정정된 것과 동형의 무조건적 서술("REST 와 SSE 의 방어 강도가 같아진다")을 그대로 담고 있다 — 같은 파일의 `[잔여]` 캐너리·spec §R17 정정 표가 반대 증거를 갖고 있음에도 갱신 누락. | `codebase/backend/src/modules/websocket/websocket.service.ts:458-460`(`toFanoutEnvelope` JSDoc) | "여기까지 닫아야 REST 와 SSE 의 **`waiting_for_input` 표면** 방어 강도가 같아진다 — `execution.node.*` 의 `envelope.output` 은 별도 표면이라 아직 잔여다" 식으로 범위를 명시적으로 좁힐 것 |
| 4 | 문서화 | `InteractionService.getStatus` JSDoc(`interaction.service.ts:313-315`)이 이번 PR 로 거짓이 된 "SSE·fanout 은 잔여" 서술을 그대로 유지 — 이 파일은 이번 diff(56개 파일)에 포함되지 않아(`.spec.ts` 만 포함) 리뷰에서 놓치기 쉬운 위치. | `codebase/backend/src/modules/external-interaction/interaction.service.ts:313-315` | "SSE·fanout 의 `waiting_for_input` `nodeOutput`/`buttonConfig.nodeOutput` 도 같은 목록으로 닫혔다(2026-08-23) — `execution.node.*` 의 `envelope.output` 은 별도 표면이라 잔여" 로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항 | allowlist 는 이름 기반 매칭이라, 향후 핸들러가 우연히 같은 이름의 **내부 전용** 필드를 도입하면 그대로 통과한다(wire 전용 8키는 `NodeHandlerOutput` 타입에 결속되지 않음, 리터럴 테스트만이 방어). 기존 트레이드오프, 신규 결함 아님. | `node-output-allowlist.ts:41-51,66-92` | 조치 불요(이미 리터럴 테스트로 방어, 신규 필드 추가 시 체크리스트 항목으로만 유지) |
| 2 | 보안/API계약/부작용/요구사항 | `NODE_OUTPUT_ALLOWED_KEYS` 를 REST `getStatus` 와 SSE/fanout 이 단일 소스로 공유해, chat-channel 전용 4키가 REST 응답에도 통과한다 — 캐너리로 의도임이 명시적으로 고정됨(`interaction.service.spec.ts:733-763`). 실측상 REST 로 이 4키를 읽는 소비처 없음. | `node-output-allowlist.ts:66-92` | 조치 불요 |
| 3 | 성능 | `allowlistNodeOutputKeys` 의 `.includes()` 선형 탐색이 9→13개로 늘었으나 이미 두 차례 전 라운드에서 검토·보류된 사항(컴파일타임 결속 유지 목적), 규모상 체감 비용 무시 가능. | `node-output-allowlist.ts:126,129` | 조치 불요. 원소 수가 수십 단위로 늘면 `Set` 파생(단일 SoT 유지 전제) 재검토 |
| 4 | 성능 | `allowlistFanoutNodeOutput` 이 top-level/`buttonConfig` 양쪽에서 키가 걸리면 shallow copy 최대 2회 발생하나 크기 작아 무시 가능. | `websocket.service.ts:182-205` | 조치 불요 |
| 5 | 스코프 | `spec/5-system/` 두 파일 편집이 코드 fix 커밋과 같은 커밋에 동봉돼, plan 이 스스로 예고한 "(planner 턴)" 분리가 git 이력상 드러나지 않는다. 내용은 plan 체크리스트와 1:1 대응해 범위 이탈로 단정할 근거는 아니나 프로세스 경계 확인은 이 diff 만으로 완결되지 않음. | 커밋 `22f401942`, `fe4d58de7`(`git log --name-only`) | 코드 결함 아님, 비차단. 향후 유사 작업 시 spec 변경을 별도 커밋(`docs(spec):`)으로 분리 권장 |
| 6 | 스코프 | 두 번째 spec 커밋(`fe4d58de7`)이 CRITICAL 을 코드 확장이 아니라 spec 서술 축소(보장 문구를 실측에 맞춰 좁힘)로 처리 — 스코프 관점의 모범 사례. | `review/consistency/2026/08/23/23_29_27/RESOLUTION.md`, `spec/5-system/6-websocket-protocol.md` | 조치 불요(긍정 기록) |
| 7 | 유지보수성/테스트 | 신규 잔여 캐너리(`[잔여] execution.node.* 의 envelope.output …`)가 무관한 `describe('llmCalls strip — 외부 fanout 수신자 보호', …)` 블록 안에 배치돼, 이미 알려진 "블록명-내용 불일치"(4건, 의도적 defer) 문제가 5건으로 늘었다. | `websocket.service.spec.ts`(604행 블록 안) | 조치 불요(기존 defer 결정 유지). 다음에 이 파일을 어차피 건드릴 기회에 관련 캐너리 전체를 함께 재배치 |
| 8 | 유지보수성 | 신규 테스트 안 지역변수 `output`/`out` 유사 명명이 순간 혼동을 줄 수 있음(기능 결함 아님). | `websocket.service.spec.ts` 신규 `it` 본문 | 우선순위 낮음, 강제하지 않음 |
| 9 | 테스트 | 잔여 캐너리를 정당화하는 실측값("버튼 재개 record → `{}`") 자체를 고정하는 회귀 테스트가 없음 — 전제가 향후 조용히 stale 해질 수 있음. 본 리뷰는 독립적으로 나이브 fix 를 넣어 RED 로 전환됨을 재현해 캐너리 자체는 vacuous 하지 않음을 확인. | `node-output-allowlist.spec.ts`, `button-interaction.service.ts` | 우선순위 낮음. 이 잔여 항목 착수 시 버튼 재개 record fixture 로 `{}` 붕괴 사실 자체를 먼저 캐너리로 고정 권장 |
| 10 | 테스트 | plan 의 뮤테이션 표(M1~M5)가 이번 신규 잔여 캐너리를 반영하지 않음(형식적 갭, 리뷰가 대신 실측 검증). | `plan/complete/sse-nodeoutput-allowlist.md` | 우선순위 낮음, 문서 보강 성격 |
| 11 | 유저가이드 동기화 | `spec/5-system/14-external-interaction-api.md`, `6-websocket-protocol.md` 가 `spec-major-change` 행에 glob 매칭되나 target(frontmatter 정합)은 diff 자체 + 두 차례 consistency-check(`22_26_33`, `23_29_27`, 둘 다 BLOCK:NO)로 이미 충족됨. | `.claude/config/doc-sync-matrix.json` | 조치 불요 |
| 12 | 스코프 | 대다수(44/56) 변경 파일이 이 프로젝트가 구현 완료 후 상시 강제하는 `/ai-review`+`/consistency-check` 워크플로 산출물 및 그 결과 반영 plan 트래커 갱신 — 무관한 임의 문서 작업 아님. | `review/code/2026/08/23/{22_51_46,23_16_40}/**`, `review/consistency/2026/08/23/{22_26_33,23_29_27}/**`, `plan/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `envelope.output`(execution.node.*) 잔여 WARNING(의도적 스코프 축소, 캐너리 고정) + 이름기반 allowlist 한계 INFO |
| performance | NONE | `.includes()` 선형탐색·shallow copy 2회 모두 규모상 무시 가능 INFO, CRITICAL/WARNING 없음 |
| architecture | NONE | 핵심 로직 무변경(바이트 단위 동일 확인), 문서/코드/spec 3층 정합 양호 |
| requirement | NONE | 대상 5개 spec 파일 184건 전수 GREEN, spec fidelity 불일치 없음 |
| scope | LOW | spec 편집이 코드 fix 커밋에 동봉돼 "(planner 턴)" 분리가 git 이력상 안 보임(INFO, 비차단) |
| side_effect | LOW | SSE/webhook 응답 소급 축소 WARNING(기존, 완화됨) + REST/SSE allowlist 공유 INFO |
| maintainability | LOW | 신규 캐너리가 무관한 describe 블록에 배치(5번째 사례, 기존 defer 유지) |
| testing | LOW | 잔여 캐너리 non-vacuous 직접 재현 확인, 잔여 판단 근거 자체의 회귀 테스트 부재 INFO |
| documentation | LOW | `toFanoutEnvelope`/`getStatus` JSDoc 2곳이 이번 PR 로 정정된 서술을 반영하지 않음(WARNING 2건) |
| api_contract | LOW | 외부 응답 소급 축소 WARNING(기존, 완화됨), REST/SSE 강도 통일 서술 정정 INFO |
| user_guide_sync | NONE | frontend/channel-web-chat 변경 0건, spec-major-change 매칭이나 이미 충족 |

## 발견 없는 에이전트

performance, architecture, requirement, user_guide_sync — WARNING/CRITICAL 없음(INFO 또는 무발견).

## 권장 조치사항

1. `websocket.service.ts:458-460`(`toFanoutEnvelope` JSDoc)의 "REST 와 SSE 의 방어 강도가 같아진다" 무조건적 서술을 `waiting_for_input` 표면 한정으로 좁히고 `execution.node.*` 의 `envelope.output` 잔여를 명시할 것.
2. `interaction.service.ts:313-315`(`getStatus` JSDoc)의 "SSE·fanout 은 잔여" 서술을 이번 PR 결과(waiting 표면은 닫힘, `envelope.output` 만 잔여)에 맞춰 정정할 것.
3. (비차단, 후속) `envelope.output`(execution.node.completed/failed) 표면을 실제로 닫는 작업에 착수할 때는 `outputData` shape 전수 판별을 선행하고, 버튼 재개 record 가 allowlist 적용 시 `{}` 로 무너진다는 실측 전제를 먼저 캐너리로 고정할 것.
4. (선택) 신규 잔여 캐너리를 무관한 `describe('llmCalls strip …')` 블록에서 적절한 이름의 블록으로 재배치(다음에 이 파일을 건드릴 기회에 일괄 처리).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (11명)
  - **제외**: 표 (3명, 사유 상세는 prompt 에 미기재 — 라우터가 이번 diff 스코프에 해당 없음으로 판단)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨, 화이트리스트 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 이번 diff 에 패키지/의존성 변경 없음(추정 — router 사유 상세 미기재) |
  | database | 이번 diff 에 스키마/쿼리 변경 없음(추정 — router 사유 상세 미기재) |
  | concurrency | 이번 diff 에 동시성/레이스 관련 변경 없음(추정 — router 사유 상세 미기재) |