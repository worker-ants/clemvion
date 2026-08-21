# RESOLUTION — 12_25_15

대상 SUMMARY: `review/code/2026/08/21/12_25_15/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **1**, INFO 15)

**처분: WARNING 1건 수정.** 더불어 `requirement` reviewer 가 **forced 인데 결과 없이** 종료돼
(연결 끊김) 이 라운드는 그 관점이 **미검증**이다 — 다음 라운드에서 메운다.

---

## WARNING 1 — 파생이 "전수처럼 보이지만 아닌" 목록을 만들었다 (architecture·maintainability) — **수정**

직전 라운드에서 손 목록(`SCAN_DIRS`)을 실측 파생으로 바꿨다. 그런데 그 파생이 `codebase/`
를 **한 단계만** 훑어 워크스페이스 패키지 7개(`ai-end-reason` 등)의 `src` 가 통째로 빠졌다.

> 손 목록이었을 때는 "세 개만 적혀 있다" 가 눈에 보였다. 파생으로 바꾸니 **전수처럼 읽히면서
> 실제로는 아니었다** — 미러를 없앤 대가로 누락이 더 잘 숨는 형태가 됐다.

`SOT_DIR` 자기 제외 분기가 도달 불가능한 죽은 코드였던 것도 같은 원인이다(3라운드 연속
INFO 로 나왔는데 근본 원인을 못 봤다).

- `resolveScanDirs` 를 **2단계**로 확장 — `codebase/<stack>/src` + `codebase/packages/<pkg>/src`.
- packages 를 실제로 훑게 되면서 `SOT_DIR` 접두 겹침이 **살아났다**. `startsWith(SOT_DIR)`
  만으로는 `masked-markers-extra` 같은 형제를 오배제하므로 **경계를 명시**했다
  (`=== SOT_DIR || startsWith(SOT_DIR + '/')`). 이 시리즈가 접두 겹침으로 반복해 당한 자리다.

### 캐너리가 왜 못 잡았나 — 하한만 보는 단언

당시 캐너리는 `dirs.length >= 3` 이었다. **좁은 목록도 그대로 통과**한다. 하한은 vacuity 는
막지만 **누락은 못 본다.**

형제 패키지가 실제로 들어오는지 **직접** 묻는 단언으로 바꿨다 —
`expect(dirs).toContain('codebase/packages/ai-end-reason/src')` 외 3건.

**뮤테이션 실증**: 옛 1단계 스캔으로 되돌리니 **새 캐너리 1건만 정확히 RED**(17 passed).
라운드2 에 실제로 나갔던 결함을 이 캐너리가 잡는다는 직접 증거다.

## 미조치 INFO (15건)

전부 리뷰어 스스로 "조치 불요·범위 밖·선례 일치" 판정. 대표 — 탐지 로직 중복(문서화된
트레이드오프) · `pnpm-lock` 노이즈(3라운드 연속 동일 판정) · `prepare` 9번째 사본 ·
CHANGELOG 미기재(선례 `ai-end-reason` 도 동일) · 리뷰 산출물 잔여 텍스트.

### INFO 7 은 트래커에 등재했다

backend `deepRedactSecrets` 의 깊이 경계 테스트 부재 — 프런트는 `nest(10)→true` /
`nest(11)→false` 로 정확히 고정하는데 backend 는 *"언젠가 멈춘다"* 만 본다. **2라운드째
이월만 되고 어디에도 안 적혀 있다**는 지적이 맞다. `review/**` 는 SoT 가 아니므로 plan 에
등재했다.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (49s) |
| unit | backend jest **431 suites / 8,914 passed**(1 skipped) · frontend **287 files** |
| build | PASS (165s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (210s) — backend supertest **276** · playwright **51 passed (55.6s)** |

두 미러 가드가 각각 **18건**으로 일치한다.
