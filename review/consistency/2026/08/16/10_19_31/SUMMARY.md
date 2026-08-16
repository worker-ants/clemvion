# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. `spec/**` 자체는 이번 diff(`origin/main...HEAD`)에서 0줄 변경 — EIA 종결 이벤트(`execution.failed`/`cancelled`)의 `error.message`/`details` 를 egress 초크포인트(`toTerminalErrorPayload`)에서 `deepRedactSecrets` 로 값-마스킹하는 순수 하드닝 PR.

## 전체 위험도
**LOW** — 5개 checker 전원 CRITICAL 0, WARNING 1(중복 제거 후), INFO 다수. `naming_collision` 은 NONE(신규 식별자 충돌 없음).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence (+ cross_spec, rationale_continuity 중복 지적을 상향 통합) | 신규 egress 마스킹 지점(`execution.failed`/`cancelled`/chat-channel 종결의 `error.message`·`details`, `toTerminalErrorPayload`→`redactTerminalError`→`deepRedactSecrets`, 호출부 5곳)이 EIA §R17 "표면 제약(보안)" 마스킹 카탈로그(4개 불릿: `conversationThread`·`ai_message`·`nodeOutput.conversationConfig`+terminal `result`/`error`)에도, §6.4 필드 표(`error` 행)에도, 어느 plan 의 후속 항목으로도 등재되지 않았다 | `spec/5-system/14-external-interaction-api.md` §R17(1414~1457행), §6.4 필드 집합 표(`error` 행, ~L579) | `plan/in-progress/eia-terminal-error-sanitize.md`(`spec_impact: none` 근거 = "계약 위반 아님"이지 "카탈로그 완전성 유지"가 아님) · `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(잔여 항목은 패턴 커버리지 갭만 다룸, 카탈로그 누락은 미등재) | project-planner 턴에서 R17 불릿에 5번째 항목 추가(예: "WS/SSE/webhook 의 `execution.failed`/`cancelled`.`error.message`·`details` 도 2026-08-16 부터 `deepRedactSecrets` 값-마스킹, 자격증명 없는 연결 문자열·호스트명은 잔여 갭") 또는 최소 §6.4 note 갱신. 대안으로 `spec-sync-external-interaction-api-gaps.md` 에 "R17 카탈로그 5번째 항목 등재" 를 명시적 후속 항목으로 남겨도 됨 |

> 등급 근거: cross_spec·rationale_continuity 는 이 사안을 INFO 로, plan_coherence 는 WARNING 으로 판정했다. 통합 규칙(§2 하향 금지·중복 제거 시 최강 등급)에 따라 WARNING 으로 통합한다 — 세 checker 가 지목한 target(§R17 vs §6.4 note)은 각도 차이일 뿐 동일 근본 원인(신규 마스킹 인스턴스가 EIA spec 의 정본 마스킹 인벤토리에 미반영)이다.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | CHANGELOG/plan 의 EIA 섹션 인용 오류: `§3.3`(인증, EIA-AU-*) → 실제로는 `§3.1`(Outbound Notification, EIA-NX-*). outbound webhook 페이로드 정본은 §6/§6.4 | `CHANGELOG.md` "Unreleased" 항목, `plan/in-progress/eia-terminal-error-sanitize.md` "실측 — 네 고리를 다 확인했다" 표 "도달 범위" 행 | `(§3.3)` → `(§3.1)` 또는 `(§3.1·§6.4)` 로 정정. 코드 주석은 절 번호 미인용이라 문제 없음 |
| 2 | plan_coherence | `eia-terminal-emit-facade.md`(#1174, 이미 `8e0728a90` 로 origin/main 병합됨)의 체크리스트가 여전히 미완료(`- [ ]`)로 남아 "plan 체크박스 = 실제 상태" 교훈 재발 | `plan/in-progress/eia-terminal-emit-facade.md` 체크리스트 하단 | `[x]` 로 갱신하고 `plan/complete/` 로 이동. 이번 PR 범위 밖, 차단 사유 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 영역 간 직접 모순 없음. `execution.failed` 마스킹이 R17 문서화 관행과 비대칭(INFO→통합 시 WARNING 상향) |
| rationale_continuity | LOW | 직전 라운드 WARNING(write-time vs egress-only)을 근거와 함께 정확히 반영해 egress 초크포인트로 재설계 — 연속성 양호. R17 열거 미반영만 잔존(INFO→통합 시 WARNING 상향) |
| convention_compliance | LOW | `spec/conventions/**` 표면(명명·출력포맷·API문서 규약) 거의 미개방, 위반 없음. CHANGELOG/plan 섹션 인용 오탈(§3.3→§3.1)만 발견 |
| plan_coherence | LOW | 두 plan(`eia-terminal-error-sanitize.md`·`spec-sync-external-interaction-api-gaps.md`) 상호 참조 정합. R17 카탈로그 갱신 누락(WARNING) + 무관한 facade plan 체크리스트 stale(INFO) |
| naming_collision | NONE | target(`spec/5-system/`) diff 0. 유일 신규 식별자 `redactTerminalError`(module-private)는 전 저장소 검색상 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — 참고용) project-planner 턴에서 `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)" 불릿에 신규 egress 마스킹 지점(`execution.failed`/`cancelled`/chat-channel 종결 `error.message`·`details`) 5번째 항목 추가, 또는 §6.4 note 로 값-마스킹 사실 명시.
2. `CHANGELOG.md`·`plan/in-progress/eia-terminal-error-sanitize.md` 의 `§3.3` 인용을 `§3.1`(또는 `§3.1·§6.4`)로 정정.
3. `plan/in-progress/eia-terminal-emit-facade.md` 체크리스트를 `[x]` 로 갱신하고 `plan/complete/` 로 이동 (이번 PR 범위 밖, 별도 후속 작업으로 처리 가능).