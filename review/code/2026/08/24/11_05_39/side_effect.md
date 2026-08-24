STATUS=success side_effect review complete (target: node-output-envelope — websocket.service.ts envelope.output allowlist wiring)
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — `node-output-envelope`

## 방법론 note

프롬프트 번들에서 코드 실체가 있는 유일한 두 파일(`websocket.service.ts`,
`websocket.service.spec.ts`)의 전체 컨텍스트가 예산 절단으로 실리지 않아, 저장소에서
직접 `Read`했다. 또한 이 PR 의 핵심 우려("`envelope.output` 최상위 필터링이 의도한
`NodeHandlerOutput` 표면 밖의 다른 `output` 의미를 가진 이벤트까지 잘못 건드리지
않는가")를 검증하기 위해, `emitExecutionEvent`/`emitNodeEvent` 를 호출하는 전 사이트
(`execution-engine.service.ts`, `button-interaction.service.ts`,
`form-interaction.service.ts`, `ai-turn-orchestrator.service.ts`,
`execution-event-emitter.service.ts`)를 `grep`+`Read` 로 직접 대조했다 — 문서 주장을
코드로 재확인했다.

## 발견사항

- **[INFO]** 외부 wire 계약(SSE/fanout) 변경 — `envelope.output` 최상위 키가 이제
  fail-closed allowlist 를 지난다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182-214`
    (`narrowTopLevelNodeOutput`, `allowlistFanoutNodeOutput`), 배선부
    `codebase/backend/src/modules/websocket/websocket.service.ts:489-497`
    (`toFanoutEnvelope`)
  - 상세: `allowlistFanoutNodeOutput` 이 기존 `envelope.nodeOutput` 좁히기에 더해
    `envelope.output` 도 같은 `allowlistNodeOutputKeys` 로 좁히도록 확장됐다.
    `toFanoutEnvelope` 는 `emitExecutionEvent`/`emitNodeEvent` 의 유일한 외부(SSE·
    webhook·chat-channel) 출구이므로, 이 변경은 **기존에 이미 나가고 있던 wire
    payload 의 shape 을 좁힌다** — `execution.node.completed`/`.failed` 를 구독하는
    외부 클라이언트가 `output` 안에서 목록 밖 키(예: `_retryState`, 향후 추가될
    미지의 내부 필드)를 참조하고 있었다면 그 필드가 이제 조용히(에러 없이) 빠진다.
    이는 이 PR 의 명시적 목적(REST `getStatus` 와 SSE 의 방어 강도를 맞추는 보안
    수정)이며 광범위한 캐너리(`websocket.service.spec.ts` 신규 `it` 2건)로 고정돼
    있다. **직접 코드 대조로 확인한 결과, 이 필터가 의도치 않은 다른 `output` 의미를
    잘못 건드릴 위험은 실제로 없다** — `emitExecutionEvent`/`emitNodeEvent` 로 가는
    모든 top-level `output:` payload 는 예외 없이 `nodeExecution.outputData` /
    `nodeExec.outputData`(= `NodeHandlerOutput` shape)에서 왔다
    (`execution-engine.service.ts:6120,6381`, `button-interaction.service.ts:581`,
    `form-interaction.service.ts:344`, `ai-turn-orchestrator.service.ts:1636`).
    Execution-level 종결 이벤트(`completed`/`failed`/`cancelled`)는 `result` 키를
    쓰지 `output` 을 쓰지 않는다(`execution-event-emitter.service.ts:144-155`)ㅡ 즉
    "다른 shape 의 `output` 이 잘못 잘린다" 는 회귀는 관측되지 않았다.
  - 제안: 별도 조치 불요 — 다만 이 wire 계약 변경이 발생시키는 것은 순수 코드
    부작용이 아니라 **spec API 계약(EIA §R17 / WS §4.4)과의 정합성** 문제이며, 그
    부분은 이미 이 세션의 `--impl-prep` consistency-check(`10_44_28`)가 별도로
    다루고 `RESOLUTION.md`/후속 커밋 `970cac5cf` 로 처리한 것으로 보인다 — 중복
    지적 방지 차 이 리뷰에서는 참고로만 남긴다.

- **[INFO]** 알려져 있으나 미계측인 잔여 데이터-소실 경로 — `nodeOutputCache` flat
  폴백이 발현하면 새 필터가 `parameters`/`items` 등을 조용히 떨어뜨릴 수 있다
  - 위치: `plan/in-progress/node-output-envelope.md` "## 남은 위험" 절(문서),
    실제 코드 경로는 `ai-turn-orchestrator.service.ts:1451` 부근의
    `finalAdapted ?? context.nodeOutputCache[node.id]` 폴백(이번 PR 의 diff
    범위 밖 — 기존 코드)
  - 상세: 이 PR 이 추가한 필터(`narrowTopLevelNodeOutput(..., 'output')`)는
    `envelope.output` 이 어떤 shape 이든 무조건 allowlist 를 건다. 대부분의 경로에서
    `output` 은 `NodeHandlerOutput`(위 항목에서 확인) 이지만, `outputData` 가
    "already-flattened … 의도적으로 bare" 라 불리는 `nodeOutputCache` flat view 로
    채워지는 잠재 경로가 하나 남아 있다고 작성자 본인이 문서화했다(285건 e2e +
    실 DB 조회에서 0건 관측, 코드 경로로는 생존). 이 경로가 실제로 발현하면 필터가
    `parameters`/`items` 등을 **에러·로그 없이** 떨어뜨린다 — 캐너리
    (`websocket.service.spec.ts` `[잔여 고정] flat 폴백 shape...`)가 그 동작 자체는
    고정했지만, 프로덕션에서 그 경로가 실제로 발동했는지 감지할 계측(카운터/로그)은
    추가되지 않았다. 트래커 항목(`spec-sync-external-interaction-api-gaps.md`)의
    "재개 신호" 가 수동 DB 조회/향후 e2e 관측에 의존한다.
  - 제안: 이번 PR 범위 밖이고 작성자도 의도적으로 defer 한 것이 맞다(영속 계약을
    건드리는 별건). 다만 후속 작업 시 `allowlistNodeOutputKeys` 가 실제로 키를
    떨어뜨렸을 때(특히 `output` 경로) 저수준 debug 로그 한 줄을 추가하면, 이 dormant
    경로가 프로덕션에서 처음 발동하는 순간을 "재개 신호" 로 자동 포착할 수 있다 —
    지금은 순전히 우연한 발견에 의존한다.

- **[INFO]** 내부(에디터) WS 채널은 불변임을 코드로 확인 — 회귀 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:328`
    (`emitExecutionEvent` 의 `broadcastToChannel(channel, eventType, wireEnvelope)`)
    vs `:336`(`toFanoutEnvelope` 호출)
  - 상세: `broadcastToChannel` 은 `toFanoutEnvelope`(및 그 안의 새 `output` 좁히기)가
    호출되기 **이전**에 이미 `wireEnvelope` 원본으로 실행된다. `toFanoutEnvelope` 는
    그 뒤에 별도 clone 을 만들어 좁히므로 내부 WS(에디터 콘솔)는 이 변경으로 영향받지
    않는다 — 신규 canary(`wire`/`wireOut` 단언, `websocket.service.spec.ts:952-960`)
    가 이를 명시적으로 고정한다. 정상.

- **[정보 — 시그니처/인터페이스]** `narrowTopLevelNodeOutput`/`allowlistFanoutNodeOutput`
  는 모듈-private 함수이고 외부 호출자 없음 — 확인됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:182`,`:192`
  - 상세: 이전 버전의 `allowlistFanoutNodeOutput`(단일 `nodeOutput` 자리만 처리)이
    두 함수로 재구성됐고 새 `key` 매개변수(`'nodeOutput' | 'output'`)가 추가됐지만,
    둘 다 `export` 되지 않고 파일 내부(`toFanoutEnvelope` 한 곳)에서만 호출된다
    (`grep -rn "allowlistFanoutNodeOutput\|narrowTopLevelNodeOutput"` 결과 이 파일
    밖 참조 0건). 시그니처 변경으로 인한 외부 호출자 영향 없음.

## 부작용 없음(확인됨)으로 판단한 항목

- 전역 변수·모듈 스코프 상태 변경 없음 — 두 함수 모두 순수 함수(입력 → 새 객체 또는
  동일 참조 반환), `let next` 는 함수 로컬 변수.
- 파일시스템 부작용 없음 — 코드 diff(websocket.service.ts/.spec.ts)에 파일 I/O
  없음. (plan/review 문서 파일 생성은 이 세션의 정상 워크플로 산출물이지 코드
  side effect 가 아니다.)
- 환경 변수 읽기/쓰기 없음, 네트워크 호출 없음 — 순수 in-memory envelope 변환.
- `NODE_OUTPUT_ALLOWED_KEYS` 배열 자체는 이 PR 에서 무변경 확인(`node-output-allowlist.ts`
  diff 없음, `git diff origin/main --stat` 대조) — 기존 allowlist 를 두 번째 wire
  위치에 재적용한 배선 변경일 뿐, 목록 내용 변경 아님.
- copy-on-change 불변식 유지 — `narrowTopLevelNodeOutput` 이 두 번 연쇄 호출돼도
  변경이 없으면 `next === envelope` 원참조가 그대로 유지된다(hot path 성능 의도
  보존).

## 요약

핵심 코드 변경(`websocket.service.ts`)은 기존 fail-closed allowlist 메커니즘을
`envelope.nodeOutput` 한 자리에서 `envelope.output` 한 자리로 확장 배선하는
순수 함수 리팩터링이다. 전역 상태·환경변수·파일시스템·네트워크 부작용은 없고,
변경된 두 헬퍼 함수는 모듈-private 이라 외부 시그니처 영향도 없다. 유일한 실질적
"부작용"은 의도된 것 — SSE/fanout 외부 wire payload 의 `output` 필드가 이제 좁혀져
목록 밖 필드(`_retryState` 등)가 조용히 빠진다는 점이며, 이는 이 PR 의 목적 자체이고
전 emit 호출부를 직접 대조해 다른 의미의 `output` 을 잘못 건드리는 경로가 없음을
확인했다. 내부 WS(에디터) 불변도 코드 순서(broadcast 가 clone 이전에 실행)로
확인된다. 다만 이미 문서화·트래커 등재된 잔여 위험(flat 폴백 경로가 발현하면 조용히
데이터가 빠지는데 이를 감지할 런타임 계측이 없음)은 이번 PR 범위 밖이지만 참고로
남긴다.

## 위험도

LOW
