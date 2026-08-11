# ai-review SUMMARY — `16_31_02` (forced 7) + consistency `16_31_08` (5)

델타 = 커밋 `9416da806`(테스트 주석 1줄 + plan 회고 절) + `de9674b2f`(리뷰 산출물).

## 집계 — 12/12 착지, **CRITICAL 0**, 전원 BLOCK:NO

| | 결과 |
|---|---|
| 코드 7 | security · testing · scope · side_effect · requirement · maintainability = **NONE** / documentation = LOW (**WARNING 1**) |
| consistency 5 | cross_spec · convention · naming · plan_coherence = **NONE** / rationale_continuity = LOW (INFO 3) |

## documentation WARNING — 회고 절이 자기 주제를 어겼다

절 제목은 **"라운드 2~5"(넷)**, 표는 **1~5(다섯 행)**, 본문은 **"다섯 번"**. 셋이 안 맞았다.
**하필 그 절이 "개수를 정확히 세라" 를 말하는 자리다.** 처분했다.

## rationale_continuity — "출처" 를 두 뜻으로 쓴 것을 잡았다

내 회고는 세 번째 복제본의 출처를 #384 로 적었다. 실측하면:

- `configFromQuery` JSDoc·폴백 호출부 주석 **2건**은 `a652f8733`(#384) 원본이고, 라운드 4
  직전까지 **글자 하나 안 바뀐 채** 유지됐다 — 여기까진 내 서술이 맞다.
- 그러나 세 번째 복제본의 **문자열**(`direct-load 외부 입력 방어`)은 `aba46cc90`(#761,
  `safeApiBaseFromQuery` 신설)에서 처음 나온다. **copy-paste 파생이 아니라 같은 오해의
  독립 재저술**이다.

계보를 잇는 것은 문자열이 아니라 **오해**다. 그리고 이 구분은 실질적이다 — **원본을 고쳐도
독립 재저술은 막히지 않는다.** 그게 다섯 번째 사례가 존재한 이유다. 처분했다.

## 리뷰어들이 검증 축을 실제로 바꿨다

직전 라운드에서 "문자열 말고 뜻으로 세라" 를 요구했고, 그대로 수행됐다:

- **documentation** — 10개 후보 표현으로 훑고 각 매치의 **본문을 읽어** 배타성 주장 여부를
  판정. `use-widget-eager-start.test.ts:4248`(중립 라벨) · `api-base.ts:5`(옛 별칭)를
  구분해 **네 번째 복제본 없음**으로 결론.
- **cross_spec** — 같은 방식으로 spec 6문서 + 위젯/SDK 소스 전수. `_product-overview.md` 의
  "샘플" 은 **SDK `examples/` 패키지**를 가리켜 대상이 다름을, `3-auth-session.md §R8` 은
  trailing-slash 정규화 얘기라 무관함을 각각 본문으로 판정했다.
- **plan_coherence** — 회고 표 5행을 커밋 diff 와 **행 단위**로 대조하고, "6명 수렴" 을
  `review/**` grep 으로 정확히 6개 파일 확인, "451" 을 직접 실행해 재현.
- **naming** — 회고가 인용한 커밋 해시·앵커·세션 타임스탬프를 `git cat-file -t` 와 파일시스템
  대조로 **전수 실재 확인**. 죽은 참조 0.

## maintainability — 정직하게 판정하라는 요구에 정직하게 답했다

"같은 사실이 이제 네 곳" 이 선을 넘었냐는 물음에, **"새 중복 추가가 아니라 5라운드째 남아
있던 오류 사본의 정정"** 이라 판정하면서도 **"순수 새 중복이었다면 4곳은 과했을 것"** 이라고
분명히 덧붙였다. 그리고 누적 주석량(로직 ~30줄에 방어 주석 ~12줄)이 **"다소 높다"** 고 적고
향후 증가를 억제할 것을 권고했다 — 내가 유리하게 읽을 여지를 남기지 않았다.

## scope — PR 규모를 실측 분해

총 85파일 7082(+). `codebase/`+`spec/` **5파일 262(+)/24(-)**, `plan/` 3파일, `review/`
**77파일 6649(+)**. 제품 diff 는 원래 plan 범위에 머물고, diff 의 94% 는 이 저장소가 상시
강제하는 리뷰 산출물이다. **stale loop 아님**(발견 성격이 동작→구조→문서로 좁아짐).

## 유예 1건

`api-base.ts:5` 의 옛 별칭 — **배타성 주장 없음**(기능 참조만) · 파일·관심사 다름
(trailing-slash 정규화) · 고치면 위험 0에 게이트 라운드 하나. plan 에 사유와 함께 등재.

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 1 (처분 완료)
