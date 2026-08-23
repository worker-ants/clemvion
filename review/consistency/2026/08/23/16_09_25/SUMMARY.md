# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건(근본 원인은 developer 권한 밖의 spec drift). 아래 §planner 인계 참고.

## 전체 위험도
**CRITICAL** — `assistant-mask-leak` 구현이 뒤집는 마스킹 포맷 결정이 spec SoT 두 문서(`4-ai-assistant.md` §4.1.1 `ED-AI-37`, `14-external-interaction-api.md` §R17 "잔여 ③")와 직접 모순되는데 `spec_impact: none` 으로 선언돼 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec (rationale_continuity·convention_compliance·plan_coherence 동일 이슈를 WARNING 으로 중복 지적, 최강 등급 CRITICAL 로 통합) | workflow-assistant 마스킹 강화(`deepRedactSecrets` 중첩 → `****<last4>`가 `***`로 변경, `DEFAULT_SENSITIVE_KEYS` token 계열 확장)가 spec SoT 두 곳의 정본 서술과 직접 모순되는데 `spec_impact: none` 으로 선언되어 spec 갱신 계획이 전혀 없음 | `plan/in-progress/assistant-mask-leak.md` (frontmatter `spec_impact: none`); 구현 대상 `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`(`redactAssistantFields`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` | `spec/3-workflow-editor/4-ai-assistant.md:259` §4.1.1 "마스킹 규칙"(요구사항 `ED-AI-37` 정본, `"****<last4>"` 포맷·리터럴 키 목록 명문화) / `spec/5-system/14-external-interaction-api.md:1652-1658` §R17 "잔여 ③ (범위 밖 유지)"("값-패턴 마스킹을 단순 합성하면 안 된다... 어느 의미가 우선하는지는 별도 결정") | `spec_impact` 를 두 파일 경로로 정정 + project-planner 턴으로 §4.1.1 포맷을 `***`(힌트 없음)로 정정하고 §R17 잔여③을 "결정 완료(2026-08-23, 유출 차단 우선)"로 flip + 트래커 `spec-sync-external-interaction-api-gaps.md` `17_12_34` W1 체크박스 해소 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 등급 CRITICAL, `BLOCK: YES` 그대로 유지 — 다음 행동을 지정하는 표.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/` 쓰기는 project-planner 전용(CLAUDE.md Skill 표) — 이번 세션은 developer `--impl-prep` 이라 `spec/` read-only. 이 결정(사용자 결정 2026-08-23 "유출 차단이 우선")은 EIA §R17 이 명시적으로 "별도 결정"으로 열어 둔 항목을 정당하게 닫는 것이지만, spec 본문에 되반영하는 단계가 developer 권한 밖 | project-planner | `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1(L259, 매칭 값 포맷 `"****<last4>"`→`"***"` 정정, "기획 결정 메모" 표 L1429 동반 갱신) / `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ③"(L1652-1658, "결정 완료 — 값+키 축 전면 마스킹, 접미 힌트 트레이드오프는 유출 차단 우선으로 폐기"로 flip) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` `17_12_34` requirement W1 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | `spec/conventions/egress-masking.md` §1 좌표계 표(2행)·frontmatter `code:` 에 신규 소비처(`ExploreToolsService.redactAssistantFields`)가 미등재 | `spec/conventions/egress-masking.md` §1 좌표계 표 | 이번 diff 가 `deepRedactSecrets` 를 `explore-tools.service.ts` 에 신규로 겹쳐 호출 | 표 2행 소비처 열에 `ExploreToolsService.redactAssistantFields`(workflow-assistant 도구 응답) 추가. "소비처 확장이라 표 갱신 불요"로 판단할 경우 §3 에 그 판단 근거를 한 줄 기록(문서 자신이 요구하는 패턴) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | 마스킹 마커 표기가 두 형태로 갈린다(`***` bare vs `****<last4>`) — `handler-output.adapter.ts` 산출물은 `VALUE_MASK_MARKER`(`***`) 공유 계약 밖이라, 향후 재제출 가능 경로에 들어가면 `isMaskedMarker` 오탐(재제출 허용) 위험 | `codebase/packages/masked-markers/src/index.ts`(`VALUE_MASK_MARKER`) vs `codebase/backend/.../handler-output.adapter.ts` | 오늘 시점 보안 구멍 아님(재제출 경로 미진입). `assistant-mask-leak.md` "자매의 값 축 잔여" 트래커 항목에 이 위험을 한 줄 등재 |
| 2 | convention_compliance | `spec/5-system/2-api-convention.md` 에 `## Overview` 섹션 부재(형제 문서 `1-auth.md`/`3-error-handling.md` 는 있음) | `spec/5-system/2-api-convention.md:16-22` | 급하지 않음. 이 파일을 만질 기회가 있으면 §1 앞에 Overview 2~3문장 추가 |
| 3 | plan_coherence | `maskSensitiveFields` 실사용처 3곳 중 1곳(`ai-turn-executor.ts:3280,3351`)은 주석-only 참조 — plan 의 2곳 열거는 실측과 일치, 누락 아님 | `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` | 조치 불필요, 확인 기록만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | 마스킹 포맷 변경이 `ED-AI-37`(§4.1.1)·EIA §R17 "잔여③" 과 직접 모순, `spec_impact: none` |
| rationale_continuity | MEDIUM | 동일 이슈 — EIA §R17 이 "별도 결정"으로 열어둔 트레이드오프를 뒤집으면서 spec Rationale 미갱신 |
| convention_compliance | MEDIUM | 동일 이슈(§4.1.1/§R17) + egress-masking.md 표 미갱신(WARNING) + Overview 부재(INFO) |
| plan_coherence | MEDIUM | 동일 이슈 — `spec_impact: none` 이 실측과 어긋남, 작업 목록에 spec 갱신 태스크 부재 |
| naming_collision | NONE | 신규 식별자 충돌 없음. 마커 표기 이원화는 INFO |

## 권장 조치사항
1. (BLOCK 해소 우선) `plan/in-progress/assistant-mask-leak.md` frontmatter `spec_impact` 를 `none` → `[spec/3-workflow-editor/4-ai-assistant.md, spec/5-system/14-external-interaction-api.md]` 로 정정.
2. project-planner 턴으로 `4-ai-assistant.md` §4.1.1(L259, 포맷 `***`) 과 `14-external-interaction-api.md` §R17 "잔여 ③"(L1652-1658, 결정 완료로 flip)을 구현과 동기화.
3. `spec-sync-external-interaction-api-gaps.md` `17_12_34` requirement W1 체크박스를 해소로 표시(체크박스=실제 상태 규약).
4. `spec/conventions/egress-masking.md` §1 표에 신규 소비처 행 추가 또는 §3 에 판단 근거 기록.
5. (여유 시) `spec/5-system/2-api-convention.md` Overview 섹션 추가, 마스킹 마커 이원화(`***` vs `****<last4>`) 위험을 트래커에 등재.