# RESOLUTION — `review/code/2026/09/24/15_26_17` (2라운드)

**Critical 0 · Warning 2 · INFO 12.** reviewer 14명 전원 산출물 확보, `forced_missing` 0 —
1라운드의 커버리지 갭(`database`·`api_contract`·`user_guide_sync` 미확보)은 이 전수
라운드가 덮었고 세 관점 모두 «해당 코드 없음 / 위험도 NONE» 이었다.

Warning 2건 **둘 다 내 것이고 둘 다 조치했다. 보류 0건.**

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Warning 1 | npm script **텍스트** 자체를 지키는 가드가 없다 — 이 PR 이 고친 `test:debug` 드리프트와 같은 클래스가 재발해도 못 잡는다 | `esm-native-load.spec.ts` 에 정적 대조 단언 추가. **전제 실측**: `test:cov`·`test:watch`·`test:debug` 는 CI·Makefile·`test-stages.sh`·docker-compose **어디서도 안 불린다**(grep 0건) — 그래서 scaffold 이후 방치됐다. 뮤테이션 3종 아래 | `f14d680ae` |
| Warning 2 | 트래커 항목이 pathspec 을 8개로 적고 **"뿐이다"** 라고 완전성을 주장했는데 실제 **12개** | 전수 12개로 정정 + **어떻게 셌는지 명령까지** 본문에 적음. 내가 틀린 경위(`grep -A 20` 잘린 출력을 전수의 프록시로 삼음)도 인용문으로 남김 | `f14d680ae` |
| INFO 3 | 새 가드의 canary 가 `uuid`(downlevel **가능**)라, 이 마이그레이션의 진짜 벽인 `import.meta.url`(downlevel **불가**)은 가드가 초록이어도 미검증 | `nestjs-v12-coordinated-upgrade.md` §B 에 인용 블록 추가 — 로컬 선측정은 있으나 **상주 검증이 아니며 착수 시 직접 확인할 것** | `f14d680ae` |
| INFO 4 | 플래그는 CLI 인자라 5개 script 문자열에만 존재 — script 를 우회하는 호출(IDE 러너, `npx jest`)은 불변식 **밖** | 가드 스펙 헤더에 **덮지 못하는 것**으로 명시. 보증을 만든 것보다 넓게 말하지 않는다 | `f14d680ae` |
| INFO 10 | CHANGELOG 「해당 없음」 판정이 타당하나 성문 근거가 없어 유사 사례마다 재도출해야 함 | **등재**(아래 §보류·후속). 이 표는 「X 를 바꾸면 Y 도」 구조라 **부정 행과 범주가 안 맞고**, `doc-sync-matrix.json` 과 행 수 1:1 로 묶여 있어 2군데 편집이다 — 규약 자리를 정하는 판단이 먼저다 | — |

### 뮤테이션 — 새 단언이 공허하지 않음을 실증

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| M5 `test:cov` 에서 플래그만 제거 | RED | **RED** — 실패 메시지가 `test:cov: …` 로 **어느 script 인지** 지목(값에 이름을 붙여 단언한 이유) |
| M6 `test:debug` 를 원래의 깨진 shim 으로 되돌림 | RED (실제 회귀 형태) | **RED** — `…register node_modules/.bin/jest --runInBand` |
| M7 접두어 없는 새 jest script 추가 | RED (인구조사 축) | **RED** — `+ "test:ci"` |

M7 이 있는 이유: 단언이 값만 검사하면 **접두어 없는 script 가 새로 추가되는 경로**가 열려
있다. 명단을 못 박아 늘거나 줄 때 사람이 다시 보게 한다.

원복은 전부 `cp` + 절대경로(`git checkout`/`git restore` 미사용), 원복 후 `git diff` 에
`package.json` 이 **없음**을 확인했다.

### 나머지 INFO 처분

- **INFO 1 · 2 · 6 · 7 · 8 · 11 · 12** — 「없음」 또는 긍정 확인(1라운드 조치가 실제로
  반영됐음을 각 reviewer 가 재현으로 재확인). 조치 대상 아님.
- **INFO 5** (5개 script 접두어 중복) — 1라운드에서 이미 defer 했고 reviewer 도
  「현 규모에서 조치 불필요」로 동의. 새 지적이 아니다.
- **INFO 9** — 새 가드가 `<name>-guard.ts` + `<name>.spec.ts` 분리 관례를 안 따르는 것이
  **위반이 아님**을 reviewer 가 선례(`workspace-roles-attachment.spec.ts`)로 확인. 조치 없음.

## TEST 결과

조치 후 전 단계를 **두 번** 돌렸다 (Warning fix 뒤 한 번, INFO 3·4 반영 뒤 한 번). 최종:

| 단계 | 결과 | 로그 |
| --- | --- | --- |
| lint | **PASS** | `_test_logs/lint-20260924-155033.log` |
| unit | **PASS** — backend **473 스위트 / 9950**(직전 473 / 9949 — 새 단언 하나만큼 정확히 증가) | `_test_logs/unit-20260924-155133.log` |
| build | **PASS** (타입체크 ratchet 둘 포함) | `_test_logs/build-20260924-155310.log` |
| e2e | **통과** — 380 PASS | `_test_logs/e2e-20260924-155555.log` |

## 보류·후속 항목

Warning 은 보류 0건. INFO 10 만 트래커로 이관했다:

- `plan/in-progress/spec-draft-nullable-notation-followups.md` — **「CHANGELOG 「해당 없음」
  판정에 성문 근거가 없다」** (developer, 낮음). 범주 불일치(부정 행)와
  `doc-sync-matrix.json` 행 수 1:1 결속 때문에 표에 행을 넣는 것이 정답이 아닐 수 있다는
  분석과, 더 싼 처방 후보(규약 문단을 범주가 맞는 자리에)를 함께 적었다.

1라운드에서 등재한 **「docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다」** 항목은
이 라운드의 Warning 2 로 **본문이 정정됐다**(8 → 12). 항목 자체는 그대로 열려 있다.
