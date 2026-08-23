# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `toFanoutEnvelope` JSDoc 이 이 PR 자신이 나중에 좁힌 보장을 여전히 무조건적으로 서술한다 — "REST 와 SSE 의 방어 강도가 같아진다"
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:458-460` (함수 `toFanoutEnvelope` JSDoc, `## \`nodeOutput\` 은 deny-list 가 아니라 allowlist 로 좁힌다` 절)
  - 상세: 이 블록은 이번 PR 이 신규로 작성한 것이다(diff 상 전부 `+` 추가분). "EIA §R17 이 REST `getStatus` 를 fail-closed allowlist 로 닫은(#1205) 이유가 그것이고, **여기까지 닫아야 REST 와 SSE 의 방어 강도가 같아진다**" 라고 무조건적으로 적는다. 그런데 같은 세션의 후속 consistency-check(`23_29_27` cross_spec CRITICAL, `review/consistency/2026/08/23/23_29_27/RESOLUTION.md`)가 바로 이 문장과 동형인 spec 서술("REST 와 SSE 는 같은 강도다")을 **구현보다 넓은 보장**이라고 판정해 CHANGELOG·`spec/5-system/14-external-interaction-api.md` §R17·`spec/5-system/6-websocket-protocol.md` §4.4·`plan/complete/sse-nodeoutput-allowlist.md`·`plan/in-progress/spec-draft-eia-62-waiting-payload.md` 다섯 곳을 전부 취소선+정정으로 고쳤다. 실제로는 `execution.node.completed`/`.failed` 가 같은 `NodeExecution.outputData` 를 **`output`** 이라는 다른 키로 싣는데(emit 5곳) 이 표면은 여전히 fail-open deny-list 라 `_retryState` 가 그대로 나간다 — 바로 이 파일의 `websocket.service.spec.ts:931` `[잔여]` 캐너리가 그 사실을 명시적으로 고정한다. 다섯 문서를 고치면서 정작 이 서술의 원본이자 가장 눈에 띄는 위치인 `toFanoutEnvelope` 함수 자신의 JSDoc(보안 chokepoint 의 진입점 문서)은 갱신 대상에서 빠졌다 — "일부 출구만 닫힌다" 류의 미러 drift 를 이 저장소가 반복 겪어 온 것과 같은 형태가, 이번엔 코드 주석 축에서 재발했다.
  - 제안: 460행 문장을 "여기까지 닫아야 REST 와 SSE 의 **`waiting_for_input` 표면** 방어 강도가 같아진다 — `execution.node.*` 의 `envelope.output` 은 별도 표면이라 아직 잔여다(§R17, `[잔여]` 캐너리 참조)" 식으로 범위를 명시적으로 좁힐 것.

