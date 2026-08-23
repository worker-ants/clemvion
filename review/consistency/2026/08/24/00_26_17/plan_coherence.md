# Plan 정합성 검토 — `spec/conventions/`

## 검토 범위 확인

`git diff origin/main...HEAD -- spec/conventions/` 결과, 실제 변경은 `spec/conventions/conversation-thread.md` §8.4 "소비처 갱신" 단락 1건뿐이다 (다른 `spec/conventions/**` 파일은 이번 PR 에서 무변경). 이 변경은 CLAUDE.md §"자기-반증형 소정정" 예외 절차(developer 가 자신이 쓴 예고 문장을 실측으로 반증)를 명시적으로 표방한다.

## 발견사항

없음 — target 변경이 plan 의 미해결 결정을 침범하지 않고, 선행 조건이 이미 해소돼 있으며, 후속 항목도 같은 커밋/PR 안에서 함께 갱신됐다. 상세 근거는 아래.

### 교차검증 상세 (참고용, 등급 없음)

- **자기-반증형 소정정 5조건 전량 충족 확인**: `git log -S "SSE·fanout 이 잔여다" -- spec/conventions/conversation-thread.md` → 커밋 `16f3e3625`(`#1205`, author `worker-ants`=developer 자신)가 원 문장을 썼다(조건1). 대상 문장은 API 계약이 아니라 "구현 상태 예고"이고, 같은 절의 "REST 와 SSE 는 같은 강도다" 같은 계약 문장은 이번에도 별도로 planner 턴(EIA §R17 갱신)을 거쳤다(조건2, `spec/5-system/14-external-interaction-api.md` diff 로 확인). 정정문에 chokepoint 실측(`toFanoutEnvelope` 단일 경유) + 버튼 재개 record 대입 시 `{}` 실측을 동봉했다(조건3). 원문은 취소선(`~~SSE·fanout 이 잔여다~~`)으로 보존되고 인접 서술은 그대로다(조건4). `plan/complete/sse-nodeoutput-allowlist.md` frontmatter `spec_impact` 에 `spec/conventions/conversation-thread.md` 가 명시돼 있고, 해당 파일을 건드린 커밋(`b813101aa`) 본문에 5조건 체크리스트와 실측이 함께 기록돼 있다(조건5). 게이트도 규약대로 `--impl-done spec/conventions/` 로 지정돼 있다.
- **후속 항목 누락 없음**: target 정정문이 언급하는 "잔여 = `execution.node.completed`/`.failed` 의 `envelope.output`" 은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 신규 CRITICAL 항목(`23_29_27 cross_spec CRITICAL`, emit 5곳 실측 + 버튼 재개 record `{}` 실측 + `websocket.service.spec.ts` 캐너리 지정 포함)으로 등재돼 있다. 같은 문서의 형제 항목(SSE/fanout waiting 표면 closure)도 취소선 + `[x]` 로 정합하게 갱신됐다.
- **선행 plan 미해소 없음**: target 이 전제하는 "waiting_for_input 표면의 SSE/fanout allowlist 닫힘"은 `codebase/backend/src/modules/websocket/websocket.service.ts` diff(`+70` 라인, `toFanoutEnvelope` 경유)로 실제 구현돼 있고, `plan/complete/sse-nodeoutput-allowlist.md` 가 체크박스 전량 완료(`status: complete`, 열린 항목 0건)로 마감돼 있다.
- **미해결 결정과의 충돌 없음**: `spec-sync-external-interaction-api-gaps.md` 의 다른 열린 항목("wire-only 키가 `node-output.md` Principle 0 의 닫힌 레지스트리 밖이다" — planner 소관, `[ ]`)은 target 문서(conversation-thread.md)가 건드리지 않는 범위(`node-output.md`)이고, target 이 그 미결 판단을 선점하거나 우회하지 않는다. `egress-masking.md §2 파이프라인 순서 갱신`(planner 소관, 등재 `23_29_27`)도 같은 이유로 target 범위 밖이며 plan 에 올바르게 미결로 남아 있다.
- **형제 plan(`spec-draft-eia-62-waiting-payload.md`)** 도 같은 날짜(2026-08-23) 후속 각주로 동일한 "waiting 표면만 닫힘, `envelope.output` 잔여" 사실을 반영해, 세 문서(target spec·EIA §R17·두 plan 트래커) 간 서술이 서로 어긋나지 않는다.

## 요약

이번 PR 의 `spec/conventions/` 변경은 conversation-thread.md 한 곳, 그것도 CLAUDE.md 가 규정한 "자기-반증형 소정정" 예외 절차를 다섯 조건 모두 충족하며 정확히 따른 1개 단락 정정이다. 그 정정이 전제하는 구현(SSE/fanout waiting 표면 allowlist)은 이미 완료·closed 상태이고, 정정이 남긴 잔여(`execution.node.*` 의 `envelope.output`)는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에 실측·캐너리와 함께 새 CRITICAL 항목으로 즉시 등재돼 있으며, EIA §R17 표와 형제 plan(`spec-draft-eia-62-waiting-payload.md`)도 같은 날 동기화됐다. plan 이 아직 열어 둔 다른 결정(Principle 0 각주, egress-masking §2 순서)은 target 범위 밖이며 정당하게 planner 턴으로 이연돼 있다. Plan 정합성 관점에서 결함을 찾지 못했다.

## 위험도

NONE
