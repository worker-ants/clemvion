# RESOLUTION — `review/consistency/2026/09/05/09_53_09` (`--impl-done`)

**BLOCK: NO** · Critical **0** · WARNING **1** · INFO **4**. **전부 조치.**

## 조치 항목

| # | Checker | 지적 | 조치 |
|---|---|---|---|
| W1 | convention_compliance | `review-citations.md` §3 이 DTO JSDoc 을 배제하지 않아 같은 날 등재된 `swagger.md` §3 과 **잠재 충돌** — JSDoc 에 리뷰 인용을 넣으면 이쪽은 만족, 저쪽은 위반 | §3 표에 **DTO·컨트롤러 JSDoc = 대상 아님** 행 추가 + `swagger.md` §3 링크. `//` 주석으로 가면 첫 행에 따라 이 규약을 따른다는 것까지 적었다 |
| INFO#1 | rationale_continuity | `code:` 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는 재해석의 근거가 `## Overview` 인용구에만 있다 | `## Rationale` 에 **전용 항목**으로 옮기고, 기각한 대안(넓은 트리 글롭)까지 적었다 |
| INFO#2 | rationale_continuity | *"`review/**` 는 사후 편집 대상 아님"* 주장의 출처 미인용 | `plan-lifecycle.md` 링크 + **그 문서가 실제로 적은 문장**을 인용했다 (*"`review/**` 같은 시점 기록 문서는 옛 경로 유지"*) — 읽어 확인한 문언만 옮겼다 |
| INFO#3 | convention_compliance | §3 표가 `scripts/**`·`.github/**` 를 침묵으로 남긴다 | **적용 대상으로 넣었다** (아래 참조) |
| INFO#4 | plan_coherence | 유보 문구를 전용 planner 문서로 정공법 처리한 것 확인 | 확인 보고 — 조치 불요 |

### INFO#3 — 지적은 맞았지만 **전제가 틀렸다**

checker 는 *"현재 두 곳 다 **우연히 이미 전체 경로 형태를 써서** 위반 아님"* 이라며
예방적 각주만 제안했다. 실측하니 다르다:

```
grep -rhoE "[0-9]{2}_[0-9]{2}_[0-9]{2}" scripts/ .github/            → 8건
grep -rhoE "review/[a-z]+/[0-9]{4}/../../[0-9]{2}_[0-9]{2}_[0-9]{2}" → 2건
                                                        → bare 6건
```

**8건 중 6건이 bare** 다. "이미 준수 중" 이 아니라 **이미 이 규약이 필요한 상태**였다.

그래서 각주가 아니라 **적용 대상으로 넣었다.** §3 의 판단 기준이 *"나중에 어떤 맥락에서
읽히는가"* 인데, 저장소 가드(`scripts/**`)와 CI 정의(`.github/**`)는 `codebase/**` 와 똑같이
맥락 없이 읽힌다 — 기준을 세워 놓고 그 기준이 가리키는 자리를 빼면 기준이 무의미해진다.
기존 6건은 §4(소급 정리 안 함)가 덮는다.

부수로 §3 제목이 `codebase/**` 만 가리키고 있어 **맥락 없이 읽히는 자리**로 넓혔고,
§4 의 "499건" 도 `+ scripts/**·.github/** 6건` 으로 맞췄다. 표와 어긋나던 리드 문장
(*"`plan/**` 과 `review/**` 만 대상 아님"* — DTO JSDoc 이 빠져 있었다)도 지웠다.

## 다음 라운드가 필요한 이유

이 조치는 전부 `spec/conventions/review-citations.md` 편집이므로 **이 `--impl-done` 리포트가
스스로 stale 해진다** (게이트는 세션 디렉터리 시각으로 판정한다). 한 번 더 돌린다.
코드 리뷰 쪽은 `codebase/**` 변경이 없어 `09_42_13` 라운드가 유효하다.
