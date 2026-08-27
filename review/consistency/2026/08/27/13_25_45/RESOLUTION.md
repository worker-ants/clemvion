# RESOLUTION — consistency `13_25_45` (`--impl-done spec/5-system/`)

**BLOCK: YES** (CRITICAL 1) → **해소**. WARNING 2건 중 1건 반영, 1건은 사유와 함께 유지.

## CRITICAL — 미러 스윕이 **네 번째**로 갈렸고, 이번엔 축이 달랐다

이 PR 이 R-5 의 안전 원칙명을 `boundary masking parity` → **`egress masking parity`** 로
개명했는데(그 boundary 가 제거됐으니 옳은 개명이다), **인용처 세 곳에 전파하지 않았다**:

| 위치 | 성격 |
| --- | --- |
| `spec/2-navigation/14-execution-history.md:467` | **같은 문서**의 자기인용 문단 |
| `spec/5-system/14-external-interaction-api.md:1530` | §R17 의 **축자 인용**(인용부호 안) |
| `spec/5-system/6-websocket-protocol.md:196` | §4.1 이 같은 근거로 원용 |

셋 다 인용부호 안이거나 원칙명을 그대로 부르는 자리라, 개명 후 **없는 이름을 인용**하게
됐다.

### 왜 내 전수 스윕이 못 잡았나 — 이게 이번의 진짜 교훈

`12_00_05` 에서 패턴 치환을 버리고 **주장 기반 전수 스윕**으로 바꿨고, 그건 옳았다.
그런데 그 스윕의 축을 **`maskSensitiveFields` 라는 구현 심볼**로 잡았다. 이번 drift 는
**내가 새로 지은 원칙 이름**에서 났고, 그 세 문장에는 `maskSensitiveFields` 가 **한 번도
안 나온다**. 후보집합이 아니라 **축**이 좁았던 것이다.

> **일반화**: 이름을 바꾸면 그 이름이 스윕 축이다. 구현 심볼로 훑는 것과 **별개 축**이고,
> 둘 다 돌려야 한다. 이번엔 `grep -ohE "[a-z]+ masking parity" | sort | uniq -c` 로
> **표기 분포**를 세어 닫았다 — `egress 4 / boundary 0`(spec 기준).

`plan/complete/**` 3개 파일은 옛 이름을 그대로 둔다 — **완료 스냅샷은 소급 수정하지
않는다**는 관례이고, 같은 판단을 코드 리뷰 `12_52_43` INFO 7 도 내렸다.

## 권한 — 우회하지 않고 planner 턴

세 자리 모두 (1) 내가 그 문서에 써 넣은 문장이 아니고 (2) 예고·트리거가 아니라 **보안
Rationale 의 원칙명**이라, CLAUDE.md 의 자기-반증형 소정정 다섯 조건 중 **1·2 를 충족하지
못한다**. 이 PR 은 이미 planner 턴 커밋(`57fb83592`)을 담고 있으므로 같은 방식으로 처리했다.

## WARNING 2 (plan_coherence) — 반영. **같은 축의 결함이었다**

`spec/conventions/node-output.md:23` 의 Principle 0 필드 정의가 아직
*"`config`: 해석된 설정값 (**자격증명 제거**)"* 였다 — 이 PR 이 신설한 Principle 7
(*"마스킹은 egress 에서만"*)과 **같은 문서 안에서 정면으로 모순**된다.

이 줄에도 `maskSensitiveFields` 가 안 나온다. CRITICAL 과 **동일한 축 누락**이다.
원문을 취소선으로 남기고 Principle 7 로 상호 참조하도록 정정했다. 앵커는 정본
`spec-link-integrity.test.ts` 로 검증(13 passed) — 초안의
`#…nodehandleroutput-config` 가 실제 slug(`…nodehandleroutputconfig`)와 달라 한 번 틀렸다.

## WARNING 1 (convention_compliance) — 유지, 사유를 남긴다

동일한 "allow-list 전환" 정정 문장이 5곳에 축자 반복된다는 지적이다. **의도적이다**:

- 그 다섯은 **정정문**이지 규범 서술이 아니다. 각 자리에서 *"여기 쓰인 옛 근거가 왜
  틀렸는가"* 를 읽는 사람에게 보여야 하므로, SoT 링크만 남기면 **취소선의 대상이 사라진다**.
- 실제로 이 세션은 그 반대 실패를 세 번 겪었다 — 자리를 좁게 잡아 자매를 놓쳤다.
  여기서 4곳을 링크로 접으면 다음 개명 때 **또 한 축이 안 보이게 된다**.

다만 지적의 취지(SoT 사본 금지)는 유효하므로, **정정문이 수명을 다하면**(취소선을 걷어낼
시점) 축약 대상이라는 것을 이 문서에 남긴다. 지금 접지 않는다.

## INFO

- **#1** rationale_continuity 가 `4-execution-engine.md` 4곳 편집을 *"새 결정 번복이 아니라
  2026-08-24 확정 결정의 지연 미러링"* 으로 판정하고 코드 주석과 실측 대조까지 해
  **모범적 편집**으로 결론. 조치 불요.
- 번들 범위: scope 가 `spec/5-system/` 이라 `spec/conventions/egress-masking.md` 는 번들에
  안 실렸다(grep 0건). 이번 CRITICAL·WARNING 은 실린 파일들에서 났고, 미적재 파일은 이
  PR 이 이미 직접 편집·검증한 대상이다.
