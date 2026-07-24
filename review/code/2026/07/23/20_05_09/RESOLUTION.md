# RESOLUTION — review/code/2026/07/23/20_05_09

대상: branch `claude/presentation-thread-optout-drift-4fc462`, 커밋 `7331ae1ac`.
판정: **RISK=LOW / CRITICAL=0 / WARNING=2 / INFO=11**. forced 7/7 확보(제외 0명), 누락 0.

> 라우팅이 `fallback-distrusted-decision` 이었다 — router 결정을 신뢰할 수 없어 전원 강제 실행.
> 결과적으로 7명 전원 커버라 누락 위험은 없다.

## WARNING 2건 — 둘 다 **내 산출물의 정확도** 문제 (전량 반영)

### 1. 체크리스트가 산출물보다 과장됐다 (documentation·requirement)

체크리스트에 *"D1 재검토 각주 **+ developer 후속 task 등록**"* 을 `[x]` 로 적었으나, repo diff 에는
**인라인 각주 1개**뿐이었다. 세션 task chip 은 띄웠지만 **repo 산출물이 아니라** 커밋으로 추적되지
않는다 — 리뷰어 지적이 정확하다. `plan_coherence` checker 도 사전에 같은 갭을 짚으며 "최소한 각주" 를
*최소* 대안으로 제시했었다.

**조치**: `node-output-redesign/form.md` 의 `## 종합 개선안` 에 **실제 추적 bullet**
`- [ ] (impl) form.handler.ts:44 spread → 명시 enumeration 전환 …` 을 추가했다. 회귀 테스트 요구
(credential-shaped 키 미유출 assert)도 그 bullet 에 명시했고, **실측 사실**(sibling
`carousel.handler.spec.ts` 에도 해당 assertion 0건이라 참고 패턴이 없다)을 함께 적었다 — INFO 8 반영.
체크리스트 문구도 "chip 은 repo 산출물이 아니므로 추적 근거는 이 bullet" 으로 정정했다.

### 2. 동봉 consistency SUMMARY 의 checker 오귀속 (requirement)

`19_48_09/SUMMARY.md` 의 WARNING #1 행이 `convention_compliance` 를 공동 제기자로 적었으나 그
checker 는 그 주제를 `[INFO]` 로만 평가했다(유일한 `[WARNING]` 은 frontmatter status 건). 같은 파일의
"Checker별 위험도" 표와 자기모순이다. 정확한 제기자는 `cross_spec` · `rationale_continuity` 2인.

**조치**: **원문 표는 고치지 않았다** — 산출물은 생성 시점 그대로 보존하는 기존 방침(15_33_52 ·
17_28_02 에서도 동일 적용)에 따라, 파일 말미에 **명시 표시된 main Claude 정정 주석**을 append 해
재집계 시 오귀속이 전파되지 않게 했다. 처리 방향에는 영향이 없다(그 plan 은 WARNING 번호·pin 내용만
재인용했고 checker 귀속은 재인용하지 않았다).

## INFO 11건

- **반영**: INFO 8(회귀 테스트 요구 + sibling 에도 패턴 부재라는 실측)을 위 추적 bullet 에 포함.
- **미조치(근거 있음)**: INFO 2(fragment anchor) — 앵커를 붙이려 했으나 `§4.6` 은 `## 4.6` 헤딩이라
  slug 가 관례와 어긋나고, 잘못된 앵커는 `spec-link-integrity` 가 즉시 잡는다. 지금 링크는 문서
  단위로 정확하며 INFO 3(헤딩 레벨 정정)과 함께 다음 편집 때 묶어 처리하는 편이 안전하다.
  INFO 3·5(헤딩 레벨·파일명) — plan 이 이미 의도적 defer 로 기록. INFO 1·10(harness 산출물의
  subagent 헤더 잔존·절대경로 하드코딩) — 본 PR 이 만든 패턴이 아니고 harness 차원 사안.
  INFO 4(양쪽 spec 근접 중복) — 교차 링크가 있고 한쪽을 요약으로 강등하는 건 별건 판단.
  INFO 6·7·9·11 — 확인형이거나 이미 근거 명시됨.

## 검증

- docs 가드(`spec-link-integrity` 포함) **18 files / 2661 passed**.
- **코드 변경 0줄** (spec/plan/review 문서만) → 테스트·e2e 불요.

## 수렴 판정

CRITICAL 0, WARNING 2건 모두 권고대로 반영했다. 반영분은 **plan bullet 1개 + 체크리스트 문구 +
정정 주석**이며 spec 본문·코드 무변경이다. 다시 full 리뷰에 걸면 문안 nit 만 재표면화하는 비수렴
doc-루프가 되므로 프로젝트 관례(Critical·코드 Warning 0 에서 INFO 비차단 수렴)대로 **종결**한다.

## 교훈

**"등록했다" 는 repo 에 남는 것만 세야 한다.** 세션 task chip 을 띄운 걸 체크리스트에 "등록 완료" 로
적었는데, chip 은 커밋되지 않아 다음 사람이 볼 수 없다. 같은 세션에서 이미 두 번(1차 "테스트로 커버",
2차 "위 2건이 커버") 같은 계열 — **주장 대신 산출물을 확인하라** — 로 지적받았다. 이번은 그 세 번째
변주다: 이번엔 실측이 아니라 **산출물의 소재(repo vs 세션)** 를 착각했다.
