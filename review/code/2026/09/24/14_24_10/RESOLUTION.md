# RESOLUTION — `review/code/2026/09/24/14_24_10`

전부 조치했다. **보류 0건.** 아래 표의 모든 지적을 실행으로 재현한 뒤 고쳤고, 재현하지
못했거나 반대 결론이 있었던 것은 어느 쪽을 채택했는지 근거와 함께 적는다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Critical 1 | 새 plan 스텁의 `worktree: (미정 — 착수 시 생성)` 이 `WORKTREE_PLACEHOLDER` 에 걸려 `plan-frontmatter.test.ts` FAIL | `(unstarted)` 로 정정. **재현**: 고치기 전 157 중 1 FAIL(`worktree "(미정 — 착수 시 생성)" 는 placeholder`) → 고친 뒤 **157/157** | `815d2e180` |
| Warning 1 | `test:debug` 가 `node node_modules/.bin/jest`(= `#!/bin/sh` 셸 shim)를 불러 즉시 `SyntaxError` | 나머지 넷과 같은 `./node_modules/jest/bin/jest.js` 로 통일. **재현**: 고치기 전 `SyntaxError: missing ) after argument list` → 고친 뒤 같은 명령이 `--listTests` 로 정상 부팅(exit 0) | `815d2e180` |
| Warning 2 | `jest.config.ts` 상단 독스트링이 이 PR 이 방금 제거한 정규식을 존재 이유로 서술 | 지금 이 파일이 주석하는 대상(기본값이 의도적인 이유와 그것을 떠받치는 것)으로 갈아 끼움 | `815d2e180` |
| Warning 3 | `nestjs-v12-coordinated-upgrade.md` §C 가 untracked 인 `review/consistency/2026/09/24/12_57_36` 을 인용 | 그 산출물을 **커밋에 포함**(`CLAUDE.md` §정보 저장 위치 의 「일관성 검토 산출물」 규약). 요지 자체는 §C 본문에 이미 인라인돼 있어 참조가 끊겨도 내용은 보존된다 | `815d2e180` |
| INFO 5 | `PROJECT.md:82` 의 「packages/\* vitest 이행은 jest 가 막는 ESM 의존이 등장하는 트리거 전까지 보류」 전제와 이 PR 의 해법 사이에 교차 참조 없음 | 한 문장 추가 — **이 PR 이 그 트리거인데 이행이 아니라 두 줄로 풀었다**. 근거의 거처는 가드 스펙 헤더로 뒀다(아래 §주의). 적용·검증된 것은 backend 뿐이고 packages/\* 에서는 재지 않았다는 사실도 함께 적었다 | `a8d1aceb4` |
| INFO 6 | ExperimentalWarning 줄 수를 plan 이 「10」이라 적었는데 로그 실카운트 9 | **다시 재서** 정정 — 11코어 머신 **9줄**. 워커 프로세스마다 1줄이라 머신에 따라 달라진다는 사실을 함께 적었다(숫자만 고치면 다음 사람이 또 고정값으로 읽는다) | `815d2e180` |
| INFO 12 | 「플래그 + 기본 허용목록은 한 쌍」 불변식을 지키는 전용 테스트가 없고 비즈니스 스펙의 **우연한 커버리지**에 의존 | `src/repo-guards/__tests__/esm-native-load.spec.ts` 신설(repo-guards 선례 준수). **뮤테이션 4종 전부 예측=실측** — 아래 §뮤테이션 | `a8d1aceb4` · `1fb23fa29` |
| 커버리지 갭 | `database` · `api_contract` · `user_guide_sync` 세 reviewer 의 산출물 미확보 | 이 라운드에서 재실행하지 **않았다** — 조치로 `codebase/**` 가 바뀌어 이 세션이 어차피 stale 이 되므로, 낡은 코드에 세 명을 다시 태우는 대신 **전수 fresh 라운드**로 덮는다. 세 이름 모두 `agents_forced` 밖이라 push 가드 판정에는 영향이 없다. 상태 파일은 `--sync-from-disk` 로 디스크와 맞췄다(success=11 / pending=3) | — |

### 반대 결론이 있었던 곳 — 무엇을 채택했나

`dependency-reviewer` 는 Warning 1 을 *"`.bin/jest` 가 같은 파일을 가리키므로 기능적으로
동등, 실동작 리스크 없음"* 이라며 INFO 로 분류했다. **채택하지 않았다** — `architecture` ·
`side_effect` · `testing` 세 reviewer 가 각각 독립 실행으로 `SyntaxError` 를 재현했고,
나도 직접 재현했다. 실행 없이 내린 추론보다 실측을 택한다.

덧붙여 이 Warning 은 **이 PR 이 만든 결함이 아니다** — `origin/main` 의
`node --inspect-brk … node_modules/.bin/jest` 도 똑같이 깨진다(실측). 그러나 이 PR 이
정확히 그 줄에 플래그를 얹으면서 고치지 않아 **나머지 넷과 어긋난 채** 남겼으므로 고쳤다.

