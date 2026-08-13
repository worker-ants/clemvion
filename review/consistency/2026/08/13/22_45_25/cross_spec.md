# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 요약

이번 diff 는 이전 라운드(`review/consistency/2026/08/13/20_36_36/cross_spec.md`)가 검토한
`UPDATE/DELETE RETURNING` 튜플 오인 결함 수정에, **1차 감사가 놓쳤던 8번째 지점**
(`auth-oauth.service.ts` 의 소셜 로그인 콜백)에 대한 수정이 추가된 상태다. `git diff
origin/main...HEAD` 를 직접 확인한 결과 **`spec/**` 아래 파일은 이번 라운드에서도 0건
변경**이다(`git diff origin/main...HEAD --stat -- spec/` 출력 없음). 변경은 전부
`codebase/backend/src/{common/utils,modules/{execution-engine,knowledge-base,auth}}/**`
코드 + 2개 plan 문서(`update-returning-tuple-shape.md` 신규, `ie-resume-turn-boundary-cancel.md`
소급 정정 배너)뿐이다.

target(`spec/5-system/`) 자체가 무변경이므로, "target 문서가 다른 spec 영역과 충돌하는가"
라는 질문은 문자 그대로는 해당 사항이 없다. 대신 이번 코드 변경이 함의하는 동작 변화가
spec 의 다른 영역(§4-execution-engine §8/§7.5, KB 관련 4문서, 그리고 이번에 추가된
`data-flow/2-auth.md` + `conventions/error-codes.md`)과 새로 어긋나는지를 확인했다.

## 발견사항

교차 영역 충돌은 발견되지 않았다. 이전 라운드와 마찬가지로 **이 수정은 이미 문서화된
cross-spec 계약과 코드가 그동안 어긋나 있던 지점을 코드 쪽에서 바로잡는** 방향이며, 이번에
추가된 auth-oauth 지점도 동일 패턴을 따른다.

- **(재확인, 이전 라운드와 동일) admission gate — `spec/5-system/4-execution-engine.md`
  §4.2/§7.1/§7.5/§8**: "admission 은 PENDING→RUNNING 최초 진입 전용, stalled 재배달(§7.1)·
  park 재개(§7.5)는 재심사하지 않는다" 는 기존 spec 불변식이다. 튜플 버그로 `admitted` 가
  영원히 `false` 였던 동안 정상 admission 이 §7.5 case B(크래시 재구동 경로)로 새어나가고
  있었다. 수정은 코드를 기존 spec 문언에 되돌린 것이지 새 이탈이 아니다.
- **(재확인) KB CAS 락 — `spec/2-navigation/5-knowledge-base.md:149,216,221`,
  `spec/5-system/3-error-handling.md:196-197`, `spec/5-system/10-graph-rag.md:524,565`,
  `spec/5-system/8-embedding-pipeline.md:264`**: 4개 문서가 "진행 중이면 409
  `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS` atomic CAS 로 차단" 을 공통 기술한다.
  튜플 버그로 이 거절이 한 번도 발동하지 않았던 것을 이번 수정이 처음 작동시킨다.
- **(신규 확인) OAuth state 원자적 소비 — `spec/data-flow/2-auth.md:122-128,274-275,388`,
  `spec/conventions/error-codes.md:35`, `spec/2-navigation/4-integration.md:851`**:
  `data-flow/2-auth.md:128` 은 "row 없으면(미존재·만료·이미 소비) 400
  `OAUTH_STATE_MISMATCH`. row.provider ≠ :provider 도 거부" 라고 명시한다 — 즉 **정상
  콜백은 통과해야 한다**는 것이 기존 spec 문언이다. 튜플 버그로 `consumed[0]` 이 행이 아니라
  행 배열이 되면서 `record.provider` 가 항상 `undefined` 가 되어 **정상 콜백까지 전부**
  `OAUTH_STATE_MISMATCH` 로 거부되고 있었다(소셜 로그인 상시 실패). `auth-oauth.service.ts`
  수정은 `data-flow/2-auth.md` 가 이미 요구하는 "정상 콜백은 통과, 만료·재사용만 거절" 을
  처음으로 실제로 성립시킨다 — spec 문언을 어기는 새 이탈이 아니라 기존 문언과의 어긋남을
  해소하는 방향이다. `error-codes.md:35` 의 `OAUTH_STATE_MISMATCH`(state 불일치) 의미도
  변경되지 않는다 — 발생 조건이 "항상" 에서 "실제 불일치 시" 로 좁아졌을 뿐 코드 자체나
  400 status 는 그대로다.
