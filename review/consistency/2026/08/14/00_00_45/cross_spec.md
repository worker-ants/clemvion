# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 발견사항

- **[INFO] target diff 없음 — 이미 `origin/main` 에 병합된 것으로 보임**
  - target 위치: `spec/5-system/` (diff-base `origin/main`, 프롬프트가 지정한 워크트리 `eia-r8-cache-scope-4ae434`)
  - 충돌 대상: 없음 (git 상태 자체의 문제)
  - 상세: `git diff origin/main...HEAD -- spec/5-system/` 가 **빈 diff**를 반환한다. 이 워크트리(디렉터리명은 `eia-r8-cache-scope-4ae434` 이지만)의 실제 체크아웃 브랜치는 `claude/raw-query-audit-followups`이며, `origin/main` 대비 이 브랜치의 10개 커밋은 전부 `codebase/backend/src/common/utils/{assert-row-array,update-returning-rows}*`, `auth-oauth.service.ts`, `execution-engine.service.ts`, `knowledge-base.service.ts` 및 `plan/`·`review/` 산출물뿐이고 `spec/5-system/**` 는 건드리지 않는다. 반대로 `origin/main` 자체(`598dca9ab` 최신)에는 이미 "EIA r8 캐시 스코프" 주제의 커밋들이 반영돼 있다 — `72db62a7b`(멱등 캐시 키가 전 execution 공유였는데 spec 은 "동일 키"라고만 적혀 있던 문제 정정), `0855000f2`("모든 Redis 키는 이 패턴" 선언에 실제로 안 따르는 키 2건 제거), `1e9f3f238`(fail-open 범위 정정), `9a4d3e32b`(종결 이벤트 계약 단일화). 즉 이 리뷰 세션이 지목한 "target" 변경분은 이미 `origin/main` 에 완전히 병합돼 있고, 현재 워크트리/브랜치는 그 이후 전혀 별개 작업(`raw-query-audit-followups`)으로 넘어가 있다. 프롬프트에 첨부된 diff 섹션도 실제로는 `<git diff origin/main...HEAD -- code_areas>` 자리표시자만 남아 있어(§생략된 파일 19개 목록 안에 diff 자체가 포함) 별도 diff 콘텐츠가 조립되지 않았음을 시사한다.
  - 제안: 이 cross-spec 검토는 실질적으로 비교할 신규 diff가 없다 — 병렬 세션이 먼저 머지를 완료한 경우다. orchestrator 는 이 세션 결과를 "델타 0" 으로 폐기하거나, 실제 검토 대상(현재 브랜치의 `codebase/backend/src/**` 변경)을 가리키는 새 프롬프트로 재생성해야 한다.

- **[INFO] (best-effort) 이미 병합된 EIA §R8 캐시 스코프 서술 자체는 관련 spec 과 정합**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R8 "캐시 키 스코프"(L1143–1154), `EIA-IN-11`(L81)·`EIA-RL-02`(L140)
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §2.2(L93, L98, L260), `spec/5-system/4-execution-engine.md` §9.2(L1157–1174)
  - 상세: 위 diff 부재를 확인한 뒤에도, 실제 병합된 캐시-스코프 내용에 잠복 충돌이 있는지 별도로 점검했다. 캐시 키 패턴 `interaction:idempotency:<executionId>:<route>:<key>`, 닫힌 캐시 대상 목록(2xx·409·410 캐시 / `400 VALIDATION_ERROR` 제외 / 5xx 제외), execution 축(토큰이 아닌 execution 단위 스코프, 토큰 회전 후에도 재현)·route 축(`interact`\|`cancel` 분리) 근거가 EIA 본문·Rationale·data-flow 문서 세 곳에서 표현만 다를 뿐 동일 계약으로 일치한다. `execution-engine.md §9.2` "용도별 키 정의" 표에는 이 `interaction:idempotency:*` 키가 등재돼 있지 않지만, `data-flow §15` L310 이 이를 "그 표에 아직 미등재다(별도 항목)" 로 스스로 명시하고 있어 조용한 누락이 아니라 알려진 경계로 처리돼 있다 — 실질 충돌 아님.
  - 제안: 조치 불요.

## 요약
프롬프트가 지정한 검토 대상(`spec/5-system/`, diff-base `origin/main`)에는 실제로 비교할 diff 가 없다 — 해당 워크트리의 체크아웃 브랜치가 이미 다른 작업(`raw-query-audit-followups`)으로 넘어가 있고, "EIA r8 캐시 스코프" 관련 spec 변경은 `origin/main` 에 이미 완전히 병합된 상태다(커밋 `72db62a7b`/`0855000f2`/`1e9f3f238`/`9a4d3e32b` 등). 이는 병렬 세션이 먼저 머지를 마친 델타-0 상황으로 판단된다. best-effort 로 이미 병합된 §R8 캐시 스코프 내용(캐시 키 패턴·닫힌 대상 목록·execution/route 축 스코프)을 `data-flow/15-external-interaction.md`·`4-execution-engine.md §9.2` 와 대조했으나 표현이 세 문서에서 상호 일치하고, execution-engine 키 표 미등재도 data-flow 문서가 스스로 인정한 알려진 경계라 실질 Cross-Spec 충돌은 발견되지 않았다.

## 위험도
NONE
