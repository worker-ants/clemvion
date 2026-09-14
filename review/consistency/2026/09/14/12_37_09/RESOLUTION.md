# RESOLUTION — `--impl-done spec/conventions/` 라운드 4 (`review/consistency/2026/09/14/12_37_09`)

**BLOCK: NO** · Critical 0 · WARNING 1 · INFO 3 · **전체 위험도 NONE**.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 실측 **0건**.
`rationale_continuity`·`convention_compliance`·`plan_coherence`·`naming_collision` **NONE**.

## WARNING#1 — 내 등재 스코프가 N−1 이었다 (고침, 그리고 N 이 3이었다)

checker 가 *"`secret-store.md §R4` 는 등재됐는데 `1-data-model.md:791` 은 그 스코프에
미포함 — 한 곳만 고치면 재발"* 이라 짚었다. 타당하다.

**고치기 전에 전수 grep 을 먼저 돌렸고, 세 곳이었다** — checker 도 나도 못 본 셋째가 있다:

| # | 자리 | 소유 | 처분 |
|---|---|---|---|
| 1 | `spec/conventions/secret-store.md:428` (§R4) | planner | `remove()` 로 정정 |
| 2 | `spec/1-data-model.md:791` | planner | 같음 (checker 가 찾음) |
| 3 | `codebase/backend/migrations/V063__secret_store.sql:20` | developer | **고치지 않는다** |

### 3번은 «고칠 수 있는데 고치지 않는» 것이 아니라 «고치면 깨지는» 자리다

`docker-compose.e2e.yml:111-113` 실측 — 마이그레이션을 `/flyway/sql` 로 마운트하고
`flyway migrate` 를 돌린다. `migrate` 는 **이미 적용된 마이그레이션의 체크섬을 검증**하므로,
주석 한 글자만 바꿔도 V063 이 적용된 장수 DB 에서 `migrate` 가 실패한다.

> e2e 는 매번 `down -v` 라 무해하지만 **그것은 판단 근거가 될 수 없다** — 프로덕션·개발
> DB 가 판단 대상이다. 트래커에 이 판단을 적어 다음 사람이 «친절하게» 고치는 것을 막았고,
> 굳이 남기려면 `migrations/README.md` 쪽이 맞다는 대안도 함께 적었다.

### 이 형태가 이 배치에서 다섯 번째다

`/ai-review` 라운드 4 RESOLUTION 에 표로 정리했다 — 넷은 코드 쪽, 이번 하나는 트래커 쪽이다.
공통 뿌리는 **«열거는 하는데 열거한 항 전부를 덮지 않는다»** 이고, 이번에 지킨 규율은
**«N 을 적기 전에 그 N 에 대한 전수 grep 을 먼저 돌린다»** 다. 그렇게 해서 셋째를 찾았고,
그 자리가 무조치가 정답임까지 드러났다.

## INFO 3건 — 조치 불요

| # | 항목 | 사유 |
|---|---|---|
| 1 | `2-trigger-list.md` `code:` 미반영 | 등재분. checker 가 *"신규 등재 불요, 기존 처분 유지"* |
| 2 | repo-guard 14 중 5 만 `code:` 등재 | checker 가 **`spec-impl-evidence.md` 는 전수 등재 의무를 두지 않는다(≥1 매치 요구뿐)** 를 확인 — 내 라운드 1 등재가 *"관례가 없다"* 로 판정한 것과 같은 결론이고, 근거는 더 정확하다 |
| 3 | 신규 식별자 전부 파일 로컬 스코프 | 확인 |
