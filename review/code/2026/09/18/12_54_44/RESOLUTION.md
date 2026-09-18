# RESOLUTION — review/code/2026/09/18/12_54_44 (2라운드)

SUMMARY: 위험도 LOW · Critical 0 · Warning 2 · INFO 10. forced 8명 전원 결과 확보.

정지 규칙(결과를 보기 전에 `plan/complete/spec-draft-trigger-workflow-index.md` 체크리스트에 적었다): Critical 0 이고 남은 Warning 이
동작 결함이 아닌 `codebase/**` 문서·주석이면 수렴 예외로 등재하고 3라운드를 돌지 않는다. 이번 두 Warning 은 **`codebase/**` 를
고치지 않고 닫힌다**(plan 이동 · spec 편집) — 그래서 실제로 고쳤고, 코드가 이 리뷰 뒤로 바뀌지 않았으므로 3라운드도 필요 없다.

## 조치 항목

| SUMMARY # | 분류 | 조치 | commit |
|---|---|---|---|
| WARNING 1 | `plan/complete/spec-draft-trigger-workflow-index.md` 선인용 3곳(spec 1 · V111 SQL 주석 · e2e 주석)이 아직 없는 경로를 가리킨다 | draft 를 `plan/complete/` 로 옮겼다. 이동 뒤 `grep -rln` 으로 세 파일 모두 실재 경로를 가리킴을 확인 | 마무리 커밋 |
| WARNING 2 | `spec/conventions/migrations.md` §5 콜아웃이 «기존 인덱스를 **갈아 끼우는**» 경우만 README §5 를 따른다고 적어, 신규 추가는 따르지 않아도 되는 것처럼 읽힌다 | planner 턴: draft S4 → `--spec` `review/consistency/2026/09/18/13_04_19` BLOCK: NO → 콜아웃을 «`CREATE INDEX CONCURRENTLY` 를 쓰는 파일은 교체든 신규 추가든» 으로 넓히고 두 결과(V056 · V106)를 함께 적었다. **1라운드 RESOLUTION(`12_43_23`) 의 «교체에 한정돼 참이라 고치지 않는다» 처분을 뒤집는다** — 문장이 거짓이 아니어도 신규 추가를 배제하는 것으로 읽히는 오독 경로가 이 PR 이 없애려는 V106 결함을 다시 만든다. 자매 문서 `spec/data-flow/8-notifications.md` 의 «교체는 README §5 를 따른다» 는 V056(교체) 이력 경고라 주어가 교체이므로 그대로 둔다(draft «`--spec` 2회차 처분») | 마무리 커밋 |
| INFO 1 | `config` 의 e2e 행동 커버리지 없음 | 조치 없음 — provider mock 부재. 단위 단언의 판별력은 뮤턴트(`config` 제거 RED 1/1)로 실측 | — |
| INFO 2 | select 확장 시 조용한 `undefined` | 조치 없음 — JSDoc 이 «필드를 더 줄일 때 소비처부터» 를 적고 정확 대조 단언이 막는다 | — |
| INFO 3 | 순차 teardown | 트래커 «부모 삭제 경로의 성능 후속» 둘째 불릿으로 남김 | — |
| INFO 4 | `Schedule.find` select 미적용 | 조치 없음 — 리뷰 자체가 «실패 복구 경로가 엔티티 전체를 재사용» 이라 좁히면 위험하다고 적는다 | — |
| INFO 5~10 | 스코프 disclosure · 문장 누적 · 중복 서술 · CONCURRENTLY 스캔 시간 · DROP-먼저 비대칭 · 보안 | 조치 없음(확인·기존 관례) | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260918-123800.log`)
- unit: 통과 (`_test_logs/unit-20260918-123858.log`)
- build: 통과 — 타입체크 ratchet backend 197 · frontend 52 baseline 일치 (`_test_logs/build-20260918-124030.log`)
- e2e: 통과 — backend 322 (`_test_logs/e2e-20260918-124317.log`). 그 뒤의 변경은 `codebase/backend/migrations/README.md`(`*.md`) · `spec/**` · `plan/**` · `review/**` 뿐이라 PROJECT.md §e2e 면제 화이트리스트에 해당 — 마지막 **코드** 커밋 뒤 e2e 통과 줄은 위 322 다
