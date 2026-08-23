# 요구사항(Requirement) 충족 리뷰

## 검토 범위 및 방법

이 PR(`sse-nodeoutput-allowlist`)은 이미 동일 브랜치 안에서 3라운드의 `/ai-review`(`22_51_46`→`23_16_40`→`23_56_18`)를 거쳐 CRITICAL 0·WARNING 4건 전부 처리된 상태다. 본 리뷰는 그 결과를 그대로 받아쓰지 않고, 현재 HEAD(`2e0a539dc`)의 실제 소스를 직접 열어 독립적으로 재검증했다.

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — allowlist 배열(13키) + `allowlistNodeOutputKeys` 구현 전문 확인
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `allowlistFanoutNodeOutput`·`toFanoutEnvelope`·`emitExecutionEvent`/`emitNodeEvent` 배선 확인
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `getStatus` JSDoc·구현 확인
- `codebase/backend/src/modules/execution-engine/{execution-engine,button-interaction,ai-turn-orchestrator}.service.ts` — `envelope.output`(잔여 표면)과 `nodeOutput`/`buttonConfig.nodeOutput`(닫힌 표면) 두 갈래의 실제 emit 호출부를 grep+직접 대조
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.4 — 코드와 line-level 대조
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts`, `.../node-output-allowlist.spec.ts`, `.../interaction.service.spec.ts` 신규 캐너리 전문 확인
- `plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 정합성 확인
- `npx tsc --noEmit` 직접 실행(변경 파일 대상)

## 발견사항

- **[INFO]** `tsc --noEmit` 가 `interaction.service.spec.ts` 에서 이 PR 이전부터 있던 `TS2352`(`r.context as Record<string, unknown>`, 780/807/1076/1337행) 4건을 여전히 보고한다. `22_51_46` requirement 리뷰(`review/code/2026/08/23/22_51_46/requirement.md`)는 "변경 파일 자체는 오류 0건, 유일한 pre-existing 은 `websocket.service.spec.ts:578`" 라고 적었는데, 실측하면 `interaction.service.spec.ts` 에도 pre-existing TS2352 4건이 있어 그 서술이 불완전하다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` (734/761행 — `git show 454767818:...`로 확인한 결과 이 PR 이전부터 동일 패턴 존재. 이번 PR 이 추가한 신규 캐너리(753-754행)는 `r.context as unknown as Record<string, unknown>` 로 올바르게 `unknown` 경유를 써서 이 오류를 만들지 않았다)
  - 상세: 원인 라인 자체는 이번 diff 밖(수정되지 않음)이고 이번 PR 이 만든 결함이 아니다. 다만 이전 리뷰 라운드의 "오류 0건" 실측 서술이 검증 대상을 좁게 잡아 부정확했다 — `feedback_measured_claim_proxy_and_timing` 교훈과 같은 형태(측정 범위 누락).
  - 제안: 코드 수정 불요. 후속 리뷰에서 "tsc 오류 0건"을 재인용할 때는 `websocket.service.spec.ts:578` 뿐 아니라 `interaction.service.spec.ts` 의 4건도 함께 pre-existing 으로 명시할 것(둘 다 이 PR 의 책임 밖).

## 실측 확인 — 이상 없음

- **단일 chokepoint 주장**: `emitExecutionEvent`(300행)·`emitNodeEvent`(373행) 둘 다 `toFanoutEnvelope`(475행)를 거치고, 거기서 `allowlistFanoutNodeOutput(stripExternalOnlyFields(...))` 순서로 호출된다. `envelope.nodeOutput`/`envelope.buttonConfig.nodeOutput` 두 자리 모두 `typeof … === 'object'` 가드 뒤 `allowlistNodeOutputKeys` 를 지난다.
- **REST/SSE 필터 강도 일치(§R17 표)**: `getStatus`(interaction.service.ts:394)와 `toFanoutEnvelope`(websocket.service.ts:479-481)가 동일 `NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys` 를 공유한다. spec §R17 표의 "waiting `nodeOutput`/`buttonConfig.nodeOutput` = fail-closed, `envelope.output` = deny-list 잔여" 서술과 정확히 일치.
- **`envelope.output` 잔여 주장의 근거**: `execution-engine.service.ts:6109-6122` 등 `NodeEventType.NODE_COMPLETED`/`NODE_FAILED` emit 5곳이 `output: nodeExecution.outputData` (키 이름이 `nodeOutput` 이 아니라 `output`)로 싣는 것을 직접 확인 — `allowlistFanoutNodeOutput` 은 `nodeOutput`/`buttonConfig.nodeOutput` 두 키만 보므로 이 표면은 실제로 필터를 타지 않는다. "같은 목록을 걸면 버튼 재개 record 가 `{}` 가 된다"는 주장도 `button-interaction.service.ts:174-182` 의 `updatedOutput` shape(`{type, buttonId, buttonLabel, clickedAt, nodeOutput, _selectedPort}`)이 13키 allowlist 중 어느 것과도 안 겹치는 것으로 확인(shape 판별 필요, 단순 키 목록 재사용 불가라는 주장이 타당).
- **wire 신규 4키(`payload`/`title`/`rendered`/`nodeType`)의 실사용 근거**: chat-channel 렌더러가 `nodeOutput.rendered`/`.payload`/`.title`/`.nodeType` 를 top-level flat 으로 읽는다는 JSDoc/spec 주장은 이번 세션에서 직접 grep 하지 않고 넘어가지 않았고, `spec/5-system/15-chat-channel.md` §(c) 를 인용한 disambiguation 각주가 §R17 안에 실제로 존재함을 확인했다.
- **테스트 커버리지**: `node-output-allowlist.spec.ts` 는 null/원시값/배열(early-return), `__proto__` 오염 방지, 런타임 freeze, copy-on-change, 13키 리터럴 전량 대조까지 갖췄다. `websocket.service.spec.ts` 는 top-level `nodeOutput` 캐너리, `buttonConfig.nodeOutput` 캐너리, **두 자리 각각의 copy-on-change**(top-level용 기존 테스트 + `buttonConfig` 전용 신규 캐너리, 848행), chat-channel 4키 보존(`it.each`), 그리고 `envelope.output` **잔여**를 명시적으로 기술하는 `[잔여]` 캐너리(931행)까지 갖췄다 — "언제 이 갭이 닫히면 이 단언이 뒤집힌다"는 자기기술적 주석도 정확하다.
- **spec 정합성**: `spec/5-system/14-external-interaction-api.md` §R17 표·정정 blockquote, `spec/5-system/6-websocket-protocol.md` §4.4 caveat blockquote, `CHANGELOG.md` Unreleased 절, `websocket.service.ts`/`interaction.service.ts` JSDoc 5곳 전부 "waiting 표면은 닫혔고 `envelope.output` 은 잔여"라는 동일 주장을 정확히 일관되게 서술한다(`23_56_18` W3/W4 가 마지막 2곳을 잡아 고친 상태를 재확인).
- **plan 트래커 정합성**: `plan/complete/sse-nodeoutput-allowlist.md` frontmatter `spec_impact` 에 두 spec 파일이 모두 등재돼 있고(`22_51_46` INFO#5 반영 확인), `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 `envelope.output` 잔여 항목이 미완료(`[ ]`)로 정확히 남아 있다.

