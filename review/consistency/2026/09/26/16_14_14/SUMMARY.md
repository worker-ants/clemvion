# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (spec 내부 모순). 단, 근본 원인은 `spec/` 이며 이번 작업(`assistant-e2e-contract-gaps`, `spec_impact: none`, 테스트 파일 1곳 한정)의 권한 밖이므로 아래 §planner 인계 참고.

## 전체 위험도
**CRITICAL** — target spec 자체가 요구사항 ED-AI-19("실행 중 편집 도구 거부")의 이행 여부를 PRD 와 상세 스펙에서 정반대로 서술하는 직접 모순을 안고 있다. 이번 e2e 테스트 보강 작업 자체는 Rationale 연속성·plan 정합성·신규 식별자 충돌 관점에서 전부 NONE 위험이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | "실행 중 편집 도구 거부"(ED-AI-19)가 PRD 에는 이행된 필수 요구사항으로, 상세 스펙에는 "(계획) 아직 미구현"으로 정반대로 서술됨. 실제 코드에도 `ASSISTANT_WORKFLOW_RUNNING` 문자열이 없고(`grep` 0건), 이 갭을 추적하는 plan 도 없음 | `spec/3-workflow-editor/4-ai-assistant.md` §12.2, §4.1.1 "실행 상태별 동작" 표(`running`/`waiting_for_input` 행) | `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19(우선순위 "필수", "(계획)" 표기 없음), §10.9 도입부("ED-AI-19 유지"), ED-AI-38 인용부 | PRD 쪽에 target 과 동일한 "(계획, 미구현)" 캐비엇을 추가하거나, 실제로 구현할 계획이면 `plan/in-progress/`에 추적 항목을 신설해 두 문서가 같은 현재 상태를 가리키도록 동기화. `project-planner` 턴 필요 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 `BLOCK: YES` 그대로 유지된다 — 아래는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 이번 세션은 `developer` 턴이며 `spec/` 은 read-only(자기-반증형 소정정 예외 미해당 — 이 문장을 developer 가 쓰지 않았고, 제품 요구사항 ID 라 예외 조건 2 도 불충족). 이번 작업 범위도 `assistant-e2e-contract-gaps`(`spec_impact: none`, 테스트 파일 1곳)로 spec 수정이 배제됨 | project-planner | `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행 + §10.9 도입부 + ED-AI-38 인용부에 "(계획, 미구현)" 캐비엇 추가. 또는 반대로 실제 가드가 이미 구현돼 있다면 `spec/3-workflow-editor/4-ai-assistant.md` §12.2·§4.1.1 의 "(계획) 미구현" 문구를 제거하고 코드 반영 상태로 갱신 | 신규 `plan/in-progress/` 항목 신설 또는 기존 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 등재 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `GET /api/workflow-assistant/sessions/latest` 가 target 의 REST API 인벤토리(§6)에서 전부 누락됨. `plan_coherence` 확인 결과 이미 `spec-draft-nullable-notation-followups.md`(라인 5139~5146, planner 소유, 미착수)에 등재된 결함으로, 신규 발견이 아니라 기존 트래커 확인 | `spec/3-workflow-editor/4-ai-assistant.md` §6 REST API 표 | `spec/data-flow/11-workflow.md` L116 (primary lookup 경로로 명시), 실제 구현 `workflow-assistant.controller.ts:88` | §6 표에 `GET .../sessions/latest?workflowId={id}` 행 추가(`{data: <AssistantSessionDto> \| null}`), §6.1 에 인용 정정. 별도 조치 불필요 — 기존 트래커 항목으로 planner 턴에서 처리 예정, 중복 등재 금지 |
| 2 | cross_spec | target 의 "모든 엔드포인트는 `editor` 이상" 일괄 RBAC 서술이 실제 라우트(조회 3곳은 `@Roles` 미부착 → 멤버십만 검증)와 이 저장소의 일반 RBAC 패턴(조회=viewer+, 변경=editor+)에 모두 어긋남. 이 역시 같은 `spec-draft-nullable-notation-followups.md` 트래커에 등재된 결함 | `spec/3-workflow-editor/4-ai-assistant.md` §6 하단, §5.1 SSE 표 | `spec/data-flow/12-workspace.md` §4 RBAC 요약표, `workflow-assistant.controller.ts` 의 `@Roles('editor')` 적용 범위(4곳만) | 조회에도 editor+ 강제 의도면 `@Roles('editor')`를 3개 GET 핸들러에 추가하고 근거를 Rationale 에 기록. viewer 열람 허용 의도면 §6 서술을 "편집·메시지 전송은 editor 이상, 조회는 멤버 이상"으로 정정. 기존 트래커 항목으로 planner 턴에서 처리 |
| 3 | convention_compliance | frontmatter `status: implemented` 인데 본문이 스스로 §7·§10·§12.2 세 곳에서 "(계획) 미구현"을 인정 — `spec-impl-evidence.md` §3 라이프사이클 위반(`implemented`=모든 약속 구현완료, `pending_plans` 없음이어야 함). §12.2 항목은 위 Critical #1 과 동일 근본 원인 | frontmatter (`status: implemented`) vs 본문 §7·§10·§12.2 | `spec/conventions/spec-impl-evidence.md` §3 | `status: partial` 로 낮추고 `pending_plans:` 에 3개 갭 추적 plan 등재, 또는 실제 구현 완료 상태면 "(계획)" 문구 제거 후 코드 반영. Critical #1 의 planner 인계와 함께 처리 |
| 4 | convention_compliance | Workflow Assistant 도메인 에러 코드 8종(`ASSISTANT_*`, `LLM_RATE_LIMIT` 등)이 중앙 에러 카탈로그(`3-error-handling.md §1`)에 미등재 — 다른 도메인(§1.5~§1.12)은 전부 등재된 패턴과 불일치 | `spec/3-workflow-editor/4-ai-assistant.md` §7 에러 처리 표 | `spec/5-system/3-error-handling.md` §1, `spec/5-system/2-api-convention.md` §5.3 | `3-error-handling.md` §1 에 "§1.13 Workflow Assistant 에러 코드" 절 신설, target §7 로 cross-reference |
| 5 | convention_compliance | SSE `event: error` 페이로드가 REST 표준 에러 봉투(`{error:{code,message,requestId,...}}`)와 형태가 다른데, EIA §5.2 처럼 그 예외 근거를 명시하지 않음 | `spec/3-workflow-editor/4-ai-assistant.md` §5.3 예시 | `spec/5-system/2-api-convention.md` §5.3, `spec/5-system/14-external-interaction-api.md` §5.2(예외 근거 명시 선례) | "SSE 프레임은 인터셉터를 거치지 않아 REST 에러 봉투를 따르지 않는다"는 한 문장을 §5.3 또는 §7 에 추가 |
| 6 | convention_compliance | 도구 호출 배지(§3.2)의 영문 하드코딩이 i18n Principle 1("사용자 가시 문자열은 반드시 dict 키 경유")을 우회하며, i18n-userguide.md §적용 범위에 예외로 등재돼 있지 않음. 기존 한국어 전용 ratchet 가드는 이 영문 하드코딩을 검출 못함 | `spec/3-workflow-editor/4-ai-assistant.md` §13 상단 각주 | `spec/conventions/i18n-userguide.md` Principle 1, §적용 범위 | i18n-userguide.md §적용 범위에 "tool-call 배지 라벨(영문 고정, MVP)"을 명시적 예외로 등재하거나, 실제 dict 키 연결 후속 plan 을 `pending_plans:` 로 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `/api/workflow-assistant/sessions` 형태가 `api-convention.md §2.2` 명명 표의 별도 행으로 정의돼 있지 않음(위반은 아님, 저장소 전반에 이미 널리 쓰이는 패턴) | `spec/3-workflow-editor/4-ai-assistant.md` §6, §5.1 | §2.2 에 "feature-namespace + resource" 행 정식 추가 (규약 갱신 성격) |
| 2 | plan_coherence | target §6 REST 표의 결함(위 WARNING #1·#2)은 이미 `spec-draft-nullable-notation-followups.md`(라인 5139~5146)에 planner 항목으로 등재되어 있어, 이번 plan(`assistant-e2e-contract-gaps`)이 닫는 트래커 항목(라인 5115~5124)과는 별개 — 체크리스트 종결 시 옆 항목을 실수로 함께 체크하지 않도록 주의 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 별도 조치 불필요, 중복 등재 금지. plan 종결 시 항목 구분 유지 |
| 3 | plan_coherence | `ai-agent-tool-connection-rewrite.md`(미착수, 사용자 디자인 결정 대기)가 같은 spec 파일의 dynamic-ports 모델을 다루지만, 이 plan 의 세 e2e 대조 칸(세션 null 분기·상태코드·선택 키 생략)과는 필드축이 달라 교집합 없음 | — | 선행 조건 아님, 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | ED-AI-19 이행 여부 PRD↔상세스펙 정반대 서술(CRITICAL) + `sessions/latest` 인벤토리 누락 + RBAC 서술 불일치(둘 다 기존 트래커 등재분) |
| rationale_continuity | NONE | 세 e2e 처방 모두 기존 확정 계약(swagger.md §5-2, api-convention.md §5.4, 4-ai-assistant.md §6.1)의 재노출 — 기각된 대안 재도입·원칙 위반 없음 |
| convention_compliance | MEDIUM | `status:implemented` vs 본문 자백 미구현 3건, 에러 카탈로그 미등재, SSE 봉투 예외 미명시, 배지 영문 하드코딩 i18n 우회 — CRITICAL 급 wire-breaking 없음 |
| plan_coherence | NONE | 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 전부 없음. target §6 기존 결함은 별도 트래커에서 독립 추적 중 |
| naming_collision | NONE | 이번 턴에 신규 도입되는 식별자 없음(테스트 전용, 기존 식별자만 대상) |

## 권장 조치사항
1. (BLOCK 해소 우선) `project-planner` 턴에서 ED-AI-19 이행 상태 모순(PRD `_product-overview.md` §10.4/§10.9/ED-AI-38 vs `4-ai-assistant.md` §12.2/§4.1.1)을 동기화 — 미구현이면 PRD 에 캐비엇 추가, 구현 계획이면 `plan/in-progress/` 추적 항목 신설.
2. 같은 planner 턴에서 target frontmatter `status: implemented` 를 `partial` 로 낮추고 `pending_plans:` 에 §7·§10·§12.2 세 미구현 항목을 등재(WARNING #3), 위 1번과 함께 처리하면 중복 작업 없음.
3. 별도 planner 턴(또는 같은 턴)에서 `sessions/latest` REST 인벤토리 누락 + RBAC 서술 불일치를 `spec-draft-nullable-notation-followups.md` 기존 항목으로 정리(WARNING #1·#2, 중복 등재 금지).
4. 에러 카탈로그 미등재(WARNING #4), SSE 봉투 예외 미명시(WARNING #5), 배지 i18n 예외 미등재(WARNING #6)는 우선순위 낮은 후속으로 별도 plan 또는 이번 planner 턴에 합류.
5. 이번 `assistant-e2e-contract-gaps` 테스트 전용 작업 자체(`sessions/latest` null 분기, 테스트 F `toBe(200)`, 테스트 H 선택 키 전부 생략)는 Rationale 연속성·plan 정합성·신규 식별자 충돌 관점에서 진행에 지장 없음 — 위 Critical 은 이 작업이 만든 결함이 아니라 기존 spec drift 이므로, developer 턴은 planner 인계 후 테스트 작업을 계속 진행 가능.
