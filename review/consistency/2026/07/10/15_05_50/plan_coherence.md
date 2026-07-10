# Plan 정합성 검토 — catalog-residual-codes.md (재검증)

## 선행 라운드(14_53_01) WARNING 재검증 — 둘 다 해소 확인

- **stale base(WARNING#1)**: target `## 배경`에 "`reset --hard origin/main` 으로 교정(plan_coherence WARNING#1 해소)" 명시 + `## 워크플로` 1번째 항목 `[x]`. `git log`/spec 본문 실측(§2.3.C·§2.3.D·§1.2.1 각주)으로 base 가 실제로 #887(스쿼시 `318642003`) 이후임을 확인 — 해소 맞음.
- **`error-codes-catalog-sot.md §후속` 미참조(WARNING#2)**: target `## 워크플로`에 `- [ ] error-codes-catalog-sot.md §후속 L56 체크박스 갱신 + (전 항목 완료 시) complete 이동` 이 정식 단계로 추가됨. `plan/in-progress/error-codes-catalog-sot.md` L56 확인 결과 실제로 미해결 `[ ]` 항목(`NOT_A_MEMBER`·`INVALID_PASSWORD` — target 은 여기에 `PASSWORD_REQUIRED` 를 더해 3코드로 완결)과 정확히 대응 — 해소 맞음. 이 항목까지 끝나면 `error-codes-catalog-sot.md` 는 전 항목 `[x]` 가 되어 plan-lifecycle 상 complete 이동 대상이 되는데, target 이 이를 스스로 인지하고 있음(양호).

## 발견사항

- **[INFO]** `error-codes-catalog-sot.md §후속` L56 텍스트가 3코드 중 2개만 명시
  - target 위치: `plan/in-progress/catalog-residual-codes.md` `## 워크플로` — "`error-codes-catalog-sot.md §후속` L56 체크박스 갱신"
  - 관련 plan: `plan/in-progress/error-codes-catalog-sot.md` L56 — `NOT_A_MEMBER`(403, workspace switch)·`INVALID_PASSWORD`(change-password) 도 §1 미등재 — 동일 완결성 pass 에서 흡수.
  - 상세: L56 원문은 `PASSWORD_REQUIRED` 를 언급하지 않는다(실제 "3코드 deferred" 근거는 `3-error-handling.md` §1.2.1 각주 — `PASSWORD_REQUIRED` 포함 — 이며 이는 target 이 정확히 인용). L56 을 그대로 `[x]` 로만 바꾸면 `PASSWORD_REQUIRED` 도 이번에 함께 등재했다는 사실이 해당 plan 문서에는 드러나지 않는다.
  - 제안: 체크박스 갱신 시 단순 `[x]` 전환이 아니라 "`PASSWORD_REQUIRED`(§1.2.1 각주 원출처)도 동일 pass 에서 함께 흡수"라는 한 줄을 덧붙이면 그 plan 단독으로도 완결 이력이 자기완결적이 된다. 차단 사유는 아님.

- **[INFO]** `## 범위 밖`에 본 plan 주제와 무관한 항목 혼입
  - target 위치: `plan/in-progress/catalog-residual-codes.md` L98 — `` `table.md §1↔§4` label 평가 변수 — `task_986b1dbe`. ``
  - 관련 plan: `plan/complete/expr-autocomplete-table-rows.md` (해당 항목의 원 출처, 이미 완료된 plan)
  - 상세: 이 항목은 에러 코드 카탈로그·auth 도메인과 무관한 노드 spec(`table.md`) 의 label 평가 변수 이슈로, 이미 다른(완료된) plan 이 `task_986b1dbe` 로 위임 완료한 상태다. 본 plan(`catalog-residual-codes`) 의 "범위 밖" 목록에 왜 포함됐는지 문맥상 근거가 없어 — 다른 plan 템플릿에서 잘못 상속됐거나 복사 잔재로 보인다. 실제 충돌은 없으나(이미 별도 task 로 추적 중) 독자에게 본 plan 이 그 이슈와 관계있다는 오인을 줄 수 있다.
  - 제안: 무관하면 제거. 의도적으로 남긴 것이라면(예: 동일 세션에서 다룬 잔여 메모) 그 이유를 한 줄로 밝히는 것을 권고.

- **[INFO]** `NOT_A_MEMBER` 행의 `ALREADY_A_MEMBER(§1.9, 409)` 인라인 참조가 plan 이 스스로 선언한 "범위 밖"과 접촉
  - target 위치: `plan/in-progress/catalog-residual-codes.md` 변경 2a 표 행 — "초대 수락 `ALREADY_A_MEMBER`(§1.9, 409)와 반대 의미", `## 범위 밖` L99 — "workspace 직접-추가 경로 코드(`ALREADY_A_MEMBER`·`WORKSPACE_TYPE_MISMATCH` 등) 등재 — deferred 목록 밖, 별도."
  - 관련 plan: 없음 — `ALREADY_A_MEMBER`/`WORKSPACE_TYPE_MISMATCH` 를 `3-error-handling.md` 에 정식 등재하는 후속 작업이 어느 `plan/in-progress/` 파일에도 존재하지 않는다.
  - 상세: target 이 명시적으로 "범위 밖"이라 선언한 코드를 같은 변경(2a) 안에서 bare 인라인 참조 `(§1.9, 409)`로 먼저 언급한다. `3-error-handling.md` 자체에는 §1.9 섹션이 없고(현재 최대 §1.8 KB/Graph RAG), 다른 두 cross-ref(`[1-auth.md §5](...)`·`[data-flow §1.5](...)`)와 달리 이 참조만 문서 한정자·링크가 없어 "본 문서 §1.9"로 오독될 소지가 있다. 이 문구가 §1 카탈로그에 먼저 새겨지면, 향후 workspace 직접-추가 경로 코드를 정식 등재하는 plan(아직 미생성)이 이 문구를 SoT 로 오인해 이어받을 위험이 있다.
  - 제안: 이 부분은 plan-coherence 보다는 cross_spec/rationale_continuity 검토 영역에 가까우나, plan 추적 관점에서는 "workspace 직접-추가 경로 코드 등재"를 위한 `plan/in-progress/` 스텁을 만들어 두거나, 최소한 `error-codes-catalog-sot.md` 류 문서에 후속 항목으로 한 줄 남겨 두는 편이 향후 재발견 비용을 줄인다.

## 요약

Target(`catalog-residual-codes.md`)은 `error-codes-catalog-sot.md §후속` L56 이 명시적으로 남긴 미해결 항목(`NOT_A_MEMBER`·`INVALID_PASSWORD`, 여기에 `PASSWORD_REQUIRED` 를 더한 3코드)을 정확히 완결하는 작업이며, 그 배치 결정(§1.2 vs §1.2.1)은 `error-codes-catalog-sot.md`·`auth-reauth-spec-accuracy`(완료, #887)가 이미 확립한 "도메인 spec 문서화 → 카탈로그 등재" 순서·패턴과 정합한다. 미해결 결정을 우회하는 지점은 없다(CRITICAL 없음). 직전 라운드(14_53_01)가 지적한 두 WARNING(stale base·`error-codes-catalog-sot.md` 미참조)은 이번 draft 에서 모두 실제로 해소됐다(재확인 완료). 남은 발견은 전부 INFO 수준 — plan 문서의 자기완결성(L56 텍스트 보강)과 "범위 밖" 절의 잡음(무관 항목 혼입, workspace 직접-추가 경로 코드에 대한 미추적 후속) 관련이며, 어느 것도 진행을 막을 사유는 아니다.

## 위험도
LOW