- **(재확인) 빈 KB 즉시 idle 복귀 — `spec/5-system/8-embedding-pipeline.md:264` 인근**:
  같은 튜플 버그로 `reset.length === 0` 분기가 죽어 문서 0건 KB 가 `reembed_status=
  'in_progress'` 로 영구 좌초했던 것을, 수정이 문서 문언대로 복구한다.

네 지점 모두 "코드가 spec 을 따라잡는" 방향이라 새로운 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC·계층 책임 충돌은 없다. 상태 전이 관점에서도 `OAUTH_STATE_MISMATCH` 를
던지는 조건("row 없음 · provider 불일치")과 실제 코드 경로가 이번에 비로소 spec 과 일치한다.

- **[INFO] 이력 기록 권장 — 전 라운드 대비 확장 (선택, carry-forward)**
  - target 위치: 코드 diff 전체(`update-returning-rows.ts` 및 8개 호출부, 이번 라운드에서
    `auth-oauth.service.ts` 1곳 추가) + `plan/in-progress/update-returning-tuple-shape.md`
  - 충돌 대상: 없음 — 참고 문서 `spec/5-system/4-execution-engine.md` §Rationale,
    `spec/5-system/8-embedding-pipeline.md` §Rationale, (신규) `spec/data-flow/2-auth.md`
    §Rationale 유사 자리
  - 상세: 전 라운드에서 이미 §8 admission gate·KB CAS 락·빈 KB idle 복귀 3개 영역에 대해
    Rationale 한 줄 추가를 권고했다. 이번에 소셜 로그인 상시 실패(`data-flow/2-auth.md`
    가 이미 규정한 정상 콜백 통과 조건 위반)가 추가로 확인되면서 영향 범위가 4개 spec
    영역(실행엔진 §8/§7.5, KB CAS 락 3문서, embedding-pipeline 빈 KB idle, auth OAuth state)
    으로 늘었다. `update-returning-tuple-shape.md` 자체가 이미 상세히 기록하고 있고
    plan 하단에 "[planner 위임]" 항목으로 `spec/5-system/4-execution-engine.md` §1.1 인근
    Rationale 각주 추가가 명시돼 있어(개발자는 `spec/` 쓰기 권한이 없어 이번 PR 로는
    미반영), blocking 성격은 아니다.
  - 제안: 다음 planner 턴에서 각주를 추가할 때 실행엔진 문서뿐 아니라
    `spec/data-flow/2-auth.md` 도 함께 고려(선택). `spec_impact: none` 판단을 뒤집을
    근거는 없다 — 이번 PR 이 실제로 바꾸는 spec 파일은 0건이 맞다.
- **[INFO] 규약 승격 검토 — 전 라운드와 동일, 범위만 확장 (선택, carry-forward)**
  - 상세: 이전 라운드 INFO 가 지적한 "raw UPDATE/DELETE RETURNING 소비는
    `updateReturningRows` 경유" 규약화 필요성은 이번 auth-oauth 지점(1차 감사가 작은따옴표
    SQL 을 놓쳐 발견 못한 4번째 사례)으로 한 번 더 실증됐다. `spec/conventions/` 승격
    여부는 planner 판단 사항으로 그대로 유지.

## 요약

이번 target(`spec/5-system/` 범위 impl-done 검토, 2차 라운드)도 spec 문서를 전혀 건드리지
않는 순수 백엔드 버그 수정이며, `plan/in-progress/update-returning-tuple-shape.md` 의
`spec_impact: none` 은 이번에 추가된 auth-oauth 지점을 포함해도 여전히 타당하다. 오히려
수정 전 코드는 실행엔진 §8/§7.5 분리, KB 409 락(4문서), embedding-pipeline 빈 KB idle
복귀에 더해 이번에 확인한 `data-flow/2-auth.md` 의 OAuth state 소비 규칙까지 **네 개 spec
영역의 기존 문언을 조용히 어기고 있었고**, 이번 diff 는 코드 쪽에서 그 어긋남을 전부
해소한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 새로운
cross-spec 충돌은 없다. 두 INFO 는 전 라운드 권고의 연장(각주 추가 범위 확대, 규약 승격
검토)이며 모두 planner 턴으로 위임된 비차단 항목이다.

## 위험도

NONE