- **[WARNING]** `InteractionService.getStatus` JSDoc 이 이번 PR 로 인해 거짓이 된 "SSE·fanout 은 잔여" 서술을 그대로 유지한다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:313-315` (함수 `getStatus` JSDoc, `**보안 제약**` 절)
  - 상세: "`nodeOutput` 키-allowlist 는 **이 함수의 waiting 출구 1곳에 fail-closed 로 적용**된다(2026-08-23) — terminal `result`/`error` 는 작성자 데이터라 의도적 제외, **SSE·fanout 은 잔여**. 범위 표는 EIA §R17." 이 문장은 직전 PR(#1205, REST 전용)이 작성한 것이며 그 시점에는 정확했다. 그런데 이번 PR(`sse-nodeoutput-allowlist`)이 정확히 그 "SSE·fanout 잔여" 를 `waiting_for_input` 표면 한정으로 닫았다 — `CHANGELOG.md`·`spec/5-system/14-external-interaction-api.md` §R17·`node-output-allowlist.ts` 헤더 주석은 전부 "소비처는 둘이다"/"SSE 도 닫혔다"로 갱신됐는데, 정작 이 함수(REST 표면의 SoT 코드) 자신의 JSDoc 은 갱신되지 않아 이제 부정확한 서술("SSE·fanout 은 잔여")을 그대로 방치하고 있다. `interaction.service.spec.ts` 는 이번 PR 에서 캐너리가 추가됐지만(`interaction.service.ts` 자체는 이번 diff 에 포함되지 않음), 그 캐너리가 검증하는 사실(REST/SSE 목록 공유)과 이 JSDoc 의 서술이 지금 서로 어긋난다.
  - 제안: "SSE·fanout 은 잔여" 를 "SSE·fanout 의 `waiting_for_input` `nodeOutput`/`buttonConfig.nodeOutput` 도 같은 목록으로 닫혔다(2026-08-23, `toFanoutEnvelope`) — `execution.node.*` 의 `envelope.output` 은 별도 표면이라 잔여" 로 정정. `interaction.service.ts` 는 이번 diff 파일 목록에 없어(`.spec.ts` 만 포함) 이번 라운드 코드 리뷰 대상에서 놓치기 쉬운 위치다.

## 확인된 항목 (문제 없음)

- **CHANGELOG.md**: "SSE·fanout 은 여전히 deny-list(잔여)" 원문을 취소선으로 보존하고 "waiting 표면 한정" 으로 정확히 좁힌 정정 블록을 달았다. "9키→13키" 수치를 `NODE_OUTPUT_ALLOWED_KEYS` 배열(13개, 직접 카운트로 확인)과 대조해 실측 일치.
- **`node-output-allowlist.ts`**: JSDoc 표(3그룹) ↔ 배열 인라인 주석(3그룹)이 서로 미러링돼 있고, 헤더 주석이 "소비처는 둘이다"로 정확히 갱신됐다. 컴파일타임 결속·리터럴 테스트 방어 한계 서술도 정확하다.
- **`allowlistFanoutNodeOutput` JSDoc**(`websocket.service.ts:171-181`): "fanout envelope 안의 `nodeOutput` **두 자리**를 좁힌다"로 범위를 명시적으로 한정해 서술 — 위 WARNING 과 달리 과잉 일반화가 없다.
- **spec 문서 2건**(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.4): `23_29_27` CRITICAL 정정이 취소선+정정 블록으로 정확히 반영됐고, `waiting_for_input` 한정과 `execution.node.*` 잔여를 표로 명확히 갈랐다. 동명 필드(`nodeType`/`payload`) disambiguation 각주도 유지.
- **plan 문서**(`plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`): 종결 직전 범위가 좁혀진 경위를 자기반증형 소정정 관례(취소선 보존)로 정확히 기록했고, `egress-masking.md` §2 staleness·`envelope.output` 잔여 항목 둘 다 정본 트래커에 신규 등재됨을 확인(developer 의 `spec/conventions/**` 쓰기 권한 밖이라 트래커 등재가 올바른 처리).
- **`websocket.service.spec.ts` `[잔여]` 캐너리**(931행): "안 닫은 방향"을 실측으로 고정하고, "이렇게 두지 않으면 다음 사람이 'REST 와 같은 강도' 로 읽는다"는 정확한 경고를 JSDoc 에 남겼다 — 역설적으로 바로 그 오독이 같은 파일의 `toFanoutEnvelope` JSDoc(위 WARNING)에서 이미 발생해 있다.
- **README/신규 환경변수**: 이 변경은 내부 보안 강화(allowlist 확장)이며 새 공개 API·설정·환경변수를 추가하지 않는다. README 업데이트 불요 판단 타당.
- **`node-output-allowlist.spec.ts`**: 리터럴 대조 테스트 주석이 "위젯 파서 + chat-channel 렌더러" 로 정확히 갱신됨.

## 요약

핵심 서사(CHANGELOG·spec 2편·plan 3편·`node-output-allowlist.ts`)는 `23_29_27` CRITICAL 정정("REST 와 SSE 는 같은 강도다"가 구현보다 넓었다)을 다섯 문서에 걸쳐 취소선+정정으로 정확히 반영했다. 그런데 그 정정 작업이 spec/plan/CHANGELOG 축에서만 이뤄지고, 동일한 과잉 일반화를 담은 **코드 내 JSDoc 두 곳**은 갱신 대상에서 빠졌다: (1) 이번 PR 이 신설한 `toFanoutEnvelope` JSDoc 자신이 "여기까지 닫아야 REST 와 SSE 의 방어 강도가 같아진다"는, 이미 CRITICAL 로 판정된 것과 동형의 무조건적 서술을 담고 있고, (2) `interaction.service.ts`(이번 diff 에 포함되지 않은 인접 파일)의 `getStatus` JSDoc 은 이번 PR 이 정확히 뒤집은 "SSE·fanout 은 잔여" 서술을 그대로 남기고 있다. 둘 다 같은 파일 안(또는 같은 모듈의 자매 파일 안)에 정확한 반대 증거(`[잔여]` 캐너리, §R17 정정 표)가 이미 있어 대조 가능함에도 불구하고 갱신이 누락됐다. 나머지 문서화 품질(CHANGELOG 자기정정 관례, JSDoc 표-배열 미러링, plan 의 예측/실측 이력 보존, 신규 캐너리의 "왜 필요한가" 설명)은 이례적으로 높은 수준이다.

## 위험도
LOW
