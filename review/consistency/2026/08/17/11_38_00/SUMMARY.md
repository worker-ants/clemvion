# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (WARNING 5건, INFO 다수)

## 전체 위험도
**MEDIUM** — 기능적 회귀·spec 자기모순은 없으나, 이번 라운드(EIA 마스킹, PR #1177~#1180)가 넓힌 마스킹 계약이 (1) 자매 spec 문서 하나(`12-background.md` §8.2)에 미반영, (2) EIA 본문(§5/§6/§8)에 요약 없이 Rationale(R17)에만 존재, (3) 두 conventions 파일(node-output.md/swagger.md)이 SoT 로 feature spec 을 역참조하는 구조적 이상, (4) `nodeName` 잔존 1건 등 문서 완전성 갭이 다수 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드는 Critical 이 없어 인계 대상이 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `background-runs.service.ts`(#1180)가 `toNodeExecutionDto`의 `inputData`/`outputData` 마스킹 범위를 넓혔는데 자매 spec `12-background.md` §8.2 는 `error` 마스킹만 언급한 채 stale | `spec/5-system/14-external-interaction-api.md` §R17 (표면 (6) `BackgroundRunsService`) | `spec/4-nodes/1-logic/12-background.md` §8.2 `nodeExecutions.data` 행 | `nodeExecutions.data` 행에 `outputData`/`inputData` egress 마스킹 문구 추가(`redactStoredDataForResponse`, DB 원문 보존, 노드 레벨이라 `Execution.inputData` 카브아웃 미적용) 한 문장 삽입 |
| 2 | convention_compliance | 전사 정정("`nodeName`→`nodeLabel`", #1176/#1180)에서 `15-chat-channel.md` 한 곳이 누락되어 근절 대상 어휘가 예시 문장에 재도입 위험 | `spec/5-system/15-chat-channel.md` §R-CC-15 (line 659) | `spec/5-system/6-websocket-protocol.md` line 191, `spec/5-system/3-error-handling.md` line 258 (전사 정정 완료 선언) | `nodeId` / `nodeName` → `nodeId` / `nodeLabel` placeholder 로 정정 |
| 3 | convention_compliance | 이번 라운드 핵심 계약(내부 읽기 경로 + WS emit 값-패턴 마스킹)이 EIA 본문 §5/§6/§8 어디에도 요약 pointer 없이 Rationale(R17)에만 존재 — CLAUDE.md "본문=기술명세/Rationale=배경" 역할 분리 위반 소지 | `spec/5-system/14-external-interaction-api.md` §5/§6/§8 (마스킹/R17/redact grep 0건) | CLAUDE.md 정보 저장 위치 표; 동일 문서 §6 line 788 의 기존 pointer 패턴 | §8 에 "8.6 응답/이벤트 값-패턴 마스킹(egress)" 서브섹션 신설(3~5줄 요약 + R17 링크) 또는 §5/§6 각 엔드포인트에 인라인 pointer 추가 |
| 4 | convention_compliance | cross-cutting 마스킹 정책의 SoT 가 `spec/conventions/`가 아니라 feature spec 의 Rationale(EIA §R17) — node-output.md·swagger.md 가 정식 규약이면서 feature spec 을 SoT 로 역참조 | `spec/conventions/node-output.md` Principle 7, `spec/conventions/swagger.md` §3 | CLAUDE.md "정식 규약 = spec/conventions/<name>.md"; 기존 패턴 `spec/conventions/data-hydration-surfaces.md` | 시급하지 않으면 현행 유지(링크는 정확·동작함). 다음 EIA 마스킹 변경 시 `spec/conventions/egress-masking.md`(가칭) 신설해 R17 서술 이관 검토 |
| 5 | rationale_continuity (연계 INFO, convention_compliance WARNING 과 결합) | 다수의 의도적 "잔여" 항목(§R17 잔여②③, `SECRET_LEAK_PATTERNS` 갭)이 열려 있는 채로 "표면 여섯·컬럼 둘" 카운트가 향후 라운드에서 drift 재발 이력(4→넷→여섯)이 있음 | `spec/5-system/14-external-interaction-api.md` §R17 | 자기 서술(과거 라운드 카운트 정정 이력) | round2 작업 계획에 "§R17 열거 카운트 동반 갱신" 체크리스트 항목 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "표면 여섯, 컬럼 둘" 서술이 표면에 따라 실제 컬럼 수가 2(Execution 레벨)~3(NodeExecution 레벨)로 달라 오독 소지(모순은 아님) | `spec/5-system/14-external-interaction-api.md` §R17 | 컬럼 수가 표면별로 다름을 명시하면 오독 예방 |
| 2 | convention_compliance | swagger.md 신설 예외의 "9곳 이상"/"1~2문장" 서술이 실측(8곳, 3~4절 1문단)과 정확히 맞지 않음 | `spec/conventions/swagger.md` §3 (line 265-267) | 수치·문장 수 기준 재확인 후 정정 또는 기준 명시 |
| 3 | convention_compliance | `6-websocket-protocol.md` 에 `## Overview` 섹션 부재(3섹션 컨벤션 미준수, 이번 라운드가 만든 결함은 아님) | `spec/5-system/6-websocket-protocol.md` line 20-26 | 다음에 이 파일을 손댈 때 Overview 섹션 추가 권고 |
| 4 | plan_coherence | workflow-assistant 도구 마스킹 의미 우선순위가 target·plan 양쪽에서 일관되게 "별도 결정"으로 미결 유지 | `spec/5-system/14-external-interaction-api.md` §R17 잔여③; `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 조치 불요. round2 착수 시 구현 전 사용자 결정 선행 |
| 5 | plan_coherence | `kb:`/`background:run:` WS 채널의 값-패턴 마스킹 미적용이 target·plan 양쪽에서 일관되게 "아직 안 함"으로 남음 | `spec/5-system/6-websocket-protocol.md` line 126·153-154·193 | 조치 불요 |
| 6 | plan_coherence | 두 순수 운영/정책 판단 항목(외부 구독자 breaking change, 사후 대응)이 코드 범위 밖으로 열려 있음 | `plan/in-progress/eia-terminal-payload.md`; `plan/in-progress/spec-draft-eia-62-waiting-payload.md` | round2 스코프에서 배제 유지 |
| 7 | naming_collision | `sanitize-error-message.ts` 동일 basename 이 두 디렉터리에 존재(JSDoc 교차참조로 이미 방지됨) | `codebase/backend/src/shared/utils/` vs `.../modules/execution-engine/` | 조치 불요(우선순위 낮은 리네임 옵션만 존재) |
| 8 | naming_collision | WS ack `resumed`(boolean) 와 `NodeExecution` 상태 enum 값 `"resumed"` 이름 중복(spec 각주로 이미 disambiguate) | `spec/5-system/6-websocket-protocol.md` §4.2 | 조치 불요. 신규 필드에 `resumed` 재사용 지양 권고 |
| 9 | naming_collision | 인증 엔드포인트 3개(forgot/reset-password, resend-verification)가 두 SoT 문서에 완전 중복 정의(내용은 일치) | `spec/5-system/1-auth.md` §5 vs `spec/2-navigation/10-auth-flow.md` | 필요 시 `1-auth.md` §5 를 포인터 참조로 축약하거나 Overview 예외 문구 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `12-background.md` §8.2 가 확장된 마스킹 범위(#1180)를 반영 못해 stale (WARNING 1건). 그 외 전 축 실측 일치 |
| rationale_continuity | NONE | CRITICAL/WARNING 없음. 결정 번복마다 근거·날짜 동반, 기각 대안 재검증 등 연속성 매우 양호. "잔여" 항목 열거 카운트 동반 갱신 필요(INFO) |
| convention_compliance | MEDIUM | `nodeName` 잔존(WARNING), EIA 본문에 핵심 계약 pointer 부재(WARNING), conventions 가 feature spec 을 SoT 로 역참조하는 구조(WARNING). CRITICAL 은 아님(링크는 정확) |
| plan_coherence | NONE | plan 과 target 이 미결 항목까지 정확히 미러. 충돌·우회·전제 파괴 없음 |
| naming_collision | LOW | 새 식별자가 기존 이름과 다른 의미로 충돌하는 사례 없음. 3건 모두 이미 disambiguate 되었거나 순수 중복(다른 리뷰어 영역) |

## 권장 조치사항
1. `spec/4-nodes/1-logic/12-background.md` §8.2 `nodeExecutions.data` 행에 `outputData`/`inputData` egress 마스킹 문구 추가 (cross_spec WARNING #1) — planner 턴에서 `spec_impact`에 이 파일 포함.
2. `spec/5-system/15-chat-channel.md` §R-CC-15 의 `nodeName` 예시를 `nodeLabel` 로 정정 (convention_compliance WARNING #2).
3. `spec/5-system/14-external-interaction-api.md` §8 에 "응답/이벤트 값-패턴 마스킹(egress)" 요약 서브섹션 신설 — 본문·Rationale 역할 분리 회복 (convention_compliance WARNING #3).
4. (선택, 비긴급) 다음 EIA 마스킹 변경 시 `spec/conventions/egress-masking.md`(가칭) 신설을 검토해 SoT 역참조 구조 해소 (convention_compliance WARNING #4).
5. round2 작업 계획에 "§R17 표면/컬럼 열거 카운트 동반 갱신" 체크리스트 항목을 명시 (rationale_continuity INFO).
6. INFO 항목(swagger.md 수치 정정, WS Overview 섹션 추가, 인증 엔드포인트 중복 정리)은 우선순위 낮음 — 후속 라운드에서 처리.