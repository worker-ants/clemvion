# 변경 범위(Scope) 리뷰

## 확인한 내용

`git merge-base HEAD origin/main` 결과 `origin/main` 은 배치 1 커밋(`255aa8597`)에 있고, 리뷰
대상 diff 는 그 위에 쌓인 3개 커밋 — 배치 2 본작업(`9b203d4d4`) + 리뷰 1R fix(`a7b9667bc`) +
리뷰 2R fix(`431c62d15`) — 로 구성된다. `git diff --stat origin/main...HEAD` 로 실측한 46개
변경 파일이 프롬프트의 파일 1~46 과 **정확히 일치**한다(46 files changed, 2312 insertions(+),
57 deletions(-)).

1. **엔티티 9개 파일(파일 1~9, 11 — `execution`/`knowledge-base`/`node-execution`/`node`/
   `notification`/`schedule`/`trigger`/`user`/`workflow`)** — plan(`plan/in-progress/
   entity-nullable-column-type-mismatch.md:186-197`)이 사전 선언한 "배치 2: 9파일·30필드
   (column 24 · relation 6)" 목표와 diff 의 필드 단위가 정확히 일치한다. 선언 외 필드가
   섞여 들어온 흔적이 없다.

2. **`redact-stored-error.ts`/`.spec.ts`(파일 12~13)** — `NodeExecution.outputData`/`error`
   가 `| null` 로 넓어진 직접 결과로 `maskIfPresent`/`redactNodeExecutionRowForResponse` 의
   제네릭 제약이 깨져(tsc 오류) 시그니처를 따라 넓힌 것이다. 엔티티 변경의 **필연적 파급**이지
   독립적 리팩터링이 아니다. docstring 정정도 자신이 그 파일에 써 넣은 전제("정적으로는 null
   불가")가 이번 변경으로 반증된 것을 원문 취소선 보존 + 정정문 병기 방식으로 고친 것으로,
   `spec/` 이 아닌 코드베이스 내부 파일이라 developer 권한 범위 안이다.

3. **`hooks.service.spec.ts`·`schedule-runner.service.spec.ts`(파일 2, 8)** — `lastTriggeredAt`/
   `lastRunAt` 이 `| null` 로 넓혀지면서 불필요해진 `null as unknown as Date` 이중 캐스트
   3건(각각 1건·2건) 제거. plan 이 명시적으로 "가드 사각지대"(`.spec.ts` 는 가드가 의도적으로
   제외)로 등재한 항목과 정확히 일치한다.

4. **plan 문서(파일 14)** — 배치 2 진행 기록·체크박스·2회의 허위 완료 주장 정정(빈 줄 삽입,
   `(d) Schedule.lastRunAt` 취소선)을 담고 있다. 작업 추적 문서 갱신은 이 작업의 의도된
   산출물이며, 실제로 파일을 열어 대조한 결과 커밋 메시지가 주장하는 수정(§185 앞 빈 줄 삽입,
   §240 `(d)` 취소선)이 **실측으로 확인**됐다.

5. **`review/code/2026/09/03/{16_45_35,17_09_06}/*` 와 `review/consistency/2026/09/03/
   17_09_09/*`(파일 15~46)** — 직전 두 리뷰 라운드 + 컨시스턴시 체크 라운드의 세션 산출물이
   신규 파일로 커밋됐다. 이 저장소는 `review/code/**`·`review/consistency/**` 산출물을
   커밋하는 것이 확립된 관례이고(이미 이 diff 안의 `17_09_06/scope.md` 자체가 `git log --all
   -- 'review/code/**/_retry_state.json'` 로 과거 다수 선례를 확인해 놓았다), CLAUDE.md 도
   "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 로 명시한다. 무관한 파일 포함이
   아니다.

6. **`review/consistency/17_09_09/*`(파일 39~46)** — 5개 checker 전원 WARNING 0·Critical 0,
   유일한 INFO 두 건(`spec/1-data-model.md:260` nullable 표기 누락, `2-api-convention.md
   §2.2` `/api/auth/*` 예외)은 plan 문서가 이미 "developer 권한 밖 — planner 턴 후속" 으로
   정확히 이월해 둔 선재 항목이고 이번 diff 가 그 spec 파일들을 건드리지도 않는다. spec/ 을
   developer 가 건드린 흔적은 diff 전체에 없다.

7. **`@Column` 데코레이터 멀티라인 재포맷 4곳**(`notification`/`trigger`/`user` 2건) — `type:`
   필드 추가로 한 줄 길이가 Prettier `printWidth` 를 넘겨 자동 개행된 결과다(예:
   `user.entity.ts` 의 `oauthProvider`/`oauthProviderId`). `type:` 추가라는 실질 변경에 수반된
   기계적 부수 효과이며, 무관한 코드 영역에 대한 별도 drive-by 포맷팅은 아니다.

8. 커밋 메시지(`9b203d4d4`·`a7b9667bc`·`431c62d15`) 확인 결과 각 라운드가 지적한 항목만
   정확히 조치했고, 다음 라운드로 스코프가 새어 나간 흔적(예: 배치 3 후보 필드를 미리
   건드리는 것)은 없다.

## 발견사항

없음.

## 요약

리뷰 대상 diff(`origin/main...HEAD`, 46개 파일)는 plan 이 사전 선언한 "배치 2: 9파일·30필드"
경계와 필드 단위로 정확히 일치하며, 유일한 "부수" 코드 변경(`redact-stored-error.ts` 시그니처
확장)은 엔티티 타입 변경의 컴파일 타임 필연적 귀결이지 독립 리팩터링이 아니다. spec 테스트
fixture 의 캐스트 제거 3건도 plan 이 사전 등재한 "가드 사각지대" 항목과 정확히 일치한다.
대량으로 보이는 `review/code/**`·`review/consistency/**` 신규 파일(46개 중 33개, 2312줄 중
약 2000줄)은 이 저장소의 확립된 리뷰 세션 커밋 관례이며 무관한 수정이 아니다 — 직접 열어 대조한
결과 각 라운드의 RESOLUTION 이 주장하는 수정(빈 줄 삽입·취소선)도 실제로 반영돼 있음을 확인했다.
요청하지 않은 기능 추가, 불필요한 리팩터링, 무관한 파일·설정 변경, 실질 변경과 뒤섞인 의미
없는 포맷팅, 불필요한 주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
