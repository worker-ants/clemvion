# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, §R17 잔여② flip 대상 라인 목록 누락(3개 checker 가 독립적으로 같은 지점을 지목)과 Re-run 모달의 "강제" 문언 미충족 가능성이 겹쳐 실제 spec 반영 시 자기모순·기능 간극으로 이어질 실질 리스크가 있음

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, plan_coherence | §R17 "잔여②" flip 대상 라인 목록(1527·1539·1542·1549·1569·1620·1642)이 실제 재작성 필요 범위보다 좁다. 특히 1571–1576행("판단 기준: 마스킹 대상이 외부로도 나가는가... **두 사례가 정확히 그 두 갈래다**")은 `Execution.inputData` 를 카브아웃 쪽 대표 예시로 못박은 핵심 문장인데 목록에서 빠져, ④ 반영 후 "해소(2026-08-20)" 표제 바로 아래 이 현재형 단정문이 그대로 남아 같은 절 안에서 자기모순이 생긴다 | `plan/in-progress/spec-draft-inputdata-egress-masking.md` §④ 및 `## 문서별 변경안` 표 6행 | `spec/5-system/14-external-interaction-api.md:1539-1578` (잔여② 블록 전체, 특히 1571-1576) | ④ 의 라인 목록에 1571–1576행("폼 경로는 카브아웃으로 풀 수 없다" 불릿 전체)을 명시로 추가. "두 사례가 정확히 그 두 갈래다" 문장은 삭제하거나, 판단 기준을 "외부 노출 **또는** 미러 유지비용" 2축으로 재정의했음을 명시하는 caveat 으로 교체 |
| 2 | rationale_continuity | Re-run 모달 caveat(target ②)은 "마스킹 마커면 프리필하지 않고 빈 값으로 안내"만 하며 제출을 막는 검증 게이트가 없다. 원 결정문(§R17 "닫는 조건")은 "재입력을 **강제**하는 가드"를 명시했는데, 빈 필드로 그대로 제출하면 마커 리터럴(`'***'`) 대신 **빈 문자열**이 실제 입력이 되어 원래 CRITICAL 이 문제 삼은 "조용한 기능 오염"이 값만 바뀐 채 남을 수 있다 | `plan/in-progress/spec-draft-inputdata-egress-masking.md` §② (Re-run 모달 caveat 블록) | `spec/5-system/14-external-interaction-api.md:1561-1562` ("닫는 조건: ... 재입력을 강제하는 가드가 선행되어야 한다") | (a) §R17 "닫는 조건" 재작성분(target ④)에 "강제 = 마커 리터럴 재제출 차단이며 값 존재 강제(required 검증)는 별개 책임"이라는 caveat 을 명시하거나, (b) Re-run 모달에 마스킹 필드 미입력 시 제출 차단/경고를 추가해 "강제" 문언과 실제 동작을 일치 |
| 3 | plan_coherence | 형제 plan(같은 worktree, developer 소유) `eia-inputdata-marker-guard.md` 의 `spec_impact`(4개 파일)·"planner 턴" 체크리스트(3개 spec 문서)가 target 이 전수 스캔으로 확장한 7개 파일 스코프를 반영하지 못했다. target 승인 후에도 갱신하지 않으면 실제 spec diff(7파일)와 developer plan 선언 범위(4파일)가 어긋난 채 남는다 | `plan/in-progress/eia-inputdata-marker-guard.md` frontmatter `spec_impact`(L8–12) 및 "## 범위" 체크리스트(L109–111) | `plan/in-progress/spec-draft-inputdata-egress-masking.md` frontmatter `spec_impact`(7개 파일, L8–15) | target 이 승인되어 spec 에 반영되는 시점(또는 직전)에 `eia-inputdata-marker-guard.md` 의 `spec_impact` 에 `spec/5-system/12-webhook.md`·`spec/5-system/6-websocket-protocol.md`·`spec/4-nodes/1-logic/12-background.md` 3개를 추가하고 체크리스트도 동기화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, naming_collision | "잔여 ②" 표제의 취소선(strikethrough) 적용 여부가 명시되지 않음. 형제 "잔여 ①" 은 `~~잔여 ①~~ 해소(...)` 로 취소선을 그어 닫힘을 표시하는 컨벤션을 이미 세워 뒀는데, target ④ 는 표제 뒤 문구만 "해소(2026-08-20)"로 바꾸라 적어 취소선 적용이 불명확 | `plan/in-progress/spec-draft-inputdata-egress-masking.md` §④ 첫 항목 | `~~잔여 ②~~ 해소(2026-08-20)` 형태로 통일하도록 draft 지시 보강 |
| 2 | cross_spec | Rationale 의 "6개 spec 파일 · 14개 지점" 수치가 target 자신의 "미러 전수" 표(#1~#7)를 단순 합산한 13개와 어긋난다. 지점 수 자체를 실측 근거로 강조하는 문서라 정합성이 상대적으로 눈에 띈다 | `plan/in-progress/spec-draft-inputdata-egress-masking.md` `## Rationale > 왜 카브아웃을 유지하지 않나` | 커밋 직전 지점 수를 재확인해 "13" 또는 갱신치로 정정하거나, 14의 근거가 된 14번째 지점을 한 줄로 명시 |
| 3 | convention_compliance | `## Overview` 섹션 부재 — CLAUDE.md 권장 3섹션(Overview/본문/Rationale) 구조에서 벗어나 보이나, 직계 선행 문서(`spec-draft-eia-fanout-masking.md`)도 동일 패턴이라 저장소 관행 안의 이탈이며 강제 가드도 없음 | `plan/in-progress/spec-draft-inputdata-egress-masking.md` 최상단 (제목 직후) | 강제 아님. 일관성을 위해 1~2문단 `## Overview` 추가 권장 |
| 4 | convention_compliance | `swagger.md` §3 예외 조항이 정확히 겨냥하는 `execution-response.dto.ts` 의 `inputData` JSDoc(현재 "값-패턴 마스킹 대상이 아니다")이 전환 후 처음으로 "요약+SoT 링크" 패턴을 따라야 하는 쪽으로 뒤집히는데, target 은 죽은 식별자 참조 삭제만 언급하고 재작성 형태는 지시하지 않음 (spec 범위 밖, developer 인수인계 리스크) | `plan/in-progress/spec-draft-inputdata-egress-masking.md` Rationale 상단 (`MASKED_INPUT_DATA_REASON` 처리 각주) | draft ② 또는 Rationale 에 "DTO JSDoc 은 swagger.md §3 형식(요약+SoT 링크)으로 재작성한다" 한 줄 추가해 인수인계 유실 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 인용 7파일·8위치 전부 실측 일치. 유일 리스크는 §R17 잔여② flip 범위가 표의 7행 번호보다 넓다는 점(WARNING #1 에 통합) |
| rationale_continuity | MEDIUM | 판단 기준 문장(1571-1576) 누락으로 인한 자기모순 위험 + Re-run 모달의 "강제" 문언 미충족 가능성, 둘 다 실질적 |
| convention_compliance | LOW | `spec-draft-*.md` 관행 충실히 준수, 규약 직접 위반 없음. Overview 생략·swagger 인수인계는 INFO |
| plan_coherence | LOW | target 자체는 정합적. 형제 plan 의 `spec_impact` drift 1건이 유일 실질 결함 |
| naming_collision | LOW | 새 식별자 도입 없음, 인용 전부 실측 일치. 취소선 컨벤션 명시 누락만 INFO |

## 권장 조치사항
1. target ④ 의 flip 대상 라인 목록에 1571–1576행("판단 기준"/"두 사례가 정확히 그 두 갈래다" 문단)을 명시로 추가하고, 이 문장을 삭제하거나 2축 재정의 caveat 으로 교체한다 (WARNING #1).
2. §R17 "닫는 조건"의 "강제" 문언과 Re-run 모달의 실제 동작(안내만, 제출 차단 없음) 간 간극을 caveat 으로 명시하거나 모달에 제출 차단/경고를 추가한다 (WARNING #2).
3. `eia-inputdata-marker-guard.md` 의 `spec_impact`·체크리스트를 target 의 7파일 스코프로 동기화한다 (WARNING #3).
4. (선택) "잔여 ②" 취소선 통일, "14개 지점" 수치 재확인, Overview 섹션 추가, swagger.md §3 DTO 재작성 지침 한 줄 추가.