### 뮤테이션 — 새 가드가 공허하지 않음을 실증

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| M1 플래그만 제거 | RED | **RED** — `Must use import to load ES Module: …/uuid@13.0.2/…` |
| M2 허용목록 복원 | RED | **RED** — `ReferenceError: exports is not defined` |
| M3 e2e 설정만 발산 | RED (3번째 단언만) | **RED** — 1 failed · 2 passed |
| M4 canary 를 CJS 로 가정 | RED (공허성 가드가 실값을 읽나) | **RED** — `Expected "commonjs" / Received "module"` |

원복은 전부 `cp` + 절대경로로 했고(`git checkout`/`git restore` 미사용), 원복 후
`git diff --stat` 이 **빈 출력**임을 확인했다.

### 주의 — 전방 참조를 하나 만들었다가 거뒀다

`PROJECT.md` 의 근거를 처음엔 `plan/complete/jest-esm-native-load.md` 로 적었다. 그 파일은
아직 `in-progress/` 이고 이 PR 의 마지막 커밋에서야 옮겨 간다. **`PROJECT.md` 링크 가드
(`test_doc_sync_matrix.py`)는 `spec/*.md` 경로와 `*.test.ts` 토큰만 검사해 이 종류를 못
잡는다(실측).** 그래서 근거의 영속 거처를 **가드 스펙 헤더**로 바꿨다 — 라이프사이클에
따라 움직이지 않는 자리다.

### CHANGELOG — 해당 없음 (누락이 아니라 판정)

`PROJECT.md §변경 유형 → 갱신 위치 매핑` 에 빌드·테스트 도구 행이 없고, `CHANGELOG.md` 의
**143개 항목이 전부 제품 동작 변경**이다(유일한 인접 사례 「npm audit 취약점 해소 의존성
상향」도 배포 의존성을 바꿨다). 이 PR 은 제품 동작도 배포 의존성도 바꾸지 않고 **테스트
러너의 모듈 로딩 방식**만 바꾼다. 이 세션에서 CHANGELOG 를 반복해 빠뜨린 이력이 있어
「빠뜨린 것이 아니라 판정했다」를 여기 남긴다.

## TEST 결과

조치 후 전 단계를 **두 번** 돌렸다 (`815d2e180` 뒤 한 번, `a8d1aceb4`·`1fb23fa29` 뒤 한 번).
아래는 최종 상태다.

| 단계 | 결과 | 로그 |
| --- | --- | --- |
| lint | **PASS** | `_test_logs/lint-20260924-151358.log` |
| unit | **PASS** — backend **473 스위트 / 9949**(직전 472 / 9946 — 새 스펙 1개와 그 테스트 3개만큼 정확히 증가), frontend 291 파일 / 6675 | `_test_logs/unit-20260924-151504.log` |
| build | **PASS** (타입체크 ratchet 둘 포함 — `test-stages.sh:95` 의 `_cmd_typecheck_ratchets`) | `_test_logs/build-20260924-151654.log` |
| e2e | **통과** — 380 PASS | `_test_logs/e2e-20260924-151942.log` |

하네스: `python3 -m pytest .claude/tests -q` → **1138 passed** (`PROJECT.md` 편집이
`test_doc_sync_matrix.py` 를 건드리므로).

## 보류·후속 항목

**이 라운드에서 보류한 지적은 없다.** 조치 중 새로 실측한 **구조적 갭 하나**를
트래커에 등재했다 — 이 PR 의 스코프가 아니고 비용 판단이 필요하다:

- `plan/in-progress/spec-draft-nullable-notation-followups.md` — **「docs 가드가 검사하는
  데이터가 그 가드를 트리거하지 않는다」** (developer, 중간).
  `frontend-checks.yml` 의 pathspec 에 `plan/**` · `spec/**` 이 없어서, **이 PR 의 Critical 1
  은 CI 에서 드러나지 않았을 것**이다(backend 만 바꿨으므로 가드 잡이 통째로 skip). 로컬
  재현이 아니었으면 초록으로 머지되고 다음 frontend PR 이 빨개졌다. 처방 둘((a) pathspec
  확대 (b) docs 가드 전용 잡 분리)과 각각의 비용, 그리고 (b) 를 권하는 근거를 함께 적었다.

INFO 중 조치하지 않은 것과 그 이유:

- **INFO 2** (jest-runtime probe 부재 시 fail-fast 가드 추가) — 같은 실패를 INFO 12 의
  가드가 **더 직접** 잡는다. 플래그가 빠지면 `esm-native-load.spec.ts` 가 이름 붙은
  스위트로 죽고, 그 헤더가 두 방향의 실측 에러 문구를 그대로 적고 있어 「Node 버전 문제」로
  오도될 여지가 없다. 장치를 둘 두지 않는다.
- **INFO 7** (5개 script 의 접두어 중복) · **INFO 8** (코드 주석과 plan 서사의 중복) —
  reviewer 스스로 「우선순위 낮음」으로 냈고, 둘 다 **단일화가 오히려 간접층을 만든다**
  (script 접두어를 셸 스크립트로 빼면 `package.json` 만 읽어서는 무엇으로 도는지 알 수
  없게 된다). 등재하지 않는 것도 판단이므로 여기 남긴다.
