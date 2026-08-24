# 정식 규약 준수 검토 — convention_compliance

## 대상
- diff-base: `origin/main...HEAD`
- 변경 spec 파일: `spec/conventions/chat-channel-adapter.md`, `spec/conventions/conversation-thread.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/6-websocket-protocol.md`
- 관련 구현: `codebase/backend/src/modules/websocket/websocket.service.ts` (+spec), `codebase/backend/src/shared/utils/node-output-allowlist.ts`

이번 diff 는 새 기능이 아니라 **"wire `output` 은 `NodeHandlerOutput` 래퍼 전체이고 도메인 값은 `output.output` 한 겹 아래"** 라는, 이전 라운드(`12_02_30` cross_spec W1, `12_13_36`)가 잡은 표현 오류를 형제 문서 전체에 미러링하고, `envelope.output` 의 fail-closed allowlist 잔여를 실측(e2e 285건 후 DB 직접 조회)으로 닫는 정정이다.

## 검증한 것

1. **`spec/conventions/node-output.md` Principle 0 과의 정합** — `NodeHandlerOutput` 5필드(`config/output/meta/port/status`)는 불변이고 `NodeExecution.outputData` 는 이 wrapper 그대로 저장된다는 SoT를 확인. 이번 diff 의 "wire `output` = wrapper, 도메인 값 = `output.output`" 서술은 이 Principle 0 의 직접 귀결이며 신규 규약을 만든 게 아니라 **기존 규약에 맞춰 오기를 정정**한 것 — 규약 준수 방향.
2. **allowlist 13키 주장의 코드 대조** — `spec/5-system/14-external-interaction-api.md` §R17 이 말하는 13키(`config·output·meta·port·status` + 위젯 4키 + chat-channel 4키)가 `codebase/backend/src/shared/utils/node-output-allowlist.ts` 의 `NODE_OUTPUT_ALLOWED_KEYS` 배열과 정확히 일치. DB 실측 표(meta/config/output/port/status/conversationConfig)도 전부 그 목록 안에 든다 — 문서·코드 drift 없음.
3. **잔존 `output.rendered` 단일-단계 참조 전수 grep** — `spec/4-nodes/**`(핸들러 레벨 `NodeHandlerOutput.output.rendered` 참조, 정상) 를 제외하면 wire/envelope 레벨에서 정정 누락된 `output.rendered` 단일-단계 서술은 발견되지 않음. `spec/5-system/15-chat-channel.md` CCH-MP-06 도 `output.output.rendered` 로 함께 정정됨(같은 diff, 3파일 동시 미러 — `spec/conventions/chat-channel-adapter.md` §1.3 JSDoc·§3 매핑표·`spec/5-system/6-websocket-protocol.md` §4.1 표 3곳이 서로 어긋나지 않음).
4. **Rationale ID 컨벤션** — `chat-channel-adapter.md` 상단에 명시된 "신규 Rationale 은 `R-CCA-N` prefix" 규칙 확인. 이번 diff 는 새 Rationale 항목을 추가하지 않고 기존 §R17(EIA) / 기존 JSDoc·매핑표 문구만 정정 — ID 신설 대상 아님, 위반 없음.
5. **테스트-스펙 정합** — `websocket.service.spec.ts` 의 `[캐너리]`/`[잔여 고정]` 테스트가 스펙 문구가 주장하는 "남은 위험 하나(`ai-turn-orchestrator` flat 폴백)" 를 그대로 고정하고 있음을 확인 — 문서가 구현보다 넓게 약속하지 않음.

## 발견사항

없음 — CRITICAL/WARNING 급 정식 규약 위반을 찾지 못했다.

- **[INFO] "정정(strikethrough + 실측)" 문서 작성 패턴이 여러 spec 파일에서 반복되지만 정식 컨벤션 문서화는 없음**
  - target 위치: `spec/conventions/conversation-thread.md` L390, `spec/5-system/14-external-interaction-api.md` §R17 정정/재정정 블록, `spec/5-system/6-websocket-protocol.md` §4.4 wire 필드 caveat 블록
  - 위반 규약: 해당 없음 (금지 항목 아님 — 순수 제안)
  - 상세: `> **정정 (YYYY-MM-DD, 세션ID 사유)**: ~~원문~~` 형태의 correction block 이 최소 4개 이상의 spec/conventions 파일에서 동일 관례로 쓰이고 있고, CLAUDE.md 의 "자기-반증형 소정정" 5조건과도 맞물려 있다. 그러나 이 표기 스타일(강조 마크업, 취소선 범위, 실측 인용 방식) 자체를 규정하는 `spec/conventions/*.md` 항목은 없다 — 사실상 emergent convention.
  - 제안: 규약 갱신 관점 — `spec/conventions/` 에 문서 정정 표기 스타일을 짧게 codify 하면(이미 사실상 표준이므로) 이후 정정 작성자마다 형식이 갈리는 것을 막을 수 있다. 급하지 않음.

## 요약

이번 diff 는 `spec/conventions/chat-channel-adapter.md`·`conversation-thread.md` 를 포함한 5개 문서에 걸쳐 "wire `output` 래퍼 vs 도메인 `output.output`" 한 겹 오기를 일관되게 미러링하고, `envelope.output` fail-closed allowlist 잔여를 실측으로 닫은 정정 커밋이다. `spec/conventions/node-output.md` Principle 0(SoT)·EIA §R17 13키 allowlist·Rationale ID 컨벤션(`R-CCA-N`)·테스트 캐너리 네 축을 대조했을 때 코드·문서·규약이 서로 어긋나는 지점을 찾지 못했다. 유일한 관찰은 반복적으로 쓰이는 "정정 표기 패턴"이 아직 정식 컨벤션 문서로 승격되지 않았다는 INFO 수준 제안뿐이다.

## 위험도
NONE
