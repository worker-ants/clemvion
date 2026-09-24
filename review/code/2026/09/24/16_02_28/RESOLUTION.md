# RESOLUTION — `review/code/2026/09/24/16_02_28` (3라운드)

**Critical 0 · Warning 1 · INFO 15.** reviewer 14명 전원 산출물 확보, `forced_missing` 0.

Warning 1건은 **2라운드에서 내가 세운 가드 자신의 결함**이었다. 조치했다. **보류 0건.**

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Warning 1 | census 가드가 플래그와 진입점의 **존재**만 보고 **순서**를 안 본다. 플래그가 진입점 뒤로 가면 node 가 아니라 jest 가 받는데, CI 가 안 돌리는 세 script 에서는 가드도 CI 도 조용히 통과 | `indexOf` 로 `flagIdx < entryIdx` 단언. **존재 단언을 함께 남겼다** — 순서 비교만 두면 플래그 부재 시 `-1 < entryIdx` 로 공허하게 통과한다. 뮤테이션 2종 아래 | `a49b62108` |

### 재현

리뷰어 주장을 그대로 받지 않고 직접 실행했다:

```
$ node ./node_modules/jest/bin/jest.js --experimental-vm-modules …
● Unrecognized CLI Parameter:
  Unrecognized option "experimental-vm-modules".
```

**이 지적의 성격**: 2라운드에서 내가 세운 가드가, 그 가드가 막으려던 결함 클래스
(**존재 검사 ≠ 정합 검사**)를 스스로 범했다. 「고친 자리」가 아니라 「같은 형태」를
봤어야 했다.

### 뮤테이션

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| M8 플래그를 진입점 **뒤**로 이동 | RED (종전 가드는 통과시켰다) | **RED** — `flagBeforeEntry: false`, 99행 |
| M9 플래그 **완전 제거** | RED (존재 단언이 잡나 — 순서 비교만이면 `-1 < n` 통과) | **RED** — `hasFlag: false`, **92행** |

M9 가 92행(**존재** 단언)에서 걸린다는 사실이 핵심이다 — 순서 비교만 두었다면 이 뮤턴트는
초록이었다. 두 단언이 서로를 떠받친다.

원복은 `cp` + 절대경로, 원복 후 `git diff` 에 `package.json` **없음** 확인.

## INFO 처분

조치한 것 없음. 판단이 필요했던 둘만 근거를 남긴다.

### INFO 1 — `PROJECT.md` 편집에 취소선이 없다는 지적: **적용 대상이 아니다**

`scope` reviewer 가 CLAUDE.md §자기-반증형 소정정의 **조건 4(원문을 취소선으로 남길 것)**
를 내 `PROJECT.md` 편집에 적용해야 한다고 봤다. 두 가지 이유로 **따르지 않는다**:

1. **그 조항의 스코프는 `spec/` 이다.** 절 제목 자체가 *"`developer` 가 `spec/` 을 고칠 수
   있는 유일한 경우"* 이고, `PROJECT.md` 는 developer SKILL 의 권한 표에서 **Read/Write**
   다. 예외를 발동할 일이 없으니 예외의 형식 요건도 적용되지 않는다.
2. **애초에 반증이 아니다.** 원문은 *"…트리거 전까지 보류한다"* 였고 그 **트리거가
   발화**했다. 조건이 충족된 것이지 문장이 틀린 것이 아니다. 취소선을 씌우면 오히려
   *"저 정책은 폐기됐다"* 로 읽혀 **없던 거짓을 만든다.** `documentation` reviewer 도 같은
   결론(「반증이 아니라 사실 보강」)이었고, 두 관점이 갈린 것을 요약이 병기해 줬다.

### INFO 2 — `uuid: ^14.0.1` 선언 vs 설치본 13.0.2: **이미 설계로 덮여 있다**

워크스페이스 `overrides` 가 강제하는 pre-existing 불일치이고 이 PR 스코프 밖이다. 다만
**내 canary 가정과 닿아 있어** 한 줄 남긴다 — override 가 풀려 `uuid@14` 가 설치돼도
가드는 안전하다. 2라운드에 넣은 **공허성 단언(M4)** 이 「canary 가 아직 ESM-only 인가」를
매 실행 검사하므로, `uuid` 가 CJS 로 돌아가면 초록으로 묻히지 않고 **실패해서** canary 를
갈아 끼우게 한다.

나머지 INFO(3·4·5·6·7·8·9·10·11·12·13·14·15)는 「조치 불요」 또는 **전 라운드 조치가
유지됨을 재확인**한 것으로, 전부 reviewer 자신이 non-actionable 로 분류했다. 그중 셋은
이미 트래커에 등재돼 있다(백로그 파일 비대화 · CHANGELOG 판정 성문화 · `import.meta.url`
케이스 미검증).

## TEST 결과

| 단계 | 결과 | 로그 |
| --- | --- | --- |
| lint | **PASS** | `_test_logs/lint-20260924-161634.log` |
| unit | **PASS** — backend **473 스위트 / 9950**(단언 *교체*라 수 불변이 정상) | `_test_logs/unit-20260924-161731.log` |
| build | **PASS** (타입체크 ratchet 둘 포함) | `_test_logs/build-20260924-161905.log` |
| e2e | **통과** — 380 PASS | `_test_logs/e2e-20260924-162211.log` |

## 보류·후속 항목

**없다.** 이 라운드의 Warning 은 보류 없이 닫았고, 새로 등재한 항목도 없다
(INFO 중 등재 가치가 있는 것은 1·2라운드에 이미 올렸다).
