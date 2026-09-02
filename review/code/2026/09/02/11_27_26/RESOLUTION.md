# RESOLUTION — frontend 타입체크 ratchet 리뷰 1라운드

대상 SUMMARY: 위험도 **CRITICAL** · Critical **2** · Warning **2** · INFO 8

**Critical 2건·Warning 2건 전부 조치.** INFO 중 넷도 처리했다. 두 Critical 모두 **이 PR 이
스스로 막으려던 실패 클래스가 이 PR 안에서 재발한 것**이라 등급이 맞다.

## C1 (requirement) — 진단 파서가 route group 경로를 통째로 버렸다

`DIAGNOSTIC` 정규식이 파일 부분을 `[^(]*` 로 잡아 **첫 여는 괄호에서 끊었다.** Next.js App
Router 의 route group(`src/app/(main)/…`)이 정확히 그 형태다.

직접 재현했다 — 리뷰어 수치를 받아쓰지 않았다:

```
count_by_file("src/app/(main)/…/scope-tab.test.tsx(44,3): error TS2322: x")  →  {}
count_by_file("src/lib/a.test.ts(1,1): error TS1: x")                        →  {…: 1}
```

**backend 에서 물려받은 패턴이라 여태 문제가 없었다** — backend 경로에는 괄호가 없다.
공유 코어로 올리면서 그 전제가 깨졌는데 나는 그것을 확인하지 않았다.

파일 부분을 non-greedy 로 두고 `(숫자,숫자): error TS` 를 앵커로 삼도록 고쳤다. `(main)` 은
숫자가 아니라 backtrack 되고 진짜 위치 괄호에서 멈춘다. 회귀 2건 추가 — 실제로 숨어 있던 그
경로와, **반대 방향 대조군**(들여쓴 상세 줄이 우연히 `(1,1): error TS…` 를 담아도 안 세어질 것).

**baseline 을 재생성했다: 51/14 → 52/15.** 숨어 있던 파일이
`src/app/(main)/w/[slug]/integrations/[id]/__tests__/scope-tab.test.tsx` 다.

> **내 앞선 판단이 거꾸로였다.** 커밋 메시지에 *"`grep -c` 로 센 52는 프록시였고 정본
> 카운터의 51이 맞다"* 고 적었는데, **grep 이 맞고 정본 카운터가 틀렸다.** 정본을 믿으라는
> 원칙 자체는 옳지만, 그 정본이 방금 내가 옮겨 온 코드일 때는 전제가 다르다 — 두 수치가
> 갈리면 **어느 쪽이 틀렸는지를 봐야지 권위로 정할 일이 아니었다.**

## C2 (documentation·side_effect) — 게이트가 자기 자신을 트리거하지 못했다

신규 `typecheck-ratchet` 잡이 **실행하는** 파일들(`_typecheck_ratchet.py` ·
`check-frontend-typecheck-ratchet.py` · `frontend-typecheck-baseline.json`)이 정작
`frontend-checks.yml` 의 `changes.pathspecs` 에 없었다. backend 쪽도 신규 공유 코어가 빠졌다.

결과: **이 파일들만 바뀐 PR** — `--update` 로 baseline 만 낮춘 커밋, 판정 규칙만 고친 커밋 —
은 `relevant=false` 로 판정돼 잡이 tsc 를 한 번도 안 돌리고 *"무관한 변경 — 검사 생략"* 으로
통과 보고한다. **게이트의 임계값과 판정 규칙을 고치는 커밋이 정작 그 게이트를 안 거친다.**

`harness-checks.yml` 에는 이 원칙을 정확히 적용했는데(공유 코어 포함) 실제 검증을 수행하는
두 워크플로에는 빠뜨렸다 — **한 층만 보고 끝냈다.** 세 파일을 `frontend-checks.yml` 에,
공유 코어를 `backend-checks.yml` 에 등재했다.

## W1 (requirement·maintainability) — 규칙이 tsconfig 와 비대칭

