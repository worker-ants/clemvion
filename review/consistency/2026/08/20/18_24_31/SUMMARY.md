# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 완주, Critical 0건. WARNING 1건(rationale_continuity)은 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재된 항목이라 신규 미해소 발견이 아니다.

## 전체 위험도
**LOW** — `Execution.inputData` egress 마스킹 카브아웃 폐지(spec 7개 파일 동기화, 프런트 마커 가드 3소비처)는 cross-spec·convention·plan·naming 4개 축에서 완전히 정합하다. 유일한 실질 지적(§R17 "닫는 조건 충족" 서술이 API 직접 호출 경로의 잔여 위험을 명시하지 않음)은 rationale_continuity checker가 MEDIUM으로 판정했으나, developer 권한 밖(spec 쓰기 불가) 사안이고 프로젝트가 이미 자체 진단·등재해 둔 트래커 항목이라 이번 PR을 막을 사유는 아니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

> Critical 발견 없음 — 인계 대상 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | §R17 "닫는 조건은 충족됐다(2026-08-20)" 서술이 실제로는 **프런트 렌더 경로(UI)** 에만 한정된 폐쇄인데, 그 경계가 본문에 없어 "완전 폐쇄"로 오독될 여지가 있다. `POST /api/executions/:id/re-run` API 직접 호출 시 서버가 마스킹 마커 리터럴(`'***'` 등)을 그대로 재실행 입력으로 받아들이는 잔여 경로가 spec 본문에 미반영 | `spec/5-system/14-external-interaction-api.md:1565-1572` (§R17 잔여② 문단) | 같은 §R17 잔여② 자체(카브아웃 도입→닫는 조건 정의→이번 폐지의 서사) | **이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(2026-08-20 등재, "inputOverride 서버측 마커 리터럴 거부")에 정확히 등재됨.** developer 권한 밖(spec 쓰기 불가)이라 이번 PR에서 손대지 않은 판단은 합리적. **planner 턴**에서 §R17 잔여② 문단에 "이 닫는 조건은 프런트 렌더 경로(UI)에 한정된다. API 직접 호출 경로는 이 가드 밖" 같은 명시적 경계 문장 추가 필요. 그 전까지 §R17을 "완전 폐쇄"로 재인용하지 말 것(이미 3라운드 소모된 오독 패턴) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/2-navigation/14-execution-history.md` 응답 예시 JSON이 `inputData` egress 마스킹 정책 전환을 언급하지 않아 "마스킹 없이 원문이 나간다"로 오독될 여지 | `spec/2-navigation/14-execution-history.md:360-420` | 다음 편집 기회에 §R17 각주(또는 R-5와 같은 각주) 한 줄 추가. 이번 PR 확장 요구 아님 |
| 2 | rationale_continuity | §R17 헤딩(`### R17. ...`)에 2026-08-20 카브아웃 폐지 결정이 반영되지 않음 (기존부터 있던 관례, 신규 결함 아님) | `spec/5-system/14-external-interaction-api.md:1392` | 선택: 헤딩에 "카브아웃 폐지 2026-08-20" 추가. 강제 아님 |
| 3 | convention_compliance | `6-websocket-protocol.md` 만 형제 문서(webhook/replay-rerun/EIA)와 달리 `## Overview (제품 정의)` 섹션이 없음 (이 diff 이전부터 있던 구조 갭, 이번 diff가 만든 문제 아님) | `spec/5-system/6-websocket-protocol.md` 최상단 | 다음 편집 기회에 §1 앞에 Overview 섹션 신설 고려. 권장 사항, 강제 아님 |
| 4 | convention_compliance | 마스킹 마커 카탈로그(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`, 이중 방어 모델)의 SoT가 `spec/conventions/` 가 아니라 도메인 spec(§R17)에 위치. 여러 라운드에 걸쳐 의도적으로 확정된 구조이며 이번 diff가 새로 만든 배치는 아님 | `spec/5-system/14-external-interaction-api.md` §R17 + 이를 인용하는 4개 문서 | 카탈로그가 계속 자라면 `spec/conventions/secret-masking.md` 승격을 project-planner 턴에서 검토 |
| 5 | plan_coherence | workflow-assistant LLM 도구(`toExecutionEnvelope`)가 `Execution.inputData` 를 여전히 키-이름 기반(`maskSensitiveFields`)으로만 마스킹, 값-패턴 egress 마스킹 미적용. 이미 트래커에 "inputData·outputData·error 세 필드" 로 등재된 기존 항목의 적용 범위가 오늘 자연 확장된 것이지 신규 미등재 갭 아님 | `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:482`; 트래커: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 조치 불요. 다음 착수 시 "Execution 레벨도 포함됨" 한 줄 추가하면 스캔 비용 절감 |
| 6 | naming_collision | backend `MASKED_MARKERS`/`isMaskedMarker` 와 frontend `masked-markers.ts` 동명 심볼은 의도된 동기화 미러(양쪽 JSDoc 상호 참조). 향후 한쪽만 리네임하면 미러 계약이 조용히 깨질 수 있음 | `codebase/frontend/src/lib/utils/masked-markers.ts` ↔ `codebase/backend/.../sanitize-error-message.ts` | 별도 액션 불필요 — 리네임 시 반대편 동반 갱신을 convention-compliance/rationale-continuity 축이 향후 캐치 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 7개 spec 파일(1-data-model, 3-execution, 12-background, 6-websocket-protocol, 12-webhook, 13-replay-rerun, 14-external-interaction-api)이 카브아웃 폐지 서사를 일관되게 동기화. 코드(backend 마스킹 관문, frontend 마커 미러, i18n)도 정합. INFO 1건(execution-history.md 예시 구식) |
| rationale_continuity | MEDIUM | §R17 "닫는 조건 충족" 서술이 실제로는 UI 렌더 경로에만 한정된 폐쇄인데 그 경계가 본문에 없음(WARNING, 이미 트래커 등재). 번복 자체엔 새 Rationale 동반, 6개 인접 문서 전파 정합, 기각된 대안 재도입 없음 확인 |
| convention_compliance | NONE | 마스킹 마커 상수·경계·i18n parity·frontend-layering 해소 패턴·spec-impl-evidence frontmatter 전부 규약 준수. INFO 2건(WS 문서 Overview 부재, 마스킹 카탈로그 SoT 위치)은 모두 이 diff 이전부터 있던 의도적/권장 사항 |
| plan_coherence | NONE | 선행조건(프런트 마커 가드) 같은 PR 내 자기완결, 7개 미러 문서 전수 정합(옛 서술 잔존 0건), 후속 항목 4건 트래커 등재 확인. INFO 1건(workflow-assistant 미적용 범위 자연 확장)은 기존 등재 항목 |
| naming_collision | NONE | 신규 식별자(frontend export 4개, rerun-modal 로컬 헬퍼 7개, i18n 키 2개) 전수 충돌 없음. `MASKED_MARKERS`/`isMaskedMarker` 동명은 의도된 backend-frontend 미러. 제거된 `MASKED_INPUT_DATA_REASON` 댕글링 참조 0건 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 0건) **planner 턴**에서 `spec/5-system/14-external-interaction-api.md` §R17 잔여② 문단(L1565-1572 부근)에 "닫는 조건은 프런트 렌더 경로(UI)에 한정되며, API 직접 호출 경로는 별도 잔여 항목([링크])" 경계 문장 추가 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 계획된 항목을 그대로 집행
2. (선택) `spec/5-system/14-external-interaction-api.md:1392` R17 헤딩에 2026-08-20 카브아웃 폐지 날짜 추가
3. (선택) `spec/2-navigation/14-execution-history.md` 응답 예시에 egress 마스킹 각주 1줄 추가
4. (선택, 다음 편집 기회) `spec/5-system/6-websocket-protocol.md` 에 `## Overview (제품 정의)` 섹션 신설해 형제 문서와 구조 통일
5. (선택, project-planner 검토) 마스킹 마커 카탈로그가 계속 자라면 `spec/conventions/secret-masking.md` 전용 규약 문서로 SoT 승격 검토