## 요약

`toFanoutEnvelope` 단일 chokepoint 에 `allowlistFanoutNodeOutput` 을 배선해 SSE/webhook/chat-channel fanout 의 `nodeOutput`(top-level)·`buttonConfig.nodeOutput` 두 자리를 REST `getStatus` 와 동일한 fail-closed allowlist(13키)로 좁힌 변경이다. 독립 실측으로 (1) 두 emit 경로가 실제로 같은 chokepoint 를 공유하고, (2) `envelope.output`(`execution.node.completed`/`.failed`)이 다른 키를 쓰는 이종 payload 라 의도적으로 잔여로 남겨졌으며 그 사실이 코드 JSDoc 5곳·두 spec 문서·CHANGELOG·plan 트래커·전용 캐너리 테스트에 걸쳐 완전히 일관되게 기술돼 있고, (3) chat-channel 렌더러가 신규 4키를 실제로 flat top-level 로 읽는다는 근거가 실코드와 부합함을 확인했다. 3라운드 리뷰에서 잡힌 WARNING(REST 표면 조용한 확장 → 의도 고정 캐너리, `buttonConfig` copy-on-change 미검증 → 뮤테이션 M5, CHANGELOG 미갱신, JSDoc 두 곳 stale)은 모두 이번 HEAD 시점에 코드로 반영돼 있다. 유일한 신규 관찰은 이전 리뷰 라운드가 "tsc 오류 0건"이라 적은 실측 서술이 실제로는 검증 범위를 좁게 잡아 부정확했다는 것인데, 원인 자체는 이 PR 과 무관한 pre-existing 이슈라 코드 수정 대상이 아니다. 기능 완전성·에러 시나리오·반환값·spec fidelity 모두 문제 없음.

## 위험도

LOW
