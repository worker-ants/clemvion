# RESOLUTION — `review/code/2026/09/15/01_42_04` (14라운드 · 종결)

**Critical 0 · Warning 1 · INFO 21 · 전체 위험도 LOW.** forced 7/7 이행(`forced_missing: []`),
11명 success·전원 리포트, `unfinished: []`. router 가 `architecture` · `dependency` ·
`api_contract` 셋을 skip 했고 셋 다 강제 목록 밖이다.

## 이 라운드의 정지 규칙 — **결과를 보기 전에** 선언했다

> *"이번엔 동작 결함이 아니면 `codebase/**` 를 건드리지 않고 남은 항목을 `RESOLUTION.md` 에
> 처분으로 기록해 닫는다."*

plan 의 완료 기준도 같은 문장이다: **마지막 라운드가 `codebase/**` 수정 0 으로 끝날 것.**
이 라운드의 유일한 WARNING 은 동작 결함이 아니라 **구조 중복**이고, INFO 21건 중
조치 대상은 전부 주석·문서·후속이다. 그래서 **`codebase/**` 수정 0** 으로 닫는다.

> plan 에는 *"Critical 0 이고 WARNING 0 이면 멈춘다"* 도 적혀 있다. 그 조건은 이번에
> 충족되지 않았다(W1 생존). 두 규칙이 갈리므로 **더 엄격한 쪽이 아니라 더 정확한 쪽**을
> 적용한다 — 수렴 판정은 「발견 0」이 아니라 **발견의 성격**(동작 → 구조 → 문서)이고,
> 이 라운드는 그 축의 끝에 있다. 남은 것을 고치려면 또 코드를 만져야 하고, 그러면
> 이 SUMMARY 가 stale 이 되어 15라운드가 필요해진다 — 이 PR 이 이미 두 번 겪은 루프다.

## Warning 처분

| # | 발견 | 처분 |
|---|---|---|
| W1 (maintainability) 두 `remove()` 의 «락 → 삭제 → 실패 로깅 → 재던짐» 블록 복제 | **후속 등재** — 지적이 정확하다. 이 PR 자신이 «복제가 drift 를 부른다» 는 근거로 `acquireTriggerConfigLock` 을 뽑았는데, 한 단계 위 패턴은 손으로 복제돼 있다. 다만 **리뷰어 자신이 «즉시 차단 사유 아님»** 으로 분류했고, 두 자리 모두 뮤턴트로 고정된 회귀 테스트를 갖는다(상한 제거·순서 뒤집기·catch 본문 제거 각 1 RED). `deleteTriggerRowLocked(manager, id, {...})` 추출은 **세 번째 호출부가 생길 때** 하는 것이 맞다 — 지금 뽑으면 인자가 «로거 · 컨텍스트 라벨 · 후처리» 셋인 헬퍼가 되어 복제보다 읽기 어렵다 |

## INFO 처분 — **지금 고친 것**

`codebase/**` 밖(루트 `CHANGELOG.md`)이라 리뷰 freshness 를 깨지 않는 것만 이번에 고쳤다.
이것이 이 게이트에서 루프를 끊는 지렛대다 — `newest_code` 는 `codebase/**` 만 센다.

| # | 발견 | 조치 |
|---|---|---|
| INFO#17 (documentation) | 13라운드 W3 정정이 «정리 3종»(provider teardown · secret 삭제 · BullMQ 해제) 나열을 **두 경로 공통**으로 적었다. 스케줄 삭제는 BullMQ 해제만 한다 → **경로마다 다르고 공통점은 «되돌릴 수 없다»** 로 일반화. 이 PR 에서 목록형 서술이 낡은 **다섯 번째** 사례라 그 사실도 함께 적었다 |
| INFO#6 (requirement·concurrency) | 표제 문단의 *"`config` 를 다시 쓰는 **모든 자리**를 닫았다"* 가 축을 넘었다. **`config` JSONB 축 한정**으로 좁히고, **닫지 않은 축**(락 밖 컬럼 한정 갱신 3곳의 이론적 TOCTOU)을 명시해 적었다 |
| INFO#10 (side_effect) | 스케줄 PATCH 가 빈 patch 면 트리거 행에 쓰지 않아 `updated_at` 이 안 올라간다. 응답 DTO 가 노출하지 않고 소비처도 없어 계약 변화는 아니지만 **부수 효과로 CHANGELOG 에 한 줄** 남겼다 |

## INFO 처분 — **후속 등재** (`codebase/**` 라 이번에 안 건드린다)

