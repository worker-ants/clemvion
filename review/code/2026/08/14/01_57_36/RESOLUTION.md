# RESOLUTION — `01_57_36` (+ consistency `01_57_37`)

ai-review **CRITICAL 0 / WARNING 3** (forced 7명 전원). consistency **BLOCK: NO** (Critical 0).
문서 정정 1건 조치, 2건은 근거를 적어 넘김. **코드 변경 없음** — 조치가 전부 `plan/` 이다.

## 수렴 판단

발견의 성격으로 판단한다(개수가 아니라):

| 라운드 | 최상위 발견 |
|---|---|
| 7 | **CRITICAL** — 소셜 로그인 `rememberMe` 침묵 무시 (동작) |
| 8 | WARNING — 자매 가드 미적용·CHANGELOG 한쪽만 (구조) |
| 9 | WARNING — 헬퍼 상호참조·재보지 않은 트레이드오프 (문서/근거) |
| 10 | WARNING — 디렉토리 명명 변종 (명명) |
| 11 | WARNING — plan 내부 숫자 불일치·정규식 중복 (문서/DRY) |

**동작 → 구조 → 문서 → 명명 → DRY.** 프로덕션 결함은 7라운드에서 끝났고 이후는 전부
내 서술의 정확성과 위생이다. 여기서 수렴으로 본다.

## W2 (documentation) — 정본 문서가 "7곳" 과 "8곳" 을 동시에 말했다

**조치 완료.** `auth-oauth` 를 8번째 지점으로 추가하면서 섹션 제목만 고치고 본문·제목·
체크리스트를 놓쳤다. 실측: `7곳` 4건(`:2`·`:73`·`:188`·`:216`) vs `8곳` 1건(`:57`).

지적의 무게는 위치에 있다 — **이 문서를 4개의 다른 plan 이 "근거" 로 링크한다.** 정본이
자기모순이면 그 불일치가 전파된다. 헬퍼 호출 실측(2+5+1=8)으로 8이 맞음을 확인하고 4곳을
고쳤다. 남은 `7곳` 0건.

## W1 (side_effect) — blast radius, 조치 불요

되살아난 4갈래(admission `EXECUTION_STARTED` emit · 2초 재큐 지연 소멸 · KB CAS 락 409 ·
종결 메트릭)가 배포 즉시 발동한다. **이건 이 PR 의 목적 그 자체**이고, CHANGELOG 와 plan
§후속에 관측 5항목으로 이미 등재돼 있다. 리뷰어도 "조치 불요" 로 달았다.

## W3 (maintainability) — 정규식 중복, 근거를 실측해 유예

`countCalls`/`stripComments` 는 `source-scan.ts` 로 합쳤는데 `CONSUMING` 정규식은 두 spec
파일에 복제된 채 남았다. 지적이 맞다.

**유예 근거(실측)** — 이 drift 는 **조용하지 않다.** 두 가드가 기대 개수를 리터럴로 박아
둔다(`expect(counts).toEqual([3, 10, 0])` · `queries: 3`/`queries: 1`). 한쪽 정규식만 바뀌면
그 파일의 개수가 달라져 **그 가드가 RED** 가 된다. 즉 위험은 가독성·DRY 이지 침묵 실패가
아니다 — 이 PR 을 한 라운드 더 돌릴 만큼 급하지 않다.

plan §후속에 처방(`countConsumingQueries` 이관)과 자연스러운 착수 시점(세 번째 가드 등장)을
적어 등재했다.

## consistency `01_57_37` — 오탐이 멈췄다

**BLOCK: NO.** 그리고 이번 회차가 확인해 준 것이 있다. 직전 4라운드 중 2번이 "target 델타 0"
을 CRITICAL 로 올렸는데(`00_00_45`·`01_12_33`), 이번엔 5개 checker 전원이 그러지 않았다.
요약이 이유를 직접 적었다:

> *"이 harness 라우팅 결함은 이미 `update-returning-tuple-shape.md`(§후속)에 원인·처방
> 후보와 함께 기록된 known issue다. 5개 checker 전원이 이를 CRITICAL 로 재상신하지 않고
> … 과거 오탐 패턴을 올바르게 회피한 결과다."*

즉 `103dee234` 에서 **원인(stale 워크트리 이름 → 프롬프트에 박히는 절대경로)을 규명해
적어둔 것이 반복 오탐을 실제로 끊었다.** 근거 없이 "오탐이다" 라고 넘겼으면 이 라운드에도
같은 CRITICAL 이 나왔을 것이다.

### 신규 WARNING 3 — planner 위임 등재

`spec/data-flow/15-external-interaction.md` §4 의 Redis 키 캐빗이 `#1160`(`redis-keys.md`
신설) 이후 stale 하다 — "§9.1 참고, EIA 키는 미등재" 라는데 §9.1 은 redirect-only 가 됐고
그 키는 이미 등재됐다. **이 PR 과 무관한 별건**이고 spec 쓰기는 권한 밖이라, 집결 티켓
`#12` 에 "추가 2" 로 등재했다(같은 planner 턴에 묶으면 싸다).

## 검증

- lint `--max-warnings 0` 통과 · 36스위트 **824 passed** · ratchet **199/38 일치**
- `nest build` 산출물 배치 확인 (`dist/common/__test-utils__/source-scan.js` + 자매, spec 없음)
- 이번 라운드 조치는 `plan/` 전용 — 코드 변경 0줄이라 위 리뷰가 stale 되지 않는다

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| INFO 10·11·15 (변수명·파라미터명·3단 관용구 반복) | 다수 라운드 유예. 이 파일들을 다음에 실질 변경할 때 |
| INFO 12 (`{@link}` 미해석 가능) | 링크가 안 걸려도 텍스트로 읽힌다. type-only import 를 위해 프로덕션 파일에 의존을 늘리지 않는다 |
| INFO 13·16 (잔존 비-튜플 mock 4~7곳) | 헬퍼가 양쪽 shape 을 받으므로 기능 안전. 실 shape 고정은 e2e 가 담당 |
| INFO 14 (e2e `$4` 가 `$3` 보다 먼저) | 매핑은 정확. 가독성 항목 |
| INFO 18 (`reEmbedAll` 비-트랜잭션) | 기존 구조, 이 diff 밖. plan 후속 등재됨 |
| consistency INFO 1·3·4 | spec 표면 — planner 위임 또는 우선순위 낮음으로 기록됨 |
