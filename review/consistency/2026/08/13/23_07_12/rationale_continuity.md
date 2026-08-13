# Rationale 연속성 검토 결과

## 검토 대상 재확인

프롬프트의 `## Target 문서` 절에는 실제 target 본문(diff 포함)이 컨텍스트 예산 초과로 전부 생략되어 있었다(`<git diff origin/main...HEAD -- code_areas>` 자체가 생략 목록에 포함). 따라서 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 `git diff origin/main...HEAD`를 직접 실행해 실제 변경분을 확인했다.

실측 결과, 이번 diff 는 워크트리 이름(`eia-r8-cache-scope`)이 시사하는 EIA/캐시 범위가 아니라 **`UPDATE`/`DELETE ... RETURNING` raw 쿼리의 반환 shape 버그 수정**이다 (커밋 `8332d9a20` "UPDATE 는 [rows,count] 튜플을 돌려준다 — 7곳이 행 배열로 다뤘다" 및 후속 `08d3c7fa3`). 영향 파일: `execution-engine.service.ts`(spec/5-system/4-execution-engine.md 대응), `knowledge-base.service.ts`(spec/5-system/8-embedding-pipeline.md 대응), `auth-oauth.service.ts`(spec/data-flow/2-auth.md 대응), 신규 헬퍼 `update-returning-rows.ts`. spec 본문 파일 자체는 이번 diff 에서 변경되지 않았다(코드만 변경 — impl-done 모드에서의 "구현이 spec Rationale 의 결정을 지키는가" 검토).

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 해당 사항 없음). 아래는 근거로 확인한 정합 사실이다.

### 확인 1 — admission gate 조건부 UPDATE (spec/5-system/4-execution-engine.md §Rationale "동시성 cap admission gate")

- **과거 결정**: "TOCTOU 원자화: … 조건부 UPDATE(`RETURNING`)로 '카운트→비교→전이' 한다" (`spec/5-system/4-execution-engine.md` 1701행).
- **target 코드**: `execution-engine.service.ts` 의 admission gate(`m.query(...)` UPDATE + `updateReturningRows(...).length === 1`)가 정확히 이 패턴을 구현하며, 수정 전에는 `rows.length === 1`(튜플이라 항상 `false`)로 이 가드가 **한 번도 발효되지 않았던 버그**를 고친 것이다. 즉 target 은 과거 Rationale 이 선언한 설계를 재도입/위반하는 것이 아니라, 그 설계가 구현에서 사문화돼 있던 것을 원복시킨다.
- **판정**: Rationale 과 정합. 새 Rationale 신설 불요(설계 자체는 안 바뀜, "설계대로 동작하지 않던 것을 고침"은 버그 수정이지 결정 번복이 아님).

### 확인 2 — KB reembed/reextract CAS 락 race-free (spec/5-system/8-embedding-pipeline.md §후속 적용)

- **과거 결정**: "KB reEmbedAll 잠금은 atomic `UPDATE ... WHERE reembed_status='idle' RETURNING id` 으로 race-free" (`spec/5-system/8-embedding-pipeline.md` 388-389행).
- **target 코드**: `knowledge-base.service.ts` 의 `reextract_status`/`reembed_status` CAS UPDATE 가 `updateReturningRows(...).length === 0` 로 거절 분기를 계산하도록 수정 — 수정 전에는 `acquired.length === 0`(튜플이라 항상 `false`)으로 **CAS 락 거절이 한 번도 발동하지 않아 동시 재추출/재임베딩을 허용**하던 버그였다.
- **판정**: Rationale 이 명시한 "race-free" 보장을 구현이 실제로 만족하지 못했던 상태를 target 이 바로잡는다. 정합.

### 확인 3 — OAuth state one-shot DELETE (spec/data-flow/2-auth.md §Rationale "OAuth state 의 one-shot DELETE")

- **과거 결정**: "동시 callback 경합에서도 정확히 한 요청만 state 를 얻게 하기 위해" 단일 원자 쿼리(`DELETE ... RETURNING`)를 쓴다.
- **target 코드**: `auth-oauth.service.ts` 가 `DELETE ... RETURNING` 결과를 `updateReturningRows`로 파싱하도록 수정 — 수정 전에는 튜플 `[rows, count]`를 그대로 `AuthOAuthState[]`로 취급해 `consumed[0].provider`가 `undefined`가 되어 **정상 콜백까지 전부 실패**하던 버그였다(소셜 로그인 상시 실패, 커밋 `08d3c7fa3`).
- **판정**: one-shot 소비라는 설계 자체는 그대로이고 구현 결함만 수정. Rationale 위반 없음.

### 확인 4 — 과거 결론의 소급 정정이 새 근거와 함께 기록됨 (plan-level, 참고)

`plan/in-progress/ie-resume-turn-boundary-cancel.md` 에 6~8차 라운드에서 "동시 cancel 레이스를 닫았다"고 종결한 근거(`persisted` 값)가 실은 위 튜플 버그로 인해 상시 `true`였다는 사실이 드러나자, target 은 침묵하지 않고 "⚠ 소급 정정(2026-08-13)" 절과 체크리스트 취소선 + 정정 사유를 명시적으로 추가했다. 이는 본 checker 관점 3 ("결정의 무근거 번복") 이 요구하는 정확한 패턴 — 결론이 뒤집힐 때 새 근거를 함께 남기는 사례로, 위반이 아니라 모범 사례에 해당한다.

### 참고 (findings 아님) — 워크트리 이름과 diff 내용 불일치

세션 워크트리명이 `eia-r8-cache-scope`이나 실제 diff 는 EIA/캐시 스코프와 무관한 `UPDATE...RETURNING` 튜플 shape 버그 수정이다. Rationale 연속성 판단에는 영향 없음(관련 spec 영역인 EIA §5-system/14 자체도 diff 대상이 아님)이나, 세션/아티팩트 명명이 실제 작업과 어긋나 있다는 사실은 오케스트레이터가 참고할 만하다.

## 요약

target(코드 diff)은 spec/5-system(및 관련 data-flow) Rationale 이 이미 선언한 세 가지 설계 원칙 — (1) admission gate 의 조건부 UPDATE 기반 cap 강제, (2) KB reembed/reextract CAS 락의 race-free UPDATE, (3) OAuth state 의 원자적 one-shot DELETE — 을 **재도입·번복·우회하는 것이 아니라**, TypeORM raw 쿼리가 `UPDATE`/`DELETE` 에서 `[rows, rowCount]` 튜플을 반환한다는 드라이버 사실을 놓쳐 이 원칙들이 구현에서 사문화(가드가 항상 통과/항상 거절되지 않음)돼 있던 버그를 원복하는 수정이다. 과거 plan 결론이 이 버그로 인해 잘못 종결됐던 부분도 새 근거를 명시한 소급 정정으로 처리됐다. Rationale 연속성 관점에서 위반·재도입·무근거 번복 사례를 찾지 못했다.

## 위험도

NONE
