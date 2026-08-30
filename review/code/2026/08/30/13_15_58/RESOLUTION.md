# RESOLUTION — 13_15_58

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING #1 (requirement) — `ALLOWED` 파일 단위 전면 면제 | 코드 | `a2ab29e2c` | `ALLOWED` 를 (파일, 사유, 사유가 검토한 raw 지점 수) 3-tuple 로 확장. `findUnguarded` 가 `rawCount > allowedCount` 를 unguarded 로 분류 |
| WARNING #2 (testing) — 판정 로직 검증 부재(프로브 1회뿐) | 코드 | `a2ab29e2c` | 판정을 `findUnguarded(discovered, allowed, guardCountOf)` 순수 함수로 추출, 합성 입력 6건으로 영속 고정 (부분/완전/초과 커버리지 + 허용목록 초과/이내) |
| WARNING #3 (testing) — `countRawUpdateReturning` blind spot 미고정 | 코드 | `030e9a825` | `source-scan.spec.ts` 음성 `it.each` 에 `.query(sqlVar)`·2단계 중첩 제네릭 2건 추가, 실제 `false`/`0` 확인 |
| INFO #1 (maintainability) — `20` 매직넘버 | 코드 | `a2ab29e2c` | `MIN_REASON_LENGTH` 상수화 |
| INFO #2 (maintainability) — `SRC` 중복 선언 | 코드 | `a2ab29e2c` | 파일 상단으로 hoist, 두 describe 가 공유 |

INFO #3~#7 은 SUMMARY 자체가 "조치 불요"로 명시 — 아래 보류·후속 항목 참조.

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend/frontend/web-chat/channel-web-chat/internal packages 전부, 신규 26 테스트 포함)
- build : 통과 (backend/frontend/web-chat/channel-web-chat, docker 이미지 검증 포함)
- e2e   : 통과 (285/285) — `.spec.ts` 전용 변경이라도 PROJECT.md §e2e 면제 화이트리스트가
  "회색지대(예: `*.test.ts` 만 변경)도 면제 아님"을 명시 지목해 수행. 로그:
  `_test_logs/e2e-20260830-134002.log`

## 뮤테이션 검증 (예측/실측)

프로브 파일을 만들었다 지우는 방식이 아니라 **영속 테스트 자체**를 대상으로 뮤테이션했다.
각 뮤턴트는 `cp` 백업 후 적용, 확인 후 `cp` 로 원복(`git checkout`/`restore` 미사용).

| # | 뮤턴트 | 예측 | 실측 |
|---|--------|------|------|
| 1 | `findUnguarded` 의 `guardCountOf(rel) < rawCount` → `guardCountOf(rel) === 0` (구 판정 재현) | 부분 커버리지 합성 테스트 RED | RED — `부분 커버리지(raw 2곳 중 헬퍼 1곳) → unguarded` 정확히 실패, 나머지 19건 GREEN |
| 2 | `ALLOWED` 개수 비교 제거(`if (allowedCount !== undefined) { continue; }`, 파일 단위 전면 면제 재현) | W1 합성 테스트 RED | RED — `허용목록 파일의 raw 지점이 허용 수를 넘으면 unguarded` 정확히 실패, 나머지 19건 GREEN |
| 3 | `countRawUpdateReturning` 을 항상 `1` 반환으로 뭉갬 | 음성 케이스 RED | RED — 8건 실패, 그중 신규 2건(`.query(sqlVar)`, 2단계 중첩 제네릭) 포함 |

세 뮤턴트 모두 예측한 정확한 테스트만 실패시키고 원복 후 `git status` 로 커밋 상태와의
diff 0 을 확인했다.

## 보류·후속 항목

- INFO #3 (`hasRawUpdateReturning` 소비자 없음) — SUMMARY 가 "조치 불요, 두 번째 소비자
  생기기 전까지 현행 유지" 로 명시. 조치 안 함.
