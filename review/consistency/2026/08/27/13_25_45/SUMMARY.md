# Consistency Check 통합 보고서

**BLOCK: YES** — naming_collision checker 가 판정한 CRITICAL 1건(R-5 안전 원칙명 개명이 인용처에 전파되지 않음)이 있어 호출자가 차단해야 함. 동일 사실을 cross_spec checker 는 WARNING 으로 지적했으나, 등급 하향 금지 원칙에 따라 더 강한 등급(CRITICAL)으로 통합함.

## 전체 위험도
**CRITICAL** — 기능적 영향은 없는 문서 인용 drift 이지만, checker 가 명시적으로 [CRITICAL] 판정했고 그 근본 원인(spec/ 파일 정정)이 developer 권한 밖이라 BLOCK 유지 및 planner 인계가 필요함. 그 외 항목은 LOW/NONE 수준.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (동일 사실을 cross_spec 은 WARNING 으로 병행 지적 — 최강 등급으로 통합) | R-5 의 안전 원칙명이 이번 diff 에서 `boundary masking parity` → `egress masking parity` 로 개명됐는데, 그 개명이 R-5 를 직접 인용하는 두 문서와 R-5 자신의 인접 문단에 전파되지 않아 같은 원칙을 가리키는 두 이름이 공존한다 | `spec/5-system/14-external-interaction-api.md:1530`(§R17, `Execution.error` 내부 읽기 경로 마스킹 근거) · `spec/5-system/6-websocket-protocol.md:196`(§4.1, 값-패턴 마스킹 적용 범위 근거) | `spec/2-navigation/14-execution-history.md:469`(R-5 본문, 이번 PR이 `boundary`→`egress` 로 갱신) 및 같은 문서 467행(R-5 를 인용부호로 직접 인용하는 자기-참조 문단, 미갱신 — 같은 문서 내부도 상호 모순) | 세 곳의 `boundary masking parity` 를 `egress masking parity` 로 정정(총 3줄, 의미 변화 없음). `masking-expression-egress-split` plan 의 `spec_impact` 6개 목록에 이 두 EIA/WS 파일이 원래 빠져 있었으므로, 후속 정정 항목으로 별도 등재해 재발 방지 |

## planner 인계 (권한 밖 Critical)

