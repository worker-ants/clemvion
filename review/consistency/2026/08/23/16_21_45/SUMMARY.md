# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. WARNING 5건(부분 중복 병합), INFO 6건.

## 전체 위험도
**MEDIUM** — 직접 모순(spec-impl drift)은 없으나, target 의 "고칠 두 곳" 범위가 실제 파급을 다 덮지 못해 편집 직후 같은 저장소 안에 stale 서술이 여러 곳(egress-masking.md 좌표계 표, 4-ai-assistant.md 내부 결정 메모 표, EH-NAV-04, 트래커 W1)에 남을 위험이 5개 checker 중 다수(plan_coherence·convention_compliance·cross_spec·rationale_continuity)에 걸쳐 반복 지적됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/2-navigation/_product-overview.md` EH-NAV-04 "구현 상태" 주석이 target 반영 후 stale — `maskSensitiveFields` 자동 마스킹 한 줄로만 서술해 실제로 닫힌 유출 경로(자유 텍스트 `Bearer …`, `token` 접두형)를 과소 서술 | 「고칠 두 곳」(4-ai-assistant.md §4.1.1, EIA §R17 잔여③) | `spec/2-navigation/_product-overview.md:265` | target 작업 범위에 이 한 줄 동기화 추가, 또는 후속 트래커에 명시 기록 |
| 2 | cross_spec + plan_coherence(INFO 병합) | `maskSensitiveFields` 는 3개 소비처(assistant 도구·AI Agent 노드·Config echo boundary)가 공유하는 함수. §4.1.1 새 서술이 "이 도구에 한정된 변화"임을 scoping 하지 않으면 다른 spec 독자가 전역 포맷 변경(`***`)으로 오독할 위험. 인접해 EIA §R17:1648-1650 의 "token 계열 확장은 잔여③에 미치지 않는다" 캐비엇도 flip 후 전제가 무너져 취소선 처리 필요 | target §1 표, EIA §R17 잔여③ 바로 위 캐비엇 문장 | `spec/4-nodes/3-ai/1-ai-agent.md`(480/755/979/1114행), `spec/2-navigation/14-execution-history.md:469`, `spec/5-system/4-execution-engine.md`(193/203/1510행), `spec/conventions/node-output.md:219`, `spec/5-system/14-external-interaction-api.md:1648-1650` | §4.1.1 에 "이 포맷 변경은 `explore-tools.service.ts` 로컬 합성에 한정, `maskSensitiveFields` 전역 포맷은 불변" 명시(developer 코드의 `redactAssistantFields` JSDoc 표현 재사용). 잔여③ flip 편집 시 바로 위 캐비엇 문장도 함께 취소선 처리 |
| 3 | rationale_continuity + plan_coherence(중복 병합) | `spec/3-workflow-editor/4-ai-assistant.md:1429` "확정된 결정 사항" 표("민감 필드 마스킹" 행, 근거 "기존 유틸 재사용")가 target 갱신 대상(§4.1.1 본문)에서 빠져 있음. §4.1.1 이 `deepRedactSecrets` 중첩으로 바뀌면 같은 파일 안에서 §4.1.1 을 참조하는 이 결정 메모(`:1432` "응답 envelope (spec §4.1.1 참조)")가 §4.1.1 과 모순된 채 남음 | 「고칠 두 곳 → 1.」(§4.1.1 본문만 명시, line 1429 결정 메모 표 불포함) | `spec/3-workflow-editor/4-ai-assistant.md:1429` (같은 파일 내부) | 같은 편집에서 line 1429 행도 "`maskSensitiveFields` + `deepRedactSecrets` 중첩, `***`" 로 갱신하거나 §4.1.1 포인터로 대체. 최소한 "2026-08-23 결정으로 대체 — §4.1.1 참조" 각주 |
| 4 | convention_compliance + plan_coherence(중복 병합) | `spec/conventions/egress-masking.md` §1 좌표계 표(소비처 열) + `code:` frontmatter 가 `deepRedactSecrets` 의 신규 소비처(`explore-tools.service.ts`/`redactAssistantFields`, workflow-assistant LLM 도구)를 반영 못한 채 stale 해짐. 이 문서 자신이 "주인 없는 사실의 drift 방지"를 존재 이유로 신설됐다는 점과 대비됨(§Rationale, PR #1192 CRITICAL 인용) | target 의 「고칠 두 곳」/작업 체크리스트, spec_impact (egress-masking.md 미포함) | `spec/conventions/egress-masking.md` §1 표 2행("REST 응답·저장 에러·conversation thread"만 열거), frontmatter `code:` 목록 | target spec_impact 에 `egress-masking.md` 추가. §1 표 2행에 신규 소비처("workflow-assistant explore 응답") 등재, `code:` 에 `mask-sensitive-fields.util.ts`·`explore-tools.service.ts` 추가. 의도적으로 표 밖에 두기로 했다면 §3 에 같은 문체로 판단 근거 기록 |
| 5 | plan_coherence | 트래커 `17_12_34` W1 종결이 자매 표면(`handler-output.adapter.ts`)의 아직 열린 값 축 잔여(문자열 안 `Bearer …` 등, 의도적으로 남겨둠)를 조용히 삼킬 위험 — 트래커 문서 246~249행이 스스로 기록한 "결합 항목을 한 체크박스로 닫으면 나머지가 조용히 사라진다"는 패턴의 재발 후보 | target 작업 목록 "트래커 `17_12_34` W1 종결" | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:470-486`(W1 원문), `plan/in-progress/assistant-mask-leak.md:156-161,177`(자매의 값 축 잔여 등재 TODO, 미완) | W1 종결 시 (a) 자매 표면 값 축 잔여를 새 별도 체크박스로 함께 등재 후 닫거나 (b) W1 종결 노트에 "값 축은 `handler-output.adapter.ts` 아래 별도 항목으로 분리됨" 명시. `assistant-mask-leak.md` 의 해당 TODO 가 같은 시점에 완료되는지 확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `DEFAULT_SENSITIVE_KEYS` 키-이름 축이 9→22개로 전역 확장(explore-tools 전용 아님). 현재 node config 스키마에 겹치는 비-자격증명 필드명 없어 실질 회귀 위험 낮음 | `mask-sensitive-fields.util.ts` (커밋 `3aaa4cd19`) | 조치 불필요. 향후 `csrfToken`/`sessionToken` 등과 겹치는 비-자격증명 config 필드 도입 시 유의 |
| 2 | cross_spec | `spec/1-data-model.md:643` `AuthConfig.config` 마스킹 포맷(`***<last4>`)과 명명 유사성 — 실제로는 별도 파이프라인이며 egress-masking.md 가 이미 비대상으로 카브아웃 | target §1 표 "포맷 → `***`" | 조치 불필요 |
| 3 | rationale_continuity | `deepRedactSecrets` 의 기존 "잔여 갭(의도)"(자격증명 없는 connection string·내부 호스트명·사설 IP 등은 통과)이 새 표면(workflow-assistant)에도 그대로 상속됨을 명시하면 재발견 비용 절감 | target §4.1.1 Rationale 예정 지점 | 새 Rationale 문단에 "`deepRedactSecrets` 의 알려진 잔여 갭(§R17 참조)이 이 표면에도 동일 적용" 한 문장 추가 |
| 4 | rationale_continuity | EIA §R17 잔여③ 취소선 처리 포맷을 잔여①·②(`~~잔여 N~~ 해소(YYYY-MM-DD)`)와 통일 필요 | 「고칠 두 곳 → 2.」 | `~~잔여 ③~~ 해소(2026-08-23)` 형태 재사용 |
| 5 | convention_compliance | `spec/3-workflow-editor/4-ai-assistant.md` 에 `egress-masking.md` 로의 "관련 문서" 역참조 없음(좌표계 SoT 발견성 저하) | §4.1.1 마스킹 규칙 서술 또는 문서 상단 관련 문서 목록 | `[Egress 마스킹 좌표계](../conventions/egress-masking.md)` 한 줄 추가 (필수 아님) |
| 6 | naming_collision | (WARNING #4 와 동일 사안의 확인) target 이 참조/재확인하는 모든 심볼(`ED-AI-37`, `deepRedactSecrets`, `maskSensitiveFields`, `"***"`/`VALUE_MASK_MARKER`)은 기존 SoT 와 일관되며 신규 식별자 충돌 없음 | 전역 | 조치 불필요 — 참고용 긍정 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | EH-NAV-04 stale, `maskSensitiveFields` scoping 미명시. 직접 모순 없음 |
| rationale_continuity | LOW | line 1429 결정 메모 표 갱신 누락 위험. 결정 번복 자체는 정당(취소선 보존 계획 확인) |
| convention_compliance | LOW | egress-masking.md 좌표계 표 신규 소비처 미반영. 마커 리터럴 `"***"` 는 SoT 상수와 일치, 규약 위반 아님 |
| plan_coherence | MEDIUM | 「고칠 두 곳」범위가 실제 파급(egress-masking.md, 트래커 W1 자매표면, 파일 내부 결정 메모)을 다 못 덮음. CRITICAL 급 결정 충돌은 아님 |
| naming_collision | NONE | 신규 식별자 도입 없음. 전 심볼 기존 SoT 와 일관 |

## 권장 조치사항
1. `spec/3-workflow-editor/4-ai-assistant.md:1429` "확정된 결정 사항" 표(민감 필드 마스킹 행)를 §4.1.1 편집과 같은 커밋에서 동기화 — 같은 파일 내부 자기모순 방지 (WARNING #3)
2. EIA §R17 잔여③ flip 시 바로 위(:1648-1650) "token 계열 확장은 잔여③에 미치지 않는다" 캐비엇 문장을 함께 취소선 처리 (WARNING #2)
3. `egress-masking.md` §1 좌표계 표 + `code:` frontmatter 에 신규 소비처(`explore-tools.service.ts`) 등재하거나 명시적으로 표 밖에 두는 근거를 §3 에 기록. target spec_impact 에 이 파일 추가 검토 (WARNING #4)
4. 트래커 `17_12_34` W1 종결 시 `handler-output.adapter.ts` 값 축 잔여를 별도 체크박스로 분리 등재 후 닫기 — 조용한 소실 방지 (WARNING #5)
5. §4.1.1 새 서술에 "이 포맷 변경은 `explore-tools.service.ts` 로컬 합성에 한정" scoping 문장 추가 (WARNING #2)
6. `spec/2-navigation/_product-overview.md` EH-NAV-04 구현 상태 주석 동기화 (WARNING #1)
7. (선택) 새 Rationale 에 `deepRedactSecrets` 잔여 갭 상속 한 줄 교차 참조, §R17 취소선 포맷 통일, `egress-masking.md` 역참조 추가 (INFO #3, #4, #5)