# Rationale 연속성 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 없음).

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 `EngineErrorCode` 를
`ErrorCode` 와 층(layer) 기반으로 병기하는 좁은 범위의 spec draft(4라운드째 개정본)다. 아래
4개 관점 전부를 실측·원문 대조로 확인했고 위반을 찾지 못했다.

### 1. 기각된 대안의 재도입 — 없음
`spec/5-system/4-execution-engine.md` §Rationale "Continuation ack client-safe typed error"
(2026-06-14 결정)이 기각한 것은 **`EXEC_*` 값 레벨 prefix**("`EXEC_*` 는 기존 `EXECUTION_*` 과
이중 표기라 기각")다. `EngineErrorCode` 자매 const 도입은 코드 값을 한 글자도 바꾸지 않았고,
target 도 `## 변경 제안` "### 범위 한정 — 일반 원칙 선언이 아니다" 절에서 이 결정과 "경쟁하지
않는다" — 기존 4종을 사후 문서화할 뿐 향후 신규 엔진 코드의 귀속처는 말하지 않는다고 명시적으로
scoping 했다. 이는 1차 `--spec`(`21_30_10`) cross_spec WARNING #2 가 제안한 옵션 (a) 를 그대로
반영한 것이며, 인용된 2026-06-14 결정문 원문("신규 `EXEC_*` prefix 를 만들지 않고 중앙
`ErrorCode` enum 의 기존 `EXECUTION_*` 확장")도 `4-execution-engine.md` 실제 본문과 정확히
일치한다(재확인).

### 2. 합의된 원칙 위반 — 없음
`spec/conventions/error-codes.md` §Overview 자신이 선언한 "카탈로그·분류는 `3-error-handling.md
§1` 이 SoT, 본 문서는 재선언하지 않는다" 원칙을 target 은 그대로 지킨다 — 목적지 필드
(`output.error.code`/`Execution.error`/`NodeExecution.error`)를 §Overview 에 직접 적지 않고
카탈로그 SoT 로 위임한다. 이는 2차 `--spec`(`21_36_28`) convention_compliance WARNING(§Overview
가 위임해 둔 카탈로그 사실을 재선언한다는 지적)을 정확히 해소한 결과다(원문 대조 확인:
`review/consistency/2026/09/01/21_36_28/convention_compliance.md`).

### 3. 결정의 무근거 번복 — 없음
target 자체가 "두 라운드가 반대로 가리켰다" 절에서 1판(목적지 필드 서술) → 2판(목적지 필드 공존
명시) → 3판(목적지 필드 완전 삭제, SoT 위임)의 번복 이력을 근거와 함께 명시적으로 기록한다 —
각 번복이 어느 라운드의 어느 지적에 대응하는지(1차 cross_spec / 2차 convention_compliance)를
정확히 인용했고(원문 대조 확인), 결과를 "사실 오류와 SoT 중복을 한 번에 없앤다" 로 정당화했다.
"판단 기준(언제 central enum 확장, 언제 자매 const)을 이번엔 안 쓴다" 결정도 착수 근거 plan
(`spec-conventions-engine-error-code-surface.md`)의 2026-09-01 체크리스트 항목을 SoT 로 지정하고
target 은 포인터만 두어, 같은 결정이 두 문서에 독립 서술되어 drift 위험을 만드는 것을 피했다
(2차 rationale_continuity 라운드가 지적한 중복 기록 위험에 대한 대응).

### 4. 암묵적 가정 충돌 — 없음
`exec-intake-followups.md` ARCH#5 ⑤ 가 "자매 const" 형태 선택을 **"의식적 이탈이고 해석의 여지가
있다"** 고 유보로 남겨 둔 사실을 target 의 `## Rationale` 이 원문 그대로 인용한다(대조 확인,
`plan/complete/exec-intake-followups.md:82-92` 와 일치). target 은 이 유보를 규약(판단 기준)으로
승격시키지 않고 "두 surface 가 존재한다는 사실만 적는다" 로 범위를 최소화했다 — 유보 중인 결정을
규약으로 조기 확정하면 다음 사람이 유보를 못 보게 된다는, ARCH#5 ⑤ 스스로가 경계한 독법을
target 이 정확히 피했다. `WORKER_HEARTBEAT_TIMEOUT` 이 §3 예외 레지스트리에 이미
`EngineErrorCode` 소속으로 정확히 표기돼 있다는 사실도 원문 대조로 확인되며, target 의 "이 병기는
새 규칙이 아니라 기존 실무의 명문화" 주장을 뒷받침한다.

또한 target 은 3차 `--spec`(`21_39_47`) cross_spec 이 새로 지적한 `1-data-model.md`(§2.13
"이분법 vs 실제 삼분법")·`3-error-handling.md §1.4`(카탈로그 무등재 다수) 의 **선재(pre-existing)
drift** 를 이번 diff 범위 밖으로 명시적으로 인정하고("이 draft 가 만든 것이 아니고 ... 충돌하는
주장을 더는 하지 않는다") 착수 근거 plan 의 후속 항목으로 등재했다(원문 대조 확인 — 해당 plan
파일에 실제로 "후속(별도 planner 턴) — 인접 문서의 선재 drift 2건" 항목이 추가돼 있음). 이는
cross_spec 자신이 제시한 두 옵션("이번 diff 또는 후속 planner 턴") 중 하나를 명시적으로 선택한
것이라 은폐가 아니다.

## 요약

이 target 은 4라운드에 걸쳐 동일 checker 계열(cross_spec·convention_compliance·plan_coherence·
rationale_continuity)의 지적을 하나씩 정확한 원문 인용으로 흡수해 온 이력을 그대로 문서 안에
남겨 두고 있다. 기각된 대안(값 레벨 `EXEC_*` prefix)을 재도입하지 않고, 합의된 SoT 위임 원칙을
지키며, 결정 번복(3회에 걸친 목적지-필드 서술 변경)마다 근거를 함께 적었고, 유보 중인 선례
이탈(ARCH#5 ⑤)을 규약으로 조기 승격시키지 않는 신중함을 보인다. 별도 checker 영역(cross_spec)의
선재 drift 지적도 은폐하지 않고 범위를 명시적으로 그어 별도 planner 항목으로 위임했다. 이번
라운드에서 Rationale 연속성 관점의 새로운 위반은 발견되지 않았다.

## 위험도

NONE
