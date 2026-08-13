# Consistency Check 통합 보고서

target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`

**BLOCK: YES** — cross_spec 이 [CRITICAL] 1건을 보고했다 (spec_impact/체크리스트 범위 밖에서 EIA §6 renumbering 이 3개 파일의 기존 cross-reference 를 stale 하게 만듦).

## 전체 위험도
**HIGH** — 전략 방향(단일 SoT + 포인터) 자체는 4개 checker 전원이 지지·검증했으나, 실행 시 스코프 누락이 사실상 확실해 이 draft 그대로는 4번째 "부분 반영" 반려 사유를 만든다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | EIA §6 renumbering(§6.3 신설)이 spec_impact 밖 3개 파일의 기존 "EIA §6.4/§6.5/§6.6" 절 번호 참조를 stale 하게 만든다 | "결정 — 필드 집합은 1곳..." §(1)·(2), 체크리스트 "EIA §6.3 신설 + §6.x 봉투 1회 + §6.4/§6.5 를 참조로 축약" | `spec/5-system/15-chat-channel.md:95,100`(EIA §6.4 참조 2곳) · `spec/7-channel-web-chat/0-architecture.md:69`(EIA §6.5) · `spec/data-flow/15-external-interaction.md:176,262`(§6.6 재시도, 2곳) — 그중 `chat-channel-adapter.md:145,354` 는 리터럴 line 번호까지 핀박아 별도로도 깨짐 | target 의 `spec_impact` 에 위 3개 파일 추가 + 체크리스트에 "EIA §6 renumbering 후 §6.4/§6.5/§6.6 cross-ref 갱신" 명시 항목 등재. 착수 시 `grep -rn 'EIA §6\.\|external-interaction-api.md#6' spec/` 전수 재확인 |

## planner 인계 (권한 밖 Critical)

> (해당 없음 — 이 세션은 `project-planner` 턴(spec draft 작성 자체)이며, 위 CRITICAL 은 target 문서(spec 초안)의 스코프 보정으로 target 작성자 권한 내에서 직접 해소 가능. `developer` 권한 밖 spec drift 유형이 아니다.)

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | "§6.x" 봉투 절 번호가 미확정 — renumbering 최종 범위가 실행 시점까지 불명 | "(2) 봉투는 채널별로 각 한 번만 서술 — EIA §6.x" | §6.3~§6.6 순번에 의존하는 모든 cross-reference (CRITICAL #1 과 동일 파일군) | 구현 착수 시 최종 번호 먼저 확정 → CRITICAL 제안의 grep 전수 재확인을 그 번호 기준 1회로 체크리스트에 명시 |
| 2 | naming_collision | EIA §6.5 헤딩 재서술 시 헤딩 문구 파생 마크다운 앵커 4곳이 끊긴다 | 체크리스트 "§6.4/§6.5 를 참조로 축약" | `spec/5-system/15-chat-channel.md:76` · `spec/conventions/chat-channel-adapter.md:145,354` · `codebase/backend/src/modules/chat-channel/types.ts:378`(현재 `#65-페이로드--executioncancelled--executionai_message` 앵커 참조) | 체크리스트에 "§6.5 헤딩 문구(번호+타이틀) 유지, 본문만 축약" 또는 "위 4개 참조처 앵커 문자열 동반 갱신" 명시 |
| 3 | naming_collision | 신설 봉투 절 "EIA §6.x" 번호 미확정 — 삽입 위치에 따라 §6.4~§6.6 전체 재넘버링 캐스케이드 위험(§6.5 앵커 파손 배가) | "(2) 봉투는 채널별로... EIA §6.x" | §6.1~§6.6 기존 순번 전체(이미 꽉 참) | `§6.x` 를 실제 확정 번호(예: `§6.3.1` 서브섹션 또는 `§6.6` 앞 삽입 후 재시도를 `§6.7` 로)로 못박고, 재넘버링으로 깨지는 참조를 체크리스트에 함께 등재 |
| 4 | convention_compliance | 결정 (3) "코드 타입(`chat-channel/types.ts`)을 SoT 로" 가 `chat-channel-adapter.md` 자신의 R3("EIA spec 이 SoT, 구체 필드 갱신은 항상 spec 우선")와 충돌하고, target 자신의 후속 체크리스트("코드를 spec 표 (1)과 동기화")와도 모순 | "### (3) 나머지는 포인터로" 첫 불릿 | `spec/conventions/chat-channel-adapter.md` §1.2 서문 + R3 | (a) "코드 타입을 SoT 로" 문구 삭제, R3 패턴 유지(코드는 구현체일 뿐 SoT 아님 명확화) 또는 (b) 정말 코드-우선이 의도라면 R3 본문도 갱신 + 후속 체크리스트 방향도 반대로 정정 |
| 5 | rationale_continuity | §6.3 를 "전체 SoT" 로 승격하는 결정이 WS 자신의 직전 유사 선례(§4.4 "오너십 분리", 2026-07-14 PR #945)를 인용·구분하지 않음 | "## 결정" (2)·(3)항 | `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat — 오너십 분리" 문단 | `## Rationale` 에 "WS §4.4 선례와의 관계: 종결 이벤트는 WS 전용 부가 필드가 없음(실측 확인)이므로 오너십 분리 대신 단일 SoT+포인터가 §4.4 원칙의 다른 face" 문단 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "finalNodeId·finalPort 엔진에 개념 자체가 없다(grep 0건)" 표현이 엄밀하지 않음 — emit 로직 0건은 맞으나 `chat-channel/types.ts:388` 에 미사용 타입 흔적 1건 존재(후속에서 이미 정리 예정이라 실질 누락 아님) | "### (1) 신설: EIA §6.3" 표 마지막 행 | "emit 로직상 0건, 단 `chat-channel/types.ts:388` 에 미사용 타입 흔적 1건(후속에서 함께 정리)"로 표현 다듬기 |
| 2 | rationale_continuity | `chat-channel-adapter.md` §1.2 축약 결정이 그 문서 자신의 R3 를 명시 인용하지 않음(내용은 완전히 정합, 인용만 누락) | "### (3) 나머지는 포인터로" 첫 항목 | `## Rationale` 에 "R3('구체 필드 갱신은 항상 EIA spec 우선')가 이미 이 방향을 명시했다" 한 줄 추가 |
| 3 | naming_collision | 같은 파일(`14-external-interaction-api.md`)을 동시에 건드리는 활성 plan 이 하나 더 있음(`spec-draft-eia-r8-alignment.md`, worktree `eia-spec-r8-alignment-fff754`, §R8 idempotency) | (참고 정보) | 직접 충돌은 없음(다른 절) — 머지 순서만 인지 |
| 4 | plan_coherence | `node-output-redesign/README.md:372` P0 항목의 EIA §6.3 cross-ref 가 target 의 §6.3 성격 변화(completed 전용 → 3종 공유 필드 표)를 반영하지 못한 채 남음. 절 번호는 결과적으로 우연히 맞아떨어지나 참조 대상의 의미가 바뀜 | plan_coherence 보고서 참고 | target `후속 (developer)` 또는 `spec-sync-external-interaction-api-gaps.md` 에 "P0 착수 전 해당 cross-ref 를 재구성된 §6.3/§6.4 기준으로 재검증" 항목 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | CRITICAL 1건: spec_impact 밖 3개 파일 cross-ref stale化. 핵심 기술 전제(WS flat envelope, `cancelledBy` 누락, PR #228 기원)는 전부 소스 대조로 검증됨 |
| rationale_continuity | LOW | 인용 선례 전부 사실과 일치, 지어낸 이력 없음. §4.4 오너십분리 선례 미인용만 WARNING |
| convention_compliance | LOW | 결정 (3) 한 문장이 R3 및 target 자신의 후속 체크리스트와 모순 — 문구 정정으로 해소 가능 |
| plan_coherence | LOW | plan/in-progress 전수 대조 결과 선행조건 우회 없음. `node-output-redesign` P0 cross-ref 재검증 누락만 WARNING |
| naming_collision | MEDIUM | 신규 표면(엔드포인트/이벤트/ENV) 도입 없음. 기존 헤딩 재작성으로 인한 앵커 파손 위험(4곳) + 신설 절 번호 미확정이 핵심 |

## 권장 조치사항
1. **(BLOCK 해소)** target 의 `spec_impact` 에 `spec/5-system/15-chat-channel.md`, `spec/7-channel-web-chat/0-architecture.md`, `spec/data-flow/15-external-interaction.md` 를 추가하고, 체크리스트에 "EIA §6 renumbering 후 3개 파일의 §6.4/§6.5/§6.6 참조 갱신" 항목을 명시적으로 등재한다.
2. 착수 시 `grep -rn 'EIA §6\.\|external-interaction-api.md#6' spec/` 로 절 번호 참조를 전수 재확인한다(이번 리뷰가 잡은 5곳이 최종이라고 가정하지 말 것 — 동일 방심이 이미 3회 반복됨).
3. "EIA §6.x"(봉투 절)의 최종 번호를 확정하고, §6.5 헤딩 문구(및 파생 앵커 4곳)를 유지할지 갱신할지 체크리스트에 명시한다.
4. 결정 (3) "코드 타입을 SoT 로" 문구를 `chat-channel-adapter.md` R3 원칙에 맞춰 정정하거나, R3 자체를 함께 갱신한다.
5. `## Rationale` 에 WS §4.4(오너십 분리) 선례와의 관계를 한 문단 추가한다.
6. (선택) `node-output-redesign/README.md:372` 의 EIA §6.3 cross-ref 재검증 항목을 후속 목록에 추가한다.