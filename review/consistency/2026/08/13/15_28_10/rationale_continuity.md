# Rationale 연속성 Check — spec-draft-eia-notification-payload-contract

## 검토 범위 요약

target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`.
직전 라운드(`15_15_08`)가 CRITICAL 2건(WS §4.1 completed/failed 행 미정정,
`spec/conventions/chat-channel-adapter.md` spec_impact 누락)으로 반려한 뒤 target 이 전면
개정된 상태 — 본 라운드는 그 개정판을 대상으로 Rationale 연속성만 재검토했다. `spec/5-system/
6-websocket-protocol.md`·`spec/5-system/14-external-interaction-api.md` 의 `## Rationale`
전문 및 `spec/conventions/chat-channel-adapter.md`(bundle 예산 초과로 프롬프트에 미포함 —
직접 Read) 를 대조했다.

## 발견사항

### INFO — `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 삭제를 저장소의 확립된 "won't-do" 형식으로 정식화 권고

- target 위치: `## 무엇을 쓸 것인가 → 1.`·`## 비목표`·`## Rationale → 왜 "코드를 spec 에 맞춘다" 를 통째로 택하지 않았나`
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale`의 **R5. 외부 WebSocket 채널 신설 — 보류**(결정 본문에 "미래 재논의 트리거" 4개 명시) 및 **R-wontdo-rawws-rest**("Planned 로 계속 두는 안 → ... 명시적 won't-do 가 정직하다" — 전용 Rationale ID + "폐기 대안"/"범위 밖(잔여 유지)" 절 구조)
- 상세: 이 저장소에서 "한때 spec 이 약속했으나 영구 미도입하기로 하는" 결정은 R5·R-wontdo-rawws-rest 처럼 **전용 Rationale ID + 재논의 트리거(또는 폐기 대안) 절**을 갖는 형식으로 정착되어 있다. target 은 `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 를 "배선이 아니라 신규 추적 설계가 필요하다"는 근거로 영구 삭제하지만, 이 결정은 산문 Rationale 문단 + `## 비목표` bullet 로만 기록되고 전용 ID 나 "이 조건이 되면 재도입을 재검토한다" 류의 트리거 목록이 없다. 결정 자체는 내용상 R-wontdo 패턴과 동일 성격(구현 안 된 것으로 확정)이라 충돌은 아니지만, 형식이 확립된 관행과 어긋나 향후 "이 필드가 왜 없는가"를 다시 묻는 재논의가 반복될 위험이 있다.
- 제안: EIA §6.3 Rationale (신설 예정) 에 `R-wontdo-*` 류 ID 를 부여하고, "미래 재논의 트리거"(예: 특정 고객이 노드-단위 최종 상태 추적을 명시 요구, 또는 엔진에 노드별 최종 포트 개념이 별도 사유로 도입됨) 절을 추가해 R5/R-wontdo-rawws-rest 형식과 정합시킬 것을 권고.

### INFO — "직접 재작성" 선택과 "§4.4 wire 필드 caveat" 선례의 표면적 차이를 한 줄로 선제 구분

- target 위치: `## 결정 — spec 을 실제에 맞추되, 지킬 수 있는 약속은 지킨다` / `## 무엇을 쓸 것인가 → 1.`
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale`의 **"§4.4 wire 필드 caveat — 직접 재작성 대신 caveat + 오너십 분리"** — "논리 nested 구조가 가독성상 유리하므로 JSON 전체를 실 wire 로 교체(가독성 저하 + 두 문서 불일치)하지 않고 caveat 로 통일했다"
- 상세: 이 선례는 "문서의 논리 구조와 실제 wire 표현이 다르지만 데이터 자체는 존재"하는 경우 caveat blockquote 로 해소하라는 원칙을 세웠다. target 은 EIA §6.3 을 caveat 대신 "실제 봉투로 재작성"한다 — 표면적으로 이 선례와 반대 방향의 해법이다. 다만 실질은 다르다: `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 는 논리-wire 표현 차이가 아니라 **엔진에 개념 자체가 없는 필드**(grep 0건)이므로 caveat("실제로는 이렇게 옵니다")가 성립할 대상이 없다. 이 구분이 target 본문에 암묵적으로만 존재하고 명시되지 않아, 향후 검토자가 "왜 §4.4 선례(caveat 우선)를 따르지 않았나"로 재질문할 소지가 있다.
- 제안: target Rationale 에 "본 건은 §4.4 wire caveat 선례(논리-wire 표현 차이)와 달리 필드가 실제로 존재하지 않는 경우이므로 caveat 이 아니라 삭제/Planned 표기를 택한다"는 한 줄을 명시해 두 선례의 적용 경계를 고정.

### INFO — "미구현 (Planned)" 마커의 tracking 파일 정합 여부 확인 권고

