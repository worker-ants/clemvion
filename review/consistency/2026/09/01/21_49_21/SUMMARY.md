# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, CRITICAL 0건)

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나 WARNING 3건(위임 SoT 불일치·용어 신조어화·재개 신호 근거 미동기화) 존재, cross_spec 이 MEDIUM 판정

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 목적지-필드(어느 코드가 `Execution.error` vs `NodeExecution.error` 에 실리는지) 위임 문장이 가리키는 `3-error-handling.md §1` 은 실제로 그 정보를 갖지 않음 — 진짜 SoT 는 `spec/1-data-model.md`(:474, :557-565) 인데 이 draft 가 `spec_impact` 에서 명시적으로 철회 | draft `## 변경 제안` 4번째 불릿 ("카탈로그 SoT(`5-system/3-error-handling.md §1`)에 맡긴다") | `spec/5-system/3-error-handling.md` §1(카탈로그·분류만 다룸, 필드 목적지 서술 0건) vs `spec/1-data-model.md:474, :557-565`("Execution.error ↔ NodeExecution.error 관계" 표) | 위임 문장에 `1-data-model.md` 링크 병기(2차 convention_compliance 대안 (b) 채택), 또는 "필드에 실리는지" 표현 자체를 삭제해 목적지-필드 클레임을 하지 않음 |
| 2 | convention_compliance + naming_collision (동일 위배, 강한 등급으로 통합) | 신규 "층(layer)" 표현이 동일 축(노드 핸들러 vs 엔진)에 이미 정착한 "레벨"/"레이어" 용어와 병존 — SoT 문서·구현 JSDoc·테스트 3곳 모두 "레이어"/"레벨" 사용 | draft `## 변경 제안` 하위 불릿 ("노드 핸들러 층" / "엔진 층") | `error-codes.md` §3("엔진 레벨 error.code")·§4.1("엔진 레벨", "레이어가 다르다") · `error-codes.ts:116,125`("엔진 레이어", "레이어는 타입에 드러나고") · `error-codes.spec.ts:57`("레이어를 타입으로 가른다") · `3-error-handling.md:112`("엔진 레벨", "노드 출력 레이어") | "층" → "레이어" 또는 "레벨" 로 교체해 SoT 문서·코드 JSDoc·테스트와 표기 통일. "층위 혼동을 경계"하는 문서 취지와 정면 배치되므로 병합 전 반드시 수정 |
| 3 | plan_coherence | "재개 신호"(세 번째 자매 const 발생 시점) 판단에 필요한 새 사실(`WsErrorCode` 가 `EngineErrorCode` 보다 7주 앞선 2026-07-07/`daaae64c2`/#843 에 이미 별도-const 로 신설된 선례)이 target 스스로 지정한 SoT(착수 근거 plan)에 미반영 — draft 가 `complete/` 로 이동하면 소실 | draft `### 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다` 문단 ("재개 신호는 세 번째 자매 const 가 생길 때") | `plan/in-progress/spec-conventions-engine-error-code-surface.md` 체크리스트 (`WsErrorCode` 언급 0건, `grep -rn "WsErrorCode" spec/ plan/` 결과 draft 1곳뿐) | 착수 근거 plan 체크리스트에 `WsErrorCode` 선재 사실(도입 시점·별도 파일 여부)과 "세 번째 자매 const" 정의(같은 파일 한정 여부)의 모호성을 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 선재 drift(`1-data-model.md:474` 엔진 인프라 코드 무차별 나열, `3-error-handling.md §1.4` 10종 단일 나열) 미해결 상태가 이번 판에도 그대로 남음 — draft 가 명시적으로 범위 제외 선언하고 착수 plan 후속 항목에 등재됨 | draft `## Rationale` "다른 문서의 선재 drift는 여기서 안 고친다" | 없음(추적 확인만) |
| 2 | cross_spec | `4-execution-engine.md` §Rationale(line 1143, 1796-1800) 결정문과 이번 병기가 단방향(one-directional) 스코핑 상태로 남음 — draft 가 "경쟁하지 않는다"고 명시적으로 유보 | draft "### 범위 한정 — 일반 원칙 선언이 아니다" | 없음(추적 확인만) |
| 3 | convention_compliance | 새 SoT 위임 불릿의 "SoT" 표기 위치가 §Overview 기존 "책임 경계" 목록 스타일(링크 뒤 괄호)과 다를 수 있음 | draft `## 변경 제안` 4번째 불릿 | 실제 diff 작성 시 기존 "링크 + (SoT)" 스타일로 통일 |
| 4 | plan_coherence | 두 plan(`spec-draft-error-code-two-surfaces.md`, `spec-conventions-engine-error-code-surface.md`) 의 종결 동기화 절차(체크리스트 갱신·`complete/` 이동 시점)가 draft 본문에 명시돼 있지 않음 (직전 라운드 대비 변화 없음, carryover) | draft 전체 | spec 반영 시 착수 plan 체크리스트 1번째 항목 `[x]` 처리, 후속 항목 남아있으므로 착수 plan 은 `in-progress/` 유지하고 draft 만 완료 처리 |
| 5 | naming_collision | (관점 6개 전수 확인) 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·파일 경로 신규 신설 없음 — "층" 이슈는 위 WARNING #2 로 통합 | draft 전체 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | 목적지-필드 위임 SoT 불일치(WARNING) + 추적 중인 선재 drift/단방향 스코핑 2건(INFO) |
| rationale_continuity | NONE | 위반 없음 — 기각된 대안 미재도입, 원칙 준수, 번복 이력 근거 명시, 암묵 가정 없음 |
| convention_compliance | LOW | "층" 용어 신조어화(WARNING) + SoT 표기 스타일 차이(INFO) |
| plan_coherence | LOW | `WsErrorCode` 선재 사실 SoT plan 미반영(WARNING) + 두 plan 종결 동기화 미명시(INFO) |
| naming_collision | NONE | 신규 식별자 없음, "층" 이슈는 convention_compliance 와 중복(WARNING #2 로 통합) |

## 권장 조치사항
1. (최우선) 위임 문장에 `spec/1-data-model.md` 링크를 병기하거나 목적지-필드 클레임 자체를 삭제 — 다음 독자가 잘못된 SoT를 따라가는 것을 방지
2. "층(layer)" → "레이어" 또는 "레벨" 로 교체해 `error-codes.md`·`error-codes.ts`·`error-codes.spec.ts`·`3-error-handling.md` 와 용어 통일
3. 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`) 체크리스트에 `WsErrorCode` 선재 사실(2026-07-07/`daaae64c2`/#843) 추가 — "세 번째 자매 const" 재개 신호 판정 시점에 이 draft 를 다시 열지 않아도 되게
4. (선택) SoT 표기 스타일 통일, spec 반영 커밋에서 두 plan 의 종결 상태를 draft 본문에 명시