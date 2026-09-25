# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 결과 확보(전부 status=success, 인라인 전문 authoritative). CRITICAL 발견 없음.

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건은 모두 "판정표의 근거 문구·교차 참조 누락" 성격으로, target(`plan/in-progress/changelog-backfill-12.md`)의 최종 판정 자체를 뒤집기보다 근거 보강을 요구한다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `#1238` "안 낸다" 판정의 근거 "spec 0" 이 사실과 다름 — `spec/5-system/6-websocket-protocol.md` §Rationale 이 `#1238` 을 명시적으로 인용·서술 중 | §A 판정표 `#1238` 행 | `spec/5-system/6-websocket-protocol.md` §Rationale "WS 이벤트 enum 명명 — `<도메인>EventType` (2026-08-30, `#1238` 후속)" (라인 1298~1308) | 근거 문구를 "facade 소비자 0. spec 은 `#1238` 을 명명 규칙 채택 근거로 인용하지만 검사/가드가 아니라 정책 문서화이므로 기준 ③(전역 가드) 미충족 — 안 낸다 유지"로 정정. 최종 판정은 유지 가능, spec 파일 자체 수정 불요 |
| 2 | plan_coherence | `#1270` 판정("오늘 관측되는 변화 — 셧다운 지연 방지")이 원 plan `ws-token-expired-socket-lifetime-impl.md` 의 미해결 후속 3건(셧다운 중 만료 콜백 미실행 캐비엇 · 배포 런북 미실체화 · 타이머 지터)과 단절 | §A 표 `#1270` 행 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` L168-195 (`- [ ]` 미해결 3건, 배포 런북이 아직 이 in-progress plan 자신) | target §A `#1270` 행(또는 실제 CHANGELOG 항목)에 "그레이스풀 셧다운 중 사전 통지가 못 갈 수 있다" 캐비엇 한 줄 추가, 또는 §C 체크리스트에 "원 plan 미해결 후속과 대조" 항목 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 이번 세션이 번들 절단분(SSRF·WS·chat-channel·OpenAPI 관련 spec 78개 파일)을 직접 원본 대조로 메웠으나 그 사실이 target plan 자체에는 기록되지 않음 | `plan/in-progress/changelog-backfill-12.md` 전체 | §C 검증 체크리스트에 "spec 원문 대조(번들 절단분 포함)" 한 줄 추가 |
| 2 | convention_compliance | frontmatter(`worktree`/`started`/`owner`/`spec_impact: none`)는 `.claude/docs/plan-lifecycle.md §4` 스키마를 정확히 충족 | frontmatter | 없음 (확인 기록). `complete/` 이동 시 `status` 종료 어휘 갱신 필요 |
| 3 | convention_compliance | CHANGELOG 항목 포맷 기준(`## Unreleased — <제목>` 등)은 `spec/conventions/**` 밖(CHANGELOG.md 자체)에 있어 본 checker 위임 범위 밖 | §A/§B 전체 | 실제 CHANGELOG 편집 커밋 시 포맷 준수를 code-review 또는 후속 검토에서 재확인 |
| 4 | naming_collision | 판정표 인용 PR 12건 모두 CHANGELOG.md grep 0건(미사용) — `changelog-criteria.md` 의 후속 위임과 정합, 신규 식별자 없음 | §A 판정표 전체 | 없음 (확인 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `#1238` "spec 0" 근거가 실제 spec 서술과 불일치(WARNING 1건), 나머지 5개 기술 주장은 spec과 정확히 일치 확인 |
| rationale_continuity | NONE | 인용 기술 사실 전부 해당 영역 spec Rationale과 일치, 무근거 번복·기각 대안 재도입 없음. INFO 1건(번들 절단 대조 기록 보강 제안) |
| convention_compliance | NONE | plan-lifecycle 스키마 준수, 신규 식별자·포맷 위반 없음. INFO 3건은 범위 밖 관찰 |
| plan_coherence | LOW | 12건 목록·근거는 상위 트래커·완료 plan과 정합. `#1270` 판정이 원 plan의 미해결 후속 캐비엇과 단절(WARNING 1건) |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API·이벤트·파일 경로 없음, 기존 위임 문서와 정합 |

## 권장 조치사항
1. `#1270` 행에 "그레이스풀 셧다운 중 사전 통지 누락 가능" 캐비엇을 추가하거나 §C에 원 plan 대조 체크리스트 항목을 넣는다 (WARNING 2 해소).
2. `#1238` 행의 근거 문구를 "spec 0" → "spec 은 인용하나 가드/검사가 아닌 정책 문서화"로 정정한다 (WARNING 1 해소, 최종 판정 유지 가능).
3. 위 두 정정 반영 후 실제 CHANGELOG.md 편집 커밋 시 포맷(§Unreleased 접두 등)은 후속 검토에서 재확인한다.
