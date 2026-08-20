# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL 0건. `cross_spec` 이 낸 WARNING 1건(`token` 계열 마스킹 커버리지가 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 축과 `maskSensitiveFields` 축 사이에서 비대칭이며 그 사실이 spec 본문에 캐비엇으로 남아있지 않음)만 존재하고, 이미 plan 트래커에 정확히 tracked 돼 있어 차단 사유는 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `token` 계열 마스킹 커버리지가 두 SoT(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` vs `maskSensitiveFields`/`DEFAULT_SENSITIVE_KEYS`) 사이에서 비대칭인데, spec 본문에는 그 비대칭이 캐비엇으로 남아있지 않다 — `maskSensitiveFields` 는 node config echo(모든 노드)·workflow-assistant AI 도구 읽기 표면을 방어하지만 여전히 리터럴 키 나열만 매칭해 `csrf_token`/`auth_token`/`session_token`/`csrfToken` 등 접두 `token` 계열이 평문 통과 | `spec/5-system/14-external-interaction-api.md` §R17(2026-08-17 갱신 블록) · `spec/5-system/11-mcp-client.md` §8.3·Rationale | `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙"(매칭 키 리터럴 나열) · `spec/2-navigation/14-execution-history.md` · `spec/conventions/node-output.md` · `spec/5-system/7-llm-client.md` | `spec/5-system/14-external-interaction-api.md` §R17 또는 `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙" 중 한 곳에 "`maskSensitiveFields` 소비자(node config echo·workflow-assistant explore tools)는 더 좁은 목록을 쓰며 접두 `token` 계열이 아직 새어나간다"는 한 줄 캐비엇 추가. 코드 확장을 지금 요구하는 것은 아님 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 미결 항목이 이미 이 gap 을 소유 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 자격증명 마스킹 SoT 가 3갈래(값-정규식/키-리터럴/헤더 substring 블랙리스트)로 병존, 통합 인벤토리 부재 | `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` vs `12-webhook.md` §5.3 `sanitizeResponseHeaders` vs `maskSensitiveFields` | `spec/conventions/` 에 credential-masking 메커니즘 인벤토리 표 신설 고려 (필수 아님) |
| 2 | rationale_continuity | `MCP_EXTRA_SECRET_PATTERNS` 빈 배열에 §3.3 확립된 절 단위 won't-do 표기 선례(`_(비채택 won't-do — 이유)_`)를 적용하지 않음 | `mcp-error-codes.ts` | won't-do 가 아니라 "현재 불필요해 비어 있다"는 상태 서술이라 적용 대상 아님 — 선택적 스타일 통일만 고려 |
| 3 | rationale_continuity | 직전 리뷰(`13_31_57`) INFO #2("`websocket.service.ts` 신규 주석에 `x-api-key` 비대칭 관련 한 줄 추가")가 이번 커밋에 미반영 | `websocket.service.ts` | 원래 선택 사항(INFO)이라 연속성 위반 아님 — 조치 불요 |
| 4 | plan_coherence | 순서 의존 선행 plan(`eia-masked-prefill-roundtrip-guard.md` "token= 패턴 확장은 이 PR 뒤에") 확인 — 커밋 순서(`c9cc2a923`→`45ba37792`)로 실측, 가드가 마커 exact-match 로 일반화돼 있어 패턴 확장에 영향 없음 | (해당 없음) | 조치 불요 |
| 5 | plan_coherence | 소유 트래커(`spec-sync-external-interaction-api-gaps.md`)의 범위 결정(①②③만 닫고 ④`mask-sensitive-fields.util.ts`는 범위 밖 유지)과 diff 가 정확히 일치 | `spec/5-system/11-mcp-client.md` §8.3 | 조치 불요 |
| 6 | naming_collision | 확장 정규식 `[A-Za-z0-9_-]*token` 이 `nextPageToken`(불투명 커서) 같은 무해한 키도 마스킹하는 의도된 오탐 | `sanitize-error-message.ts` | 캐너리 테스트로 이미 명시적으로 기록돼 있어 조치 불요 (신규 식별자 충돌 아님, 범위 외) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `token` 계열 마스킹이 값/키 SoT 축에서는 닫혔으나 `maskSensitiveFields` 축은 여전히 좁음 — 이미 tracked, spec 캐비엇만 미반영 |
| rationale_continuity | NONE | 직전 리뷰 WARNING(#1, `MCP_EXTRA_SECRET_PATTERNS` 잉여화)을 절차대로 정확히 집행. 기각 대안 재도입·원칙 위반·무근거 번복·암묵 가정 충돌 전부 없음 |
| convention_compliance | NONE | `spec/conventions/**` 명명·포맷·구조 규약 위반 없음. 오히려 기존 예외 승격·표 열-불일치 정정 등 정합화 |
| plan_coherence | NONE | 소유 plan 이 트래커 범위 결정을 정확히 따랐고, 다른 worktree 선행 plan 의 순서 제약도 커밋 순서로 실측 충족 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·파일 경로 전무 — 전부 기존 식별자 재사용/재인용 |

## 권장 조치사항
1. (선택, BLOCK 무관) `spec/5-system/14-external-interaction-api.md` §R17 또는 `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙"에 `maskSensitiveFields` 축이 `token` 접두 계열을 아직 못 잡는다는 한 줄 캐비엇 추가.
2. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 workflow-assistant 항목이 해소될 때 `mask-sensitive-fields.util.ts` 에도 SoT 파편화 방지 주석 추가 권장(이번 diff 의 JSDoc 스타일 참고).
3. (선택) `spec/conventions/` 에 credential-masking 메커니즘 인벤토리 표 신설 고려 — 필수 아님.