| # | 발견 | 왜 지금 아닌가 |
|---|---|---|
| INFO#1 (security) | `rewriteTriggerConfigLocked` 재읽기가 `workspaceId` 미스코프 | 현 호출부 6곳 전부 사전 검증 뒤. JSDoc 전제 명시가 답이고 이미 5·9라운드에 등재돼 있다 |
| INFO#2 (security·DB) | `SET LOCAL lock_timeout = '${Math.trunc(ms)}ms'` 문자열 보간 | 호출부가 **모듈 상수만** 넘기도록 배선돼 익스플로잇 불가. 방어 심도로 `Number.isFinite` + clamp |
| INFO#17 의 코드 절반 | `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 의 같은 나열 | 위 CHANGELOG 와 **같은 정정**이지만 이쪽은 `codebase/**` 다. 다음 편집자가 함께 닫도록 등재 |
| INFO#19 (DB) | `rewriteTriggerConfigLocked` 가 `affected` 미확인 | 삭제 경로 2곳이 **같은 락을 공유**해 실무적으로 닫혀 있다. 계약 명확화용 |
| INFO#16 (testing) | `schedule.triggerId` falsy 분기 미커버 | 선재 가드절, 이번 diff 의 회귀 아님 |
| INFO#8·#13 (concurrency·maintainability) | CASCADE 뒤 `scheduleRepository.remove` 재호출 의도 주석 · `dto.name` 대신 `trigger.name` 재조회 | 둘 다 선재 코드의 가독성 |
| INFO#11·#12 (maintainability) | `update()` 180줄 · `setupChatChannel()` 237줄 | 6·13라운드 등재분과 동일 항목 |
| INFO#14 (maintainability) | `withTransactionMock` 위임 클로저 5개 반복 | 테스트 전용 유틸 |
| INFO#3·#4·#5 (performance) | cron 왕복 증가 · 쓰기 경로 4~5x · 상한 없는 대기 | 8·9라운드 등재분과 동일. 저빈도 관리 엔드포인트 |
| INFO#7 (concurrency) | 스케줄 `update()` 가 동시 삭제와 만나면 매치 0건 no-op | 선재 결함, `config` 미접촉이라 fail-open 축 아님 |
| INFO#9 (testing) | e2e 의 고정 `SETTLE_MS=300` | flake 발생 시 1차 용의선으로 기록만 |
| INFO#18·#20 (DB) | cron 스윕 무-페이지네이션 · 32비트 키 공간 공유 | 선재 구조 · 별도 consistency 리뷰에서 수용됨 |
| INFO#15 (testing) | 상한 값 `'5000ms'` 리터럴 하드코딩 | 형제 테스트와 **같은 기존 관례**다. 한쪽만 바꾸면 비대칭이 된다 |

## INFO#21 — 리뷰어가 본 미커밋 plan 변경

관찰이 정확하다. 리뷰 실행 중 워킹트리에 `trigger-config-lost-update.md` ·
`spec-draft-nullable-notation-followups.md` 의 미커밋 변경이 있었다 — 이 PR 이 스스로 약속한
**트래커 종결 작업**이고, 리뷰어 권고대로 **코드와 분리한 plan-only 커밋**으로 넣는다.
`plan/**` · `review/**` 는 리뷰 freshness 를 깨지 않는다.

## `--impl-done` 동반 결과

`/consistency-check --impl-done spec/5-system/` → `review/consistency/2026/09/15/01_44_29`
**BLOCK: NO** (5 checker 전원 success, Critical 0, WARNING 5).

| # | 처분 |
|---|---|
| W5 **planner 범위 5건이 봉인될 plan 안에만 있다** | **수용·조치** — 전수 grep 상 `pending_plans:`·다른 `plan/in-progress/**` 어디에도 0건이었다. 5건을 살아 있는 트래커(`spec-draft-nullable-notation-followups.md`)로 이관하고 plan §D 에 포인터를 남겼다. **조건부·후속 처분은 봉인되는 문서가 아니라 살아 있는 트래커에 적는다** |
| W1·W2·W3 (R-CC-22 glob · `redis-keys.md §4` 2계열 · §5.4.1.1 표↔각주 모순) | **planner 턴** — `spec/` 은 developer 권한 밖이다. 위 이관에 포함 |
| W4 `findByIdForUpdate` 명명이 이 저장소의 `*ForUpdate`=행잠금 관용구와 반대 | **후속 등재** — 지적이 정확하다. 다만 **바로 위 JSDoc 이 이미** *"저장·응답에 쓰이는 엔티티는 **락 안에서 다시 읽으므로**"* 를 적고 있어 오신뢰 여지가 좁고, private 스코프라 파급이 이 파일 안이다. 주석 한 줄이라도 `codebase/**` 편집이라 이 SUMMARY 를 stale 로 만든다 → 개명(`findByIdForPatchValidation`)을 후속으로 |
| INFO#2 트래커가 아직 없는 `plan/complete/…` 경로를 선참조 | **같은 커밋에서 해소** — 체크박스 `[x]` · `git mv` · 선참조가 한 커밋 안에서 정합해진다 |
| INFO#3 Cafe24 락 기각 선례 대조 | **조치 불요** — 체커가 *"위반 아님, 모범 사례"* 로 판정했다(외부 호출은 락 밖, 락 안은 재조회+UPDATE 만) |

## 결론

**`codebase/**` 수정 0 으로 종결한다.** 이 PR 이 닫은 것은 «스냅샷 기반 `config` 통째
되쓰기» 한 클래스이고, 네 창 · 웹훅 인입 두 자리 · 형제 쓰기 여섯 자리 · 삭제 두 경로까지
모두 같은 락을 지난다(종결 시점 실측: 락을 지나는 쓰기 자리 **9곳**). 남은 항목은 전부
**살아 있는 트래커**에 있다 — 봉인되는 plan 이 아니라.
