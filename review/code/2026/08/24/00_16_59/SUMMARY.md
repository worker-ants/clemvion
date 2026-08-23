# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 1건(문서 drift: `spec/conventions/conversation-thread.md:388`가 이번 PR이 반증한 "SSE·fanout 은 잔여" 서술을 여전히 담고 있음, 미러 스윕에서 빠진 6번째 자리). 나머지는 전부 INFO. 4개 reviewer(documentation·requirement·scope·security) 전원 결과 확보, forced 항목 없음 — 위험도를 낮게 판정할 근거가 결측된 곳은 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `spec/conventions/conversation-thread.md:388`가 "SSE·fanout 이 잔여다"라는, 이번 PR(및 직전 fixup)이 정확히 반증한 서술을 그대로 두고 있다. 이번 스윕은 같은 주장이 실린 자리를 5곳(§R17·WS §4.4·CHANGELOG·`toFanoutEnvelope` JSDoc·`getStatus` JSDoc) 고쳤다고 plan 체크리스트가 명시하는데, 이 6번째 자리는 diff 대상에서 빠졌다. `git blame` 상 직전 PR(#1205)이 쓴 문장이고, 미러 스윕이 grep 한 패턴(`SSE·fanout 은 잔여`, 조사 "은")과 실제 문구(`SSE·fanout **이** 잔여다`, 조사 "이")가 달라 grep 을 피해 간 것으로 재구성된다. §R17 은 이제 "waiting 표면도 닫혔고 `envelope.output` 만 잔여"라고 정확히 서술하므로 이 문장만 모순 상태다. | `spec/conventions/conversation-thread.md:388` | 자기반증형 소정정 관례대로 원문(`SSE·fanout 이 잔여다`)을 취소선으로 남기고, "`waiting_for_input` 표면은 같은 날 닫혔고 잔여는 `execution.node.*` 의 `envelope.output` 뿐"이라는 정정 문구를 §R17/§4.4/CHANGELOG 와 동일하게 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `interaction.service.ts` 인라인 주석("EIA §R17 잔여")이 바로 위 JSDoc(이번 PR로 갱신됨: "SSE 도 닫혔고 잔여는 `envelope.output` 뿐")과 톤이 약간 어긋난다. 이번 diff 밖(도입 #1205)이라 기능상 틀린 서술은 아님. | `codebase/backend/src/modules/external-interaction/interaction.service.ts:390` | 당장 조치 불요. 다음에 이 주변을 만질 때 "EIA §R17(waiting 표면, 2026-08-23 SSE까지 닫힘) — fail-closed allowlist" 정도로 구체화. |
| 2 | 요구사항 | `tsc --noEmit` 이 `interaction.service.spec.ts` 에서 pre-existing `TS2352`(780/807/1076/1337행, `r.context as Record<string, unknown>`) 4건을 보고한다. 직전 라운드(`22_51_46`) requirement 리뷰가 "유일한 pre-existing 은 `websocket.service.spec.ts:578`" 라고 적었는데 검증 범위가 좁아 불완전했다. 이번 PR 신규 캐너리(753-754행)는 `unknown` 경유를 써서 이 오류를 만들지 않음. | `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` | 코드 수정 불요(이 PR 밖 pre-existing). 후속 리뷰에서 "tsc 오류 0건" 재인용 시 이 4건도 함께 pre-existing 으로 명시. |
| 3 | 스코프 | allowlist 가 계획 초안(위젯 4키) 대비 chat-channel 용 4키(`payload`·`title`·`rendered`·`nodeType`)로 확장됐다. 착수 후 실측(Discord/Telegram/Slack 렌더러가 top-level flat legacy shape 으로 이 4키를 읽음)으로 드러난 필수 보정이며 요청 밖 확장이 아니다. | `codebase/backend/src/shared/utils/node-output-allowlist.ts` (`NODE_OUTPUT_ALLOWED_KEYS`) | 조치 불요. |
| 4 | 스코프 | `node-output-allowlist.ts` 헤더 주석/JSDoc 의 소비처 서술이 REST 단수 → REST+WS 복수로 갱신됨. 이번 PR 이 두 번째 소비처(WS)를 추가하는 그 PR 이므로 자기 자신이 만든 부작용의 동반 수정. | `codebase/backend/src/shared/utils/node-output-allowlist.ts` 상단 주석 | 조치 불요. |
| 5 | 스코프 | `interaction.service.ts` JSDoc·`CHANGELOG.md`·`plan/in-progress/spec-draft-eia-62-waiting-payload.md` 세 자리에서 "SSE·fanout 은 잔여" 서술이 취소선+정정 블록으로 자기반증형 소정정됨(CLAUDE.md 5조건 준수 확인, 코드 JSDoc 2곳은 리뷰 지적 후 추가 반영된 이력 있음). | `interaction.service.ts`, `CHANGELOG.md`, plan 문서 | 조치 불요. |
| 6 | 스코프 | `spec/5-system/14-external-interaction-api.md`(§R17)·`6-websocket-protocol.md`(§4.4)가 diff 에 포함됨. plan 트래커의 "(planner 턴) §R17 flip + WS §4.4 단서" 항목과 1:1 대응하며 내용은 핵심 산출물. 역할 분리(planner 턴 실제 수행 여부) 감사는 이 리뷰 범위 밖. | 두 spec 파일 | 조치 불요(내용 관점). 역할 분리 확인이 필요하면 별도 프로세스 점검. |
| 7 | 스코프 | 72개 변경 파일 중 60개가 `review/code/2026/08/23/{22_51_46,23_16_40,23_56_18}/**`·`review/consistency/2026/08/23/{22_26_33,23_29_27}/**` — 이 프로젝트가 구현 완료 후 상시 강제하는 `/ai-review`+`/consistency-check` 워크플로의 정식 산출물(무관한 파일 아님). | 위 5개 세션 디렉터리 | 조치 불요. |
| 8 | 보안 | `execution.node.completed`/`.failed` fanout 의 `envelope.output` 은 여전히 fail-open — `_retryState` 등 엔진 내부 필드가 SSE/webhook/chat-channel 로 새는 경로가 남음. 이번 diff 가 만든 결함이 아니라 의식적으로 재확정된 스코프 제한(버튼 재개 record 는 이종 payload 라 같은 allowlist 를 걸면 `{}` 가 됨). 캐너리로 고정됨(`websocket.service.spec.ts:931`). | `codebase/backend/src/modules/websocket/websocket.service.ts` `allowlistFanoutNodeOutput`(182-205행) | 코드 변경 불요. 닫으려면 `outputData` shape 전수 판별이 선행 조건(plan 트래커에 재개 조건으로 기록됨). |
| 9 | 보안 | `NODE_OUTPUT_ALLOWED_KEYS` 가 REST/WS 두 표면에 공유되며 chat-channel 전용 4키(`payload`·`title` 등 범용적 이름)가 REST 응답에도 통과한다. 이론적으로 향후 무관한 핸들러의 동명 내부 필드가 우연히 통과할 여지. 이번 PR 신규 캐너리가 "이 4키를 REST 로 읽는 소비처는 현재 없음"을 실측 고정해 직전 라운드 W1 해소. | `node-output-allowlist.ts:78-89`, 소비처 `interaction.service.ts:394`·`websocket.service.ts:189,197` | 조치 불요(이미 캐너리로 방어). |
| 10 | 보안 | SSE/webhook fanout `nodeOutput` narrowing 은 운영 중인 외부 응답 바디를 소급 축소하는 하위 호환성 변경 — 알려지지 않은 제3자 webhook 구독자 실 트래픽 감사는 이 세션 범위 밖. 정보노출 방어 강화 방향(공격 표면 축소)이라 트레이드오프는 정당. | `CHANGELOG.md`, `websocket.service.ts:182-205,475-483` | 조치 불요(정보성 기록). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | `conversation-thread.md:388` 미러 스윕 6번째 자리 누락(WARNING 1건) + JSDoc 톤 경미 불일치(INFO) |
| requirement | LOW | 핵심 chokepoint·필터 강도·잔여 표면 정의·spec 정합 전부 실측 확인. 유일 신규 관찰은 이전 라운드 tsc 서술 보완(INFO) |
| scope | NONE | 72개 파일 전부 단일 목표 직결, drive-by/미사용 import/무관 리팩토링 없음 |
| security | LOW | 신규 CRITICAL/WARNING 없음. fail-closed·프로토타입 오염 방어·chokepoint 단일화 확인. 기존 잔여 갭(`envelope.output`)은 의식적 스코프 제한으로 재확인 |

