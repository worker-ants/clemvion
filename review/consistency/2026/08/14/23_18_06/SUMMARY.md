# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec/5-system/14-external-interaction-api.md`, `error` string→object 일원화)이 타 spec·규약·명명과 정합. 다만 같은 문서 내부 자기모순 1건과 자매 plan 2건의 stale 서술이 WARNING 으로 남아 있음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | §6.4 blockquote(라인 792-793)가 "`error` 는 현행 일부 경로에서 string" · "당분간 양쪽을 방어"라고 남아, 같은 문서 §6 필드표(라인 572, 이번 diff로 "전 경로 object" 로 확정)와 정면 모순. 방치 시 다음 판단자가 이미 걷어낸 back-compat 스캐폴딩을 무근거로 되살릴 위험 | `spec/5-system/14-external-interaction-api.md:792-793` | 같은 문서 `§6` 필드표(라인 572) | §6.4 caveat 를 "레거시 흡수 전용"으로 재서술 — 예: "`failed` 의 `error` 는 이제 전 경로 object 다(`toTerminalErrorPayload`, 2026-08-14). 배포 경계에서 재생되는 레거시 이벤트에 한해 dispatcher/프런트가 string 을 방어적으로 흡수한다" |
| 2 | plan_coherence | 자매 plan 2건이 "일부 경로는 아직 string" 이라는 이제 거짓이 된 전제를 그대로 서술, 대응 체크박스 미체크. `eia-terminal-payload.md:230` 자신이 이 갱신을 체크리스트에 남겼으나 미집행(`/ai-review 22_55_51` WARNING #11 재확인) | `spec-sync-external-interaction-api-gaps.md:20-23`, `spec-draft-eia-notification-payload-contract.md:104-105,190` | 이번 diff 로 갱신된 `spec/5-system/14-external-interaction-api.md:572` (§6 필드표) | 두 plan 의 `error` 관련 서술을 "emit 4곳 object 통일 완료(`toTerminalErrorPayload`, 2026-08-14)" 로 flip. 단, `chat-channel.dispatcher.ts` string 분기는 **레거시 큐 이벤트 흡수용으로 의도적 유지**(제거 대상 아님)임을 명기 — 단순 "wrap 제거 완료"로 잘못 flip 하지 말 것. 갱신 후 `eia-terminal-payload.md:230` 체크 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `EIA-NX-03`/`R12`가 V066 로 제거된 `hmacAlgorithm` 필드를 현재형으로 인용(실 소유자는 `AuthConfig.config.algorithm`, `12-webhook.md:167`) — 이번 diff 범위 밖, `spec-sync-external-interaction-api-gaps.md` 에 이미 추적 중 | `spec/5-system/14-external-interaction-api.md` §7.1 인접 | 기존 추적 문서에서 계속 처리 |
| 2 | cross_spec | §11 WS↔외부 명령 매핑 표의 `execution.stop` 행이 `6-websocket-protocol.md §4.6` 의 "WS 명령 §4.2 won't-do" 주석을 누락 — 두 "권위 표" 비대칭. 이번 diff 범위 밖 | `spec/5-system/14-external-interaction-api.md` §11 | 기존 추적 문서에서 계속 처리 |
| 3 | cross_spec | `toTerminalErrorPayload` 의 `message`/`details` 가 REST(`getStatus`)의 값-패턴 마스킹과 달리 WS/SSE fanout 에서 키-이름 마스킹만 거침 — 채널간 보안 계약 비대칭. `22_55_51` security WARNING 으로 이미 발견·defer, 이번 diff 로 노출면 확대 없음 | `terminal-error-payload.ts` / WS·SSE emit 경로 | 기존 backlog 에서 계속 추적 |
| 4 | convention_compliance | `api-convention.md §6` HTTP 상태 코드 표에 `410 Gone` 누락 — target(EIA)·`12-webhook.md` 등이 이미 광범위하게 사용 중인데 canonical 표가 완결되지 않음. target 자체 결함 아님 | `spec/5-system/2-api-convention.md §6` | 표에 `410 | Gone | 리소스가 더 이상 유효하지 않음(webhook 비활성 트리거, EIA 종료된 execution/토큰)` 행 추가 |
| 5 | convention_compliance | 본문 곳곳(§5.1/§5.2/§5.4/§5.5/§6.2 등)에 날짜 스탬프 "정정" blockquote 가 `## Rationale` 밖 인라인으로 산재 — CLAUDE.md "배경·근거는 Rationale" 권장과 형식적 긴장. 다만 저장소 전역 관행이고 권장 사항이라 target 고유 이탈 아님 | `spec/5-system/14-external-interaction-api.md` 전역 | target 수정 불요. CLAUDE.md 문구를 "단문 정정은 본문 인라인 허용, 설계 대안 비교/기각 근거는 Rationale" 로 명확화하는 편이 실제 관행과의 괴리를 줄임 |
| 6 | rationale_continuity | `code` nullable 근거 정정(`plan/in-progress/eia-terminal-payload.md` 재판정 ③-b)은 실측 재검증 통과 — 결론 번복 아님, R8/R10/R14 등과 충돌 없음 | `spec/5-system/14-external-interaction-api.md:782-790` | 조치 불요. WARNING #1 정리 시 같은 편집 단위로 함께 처리 가능 |
| 7 | naming_collision | 신규 심볼 `toTerminalErrorPayload`/`TerminalErrorPayload` 가 기존 `extractAiTurnErrorPayload`(AI turn 예외 분류)·`extractNodeErrorPayload`(프런트 노드 에러 파싱)와 이름 계열(`...ErrorPayload`) 은 유사하나 동일 식별자 아님 — 충돌 아님 | `codebase/backend/src/modules/execution-engine/terminal-error-payload.ts:36,48` | 조치 불요. 추후 헬퍼 증가 시 `to<X>ErrorPayload`(wire 정규화) vs `extract<X>ErrorPayload`(예외→분류) 접두사 구분을 컨벤션화하면 탐색성 향상 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 타 spec 영역(1-data-model, 6-websocket-protocol, 15-chat-channel, channel-web-chat 위젯)과 신규 충돌 없음. 오히려 종전 string drift·지어낸 `'INTERNAL_ERROR'` 값을 제거해 정합도 개선 |
| rationale_continuity | LOW | `## Rationale` 항목 번복 없음. §6.4 blockquote 가 §6 필드표와 자기모순(WARNING) |
| convention_compliance | LOW | `spec/conventions/**` 명명·출력 포맷·API 문서 규약 전 항목 준수. `410 Gone` 표 누락은 대조 문서(target 아님) 쪽 갭 |
| plan_coherence | MEDIUM | target 자체는 정확히 갱신됐으나 자매 plan 2건(`spec-sync-external-interaction-api-gaps.md`, `spec-draft-eia-notification-payload-contract.md`)의 stale 서술·미체크 체크박스 방치 |
| naming_collision | NONE | diff 는 spec 1파일 11줄, 신규 ID/엔티티/endpoint/이벤트명 없음. 유일한 신규 코드 심볼 `toTerminalErrorPayload` 는 전수 grep 상 충돌 없음 |

## 권장 조치사항
1. `spec/5-system/14-external-interaction-api.md:792-793` §6.4 blockquote 를 §6 필드표(라인 572)와 정합하도록 "레거시 흡수 전용" 으로 재서술 (WARNING #1).
2. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:20-23` 과 `plan/in-progress/spec-draft-eia-notification-payload-contract.md:104-105,190` 의 `error` 관련 서술을 이번 완료 상태로 flip하고 체크박스 반영, `chat-channel.dispatcher.ts` string 분기는 레거시 흡수용으로 의도 유지임을 명기 (WARNING #2).
3. 위 두 plan 갱신 후 `plan/in-progress/eia-terminal-payload.md:230` 체크리스트 항목 체크.
4. (선택) `spec/5-system/2-api-convention.md §6` 표에 `410 Gone` 행 추가 (INFO #4).