- INFO #4 (raw UPDATE 불변식 spec 규약 미문서화) — SUMMARY 가 "이미 planner 위임으로 추적
  중" 으로 명시 (`plan/in-progress/update-returning-tuple-shape.md:409`). 조치 안 함, spec
  변경 없음.
- INFO #5 (`kb-stats.helper.ts` 스코프) — SUMMARY 가 "조치 불요, 이전 라운드 승인" 으로
  명시. 조치 안 함.
- INFO #6 (`node-cancellation.md` frontmatter `pending_plans` 미등재) — SUMMARY 가
  "developer 권한 밖, planner 턴 대상" 으로 명시. 조치 안 함.
- INFO #7 (security/side_effect, 스캐너 표면 안전성) — SUMMARY 가 "조치 불요" 로 명시.
  조치 안 함.

spec draft 위임 없음 — Critical 0, spec 결함/SPEC-DRIFT 항목 없음, WARNING 3건 전부 가드
자신의 코드 정밀도 문제(코드 관련)로 분류.

---

## main 의 독립 재검증 — 이번엔 **커밋된 테스트**가 잡는다

지난 두 라운드에서 반복한 실수(프로브로 확인하고 삭제)를 이번엔 하지 않았다. 같은 두
뮤턴트를 직접 주입했고, **잡은 것이 스위트에 남아 있는 테스트**다:

| 뮤턴트 | 예측 | 실측 | 잡은 테스트 |
| --- | --- | --- | --- |
| 판정을 구 `guardCountOf(rel) === 0` 으로 되돌림 | RED | **RED 1** | `부분 커버리지(raw 2곳 중 헬퍼 1곳) → unguarded` |
| 허용목록의 개수 비교 제거(파일 단위 전면 면제 재현) | RED | **RED 1** | `허용목록 파일의 raw 지점이 허용 수를 넘으면 unguarded` |

원복 후 `src/common/**` **16 suites / 218 tests** GREEN, `git status` clean.

**차이는 이것이다** — 지난 라운드에는 같은 판별을 임시 프로브 파일로 확인하고 지웠다.
지금은 `findUnguarded` 가 파일시스템을 안 만지는 순수 함수라 합성 스텁을 먹일 수 있고,
그 판별 입력이 **영속 테스트로 커밋돼** 있다. 위 뮤턴트를 내일 다시 넣으면 **이름 있는
테스트가** RED 를 낸다.

## 이 PR 이 세 라운드 돈 이유 — 기록해 둔다

리뷰가 매 라운드 **같은 병의 다음 겹**을 짚었다. 셋 다 맞았고, 셋 다 내가 만든 것이다.

| 라운드 | 가드가 막으려던 것 | 가드 자신이 가졌던 것 |
| --- | --- | --- |
| 1 | 목록이 좁아 지점을 놓침 | 정규식이 중첩 제네릭을 놓침 · **파일 단위 존재-only 판정** · 스캐너 전용 테스트 0개 |
| 2 | 지점 존재만 보고 개수를 안 봄 | **허용목록이 파일 단위 전면 면제** · 개수 판정의 판별 입력 부재 · 문서화된 한계 미고정 |

**핵심 실패는 "검증이 fix 보다 한 칸 얕다" 였고, 원인은 구조였다.** 판정이 `it` 본문에
인라인이라 **애초에 합성 입력을 넣을 수 없었고**, 그래서 매번 프로브에 의존했다. 프로브는
지워지므로 다음 라운드에 같은 지적이 다시 온다. 3라운드에서 판정을 순수 함수로 뽑고 나서야
그 고리가 끊겼다 — **테스트 가능한 형태로 만드는 것 자체가 fix 의 일부였다.**

부수로 하나 더: 2라운드 RESOLUTION 에 *"되돌린 뮤테이션은 회귀 방어가 아니다(#1238 교훈)"*
라고 적으면서 **같은 문서에서 그 짓을 했다.** 교훈을 적는 것과 적용하는 것은 다른 동작이다.