- target 위치: `## 무엇을 쓸 것인가 → 1.`·`2.`, `## 후속 (developer)`
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale`의 **"전송 계층 정정"** 항목 — "미구현 (Planned) 으로 분리한 약속 ... `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 로 추적한다"
- 상세: WS spec 의 기존 "Planned" 마커는 전용 추적 plan 파일과 연동되는 관행이 있다. target 이 신설하는 EIA §6.3/§6.4 의 `durationMs`/`result.outputs` "미구현 (Planned)" 마커는 target 자신의 `## 후속 (developer)` 체크리스트에만 등재되고 별도 spec-sync 트래커와의 교차 참조가 없다 — 이 자체가 오류는 아니나(target 문서 하나가 곧 그 추적 plan 이므로 충분할 수 있음), 기존 관행과의 일관성 확인이 필요.
- 제안: 필요 시 `## 후속 (developer)` 항목에 "spec 상 Planned 마커, 추적은 본 plan 파일 자체가 SoT" 라고 한 줄 명시하거나, 기존 `spec-sync-websocket-protocol-gaps.md` 류 트래커에 교차 등록.

## 검증된 항목 (충돌 없음 — 참고용)

- `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 를 삭제하는 결정은 실제 코드(`execution-engine.service.ts` L2371·2538·3467·4633 등)와 `git log -S`(도입 커밋 `9ed6e6305`, PR #228 단일)로 검증되며, 이 필드들을 "의도된 설계"로 명시한 별도 Rationale 은 존재하지 않는다 — 기각된 대안의 재도입이 아니라 애초에 구현 이전 초안 문구였다는 target 주장이 사실과 부합.
- "왜 spec 이 코드를 따르는가" 절이 인용한 `14-external-interaction-api.md` L1198 (§5.4 `/cancel` 응답 shape, "코드가 SoT" 정정) 은 실존하며 인용 내용이 정확 — 같은 PR(#228) 출처에 같은 판단을 적용한다는 유비가 성립.
- `cancelledBy` 닫힌 3값 union(`'user'|'system'|'timeout'`)을 유지·재사용하는 것은 EIA §6.5 기존 서술("닫힌 3값 union 은 확장하지 않는다")과 정합 — 위반 없음.
- `spec/conventions/chat-channel-adapter.md` R3("EIA spec §6 이 SoT, 구체 필드의 spec 갱신은 항상 EIA spec 우선")는 target 이 §1.2 를 EIA §6.3-6.5 최종형에 맞춰 동기화하는 것을 정확히 요구하는 원칙이며, target 의 처리 방향과 정합.
- EIA-IN-04(`getStatus`, R17)가 terminal `result`/`error` 를 실값으로 반환한다는 target 의 "재조회 경로가 이미 있다" 주장은 R17 본문과 부합 — 단 `nodeCount`/`failedNodeId` 동급 데이터를 getStatus 가 제공한다고 target 이 주장하지는 않으므로(단지 "풍부한 데이터가 필요한 수신자는 EIA-IN-04 를 가리킨다" 수준) 과장 없음.
- 직전 라운드(`15_15_08`) CRITICAL 2건·WARNING 3건이 실제로 이번 target 본문에 반영되어 있음을 확인 — WS §4.1 completed/failed 행도 §3 범위에 포함, `spec_impact`/체크리스트에 `chat-channel-adapter.md` 추가, `retry-turn.service.ts failRetryExecution` cancelledBy 미emit 캐비엇 추가, §6.4 durationMs Planned 비대칭 해소, placeholder 링크(`#`) 실제 앵커로 교체.

## 요약

target 의 핵심 결정(§6.3~§6.5 재작성·`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 삭제·`durationMs`/`result.outputs` Planned 표기·`error` 목표/현행 병기·`cancelledBy` nested 통일·`chat-channel-adapter.md` §1.2 동기화)은 EIA/WS 기존 `## Rationale` 의 어떤 항목도 명시적으로 기각·확정한 대안을 재도입하거나 합의된 invariant(닫힌 union, 단일 sink, R3 SoT 위임 등)를 위반하지 않는다. 오히려 이번 개정은 직전 라운드(`15_15_08`)의 CRITICAL 2건·WARNING 3건을 전부 실제로 반영한 상태이며, "코드가 SoT" 정정 선례(L1198)를 정확히 인용해 결정 번복에 대한 새 Rationale 도 함께 작성했다. 남은 사항은 모두 INFO 수준 — (1) 필드 영구 삭제를 R5/R-wontdo-rawws-rest 형식(전용 ID + 재논의 트리거)으로 정식화, (2) "직접 재작성" 선택이 "§4.4 wire caveat 우선" 선례와 다른 이유(필드 진짜 부재 vs 표현 차이)를 한 줄 명시, (3) Planned 마커의 트래킹 파일 정합 확인 — 이며 어느 것도 BLOCK 사유가 아니다.

## 위험도
LOW
