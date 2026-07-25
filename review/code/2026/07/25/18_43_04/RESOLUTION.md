# RESOLUTION — §N CRITICAL: 전환을 **되돌렸다**

CRITICAL 1 / WARNING 4. CRITICAL 이 §N 의 전제를 반증했고, 티켓 체크리스트가 정한
**"하나라도 새 표면이면 won't-do"** 조건에 해당해 `git revert` 했다.

## 조치 항목

| # | 판정 | 조치 |
|---|---|---|
| C1 | **수용 → §N 전면 revert** | `A="line1\nline2" git push` 는 평범한 shell(`bash -n` exit 0)이고 push 가 **실제 실행**되는데, split 이 따옴표 안 개행을 구분자로 오인해 값을 찢어 **미탐지**. false negative = 게이트 우회이며 안전 방향이 아니다. 4 케이스 전부 §N False / §M True 실측 |
| W1·W2·W3·W5 | **revert 로 자동 해소** | 전부 "§N 이후 주석·docstring·remedy 가 낡음" 지적. §M 상태로 돌아가 원래 서술이 다시 맞다(146행 주석 ↔ 패턴, `_env_value_subpatterns` 앵커 ↔ `.index` 인자 각각 재확인) |
| W4 | 해소 | §N 벤치 수치 불일치 — §N 서술 자체가 사라짐 |
| INFO1 | **수용 + 등급 상향** | 아래 §리뷰어가 틀린 지점 |

## 왜 고치지 않고 되돌렸나

split 이 "이 개행이 따옴표 안인가" 를 알아야 고칠 수 있다 = **quote 파서**. 이 파일이 두 번
거부한 길이다(2026-07-17 shlex 재작성 REVERT). §M 은 유한하고 측정된 상태(네 형태 전부 선형,
회귀 pin 완비)이므로 그것을 무한 표면과 바꾸지 않는다.

## 내가 "정확성 10/10 동일" 이라 한 것이 왜 틀렸나

프로토타입 판정 때 **손으로 고른 10개**에 "따옴표 값 안의 개행" 이 없었고, 656개 스위트에도
그 축이 없었다. 이번엔 **전체 통과**가 안전의 증거로 보였기에 더 설득력 있게 틀렸다 —
큐레이션한 입력 집합이 커버리지의 상한이라는 교훈의 가장 비싼 형태.

## 리뷰어가 틀린 지점 — INFO1 은 기존 갭이 아니라 §M(e) 회귀다

리뷰는 백슬래시 line continuation 미탐지를 "구 패턴에서도 동일하게 존재했던 사전 인지된
트레이드오프" 라며 INFO 로 뒀다. 실측하니 **legacy floor 는 잡는다**:

| | `git \<개행>  push origin main` |
|---|---|
| legacy(§M 이전 floor) | **True** |
| 현재(§M(e) 적용) | False |

§M(e) 가 tail 에서 개행을 제외하며 잃은 **differential floor 위반**이고, 실행되는 push 를
놓치므로 활성 우회다. corpus 에 continuation 이 한 건도 없어 아무 테스트도 울지 않았다.

shell 이 하는 일을 그대로(`\`+개행 삭제) 탐지 전에 수행하도록 고쳤다. tail 의 개행 제외는
유지되므로 §M(e) 의 선형성도 보존된다.

## 비-vacuity 검증

| 뮤턴트 | 결과 |
|---|---|
| split 메커니즘 재주입(§N 재시도) | `QuotedNewlineValueTest` **5 failed** |
| line continuation unfold 제거 | `LineContinuationTest` **3 failed** |

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 661 passed, 564 subtests**
- build: 해당 없음(`codebase/**` 변경 0)
- e2e: **면제** — diff 가 `.claude/**` + `plan/**` + `review/**` 뿐(PROJECT.md §e2e 면제
  화이트리스트의 harness/문서 전용 변경)

## 보류·후속 항목

없음. §N 티켓은 won't-do 로 종결(`plan/complete/`), line continuation 은 본 PR 에서 수정.
