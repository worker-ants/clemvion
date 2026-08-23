# 요구사항(Requirement) 충족 리뷰

## 검토 범위

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` — allowlist 를 9키→13키로 확장(chat-channel 전용 4키 `payload`/`title`/`rendered`/`nodeType` 추가), 헤더 주석 소비처 서술 갱신
- `codebase/backend/src/modules/websocket/websocket.service.ts` — `allowlistFanoutNodeOutput` 신설, `toFanoutEnvelope` 에 `strip → allowlist → routing` 순서로 배선
- 대응 `.spec.ts` 2건(신규 캐너리·리터럴 테스트), `interaction.service.spec.ts` REST 4키 통과 캐너리 1건
- `CHANGELOG.md` 자기반증형 정정, `plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-*.md` 2건, `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.4
- 나머지 다수 파일(`review/code/**`, `review/consistency/**`)은 직전 두 리뷰 라운드(`22_51_46`, `23_16_40`)와 consistency-check(`22_26_33`, `23_29_27`) 산출물이 이 커밋에 함께 실린 것 — 이 프로젝트 워크플로가 항상 만드는 정상 산출물이며 별도 요구사항 판정 대상이 아니다(과거 라운드 자체 판정은 그 파일들 안에 이미 있음).

## 실측 검증

- 대상 5개 spec 파일(`node-output-allowlist.spec.ts`, `websocket.service.spec.ts`, `interaction.service.spec.ts` 포함) 단독 실행: `Test Suites: 5 passed, Tests: 184 passed`.
- `node-output-allowlist.ts` 를 직접 열어 배열이 정확히 13개 키(핸들러 공개 5 + wire 위젯 4 + wire chat-channel 4)임을 확인. 이전 커밋(`22f401942~1`)의 배열은 9개였음을 `git show` 로 직접 대조 — CHANGELOG/spec 의 "9→13" 서술과 일치.
- `websocket.service.ts` 의 `allowlistFanoutNodeOutput`/`toFanoutEnvelope` 를 직접 읽어 `envelope.nodeOutput`·`envelope.buttonConfig.nodeOutput` 두 자리만 좁히고 `envelope.output`(node.completed/.failed 표면)은 건드리지 않음을 확인 — spec §R17 표·CHANGELOG 정정 블록의 "잔여" 서술과 정확히 일치.
- `emitExecutionEvent`/`emitNodeEvent` 둘 다 `toFanoutEnvelope` 를 거치는 단일 chokepoint 임을 소스에서 직접 확인.
- chat-channel 렌더러 3파일(discord/telegram/slack)에서 `nodeOutput.rendered`/`.payload`/`.title`/`.nodeType` 을 실제로 top-level flat 로 읽는 코드를 grep 으로 확인 — JSDoc·spec 표·테스트 주석의 근거가 실코드에 부합.
- `spec/5-system/15-chat-channel.md` §(c) `renderPresentationByType shape 처리 우선순위` 를 직접 열어 JSDoc 인용이 정확함을 확인(`payload → output → config → flat` 순서).
- `spec/5-system/14-external-interaction-api.md` §R17 표·정정 blockquote, `spec/5-system/6-websocket-protocol.md` §4.4 blockquote 를 직접 읽어 코드·테스트 주석의 주장과 line-level 로 일치함을 확인.
- `plan/complete/sse-nodeoutput-allowlist.md` frontmatter `spec_impact` 에 두 spec 파일이 모두 등재돼 있음을 확인(직전 라운드 `22_51_46` requirement 리뷰가 지적했던 INFO 누락이 최종 커밋에서 이미 반영됨).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 신규 잔여 항목(`envelope.output` 은 아직 deny-list)이 미체크(`[ ]`) 로 등재되고, 종전 R17 잔여 항목(`getStatus` 일반 allowlist)은 완료(`[x]`) 로 갱신됨을 확인 — 트래커 상태가 실제 구현 상태와 일치.
- `websocket.service.spec.ts` 의 `[잔여] execution.node.* 의 envelope.output 은 아직 allowlist 를 지나지 않는다` 캐너리(931행 부근)가 `_retryState` 가 여전히 통과함을 명시적으로 고정 — "이번 PR 범위 밖" 주장이 코드로 뒷받침됨.
- `[캐너리] buttonConfig.nodeOutput 이 이미 깨끗하면 buttonConfig 를 재조립하지 않는다` (848행) 가 직전 라운드 testing WARNING(copy-on-change 미검증)을 해소했음을 확인 — `fanout.payload`/`fanout.payload.buttonConfig` 양쪽 참조 동일성을 단언.

