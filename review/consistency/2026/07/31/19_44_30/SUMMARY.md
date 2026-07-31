# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 성공, 전문 확보 완료. Critical 판정 0건. 직전 라운드(19:20:50)에서 지적된 CRITICAL(viewer 실행 권한 오기재)은 이번 target 변경(`spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 정정, 커밋 `9fa06cd4c`)으로 정확히 해소됨.

## 전체 위험도
**MEDIUM** — 차단 사유(Critical)는 없다. 다만 "LLM Config"/"Model Config" 명칭 드리프트가 이번 신규 각주에서 처음 병치 노출됐고(naming_collision 자체 판정 MEDIUM, cross_spec·convention_compliance 도 동일 현상을 INFO 로 교차 확인), 여기에 구조적 섹션 배치(§3.2 위치)와 SIGTERM/shutdown 취소 분류 미언급까지 총 3건의 WARNING 이 잔존해 후속 정리가 필요하다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|

(없음 — 5개 checker 전원 Critical 0건 보고. 직전 라운드의 CRITICAL 은 이번 diff 로 해소 확인됨)

## planner 인계 (권한 밖 Critical)

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|

(없음 — Critical 자체가 없어 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (cross_spec·convention_compliance 교차 확인, 최강 등급으로 통합) | 신규 각주가 "LLM Config"(표 헤더, 기존 관용 표현)와 "Model Config"(1-auth.md 정본 명칭)를 연결 없이 병치 — 동일 리소스이나 별개로 오해될 위험. `unified-model-management`(V088~V092) 이후 API·내비게이션은 "Model Config" 로 일원화됐으나 product-facing 문서 다수가 아직 "LLM Config" 를 씀 | `spec/data-flow/12-workspace.md:239-256`(§3.2 표 "LLM Config" 열 헤더 + 신규 각주의 "Model Config" 언급) | `spec/5-system/1-auth.md:379-402`("Model Config" 로 통일된 정본) · `spec/2-navigation/6-config.md:286`(LLM Config alias 제거 완료 문서화) · `spec/data-flow/7-llm-usage.md:11`("Model Config") vs 같은 폴더 `12-workspace.md:11`/`0-overview.md:131`("LLM Config") | 각주에 "동일 리소스" bridging 한 문장 추가(최소 조치). 근본 해결은 표 헤더를 "Model Config" 로 통일하고 관련 product-overview 문서군 표기도 별도 후속 항목으로 정리 |
| 2 | convention_compliance | RBAC 권한 매트릭스가 도메인 공통 규약(entity status enum 전이만 다루는 "상태 전이" 섹션) 범위 밖 내용을 그 섹션 아래 배치 — 15개 형제 문서 전원이 지키는 템플릿에서 `12-workspace.md` 만 유일하게 이탈(사전 존재, 이번 diff 는 표만 확장하고 위치는 정리하지 않음) | `spec/data-flow/12-workspace.md` `## 3. 상태 전이` > `### 3.2 RBAC 매트릭스 (요약)` | `spec/data-flow/0-overview.md §3.4`(상태 전이/흐름 단계 템플릿 정의) | §3.2 를 `## 3 상태 전이` 밖으로 이동(별도 `## X 권한(RBAC)` 섹션 승격 등) 또는 `0-overview.md §3 공통 규약`에 "도메인 문서는 선택적 RBAC 요약을 덧붙일 수 있다" 예외 조항 명문화 |
| 3 | plan_coherence | SIGTERM/graceful-shutdown 취소 분류가 활성 plan 2건이 추적 중인 미해결 (a)/(b) 결정에 걸려 있고, 그에 종속된 실측 gap(취소 가드 `assertExecutionNotCancelled` 가 `FAILED`/`SERVER_INTERRUPTED` 를 관측하지 못함)이 있는데 target 이 이를 전혀 언급하지 않아 "완결된 것처럼" 읽힐 위험 | `spec/data-flow/3-execution.md` §3.3 "비정상 종료 회수" 표(`ShutdownStateService.onApplicationShutdown` 행) 및 §3.1/§3.2 `SERVER_INTERRUPTED → failed` 전이 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`("결정이 필요하다 (택일)" (a)/(b) 미결) · `plan/in-progress/node-cancellation-residual-signal-propagation.md`("백로그" — 가드가 FAILED 미관측) | 결정 확정 전까지 §3.3 행/각주에 "분류 정책 결정 대기 중(`spec-update-node-cancellation-shutdown-classification.md`) — dispatch 루프가 이 UPDATE 를 즉시 관측 못할 수 있음" 상호참조 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity + convention_compliance (교차 확인) | RBAC 정정 근거가 `## Rationale` 절이 아닌 §3.2 본문 인라인 blockquote 에 위치 — CLAUDE.md 저장 위치 원칙과는 결이 다르나, 같은 문서·폴더의 기존 인라인 근거 선례(§1.4/§1.5/§1.9)와는 부합 | `spec/data-flow/12-workspace.md` §3.2 표 아래 신규 blockquote 2건 | `## Rationale` 절 말미에 "RBAC 요약표 viewer 실행 권한 정정 (2026-07-31)" 소절로 1줄 요약·링크 고려(비차단) |
| 2 | convention_compliance | 신규 각주가 인용하는 1-auth.md 각주("Model Config Editor CRUD 근거")는 실제로 Auth Config 를 대비 대상으로 삼지 Integration 을 언급하지 않음 — 인용 정확성 이슈(값 자체는 정확) | `spec/data-flow/12-workspace.md` 신규 각주 "(1-auth.md §3.2 및 그 아래 'Model Config Editor CRUD 근거' 각주)" | "Auth Config 와 같은 논리로(1-auth.md §3.2)" 로 인용 문구 수정 또는 1-auth.md 에 Integration 전용 근거 각주 신설 |
| 3 | convention_compliance | 신규 문장 2곳에서 문서·섹션 참조에 backtick 코드스팬 누락 — 같은 문단 내 기존 표기 관행과 스타일 불일치 | `spec/data-flow/12-workspace.md` 신규 문장("1-auth.md §3.2 의 …", "(1-auth.md §3.2 및 그 아래 …)") | `1-auth.md §3.2` 를 backtick 으로 통일 |
| 4 | naming_collision | `Integration (Org)`(1-auth.md, 공백 있음) vs `Integration(Org)`(신규 각주, 공백 없음) 표기 차이 — 동일 엔티티 지칭이라 충돌 아님 | `spec/data-flow/12-workspace.md:255` vs `spec/5-system/1-auth.md:379` | 다음 편집 시 공백 통일(조치 불요 수준) |
| 5 | rationale_continuity | (carry-over, 이번 diff 범위 밖) "Manual Trigger" 용어가 노드-타입과 Trigger 엔티티를 동시 지칭해 문단 내 오독 위험 — 직전 라운드부터 이월, 실제 결정 충돌 아님 | `spec/data-flow/11-workflow.md` `## Rationale`("복제가 버전 이력·트리거·데이터셋을 승계하지 않는 이유") | "복제본에도 Manual Trigger 노드를 `create()` 처럼 자동 생성"으로 명시하거나 각주로 두 용례 구분(비차단) |
| 6 | plan_coherence | (data-flow 범위 밖, 참고용) `execution-engine-residual-gaps.md` G1 "장래 도입 여지" 서술이 3일 뒤 확정된 `spec-sync-websocket-protocol-gaps.md` won't-do 결정과 어긋나는 죽은 서술로 남음 | `plan/in-progress/execution-engine-residual-gaps.md` G1 절 | `execution-engine-residual-gaps.md` 또는 `spec/5-system/4-execution-engine.md §11` 다음 정리 시 반영 후보로 보류 |
| 7 | plan_coherence | (실질 충돌 아님, 저강도 관찰) AI Agent Tool Area 재설계 미결 결정(`ai-agent-tool-connection-rewrite.md` 전항목 TBD)과 target 의 스키마 레벨 서술 — 현재는 사실 서술일 뿐 선점 없음 | `spec/data-flow/11-workflow.md` §1.2 "노드 컨테이너 / Tool Area 배치" 표 + Rationale | 조치 불필요. 재설계 결정 확정 시(특히 Tool Area 부활 채택 시) §1.2 표·Rationale 갱신 대상으로만 인지 |
| 8 | rationale_continuity | (확인 완료, 결함 아님) RBAC 정정이 인용한 코드·교차문서 근거(`@Roles('editor')`, `ROLE_HIERARCHY`, `1-auth.md §3.2`) 전부 정확 — 감사 기록 목적 기재 | `spec/data-flow/12-workspace.md:239-256` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | RBAC 정정(viewer 실행 ✗, LLM Config/Integration 열 분리)이 코드(`@Roles('editor')`, `ROLE_HIERARCHY`)·`1-auth.md §3.2`·`9-user-profile.md §4.2` 전부와 정합; 미수정 사본·깨진 앵커 없음. 잔여는 "LLM Config" vs "Model Config" 표기 불일치(INFO) |
| rationale_continuity | NONE | 정정은 근거·인용 모두 정확, 결정 번복·invariant 우회 없음; 인라인 vs Rationale 배치(INFO)와 이월된 Manual Trigger 용어 중의성(INFO)만 잔존 |
| convention_compliance | LOW | RBAC 요약표가 "상태 전이" 섹션 템플릿(0-overview.md §3.4) 범위 밖에 위치(WARNING, 사전 존재 이탈, 이번 diff 가 정리하지 않음); 각주 인용 정확성·backtick 표기·근거 배치(INFO 3건) |
| plan_coherence | LOW | SIGTERM/shutdown 취소 분류 미결 (a)/(b) 결정과 실측 gap 을 target 이 언급하지 않음(WARNING); G1 stale 서술·Tool Area 재설계 미결은 범위 밖/저강도(INFO 2건) |
| naming_collision | MEDIUM | 신규 각주가 "LLM Config"/"Model Config" 명칭 드리프트를 처음으로 한 문단에 병치 노출(WARNING); `Integration(Org)` 공백 표기 차이(INFO) |

## 권장 조치사항
1. (WARNING #1, naming_collision) `spec/data-flow/12-workspace.md` 신규 각주에 "LLM Config = Model Config(1-auth.md 정본 명칭), 동일 리소스" 를 명시하는 bridging 문장 1줄 추가 — 최소 비용으로 오독 위험 제거.
2. (WARNING #3, plan_coherence) `spec/data-flow/3-execution.md` §3.3 SIGTERM 행에 "(a)/(b) 분류 정책 결정 대기 — `spec-update-node-cancellation-shutdown-classification.md`" 상호참조 추가 — 결정 자체를 선점하지 않으면서 미결 상태를 명시.
3. (WARNING #2, convention_compliance) §3.2 RBAC 매트릭스를 "## 3 상태 전이" 섹션 밖으로 옮기거나(별도 RBAC 섹션 승격), `0-overview.md §3 공통 규약`에 예외 조항을 명문화 — 후속 편집 시 처리해도 무방(비차단).
4. (INFO 항목들) 각주 인용 정확성(Auth Config↔Integration), backtick 표기, `Integration (Org)` 공백, `## Rationale` 미러링은 다음 이 문서 편집 시 함께 정리 — 개별 후속 조치 불필요.
5. 그 외(Manual Trigger 용어, G1 stale 서술, Tool Area 재설계)는 이번 diff 범위 밖 이월 항목으로 별도 추적(비차단).