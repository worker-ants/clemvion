# consistency SUMMARY — `16_31_08` (`--impl-done spec/7-channel-web-chat`)

## BLOCK: NO

Critical **0건**. checker 5/5 착지, 전원 BLOCK:NO.

| checker | 위험도 | 발견 |
|---|---|---|
| cross_spec · convention_compliance · naming_collision · plan_coherence | **NONE** | 0 |
| rationale_continuity | LOW | INFO 3 (**1건 처분 · 1건 유예 · 1건 확인기록**) |

## 검증 축이 실제로 바뀌었다

직전 라운드에서 "문자열 말고 **뜻**으로 세라" 를 요구했고, 그대로 수행됐다:

- **cross_spec** — spec 6문서 + 위젯/SDK 소스 전수를 표현이 아니라 취지로 훑고, 매치마다
  **본문을 읽어** 배타성 주장 여부를 판정했다. `_product-overview.md` 의 "샘플" 은 **SDK
  `examples/` 패키지**를 가리켜 대상이 다르고, `3-auth-session.md §R8` 의 "동명 함수 주의" 는
  trailing-slash 정규화 얘기라 무관함을 각각 본문으로 갈랐다. **추가 잔존 0.**
- **rationale_continuity** — 같은 방식으로 `api-base.ts:5` 하나를 찾아냈다(아래).
- **plan_coherence** — 회고 표 5행을 커밋 diff 와 **행 단위** 대조. "6명 수렴" 을 `review/**`
  grep 으로 정확히 6개 파일 확인. "451 passed" 를 직접 실행해 재현.
- **naming** — 회고가 인용한 커밋 해시(`a652f8733`·`df1375208`)·`§R7` 앵커·세션 타임스탬프
  5개를 `git cat-file -t` 와 파일시스템 대조로 **전수 실재 확인**. 죽은 참조 0.

## rationale_continuity INFO 3건 — 처분 내역

| # | 내용 | 처분 |
|---|---|---|
| 1 | 회고가 **"출처"** 를 두 뜻으로 사용 — 세 번째 복제본의 **문자열**은 #384 가 아니라 `aba46cc90`(#761)에서 독립 재저술 | **고침** |
| 2 | `api-base.ts:5` 의 옛 별칭 `direct-load 쿼리 하드닝` | **유예** — plan 에 사유 등재 |
| 3 | `use-widget-eager-start.test.ts:4248` 재판정 | **위험 없음 확인** — 실제 별개 코드 경로를 정확히 서술 |

**#1 이 값이다.** 원본 2건(`configFromQuery` JSDoc·폴백 호출부)이 `a652f8733`(#384)에서
`resolveIframeTarget` 과 **함께 태어나 라운드 4 직전까지 글자 하나 안 바뀐 채** 유지됐다는
내 서술은 독립 재검증으로 **사실 확인**됐다. 그러나 세 번째 복제본의 문자열은 #761 이
저작한 것이고, 이는 **copy-paste 파생이 아니라 같은 오해의 독립 재저술**이다.

계보를 잇는 것은 문자열이 아니라 **오해**다 — 그리고 **원본을 고쳐도 독립 재저술은 막히지
않는다.** 다섯 번째 사례가 존재한 이유가 여기 있다. 회고에 그렇게 적었다.

**#2 유예 근거**(추측 아니라 리뷰어 실측): 그 문장은 **배타성을 주장하지 않고** 기능을
참조만 한다 · 파일·관심사가 다르다(trailing-slash 정규화) · 고치면 위험 0인 별칭 하나에
게이트 라운드가 하나 더 든다. maintainability 도 주석 총량 억제를 권고했다(`16_31_02`).

## convention — 완료 plan 에 절을 덧붙이는 것이 규약에 맞는가

`.claude/docs/plan-lifecycle.md` 는 **이동 시점**의 요건만 규정하고 완료 문서에 후속 절을
더하는 것을 금지하지 않으며, `status` 값도 안 바뀌었다. 선례로 이 문서 자신(같은 PR 안에서
라운드별 회고를 여러 번 추가)과 `plan/complete/output-shape-comment-followups.md` 의
`## 리뷰 라운드 (3회, 수렴)` 를 제시했다 — **선례를 실제로 찾아 보였다.**
