# RESOLUTION — `review/code/2026/09/06/15_30_59` (+ consistency `15_31_00`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 4 · 위험도 **LOW** ·
consistency **BLOCK: NO** · Critical **0** · WARNING 5
**처분**: 코드 리뷰 WARNING 2건 + INFO 1건 수정, 2건은 plan 등재.
consistency WARNING 5건은 **전부 `spec/2-navigation/` 의 선행 부채** — 4건 신규 등재, 1건 기등재.

**수렴 신호**: 이번 라운드 지적은 전부 **문서·커버리지 등급**이다. 동작 결함 0, 구조 결함 0.

---

## W3 (documentation) — docstring 이 방금 추가한 분기의 **반대**를 말하고 있었다

`_strip_comment` 의 첫 줄이 *"따옴표 **없는** 스칼라의 트레일링 주석을 잘라낸다"* 인데,
직전 라운드가 추가한 분기는 정확히 그 반대(따옴표 **있는** 스칼라)를 처리한다.

**이 자리에서 특히 위험하다** — 같은 결함 클래스를 이미 세 번 좁게 닫아 왔고, 다음 사람이
docstring 을 믿으면 인용 분기가 있다는 것을 모른 채 편집한다. 첫 줄을 *"따옴표 유무로 갈라
처리한다"* 로 바꾸고 두 분기를 각각 적었다.

## W2 (testing) — 관측되지 않는 분기는 다음 편집에서 조용히 죽는다

인용 스칼라 + 트레일링 주석 회귀 테스트가 **블록 리스트 형태에만** 있었다. 단일값
(`code: "a.ts"  # note`)과 인라인 리스트도 같은 `_strip_comment` 를 타므로 구현은 맞지만,
관측되지 않는 분기는 다음 편집에서 죽어도 초록이다 — 이 파일이 이미 세 번 겪은 형태다.

두 형태 회귀 테스트 추가. 파서 테스트 **48 pass**.

## INFO#11 (testing) — 통합 경로에도 표면 축을 걸었다

술어 테스트는 두 wrap 표면(`driverError` / 최상위)을 태우는데 통합 테스트는 `driverError`
하나였다. 서비스가 술어를 안 거치고 자기 판정으로 돌아가도 통합 테스트가 안 보는 상태였다.
`it.each` 를 `(method × surface)` 4조합으로 확장.

---

## 조치하지 않은 것 — 전부 plan 등재

| 출처 | 항목 | 왜 여기서 안 하나 |
|---|---|---|
| 리뷰 W1 | `listMembers` 를 DB 레벨 투영으로 | 원래 목표 밖이고 **응답은 이미 안전하다**. 남는 것은 전송 낭비와 *"가드가 못 지킨다"* 는 구조적 사실이고, 그것은 이번 라운드에 단위 테스트로 고정했다. 전환하면 화이트리스트에서 이 항목이 **빠지는 것**이 완료의 기계적 증거가 된다 |
| 리뷰 W4 | `details` array/object 이형 §5.3 명문화 | 이미 등재됨 (`spec/` 쓰기) |
| consistency W1 | `2-trigger-list.md` R-2 가 폐기된 설계를 유효한 것처럼 남김 | `spec/` 쓰기. **파급이 문서 밖으로 나간다** — `15-chat-channel.md` R-CC-10 이 R-2 를 현재 유효 설계로 인용. 두 파일 같은 턴에 |
| consistency W2 | Auth Config 링크가 editor 에게 dead-end | `spec/` 쓰기. **문구 정정이 아니라 결정**이다 — 어느 쪽이 제품 의도인지 확인이 먼저 |
| consistency W3 | frontmatter `status: implemented` vs 본문의 "sort/order 미구현" 자백 | `spec/` 쓰기. `3-schedule.md` 가 `partial` + `pending_plans:` 선례 |
| consistency W4 | `WorkflowVersionDetail` 동명 미러를 트래커로 격상 | 개명은 이 PR 범위 밖. 지금 방어는 JSDoc 한 줄뿐이고 **그 파일을 여는 사람에게만** 닿는다 |
| consistency W5 | `botToken` 마스킹 서술 자기모순 | 이미 등재됨 |

> **다섯 건 전부 이 PR 이 만든 것이 아니다.** 파서 수정이 게이트를 넓히면서
> `spec/2-navigation/` 이 처음 범위에 들어왔고, 그 영역의 선행 부채가 드러났다. 게이트가
> 옳게 넓어진 결과이며, `review/**` 는 SoT 가 아니므로 **이 턴에 plan 으로 옮겼다.**

## 검증

lint / unit(backend 452 suites) / build / e2e(299) / 파서 48 전부 PASS.
