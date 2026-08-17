# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — 이번 PR 이 신설한 WS emit 값-패턴 마스킹(`execution.node.*`/비-종결 `execution.*` payload 전체)이, 이 PR 이 건드리지 않은 `spec/5-system/15-chat-channel.md` CCH-MP-06 의 "template 은 `output.rendered` 텍스트 그대로" 명시적 verbatim 계약과 충돌한다. 코드 추적(`WebsocketService.emitNodeEvent`→`executionEvents$`→`ChatChannelDispatcher`)으로 실제 도달 경로까지 확인된 미검토 회귀이며, 근본 해소는 spec/ 수정을 요구해 developer 권한 밖이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `execution.node.completed` 등 emit 값-패턴 마스킹이 "payload 전체" 대상이라 정상 워크플로 텍스트(template 출력 등)도 `***`로 치환될 수 있는데, `15-chat-channel.md` CCH-MP-06 이 그 값을 "그대로" 채널에 전달하도록 명시 보장한다 — 코드상 실제로 마스킹된 값이 `ChatChannelDispatcher`에 도달함을 확인 | `spec/5-system/6-websocket-protocol.md` §4.1 "값-패턴 마스킹" 캐비엇, `spec/5-system/14-external-interaction-api.md` §R17 신설 불릿 | `spec/5-system/15-chat-channel.md` §3 CCH-MP-06 (라인 81, 필수 항목) | (a) CCH-MP-06 문구에 "마스킹 이후 값 그대로" caveat 추가, 또는 (b) `output`/`presentations` 등 presentation 필드를 마스킹 대상에서 carve-out 하고 Rationale 에 근거 기록. 두 경우 모두 `spec/conventions/chat-channel-adapter.md` §1.3/§3 동반 확인 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 등급·`BLOCK: YES` 그대로이며, 아래는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 해소가 `spec/5-system/15-chat-channel.md`(또는 마스킹 대상 범위) 자체의 결정·문구 변경을 요구하며, developer 는 `spec/` read-only | project-planner | `spec/5-system/15-chat-channel.md` §3 CCH-MP-06 문구 정정(caveat 추가) **또는** `spec/5-system/6-websocket-protocol.md` §4.1 + `spec/5-system/14-external-interaction-api.md` §R17 에 presentation 필드 carve-out 명시 + `spec/conventions/chat-channel-adapter.md` §1.3/§3 동반 갱신 | `review/consistency/2026/08/17/00_22_23/cross_spec.md` [CRITICAL] 항목 1 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | carousel/table/chart 의 chat-channel 표시물(CCH-MP-06 visualNode 분기)과 AI `render_*` presentations(CCH-MP-01), 웹챗 SSE 패스스루가 같은 값-패턴 마스킹의 영향을 받는데, target 의 "부작용(수용)" 서술이 외부 최종 사용자 관점 검토를 명시하지 않음 | `spec/5-system/6-websocket-protocol.md` §4.1 캐비엇 / `spec/5-system/14-external-interaction-api.md` §R17 신설 불릿 | `spec/5-system/15-chat-channel.md` CCH-MP-06/CCH-MP-01, `spec/7-channel-web-chat/0-architecture.md` L82 | Critical 항목 1 해결 시 함께, §4.1/§R17 에 "chat-channel 최종 사용자에게도 동일하게 보인다" caveat 1줄 추가 |
| 2 | convention_compliance + cross_spec (중복 지적, 강한 등급 채택) | `3-error-handling.md §2.2` "실행 에러 형식" 예시가 이번 PR 이 실측(엔진 emit 전수 `nodeLabel`, `nodeName` emit 0건)으로 죽은 필드임을 증명한 `nodeName` 을 여전히 정본 예시로 실음. `node-output.md §3.2` 표준 `output.error` shape(`code`/`message`/`details`) 및 실제 `ErrorResponseBodyDto` 와도 필드 집합이 다름 | `spec/5-system/3-error-handling.md` §2.2 예시 JSON `"nodeName": "AI Agent"` | `spec/conventions/node-output.md` §3.2, `spec/5-system/6-websocket-protocol.md` §4.1 (이번 PR 이 `nodeName`→`nodeLabel` 4행 정정한 근거) | `nodeName`→`nodeLabel` 정정, 또는 별도 REST 에러 wrapper 라면 그 사실과 방출 코드 근거를 명시(구현 없으면 "계획(Planned)" 캐비엇 추가) |
| 3 | plan_coherence | `plan/in-progress/spec-draft-eia-fanout-masking.md` 가 최신 커밋 `b05756d9e`(inputData 마스킹 철회, Re-run 재제출 오염 CRITICAL 해소)를 반영하지 못해 "`inputData`/`outputData` 둘 다 마스킹 대상"이라는 이미 폐기된 결정을 여전히 유효한 것처럼 서술 | `plan/in-progress/spec-draft-eia-fanout-masking.md` §1-b(:55-56)·§1-c(:64-68)·변경 3(:126-129) | `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②"(inputData 비대상, 2026-08-16), `spec/5-system/12-webhook.md` §5.3 캐비엇 | draft 를 `inputData` 비대상으로 정정 → `status: draft` 종료 + `spec_impact` 채워 `plan/complete/` 이동(또는 중복 근거 정리 목적의 삭제 검토) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | §R17 "`ExecutionsService` 의 독립 반환 경로 4곳" 서술이 같은 절 아래 "6곳(2컬럼)" 정정 문단 바로 위에 현재형으로 남아 자기-불일치 | `spec/5-system/14-external-interaction-api.md:1486-1490` vs `:1512-1525` | `:1489` 를 "(2026-08-16 최초 결정 시점 — 이후 §1512 에서 6표면·2컬럼으로 확장)" 상태표시로 대체하거나 `:1512` 표 참조로 단일화 |
| 2 | rationale_continuity | `nodeOutput` 일반 키 allowlist "잔여(미구현)" 노트가 같은 PR 이 추가한 값-패턴 마스킹 층(부분적으로 gap 축소)의 존재를 언급하지 않아 최신 상태 미반영 | `spec/5-system/14-external-interaction-api.md` §R17 말미 "nodeOutput 일반 키 allowlist" 불릿 | "(2026-08-16 이후 값-패턴 마스킹 층 추가로 부분 축소 — §4.1 참조)" 교차참조 1줄 추가 |
| 3 | convention_compliance | 신규 `[EIA §R17]` 교차참조 4곳(`6-websocket-protocol.md:195,198,1092`, `12-webhook.md:327`)이 앵커 프래그먼트를 생략, 같은 문서 내 다른 R-항목 인용 관례(구체 앵커 포함)와 표기가 갈림. 빌드 가드는 앵커 부재를 오류로 잡지 않아 비차단 | 위 4곳 | 다른 R-항목 인용과 동일하게 `#r17-...` 구체 앵커로 통일 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | 값-패턴 마스킹이 `15-chat-channel.md` CCH-MP-06 verbatim 계약을 실제 코드 경로상 위반 (+ carousel/table/AI render presentations 영향 미검토 WARNING) |
| rationale_continuity | LOW | 결정 연속성 양호(기각 대안 재도입·무근거 번복 없음), §R17 "4곳" stale 수치·allowlist 교차참조 미반영 INFO 2건 |
| convention_compliance | LOW | `3-error-handling.md §2.2` nodeName stale 예시(WARNING), R17 교차참조 앵커 생략(INFO) |
| plan_coherence | MEDIUM | `spec-draft-eia-fanout-masking.md` 가 `inputData` 철회 결정(`b05756d9e`) 미반영, 향후 재집행 시 해소된 CRITICAL 재도입 위험 |
| naming_collision | NONE | 신규 식별자 전수 충돌 없음, `nodeName`→`nodeLabel` 은 정합화 |

