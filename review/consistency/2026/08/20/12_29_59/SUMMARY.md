# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건 (spec_impact 누락 + 서술 flip 미반영)

## 전체 위험도
**HIGH** — draft 자체(4개 지정 문서 내)는 정합적이지만, draft 가 스스로 "이미 네 문서에 미러됐다"고 전제한 범위 밖에 최소 2개 문서가 §R17 카브아웃을 SoT 로 직접 인용하며, flip 후 그 문서들의 서술이 즉시 거짓이 되는데도 `spec_impact` 에서 빠져 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/5-system/12-webhook.md` §5.3 이 "ingestion 층이 `inputData` 의 유일한 방어"라고 §R17 잔여 ②를 근거로 명시 — flip 후 즉시 거짓이 되는데 target `spec_impact`(4개 문서)에 미포함 | draft 전체 / frontmatter `spec_impact`, Rationale "왜 카브아웃을 유지하지 않나" | `spec/5-system/12-webhook.md:317-329` §5.3 | `spec_impact` 에 `12-webhook.md` 추가 + §5.3 캐비엇을 "ingestion + egress 값-패턴 마스킹 이중 방어 (2026-08-20)" 로 갱신, §R17 잔여 ② 앵커명과 동기화 |
| 2 | cross_spec | `spec/5-system/6-websocket-protocol.md` §4.1 "가르는 축은 필드 이름이 아니라 레벨이다" — flip 후 이 축(Execution 레벨 카브아웃) 자체가 소멸하는데 target `spec_impact` 미포함 | draft 전체 / target ①의 새 세계관("두 컬럼이 이제 같은 규칙") | `spec/5-system/6-websocket-protocol.md:205-208` | `spec_impact` 에 `6-websocket-protocol.md` 추가 + 해당 문단을 "Execution 레벨도 이제 egress 마스킹 대상 — '레벨로 가른다' 축 폐기(2026-08-20)" 로 재작성 |

## planner 인계 (권한 밖 Critical)

> (없음) — 위 Critical 2건은 spec-draft 자체(`spec/` 문서 간 미러 동기화)에 관한 것으로, 이 draft 를 작성 중인 호출자(project-planner)의 쓰기 권한 안에서 직접 정정 가능하다. developer 권한 밖 spec drift 유형이 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | §R17 "레벨이 가른다" 판단 기준 비교표(`Execution.inputData (REST) \| 안 함`)가 target 변경 목록 ④에서 누락 — flip 후 같은 문서(§R17) 안에서 자기모순 발생 | target ④ (line 102-104 부근, `1527`행 언급만 있고 비교표는 미언급) | `spec/5-system/14-external-interaction-api.md` §R17 "레벨이 가른다" 비교표 | ④ 변경 목록에 비교표 갱신(`Execution.inputData (REST)` 행 `함`으로, 근거는 "마커 가드 선행") + "카브아웃은 되쓰이는가가 정한다" 프레임 문장도 갱신 대상에 포함 |
| 2 | cross_spec | `spec/4-nodes/1-logic/12-background.md` §8.2 "재제출 카브아웃은 Execution 레벨 한정" 서술이 flip 후 시제 어긋남(핵심 주장은 참, 괄호 설명만 낡음) | draft 전체 Rationale 전제 | `spec/4-nodes/1-logic/12-background.md:246` | "카브아웃은 Execution 레벨 한정이었고(2026-08-20 이전), 현재는 컬럼 무관 전면 마스킹"으로 과거형 정정 |
| 3 | plan_coherence | target 이 "닫는 조건 충족"을 완료형(`가진다`/`전환했다`/`비활성된다`, 날짜 2026-08-20 명시)으로 서술하지만, 형제 developer plan `eia-inputdata-marker-guard.md` 의 해당 체크박스 2개(Re-run 모달 마커 가드·에디터 히스토리 로드 마커 가드)와 backend 전환·캐너리 반전이 전부 `[ ]` 미완료 | §① 변경문·§② 변경문·§③ 변경문(현재형·완료형 서술) | `plan/in-progress/eia-inputdata-marker-guard.md` §범위 (미완료 체크박스 4개) | 두 plan 이 같은 worktree 로 함께 landing 됨을 target 에 한 줄 명시하거나, `--impl-prep` 재확인 전까지 spec 문구에 "이 커밋과 함께 착지하는 마커 가드에 의해" 전방 참조 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Rationale "네 문서"라는 수치가 실측(최소 6~7곳: 위 CRITICAL 2건 + WARNING 1건 포함)과 불일치 | `## Rationale` → "왜 카브아웃을 유지하지 않나" | 수치를 실측값으로 정정하고 CRITICAL 2건을 `spec_impact` 에 반영 |
| 2 | cross_spec | `spec/3-workflow-editor/3-execution.md` §2.2 는 현재 카브아웃 서술이 없음(신규 캐비엇 삽입일 뿐, 뒤집는 것 아님) — 긍정 확인, 조치 불요 | target ③ | (조치 불요, 참고 기록) |
| 3 | rationale_continuity | "외부 노출 여부가 판단 기준" 원칙의 확장/우회(가드 비용 0에 가까울 때는 카브아웃이 필요조건 아님)를 명시적으로 짚지 않음 | "왜 카브아웃을 유지하지 않나" 절 | §R17 "판단 기준"과의 관계를 명시하는 한 문장 보강 |
| 4 | convention_compliance | 변경 문단 ①·③의 교차참조가 `(EIA §R17)` 등 평문으로 축약돼 있어 같은 draft 내 ②·④(마크다운 링크)와 표기 비대칭 | target ①·③ (line 47-51, 87-91) | `spec/` 반영 시 ①·③도 `[EIA §R17](../5-system/14-external-interaction-api.md#...)` 형태 링크로 복원 |
| 5 | convention_compliance / naming_collision | `rerun-modal.tsx` 가 `14-external-interaction-api.md` `code:` 에만 등재되고, §10.2(Re-run 모달 1차 spec 본문)를 담은 `13-replay-rerun.md` 자신의 `code:` 에는 미등재(기존부터 있던 갭) | target ④ (line 102-104) | `spec/5-system/13-replay-rerun.md` frontmatter `code:` 에도 `rerun-modal.tsx` 추가 고려 (필수 아님, planner 재량) |
| 6 | plan_coherence | `spec-sync-external-interaction-api-gaps.md` 의 별도 미해결 항목(workflow-assistant LLM 도구의 3필드 약한 마스킹, 키-패턴 vs 값-패턴 우선순위)은 target 범위와 겹치지 않음 — 확인 차 기록 | (target 밖) | 조치 불요, 교차 확인만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `12-webhook.md`·`6-websocket-protocol.md` 가 §R17 카브아웃을 SoT 로 직접 인용하는데 target `spec_impact` 밖 — flip 후 즉시 모순 |
| rationale_continuity | LOW | §R17 자체 "레벨이 가른다" 비교표가 변경 목록에서 누락 — 전파 누락, 결정 번복 아님 |
| convention_compliance | LOW | 규약 위반 없음, 링크 표기 비대칭·`code:` 대칭성만 INFO |
| plan_coherence | LOW | 4개 지정 문서는 형제 plan·트래커와 부합, 완료형 서술과 미완료 체크박스 간 시점적 간극만 |
| naming_collision | NONE | 신규 식별자 도입 없음(서술 flip 안건), `code:` 등재 비대칭만 INFO |

## 권장 조치사항
1. (BLOCK 해소 우선) `spec_impact` 에 `spec/5-system/12-webhook.md`·`spec/5-system/6-websocket-protocol.md` 추가하고, 두 문서의 §R17 카브아웃 인용 문단을 flip 후 세계관으로 재작성 (Critical #1, #2)
2. §R17 "레벨이 가른다" 판단 기준 비교표를 target ④ 변경 목록에 포함시켜 같은 문서 내 자기모순 방지 (WARNING #1)
3. `12-background.md` §8.2 캐비엇 설명을 과거형으로 정정 (WARNING #2)
4. 완료형 서술과 형제 plan 미완료 체크박스 간 간극에 대해 co-landing 명시 또는 전방 참조 추가 (WARNING #3)
5. INFO 항목(교차참조 링크 표기, `rerun-modal.tsx` code: 대칭성, "네 문서" 수치 정정, 판단 기준 보완 문장)은 여유 있을 때 함께 반영
