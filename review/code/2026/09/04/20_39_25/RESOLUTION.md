# RESOLUTION — `20_39_25`

전체 위험도 **LOW** · Critical **0** · WARNING **4**. 네 건 **전부 조치**했다 (등재 유예 없음).

## 조치 항목

| # | 카테고리 | 지적 | 조치 | commit |
|---|---|---|---|---|
| 1 | requirement | `collectNumericFields` 가 TypeORM 의 **포지셔널 타입 인자** (`@Column('numeric', { … })`) 를 못 읽어 numeric 컬럼을 조용히 "numeric 아님" 으로 분류 | `readColumnType(call, sf)` 신설 — 첫 인자가 문자열 리터럴이면 그것을, 아니면 `type:` 옵션을 읽는다. 두 형태(옵션 동반·단독)를 `it.each` 대조군으로 고정 | `b5d5210cf` |
| 2 | maintainability | `readStringOption` 이 `readBooleanOption` 의 순회 골격 12줄을 그대로 복제 | `readOption<T>(call, key, sf, pick)` 로 통합. 두 리더는 `pick` 만 다르다 | `b5d5210cf` |
| 3 | testing | 저장소 전수 스캔의 `expect([]).toEqual([])` 가 **"위반 없음"** 과 **"애초에 스캔 안 됨"** 을 구분 못함 (경로 상수 뮤턴트에서 GREEN 생존) | `scanNumericExposure` 가 위반 목록 + `numericColumns` / `responseDtoClasses` 를 함께 반환. `[전제]` 테스트가 **두 축을 각각** 단언 | `b5d5210cf` |
| 4 | testing | `threshold` 의 wire 타입을 되잡을 **런타임** 계약 테스트 부재 (`19_43_18` W1 잔여) | `test/alerts-threshold-wire-type.e2e-spec.ts` 신설 — `POST → GET → PATCH` 세 응답 모두 문자열임을 실 HTTP 로 단언 | `b5d5210cf` |

### W4 를 이번 턴에 닫은 이유 — §수렴 예외를 쓰지 않았다

직전 라운드(`20_16_17`)에서는 이 항목을 `developer` SKILL §수렴 예외로 유예했다. 이번에 다시
지적됐고, **유예 근거 쪽이 약했다**: 조건 (b)("fix 가 새 라운드를 강제한다")는 참이지만,
남은 세 WARNING 이 어차피 `codebase/**` 를 건드려 라운드를 한 번 더 돌게 되어 있었다. 즉
W4 만 유예해도 **아끼는 라운드가 0** 이었다. 유예의 값이 사라졌으므로 원칙대로 그 턴에
조치했다.

### 뮤테이션 실측 — 예측 / 실측

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| (원본) | GREEN 32 | **GREEN 32** |
| M1 `readColumnType` → `readStringOption(call,'type',sf)` (W1 회귀) | RED 2 (포지셔널 대조군 2건) | **RED 2** |
| M2 `ENTITY_DIR` → 없는 경로 (W3 회귀) | RED, **`[전제]` 포함** | **RED 9 — `[전제]` 포함** |
| M3 `RESPONSE_DTO_DIR` → 없는 경로 (W3 회귀) | RED, **`[전제]` 포함** | **RED 9 — `[전제]` 포함** |
| M4 `readBooleanOption` 의 `true` → `false` (W2 통합 회귀) | RED (presence 축) | **RED 6** |

M2·M3 은 실패한 **테스트 이름을 전수 확인**했다 — 개수만 세면 `[전제]` 가 살아남은 채
대조군만 죽는 경우와 갈리지 않는다. 두 뮤턴트 모두 `[전제]` 를 죽였다. 이것이 W3 이 지적한
바로 그 구멍이 닫혔다는 증거다.

뮤턴트 원복은 `cp` + 절대경로로 했고 (`git checkout` 금지), 매 회 치환 앵커의 존재를
`assert` 로 선검증해 **무효 뮤턴트가 GREEN 으로 위장하는 것**을 막았다. 마지막에
`git diff --quiet` 로 원복을 확인했다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`_test_logs/lint-20260904-210013.log`) |
| unit | **PASS** — backend jest **445 suites / 9,337 passed** (직전 라운드 9,334 → **+3**, 신규 테스트 수와 일치) · 타입 진단 ratchet **197건 / 36파일** baseline 일치 (`_test_logs/unit-20260904-210108.log`) |
| build | **PASS** (`_test_logs/build-20260904-210243.log`) |
| e2e | **통과** — **51 suites / 293 passed** (직전 라운드 292 → **+1**). 신규 스펙이 실제로 돌았음을 로그에서 확인 (`PASS test/alerts-threshold-wire-type.e2e-spec.ts`) — 개수만 보면 "실행됐다" 와 "제외됐는데 다른 게 늘었다" 가 갈리지 않는다 (`_test_logs/e2e-20260904-210518.log`) |

## 보류·후속 항목

- **INFO#1** (numeric 축 테스트 6곳에 `judgeNumeric` 로컬 헬퍼) · **INFO#2**
  (`extends`/`PickType` 합성 사각지대 캐너리) — 미조치. 둘 다 INFO 이고 **동작·검출력에
  영향이 없다**: INFO#1 은 순수 가독성, INFO#2 는 저장소에 실사례 0건이며 이미 문서화된
  `<Entity>Dto` 이름 관례 한계와 같은 성격이다.
- **INFO#3** (`spec/1-data-model.md:873` 의 `Float` 라벨) · **INFO#4**
  (`swagger.md` numeric 불변식 성문화) — 둘 다 `spec/` 쓰기라 developer 권한 밖.
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 이미 등재됨.
- **INFO#5·#6** — 조치 불요로 판정된 참고 사항 (리뷰 산출물 스냅샷 관례 · changeset 구성).