## 권장 조치사항

1. **(BLOCK 해소 우선)** planner 턴에서 `spec/5-system/15-chat-channel.md` CCH-MP-06 문구를 "마스킹 이후 값 그대로" 로 좁히거나, presentation 관련 필드(`output`/`presentations`)를 값-패턴 마스킹 대상에서 carve-out 하고 Rationale 에 근거 기록 (+ `spec/conventions/chat-channel-adapter.md` §1.3/§3 동반 확인).
2. 위 1과 함께 carousel/table/chart(CCH-MP-06 visualNode)·AI `render_*`(CCH-MP-01)·웹챗 SSE 패스스루에도 동일 영향이 있음을 §4.1/§R17 에 caveat 로 명시.
3. `plan/in-progress/spec-draft-eia-fanout-masking.md` 를 `inputData` 비대상 최신 결정에 맞게 정정 후 종료 처리(`plan/complete/` 이동 또는 중복 정리).
4. `spec/5-system/3-error-handling.md §2.2` 예시의 `nodeName` → `nodeLabel` 정정(또는 별도 표현 근거 명시).
5. §R17 "4곳" stale 수치를 `:1512` 표 참조로 단일화하고, `nodeOutput` allowlist 불릿에 값-패턴 마스킹 층 교차참조 추가.
6. 신규 `[EIA §R17]` 교차참조 4곳에 구체 앵커 프래그먼트 추가(비차단, 정밀성 개선).