## 발견사항

- **[INFO]** 이름-기반 allowlist(`NODE_OUTPUT_ALLOWED_KEYS`)의 wire-전용 8키(위젯 4 + chat-channel 4)는 `NodeHandlerOutput` 타입에 결속되지 않아 리터럴 테스트만이 유일한 방어다. 코드 JSDoc(`node-output-allowlist.ts:41`)·spec(§R17 표 하단)·테스트 주석이 이 한계를 모두 정확히 서술하고 있고, `node-output-allowlist.spec.ts` 의 `[리터럴] wire 전용 키가 목록에서 사라지면 여기서 잡힌다` 가 실측 방어로 존재한다. 신규 결함이 아니라 기존에 문서화된 구조적 트레이드오프의 자연스러운 연장.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:41-51,66-92`
  - 상세: 향후 핸들러가 우연히 `payload`/`title` 처럼 흔한 이름의 **내부 전용** 필드를 도입하면 fail-closed 의도와 달리 걸러지지 않는다는 위험 축은 남아 있으나, 이번 PR 이 새로 만든 취약점은 아니며 이미 두 차례(`22_51_46`, `23_16_40`) 리뷰에서 확인·수용된 트레이드오프다.
  - 제안: 조치 불요(이미 처분 완료, 재개 조건은 "허용 키가 두 자리로 늘면" 정도로 낮은 우선순위).

- **[INFO]** REST `getStatus` 와 SSE/fanout 이 `NODE_OUTPUT_ALLOWED_KEYS` 단일 소스를 공유하면서 chat-channel 전용 4키가 REST 응답에도 통과하지만, `interaction.service.spec.ts` 의 `[캐너리] chat-channel wire 4키는 REST getStatus 에서도 통과한다 (목록 단일화의 의도된 결과)` 가 이 확장을 **의도**로 명시적으로 고정했다(직전 라운드 side_effect/api_contract WARNING 의 fix). 실측상 REST 로 이 4키를 읽는 소비처는 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:733-763`
  - 상세: 표면별로 목록을 가르지 않는다는 설계 결정이 spec(§R17)·plan·코드 주석·캐너리 네 층 모두에서 일관되게 반영됨.
  - 제안: 조치 불요.

## 요약

`toFanoutEnvelope` 단일 chokepoint 에 `allowlistFanoutNodeOutput` 을 배선해 SSE/webhook/chat-channel fanout 의 `nodeOutput`(top-level)·`buttonConfig.nodeOutput` 두 자리를 REST `getStatus` 와 동일한 fail-closed allowlist(9→13키, 실측)로 좁힌 변경이다. 함수 시그니처·필드명·allowlist 구성이 spec(`14-external-interaction-api.md` §R17 표, `6-websocket-protocol.md` §4.4)과 line-level 로 정확히 일치하며, spec 이 명시한 "waiting 표면은 닫혔고 `execution.node.completed`/`.failed` 의 `envelope.output` 은 잔여"라는 범위 제약이 코드(allowlistFanoutNodeOutput 이 `envelope.output` 을 건드리지 않음)·테스트(`[잔여]` 캐너리)·CHANGELOG(취소선+정정)·plan 트래커(신규 미체크 항목) 다섯 곳 모두에서 정합적으로 반영됐다. 직전 두 리뷰 라운드(`22_51_46`, `23_16_40`)가 지적한 WARNING(REST 표면 조용한 확장, buttonConfig 분기 copy-on-change 미검증, CHANGELOG 낡음, spec_impact 누락)은 이번 최종 커밋에서 캐너리 추가·자기반증형 정정·트래커 갱신으로 전부 해소된 상태임을 소스·테스트·spec 을 직접 열어 확인했다. 대상 spec 5파일 184건 전수 GREEN. spec fidelity 관점에서 함수 시그니처·필드명·기본값·상태 전이 불일치는 발견되지 않았고, SPEC-DRIFT 도 없다(spec 이 코드보다 먼저 또는 동시에 갱신됨). 기능적·요구사항 결함 없음.

## 위험도
NONE
