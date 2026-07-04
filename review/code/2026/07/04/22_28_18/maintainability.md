# 유지보수성(Maintainability) 리뷰 — orphan pending backstop (fresh re-review, JSDoc 갱신 후)

## 스코프

`git diff origin/main...HEAD` 와 payload 가 일치(30 files). 실질 코드 변경은 다음 3개 파일:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `recoverOrphanPendingExecutions` 신규 + `recoverStuckExecutions`/`runStuckRecoveryScan` JSDoc 헤더 갱신(§8 orphan pending 책임 반영) + early-return 제거
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 신규 유닛 테스트 3건
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` — 신규 e2e 테스트 2건 + helper 2개(`insertPending`, `recoverStuck`)

나머지(`plan/*.md`, `CHANGELOG.md`, `review/**`, `spec/**`)는 문서/산출물이며 코드 유지보수성 평가 대상이 아니다.

이번은 이전 세션(`review/code/2026/07/04/22_12_26`)의 W2/W3(documentation WARNING: `recoverStuckExecutions`/`runStuckRecoveryScan` JSDoc 에 orphan pending 책임 미반영)에 대한 fix 를 검증하는 fresh 재검토다.

## JSDoc 갱신 확인

- `recoverStuckExecutions` (`execution-engine.service.ts:2781`) 헤더가 "re-drive stale RUNNING **and cancel orphan PENDING**"으로 갱신되고, 본문에 "같은 스캔이 orphan `pending` 도 회수한다" 단락이 추가되어 RUNNING re-drive/PENDING cancel 의 근거(진행 흔적 유무)까지 설명한다. §8 SoT 참조도 포함. 명확하고 정확함.
- `runStuckRecoveryScan` (`execution-engine.service.ts:753`) 헤더도 "§7.5 case B 재구동(+ §8 orphan pending cancel)"으로 갱신되어 test-hook 경유 트리거 범위가 최신 코드와 일치한다.
- 두 JSDoc 모두 실제 구현(early-return 제거 후 `recoverOrphanPendingExecutions` 항상 호출)과 line-for-line 정합 — stale 문구 잔존 없음.

## 발견사항

- **[INFO]** `recoverOrphanPendingExecutions` 는 read-then-act(non-atomic scan)로 인접 `reclaimStuckRunningExecution`(atomic claim UPDATE...RETURNING)과 원자성 모델이 다름
  - 위치: `execution-engine.service.ts` `recoverOrphanPendingExecutions`(약 2892행~) vs `reclaimStuckRunningExecution`(약 2865행~)
  - 상세: 이전 세션에서도 지적된 사항으로, 이번 재검토에서도 미해소 상태로 남아있다(JSDoc 갱신 범위가 W2/W3 두 항목에 한정되었기 때문). 신규 메서드 자체의 docstring 에는 "`markQueueWaitTimeout` 은 조건부 UPDATE 라 동시 admit/cancel 과의 race 에 멱등이다"라는 안전성 설명은 있으나, "왜 형제 메서드처럼 scan=claim 원자화를 하지 않았는가"에 대한 명시적 대비 문장은 여전히 없다. 실질 안전성 결함은 아님(concurrency 리뷰에서 이미 안전 확인됨) — 순수하게 코드를 처음 읽는 독자의 이해 비용 문제.
  - 제안: 우선순위 낮음. 필요 시 한 문장("scan 은 non-atomic 이나 최종 전이는 `markQueueWaitTimeout` 의 조건부 UPDATE 로 원자·멱등 보장 — 재-claim 불요") 추가 고려. 이번 라운드의 필수 수정 대상 아님.

- **[INFO]** `recoverStuckExecutions` 함수가 RUNNING re-claim + fire-and-forget re-drive + PENDING orphan 스캔 3개 관심사를 한 함수 안에서 순차 orchestration
  - 위치: `execution-engine.service.ts` `recoverStuckExecutions` 본체
  - 상세: 각 단계는 이미 잘 분리된 private 메서드로 위임되어 있고 `(a)/(b)/(c)` 주석으로 단계 구분이 명확하다. 함수 길이(약 40줄), 중첩 깊이(최대 2단계)는 아직 과도하지 않다. 이전 리뷰와 동일 평가 유지.
  - 제안: 현재 리팩터링 불필요. 향후 세 번째 backstop 추가 시 "recovery step 리스트 순회" 형태 일반화를 고려할 만하다는 점만 기록.

- **[정보 확인 — 문제 없음]** 매직 넘버 없음, 네이밍 일관성 양호
  - `resolveQueueWaitTimeoutMs()` 헬퍼 재사용으로 하드코딩 없음. `recoverOrphanPendingExecutions` 네이밍은 `recover<Target>Executions` + `Orphan` 어휘로 기존 `recoverStuckExecutions`/`reclaimStuckRunningExecution`/`failOrphanRunningNodeExecutions` 계열과 자연스럽게 정합.

- **[정보 확인 — 문제 없음]** JSDoc/주석 라인 길이는 파일 전체 기존 관례와 동일
  - 신규/갱신된 JSDoc 라인 다수가 100자를 넘지만, 같은 파일 전반(diff 이전부터)에 이미 존재하는 관례(Korean 서술형 장문 주석)와 일치하며 prettier 설정(`printWidth` 미지정, 주석 재포맷 없음)과도 충돌하지 않는다. diff 도입 회귀 아님.

- **[정보 확인 — 문제 없음]** 테스트 코드 스타일 일관성
  - 유닛 테스트의 `as unknown as {...}` private 메서드 접근 캐스팅은 같은 spec 파일의 기존 `redriveStuckExecution (PR3 case B)` 블록과 동일 패턴. e2e 신규 헬퍼(`insertPending`, `recoverStuck`)도 기존 `insertRunningBlocker`/`createCapWorkflow` 와 파라미터 네이밍·SQL 바인딩 스타일이 일치.

CRITICAL/WARNING 등급 발견사항 없음.

## 요약

이번 fresh 재검토는 이전 세션에서 지적된 documentation WARNING(W2/W3: `recoverStuckExecutions`/`runStuckRecoveryScan` JSDoc 미반영)이 정확히 해소되었음을 확인했다 — 두 JSDoc 헤더 모두 orphan pending 회수 책임과 RUNNING re-drive/PENDING cancel 구분 근거를 명시하며 현재 구현과 완전히 정합한다. 유지보수성 관점에서 신규 로직(`recoverOrphanPendingExecutions`) 자체는 가독성이 좋고, 네이밍이 기존 `recover*/reclaim*/failOrphan*` 계열과 일치하며, 매직 넘버·중복 코드가 없다. 유일하게 남은 INFO 는 인접 메서드(atomic claim vs read-then-act)의 원자성 모델 차이가 코드만으로 완전히 드러나지는 않는다는 점과, `recoverStuckExecutions` 가 관심사 3개를 한 함수에서 orchestrate 한다는 점인데 둘 다 이미 이전 리뷰에서 저위험으로 판정되었고 이번 변경 범위(JSDoc 갱신)로 인해 상태가 달라지지 않았다. CRITICAL/WARNING 없음.

## 위험도

NONE

STATUS: SUCCESS