`TEST_FILE_RULES["frontend"]` 가 `__tests__/`·`.test.ts(x)`·`src/test/` 세 갈래만 갖고
tsconfig 가 명시하는 `.spec.ts(x)` 를 빠뜨렸다. **이 PR 이 스스로 경고하는 "규칙 사본이
갈린다" 의 축소판**이다.

갈래를 넓히는 것으로 끝내지 않았다 — 그러면 다음 패턴을 또 놓친다. **tsconfig 의 exclude
글롭을 전수 열거**하고 각각의 대표 경로를 규칙이 잡는지 확인하는 테스트를 넣었다. 여기에
**표본 집합 자체가 실제 tsconfig 와 같은 집합인지** 확인하는 전제 테스트를 덧붙였다 —
입력 집합이 곧 커버리지라, 줄이는 편집이 조용히 통과하는 자리이기 때문이다. 프로덕션 경로
대조군도 함께 뒀다(규칙이 너무 넓어지면 프로덕션 오류가 baseline 에 수용된다).

## W2 (testing·architecture·side_effect) — 테스트가 다른 모듈 객체를 검증했다

테스트가 공유 코어를 `typecheck_ratchet_core` 라는 **다른 이름**으로 적재해 `sys.modules` 에
두 벌이 생겼다. 직접 확인했다:

```
CORE is sys.modules["_typecheck_ratchet"]                  →  False
CORE.RatchetConfig is real.RatchetConfig                   →  False
isinstance(ENTRY.CONFIG, CORE.RatchetConfig)               →  False
```

즉 `mock.patch.object(CORE, "run_tsc", …)` 는 **실제 실행 경로를 건드리지 못했고**, 엔트리
포인트의 `CONFIG`+`main` 배선은 어떤 테스트로도 검증되지 않았다. 구 스위트에는 없던 회귀다.

코어를 실제 이름으로 적재해 고쳤고, **합성 config 가 아니라 엔트리포인트의 실제 `CONFIG` 를
실제 `main` 에 태우는** 테스트를 추가했다 — 커밋된 baseline 과 같은 진단을 주입하면 0 이어야
한다는 형태라, 경로·tsconfig·baseline 이 어긋나면 거기서 드러난다.

## INFO — 넷 조치

- **#3** 같은 결함을 두 문서가 **1,128 vs 1,256** 으로 다르게 인용했다. 실측은 **1,256**
  (전체 1,414 중)이고 내 주석의 1,128 이 틀렸다. 전수 정정했고, 같은 스윕에서 **51/14 →
  52/15** 도 네 파일에서 함께 고쳤다.
- **#4** 이번 사고의 핵심 불변식("이 파일은 모듈이어야 한다")을 40초짜리 tsc 게이트 말고
  **밀리초 가드**로도 고정했다. top-level `import`/`export` 가 사라지는 것이 정확히 재발
  조건이다. 무력화 뮤턴트 → RED.
- **#7** README 의 "the PR" 대명사가 두 PR 중 어느 쪽인지 모호했다 — 날짜로 명시.

미조치: **#1**(TEST_FILE_RULES 를 `RatchetConfig` 필드로 승격) — fail-loud 라 조용한 통과로
안 이어지고, 테스트 전용 규칙을 프로덕션 설정에 올리면 코어가 테스트 관심사를 알게 된다.
**#2**(`sys.path` 중복 삽입) · **#5·#6·#8**(중복·서식·tempdir 정리) 는 리뷰어도 우선순위
낮음으로 표시.

## 검증

lint **PASS** · harness **1117 passed / 1248 subtests** ·
frontend ratchet **52/15 일치** · backend ratchet **199/38 일치**(공유 코어 리팩터 무회귀) ·
뮤테이션 **4축**(코어 이중 적재 RED 2 · spec 갈래 제거 RED 2 · 감소 판정 제거 RED 2 ·
모듈 불변식 RED 1).