## 발견 없는 에이전트

없음 (4개 에이전트 모두 최소 1건 이상의 INFO/WARNING 관찰을 보고했으나, 신규 코드 결함으로 이어지는 항목은 없음).

## 권장 조치사항

1. `spec/conventions/conversation-thread.md:388` 정정 — 자기반증형 소정정 관례대로 원문("SSE·fanout 이 잔여다")을 취소선으로 남기고, "waiting_for_input 표면은 닫혔고 잔여는 `execution.node.*` 의 `envelope.output` 뿐"이라는 정정 문구를 §R17/§4.4/CHANGELOG 와 동일하게 추가한다. (유일한 WARNING, 즉시 반영 가능한 소규모 문서 정정)
2. 나머지 INFO 항목은 전부 "조치 불요"로 판정됨 — 후속 커밋에서 우연히 이 자리를 다시 만질 때만 문구를 다듬으면 된다(`interaction.service.ts:390` 주석 구체화 등).
3. `envelope.output`(`_retryState` 노출) 잔여 표면을 닫으려면 `outputData` shape 전수 판별이 선행 조건 — 별도 plan 항목으로 이미 트래커에 등재돼 있으므로 이번 PR 범위에서 추가 조치 불요.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: 명시되지 않음(prompt 상 `routing: skipped`). 전체 reviewer(documentation·requirement·scope·security) 실행됨. forced 항목 없음(`forced (router_safety): (none)`), forced 관련 결측 없음.