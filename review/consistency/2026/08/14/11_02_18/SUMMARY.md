# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — spec/코드 자체는 정합적(CRITICAL 없음)이나, plan 문서 동기화 갭 2건(WARNING)과 spec SoT 범위 갭 1건(WARNING)이 남아 있어 다음 세션에 혼선을 줄 수 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | "llmCalls strip-only 결정"의 SoT가 실제 결함 발생 지점(`execution.waiting_for_input`)을 덮지 않음 — WS §4.4 Rationale·EIA §6.5는 `ai_message` 한정 서술이라, 실제로 새던 `nodeOutput.meta.turnDebug[].llmCalls`(EIA §6.2 페이로드)는 어느 SoT 문서에도 명시 연결이 없음 | `spec/5-system/6-websocket-protocol.md` §4.4 Rationale `### ai_message.llmCalls[] 외부 수신자 strip` · `spec/5-system/14-external-interaction-api.md` §6.2/§6.5 | `spec/conventions/conversation-thread.md` §8.1/§9.3 (필드-단위 단일 계약 전제) | WS §4.4 Rationale을 "`llmCalls` 필드 외부 수신자 strip(위치 무관)"으로 넓히고, EIA §6.2에도 §6.5와 동형의 strip 명시 문장 추가 + R17에서 역참조. 코드 JSDoc SoT 목록에도 EIA §6.2 추가 |
| 2 | plan_coherence | `spec-draft-eia-62-waiting-payload.md` 체크리스트의 "성능 실측" 항목이 실제로는 완료(`5df89cda6`, 2.80배·+20.2µs 실측 수치가 코드 JSDoc에 있음)됐는데 미체크(`[ ]`) 상태로 남음 — 직전 라운드(`10_32_29`)에 동일 패턴이 지적되어 `a9574f823`로 수정됐다가, 바로 다음 커밋에서 재발 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md:150-151` | `codebase/backend/src/modules/websocket/websocket.service.ts:370-384` (`stripDeep` JSDoc "## 비용 (실측)") | `[x]`로 변경하고 실측 수치(2.80배, +20.2µs)와 근거 커밋(`5df89cda6`) 한 줄 추가 |
| 3 | plan_coherence | 보안 수정이 CHANGELOG에 명시한 "이미 전송된 데이터에 대한 운영 판단 필요"가 어떤 plan에도 추적 항목으로 등재되지 않음 — 저장소 선례(W6 패턴, `review/code/2026/07/09/11_08_21/RESOLUTION.md`)와 달리 plan 체크리스트에서 누락 | `CHANGELOG.md` "Unreleased — (보안) 외부 fanout의 llmCalls strip이 depth-1이라 raw 프롬프트가 새고 있었다" 섹션 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` "### 처분 (실제 상태)" 체크리스트 (해당 항목 부재) | 신규 항목 "이미 유출된 turnDebug/llmCalls 데이터에 대한 사후 대응 — 운영 판단 필요"를 plan에 명시 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 이번 보안 강화 이력(depth-1 → 깊이 무관 strip, `__proto__` 오염 방지)이 spec `## Rationale`에 addendum으로 반영되지 않음 (전회 라운드부터 이어지는 동일 INFO, developer 권한 밖) | `spec/5-system/6-websocket-protocol.md` `## Rationale` "strip-only 결정" 항목 | project-planner 턴에서 "2026-08-14: depth-1 구현이 중첩 경로 2곳에서 실제 누출 중이었음을 발견, 깊이 무관 strip + `__proto__` 오염 방지로 강화(`81f2c60d6`, `5df89cda6`)" 한 줄 addendum. `plan/in-progress/eia-terminal-payload.md`에 이미 미완료 체크박스로 등재됨(중복 신설 아님) |
| 2 | naming_collision | 신설 함수 `stripDeep`(module-private) — 저장소 전체에서 충돌 없음, 명명 적절 | `codebase/backend/src/modules/websocket/websocket.service.ts:386` | 없음(기록용) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/5-system/` 무변경. 3개 spec 문서(WS §4.4·EIA §6.5·chat-channel CCH-MP-01)의 "필드명 기준 strip" 계약을 구현이 처음 온전히 충족. 모순 없음 |
| rationale_continuity | NONE | 기존 결정("모든 외부 수신자에서 llmCalls 제거") 번복 없음, depth-1 구현이 문언에 못 미쳤던 결함을 바로잡은 것. INFO 1건(addendum 미반영, 비차단) |
| convention_compliance | LOW | 코드-신설 위반 없음. 다만 spec SoT가 실제 누출 지점(`waiting_for_input`)을 비켜가는 문서 구조 갭(코드가 고친 결함과 동형) |
| plan_coherence | MEDIUM | 체크박스-실제상태 drift 재발(성능 실측) + 운영 판단 필요 항목의 plan 미등재, 둘 다 문서 동기화 갭 |
| naming_collision | NONE | 신설 식별자 `stripDeep` 1개, 충돌 없음. `spec/5-system/` 변경 없어 신규 ID/엔티티/endpoint/이벤트/ENV/경로 충돌 대상 자체가 없음 |

## 권장 조치사항
1. `plan/in-progress/spec-draft-eia-62-waiting-payload.md:150`의 "성능 실측" 체크박스를 `[x]`로 갱신하고 실측 수치(2.80배, +20.2µs, 커밋 `5df89cda6`)를 추가한다.
2. 같은 plan 문서에 "이미 유출된 turnDebug/llmCalls 데이터에 대한 사후 대응 — 운영 판단 필요" 항목을 신설해 CHANGELOG의 결정 대기 사항을 추적 가능하게 만든다.
3. (선택, planner 턴) `spec/5-system/6-websocket-protocol.md` §4.4 Rationale과 `14-external-interaction-api.md` §6.2를 갱신해 "llmCalls strip-only" SoT 범위를 `waiting_for_input`까지 명시적으로 넓히고, 같은 턴에 이번 보안 수정 이력을 addendum으로 남긴다(WARNING #1 + INFO #1을 함께 해소 가능).