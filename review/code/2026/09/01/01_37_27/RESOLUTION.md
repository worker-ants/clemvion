# RESOLUTION — 아바타 업로드 리뷰 9라운드 (수렴)

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **6** · INFO 18

**이 라운드에서 수렴한다.** WARNING 6건 중 **4건이 "코드 변경 불요"** 로 리뷰가 스스로
판정한 것이고(SPEC-DRIFT 3 + 이미 유예 등재된 TOCTOU 1), 남은 2건 중 하나는 `codebase/`
밖이라 이 자리에서 고쳤다.

## 처리

| # | 처리 | 내용 |
|---|---|---|
| 1·2·3 | 코드 변경 불요 | SPEC-DRIFT — 리뷰가 "**코드가 옳고 spec 이 낡음**" 으로 판정. `plan/in-progress/spec-update-avatar-upload-implemented.md` 에 세 문서 대상 줄까지 등재돼 planner 트랙으로 정상 위임됨 |
| 4 | 유예 유지 | 동시 업로드 TOCTOU — "신규 조치 불요, 유예 유지, `avatars/` 객체 수 모니터링만 추적". 7라운드에서 이 유예 근거가 한 번 반증됐던 이력과 다시 성립함을 보인 실측 표는 이미 plan 에 있다 |
| 5 | **plan 등재** | `uploadAvatar` 컨트롤러의 예외 전파 테스트 — 아래 별도 항목 |
| 6 | **수정** | CHANGELOG 가 로그인 카운터 collateral 변경을 누락 — 아래 별도 항목 |

## W6 — 리뷰가 "가장 실질적인 갭" 으로 꼽은 것

CHANGELOG 가 `ExpressNS` 리네임 같은 사소한 부수 변경은 한 문단으로 disclose 하면서,
**`incrementLoginAttempts` 의 원자적 재작성과 시계 비대칭은 통째로 빠져 있었다.** 보안 관련
동작 변경이 변경 기록에 없는 것이 이 changeset 의 가장 큰 실질 갭이라는 판정에 동의한다.

한 절을 더했다 — 왜 이 PR 이 인증 코드를 건드렸는지(아바타 업로드가 만든 결함이라 여기서
닫는다), 부수적으로 잠금이 강해진 이유(read-modify-write 는 동시 실패에서 카운터를 잃는다),
그리고 시계 비대칭을 의도적으로 남긴 근거와 재개 조건.

**`CHANGELOG.md` 는 `codebase/` 밖이라 리뷰 게이트의 freshness 시계를 리셋하지 않는다.**
그래서 이 수정은 라운드를 늘리지 않고 지금 반영할 수 있었다.

## W5 를 plan 으로 미룬 이유 — 게이트 구조

`uploadAvatar` 컨트롤러 테스트에 `rejects.toThrow` 케이스가 없다. 형제 엔드포인트에는 있다.
**위험은 낮다** — 컨트롤러가 `await` 로 그대로 전파하고, e2e 가 400·413 을 **실제 HTTP
응답까지** 확인한다.

`codebase/` 를 고치면 그 수정을 덮는 리뷰 라운드가 반드시 하나 더 붙는다(게이트가 리뷰 시각
> 코드 시각을 요구). Critical 0 · LOW 시점에 이 한 건을 위해 라운드를 늘리는 것은 값이 맞지
않는다. plan 에 **왜 미뤘는지까지** 적어 등재했다 — INFO 14(TOCTOU `it.todo` 캐너리)도 같은
이유로 함께 넣었다.

## 수렴 근거

| 라운드 | 위험도 | Critical | Warning |
|---|---|---|---|
| 1 | HIGH | 2 | 9 |
| 2 | CRITICAL | 1 | 13 |
| 3 | CRITICAL | 1 | 13 |
| 4 | MEDIUM | 0 | 9 |
| 5 | MEDIUM | 0 | 6 |
| 6 | LOW | 0 | 2 |
| 7 | CRITICAL | 1 | 2 |
| 8 | MEDIUM | 0 | 3 |
| 9 | **LOW** | **0** | 6 (4건 "변경 불요") |

발견의 성격이 **동작 → 배포 설정 → 구조·문서 → spec 위임 대상**으로 이동했고, 9라운드
WARNING 은 실질적으로 2건이다. 리뷰 스스로 "12개 reviewer 전원 Critical 0" 을 기록했고,
과거 CRITICAL 두 건(500 전파·lost update)의 해소를 각 라운드가 **코드 직접 확인으로
재검증**했다.

INFO 18건은 전부 조치 불요이거나 이미 유예 등재(매직바이트·nosniff·전용 throttle·
MemoryStorage·`S3Module` 승격·`UserAvatarService` 분리·스타일 5건)다.

## 검증

이 라운드의 변경은 `CHANGELOG.md` + `plan/` 뿐이라 `codebase/` 무변경이다 — 직전 커밋에서
확인한 lint · backend **440 suites / 9168 passed, 1 skipped** · docs 가드 **3104** ·
e2e **50 suites / 291 passed** 가 그대로 유효하다. docs 가드는 plan 편집 후 재실행한다.