> 이 항목은 등급이 CRITICAL 그대로이고 `BLOCK: YES` 도 그대로다 — 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 대상 문장(`boundary masking parity` 인용구)은 developer 가 이번 PR 에서 직접 써 넣은 예고 문장이 아니다 — `spec/5-system/14-external-interaction-api.md`·`spec/5-system/6-websocket-protocol.md` 는 이번 diff 범위 밖(git diff 확인, 손대지 않음)이고, 인용 대상은 보안 rationale 원칙명 자체라 "자기-반증형 소정정" 예외의 조건 1(자신이 썼음)·조건 2(예고·트리거이며 요구사항/API 계약이 아님)를 충족하지 못한다. developer 는 `spec/` write 권한이 없으므로 이 3줄 정정을 직접 할 수 없다 | project-planner | `spec/5-system/14-external-interaction-api.md:1530`, `spec/5-system/6-websocket-protocol.md:196`, `spec/2-navigation/14-execution-history.md:467` 의 `boundary masking parity` → `egress masking parity` 정정(문구만, 의미 변화 없음) | `plan/complete/masking-expression-egress-split.md` (spec_impact 사후 보완) 또는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (신규 후속 항목으로 등재) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 동일한 "allow-list 전환" 정정 문장이 SoT(node-output.md §4.2.1)를 명시적으로 인용하면서도 5곳(그중 2곳은 target 문서 내부)에 축자 반복됨 — 문서군이 스스로 "사본 금지" 원칙(2026-08-24 신설)을 세운 직후 형태가 같은 패턴 재발 | `spec/5-system/4-execution-engine.md` §7.4/§1.3(2곳, `_resumeCheckpoint`/`_retryState` 서술) | `spec/conventions/node-output.md` §4.2.1(SoT) · `spec/4-nodes/3-ai/1-ai-agent.md`(2곳) | `node-output.md §4.2.1` 을 유일 SoT 로 두고 나머지 4곳은 짧은 인용("SoT: node-output.md §4.2.1")으로 축약. self-contained 서술을 의도했다면 그 의도를 Rationale 에 명시 |
| 2 | plan_coherence | `node-output.md` Principle 0 의 `config` 필드 정의가 이번 PR 이 신설한 Principle 7("마스킹은 egress 에서만")과 self-contradiction — 같은 문서 안에서 두 원칙이 다른 진실을 말함. 이를 추적하는 plan 항목도 없음 | `spec/conventions/node-output.md:23` — `config`: "해석된 설정값 (자격증명 제거)" (구식 서술, 이번 diff 미포함) | `spec/conventions/node-output.md` Principle 7 신설 문단(L154 부근, 이번 PR — config 는 이제 원문 저장, 마스킹은 egress 전담) | Principle 0 불릿을 "egress 에서 자격증명 제거"로 정정하거나 Principle 7 로 상호 참조 각주 추가. 이번 PR spec_impact 로 싣기 늦었다면 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 잔여 항목으로 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `spec/5-system/4-execution-engine.md` 4곳 편집은 새 결정 번복이 아니라 2026-08-24 에 이미 확정된 "boundary 제거 → egress-only 마스킹" 결정의 지연 미러링(취소선+날짜+SoT 링크 동반) — 코드 주석(`ai-turn-executor.ts`, `execution-engine.service.ts`)과도 실측 대조로 정합 확인. 조치 불필요 | `spec/5-system/4-execution-engine.md` L193, L203, L1510, Rationale 신규 블록 | 없음 (모범적 편집으로 판정) |
| 2 | cross_spec | target 영역(`spec/5-system/`) 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 재검토 결과, 이번 diff 범위에서 R-5 문구 drift 외 추가 충돌 없음 | `spec/5-system/*` 전반 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | R-5 원칙명 문구 stale 인용 2곳을 WARNING 으로 지적 — naming_collision 이 동일 사실을 CRITICAL 로 재평가, 통합 보고서는 CRITICAL 채택 |
| rationale_continuity | NONE | `4-execution-engine.md` 4곳 편집은 2026-08-24 확정 결정의 정상 전파, 무근거 번복 없음 |
| convention_compliance | LOW | 동일 정정 문장 5곳 축자 반복 — SoT 사본 금지 원칙과 형태 재발(WARNING) |
| plan_coherence | LOW | `node-output.md` Principle 0 이 신설 Principle 7 과 self-contradiction, 추적 plan 항목 부재(WARNING) |
| naming_collision | MEDIUM | R-5 원칙명 개명(`boundary`→`egress` masking parity)이 spec/5-system/ 2곳 + 자기인용 1곳에 전파 안 됨(CRITICAL) |

## 권장 조치사항
1. **(BLOCK 해소 우선)** planner 턴에서 `spec/5-system/14-external-interaction-api.md:1530`, `spec/5-system/6-websocket-protocol.md:196`, `spec/2-navigation/14-execution-history.md:467` 의 `boundary masking parity` → `egress masking parity` 3줄 정정. `plan/complete/masking-expression-egress-split.md` 의 `spec_impact` 사후 보완 또는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 후속 항목 등재.
2. `spec/conventions/node-output.md` Principle 0 의 `config` 정의(L23, "자격증명 제거")를 Principle 7 신설 내용("마스킹은 egress 에서만")과 정합하도록 정정하거나 상호 참조 각주 추가.
3. `spec/5-system/4-execution-engine.md`·`spec/4-nodes/3-ai/1-ai-agent.md` 의 반복된 "allow-list 전환" 정정 문장 4곳을 `node-output.md §4.2.1` SoT 인용으로 축약해 구조적 재발 위험을 줄인다 (비차단, 후속 처리 가능).