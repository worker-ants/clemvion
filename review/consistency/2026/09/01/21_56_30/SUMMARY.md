# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker(cross_spec / rationale_continuity /
convention_compliance / plan_coherence / naming_collision) 전원 성공, 전문 확보 완료(전원
`success`, 인라인 전문 = 디스크 파일 내용과 일치, 재시도 필요 항목 없음).

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-error-code-two-surfaces.md`)은 앞선 5라운드가
지적한 CRITICAL/WARNING 을 모두 해소한 6판째 상태이며, 이번 라운드의 5개 checker 전원이
CRITICAL/WARNING 0건, INFO 만 보고했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `## 변경 제안` "경계는 비대칭이다" 서술이 `error-codes.ts` `EngineErrorCode` JSDoc 의 "엔진 레이어" 이분법 프레이밍과 여전히 어긋난 채 남는다(draft 가 반증한 것과 같은 오분류가 소스 코드 주석 쪽엔 남음) | `## 변경 제안` 3번째 불릿, `### 세 번 고쳤다` / 충돌 대상: `codebase/backend/src/nodes/core/error-codes.ts:114-115` | 필수 조치 아님. 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`) "## 할 일 → 후속(별도 planner 턴)" 에 `EngineErrorCode` JSDoc 정정 검토 항목 추가 권장 |
| 2 | rationale_continuity | 세 차례 기각한 대안이 저장소 하우스 스타일("**기각한 대안 — X**:" 라벨) 없이 프로즈로만 서술돼 발견 가능성이 낮음 | `## Rationale` → "### 왜 자매 const 인가" / "### 세 번 고쳤다" | `## Rationale` 에 "**기각한 대안 — §Overview 목적지 필드 매핑**:" / "**기각한 대안 — 층 기반 이분법**:" 라벨 두 bullet 추가(내용은 이미 있음, 라벨만) |
| 3 | rationale_continuity | `WsErrorCode` "세 번째 자매 const" 판정 보류의 전체 맥락이 draft 본문엔 1줄로 압축돼, `complete/` 이동 후 "왜 모호한지" 근거가 사라질 수 있음 | `## Rationale` → "### 판단 기준은 이번에 안 쓴다" 말미 | 괄호 안에 "— 같은 파일 기준인지 저장소 전체 기준인지부터 정할 것" 구절 추가 |
| 4 | convention_compliance | `## 변경 제안` 도입부("두 surface 가 존재한다는 사실만 적는다")와 3번째 불릿(비대칭 경계 서술)의 표현 수위가 미세하게 어긋남(self-consistency) | `## 변경 제안` 도입부 vs 3번째 불릿 / `## Rationale` "존재한다는 사실만" 문구 | 도입부를 "존재·관계·경계 성격만 적는다"로 완화하거나 불릿3 을 더 축약 — 실질 내용 변경 불필요 |
| 5 | convention_compliance | 5차 라운드 INFO(SoT 표기 스타일 불일치)는 해당 문장 삭제로 자동 해소 — 확인용 기록 | (해당 문장 삭제됨) | 조치 불요 |
| 6 | plan_coherence | "판단 기준" 결정이 target 과 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`) 두 문서에 거의 동일한 전문으로 중복 — target 자신이 지적한 위험을 스스로 반복 | `plan/in-progress/spec-draft-error-code-two-surfaces.md` §"판단 기준은 이번에 안 쓴다" | 한쪽을 짧은 포인터로 축약해 SoT 단일화(project-planner 턴에서 반영 시 정리 가능) |
| 7 | plan_coherence | 같은 spec 파일(`error-codes.md`)을 동시에 겨누는 다른 in-progress plan(`spec-update-node-cancellation-shutdown-classification.md` §3 `AbortError` 등재 위임)과 상호 참조 없음 | `## 변경 제안`(§Overview 범위 선언) | target 또는 source plan "관련" 절에 해당 plan 의 §3 위임 항목 포인터 추가 권장 |
| 8 | plan_coherence / naming_collision | "세 번째 자매 const" 재개 신호가 이미 조건부로 성립해 있을 수 있음 — `WsErrorCode` 가 이미 존재하고 스스로 "계층이 다르다"고 명시함에도 판정을 재개 시점으로 유보 | `## Rationale` → "### 판단 기준은 이번에 안 쓴다" 마지막 문장 | 필수 아님. (a) 같은 파일 자매 const 논지 밖인지 (b) central-vs-sibling 세 번째 사례로 셀지 한 줄 판정 권장 |
| 9 | naming_collision | `pgErrorCode`/`cafe24ErrorCode` 는 `*ErrorCode` 이름 패턴만 유사, 실질 충돌 없음(기존 spec 이 이미 구분 명시) | `spec/conventions/node-output.md:183`, `spec/4-nodes/4-integration/4-cafe24.md:266,285` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 5차 WARNING(잘못된 SoT 위임 포인터)은 해당 문장 삭제로 해소 확인. 새 INFO 1건(spec-대-code JSDoc 프레이밍 drift, 시스템 동작 영향 없음) |
| rationale_continuity | LOW | 기각한 대안 서술은 정확하나 하우스 스타일 라벨 미사용(INFO), WsErrorCode 유보 맥락 압축(INFO). 원칙 재도입·무근거 번복 없음 |
| convention_compliance | LOW | 5개 관점(명명/출력포맷/문서구조/API문서/금지항목) 전원 위반 없음. self-consistency INFO 1건만 |
| plan_coherence | LOW | 착수 근거 plan 과의 결정 정합은 확인됐으나, 결정 SoT 이원화·병행 plan 미상호참조·재개신호 조건부 성립 가능성 INFO 3건 |
| naming_collision | NONE | 신규 식별자 없음(기존 const 사후 문서화). `EngineErrorCode` spec 최초 등재, 의미 충돌 0건 |

## 권장 조치사항
(BLOCK 사유 없음 — 아래는 선택적 정리 권장, 우선순위순)
1. 착수 근거 plan "## 할 일 → 후속" 에 `error-codes.ts` `EngineErrorCode` JSDoc 정정 검토 항목 등재 (INFO #1)
2. `## Rationale` 에 "**기각한 대안 — X**:" 라벨 2건 추가 (INFO #2, 내용 이미 존재 — 라벨만)
3. `plan/in-progress/spec-draft-error-code-two-surfaces.md` 와 착수 근거 plan 간 "판단 기준" 결정 중복 제거 — 한쪽을 포인터로 (INFO #6)
4. `spec-update-node-cancellation-shutdown-classification.md` §3 위임 항목과 상호 참조 추가 (INFO #7)
5. `WsErrorCode` 가 "세 번째 자매 const" 논지 안인지 한 줄 판정 (INFO #3, #8)
6. `## 변경 제안` 도입부와 3번째 불릿의 표현 수위 다듬기 (INFO #4)