# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 2건은 push 전 plan 문서 갱신을 권고하는 사항이며 target(spec) 자체의 결함이 아님.

## 전체 위험도
**LOW** — 5개 checker 전원이 target(`spec/5-system/14-external-interaction-api.md`, `6-websocket-protocol.md`, `1-data-model.md`) 자체는 NONE~LOW 로 판정. 유일한 WARNING 2건은 `plan/in-progress/` 두 문서의 stale 서술(체크박스/차단 표기가 최신 커밋을 못 따라간 것)이며 spec 내용의 결함이 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 발견된 Critical 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `HANDOFF-eia-terminal-payload.md` 가 이미 해소된 두 차단(waitingNodeType SoT 상충, REST getStatus 이중 순회 미실측)을 여전히 "🚫 차단 1"/"⚠️ 차단 2" 로 미해결 서술 | `spec/5-system/14-external-interaction-api.md` §6.2 blockquote (waitingNodeType 행), `interaction.service.ts` strip/redact 순서 JSDoc | `plan/in-progress/HANDOFF-eia-terminal-payload.md` §차단1/§차단2/§재개 절차 | 이번 라운드 BLOCK:NO 확정 시 push 전에 HANDOFF 문서의 게이트 표·차단 1/2·재개 절차를 "해소 완료(`462455a52`)" 로 갱신하거나 더 이상 재개할 것이 없으면 archive/삭제 |
| 2 | plan_coherence | `spec-draft-eia-62-waiting-payload.md` 체크리스트 (3)항목이 "완료(BLOCK:NO)" 로 닫혀 있으나, 그 근거였던 §6.2 blockquote 의 `node.type→waitingNodeType` 매핑 행이 이후 라운드에서 CRITICAL 로 뒤집혀 `462455a52` 로 재정정된 이력이 각주로 남아있지 않음 | `spec/5-system/14-external-interaction-api.md` §6.2 blockquote | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §체크리스트 (3) | 체크리스트 (3) 아래에 "소급 정정(`462455a52`) — waitingNodeType 행은 WS 내부 전용으로 재정정됨(consistency `16_44_43` CRITICAL)" 한 줄 각주 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `waitingNodeType` SoT 상충은 직전 커밋(`462455a52`)이 이미 자기-정정 완료 — 재확인만 | `spec/5-system/14-external-interaction-api.md` §6.2 blockquote | 조치 불필요, 향후 라운드 감시 포인트로 기록 |
| 2 | rationale_continuity | `llmCalls` strip 범위를 WS fanout에서 EIA REST `getStatus()` 로 확장한 것은 기존 "값-마스킹만으론 부족" 판단의 자연 확장이며 새 Rationale 블록쿼트 동반 | `spec/5-system/6-websocket-protocol.md` / `14-external-interaction-api.md` §R17 | 조치 불필요 |
| 3 | rationale_continuity | `error.code`/`nodeId` nullable 승격 및 `interaction` 블록 Planned 명시는 API 규약 §5.4·기존 서술의 일관된 확장 | `spec/5-system/14-external-interaction-api.md` §6.2/§6.4 | 조치 불필요 |
| 4 | rationale_continuity | §6.2 웹훅 봉투 재작성은 문서 자기 원칙(§6 도입부 normative 표) 준수로의 정정 | `spec/5-system/14-external-interaction-api.md` §6.2 | 조치 불필요 |
| 5 | convention_compliance | 신규 교차참조(`WS §4.4.6` 인용) 두 곳에 앵커 프래그먼트 누락 — 같은 diff 내 다른 정밀 인용은 앵커 포함 | `spec/5-system/14-external-interaction-api.md` §5.3 예시 주석(L473), §6.2 payload 예시(L682) | `./6-websocket-protocol.md#446-messagessource-마커` 로 앵커 보강 |
| 6 | convention_compliance | "WS §4.4.6 / Conversation Thread §5.1" 공동 인용 중 실제 폴백 문장("source 누락 시 'live' 간주")은 WS §4.4.6 에만 존재, §5.1 은 매핑 표만 보유 | `spec/5-system/14-external-interaction-api.md` §5.3/§6.2 인용부, `spec/conventions/conversation-thread.md` §5.1 | SoT 를 WS §4.4.6 단독으로 좁히거나 "매핑 근거"와 "폴백" 을 구분해 병기 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·API 계약·계층 책임 6관점 전수 대조, 신규 모순 없음. 오히려 기존 CCH-ERR-04·api-convention §1 과 뒤늦게 정합 |
| rationale_continuity | NONE | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. waitingNodeType 자기-정정 이력 확인, 각 변경에 Rationale 블록쿼트 동반 |
| convention_compliance | LOW | null 부재표현·URL 버저닝·채널 봉투 서술은 규약과 정확히 정합. 신규 교차참조 앵커 누락 2건 INFO |
| plan_coherence | LOW | target 자체는 plan 의 명시적 차단 처방을 정확히 해소한 정합적 후속 커밋. 다만 `HANDOFF-eia-terminal-payload.md`·`spec-draft-eia-62-waiting-payload.md` 두 plan 문서의 서술이 최신 커밋을 못 따라간 stale 흔적 WARNING 2건 |
| naming_collision | NONE | 요구사항 ID·타입명·endpoint·이벤트명·환경변수·파일 경로 6관점 전수 대조, 신규 충돌 없음. `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` 는 module-private → 공유 유틸 승격 이동이라 정당한 재배치 |

## 권장 조치사항

1. push 전 `plan/in-progress/HANDOFF-eia-terminal-payload.md` 의 차단 1/2 표기를 "해소 완료(`462455a52`)" 로 갱신 (WARNING #1).
2. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 체크리스트 (3) 항목에 소급 정정 각주 추가 (WARNING #2).
3. (선택, INFO) `spec/5-system/14-external-interaction-api.md` 의 `WS §4.4.6` 교차참조 두 곳에 앵커 프래그먼트 보강, "Conversation Thread §5.1" 공동 인용 정밀도 개선.