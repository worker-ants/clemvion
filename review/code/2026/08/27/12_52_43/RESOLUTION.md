# RESOLUTION — `12_52_43` (5라운드, **forced 7/7 채운 뒤 재집계**)

RISK=LOW · **CRITICAL 0** · WARNING 4 → 처리 완료.
W1·W3 은 기지·기처분, **W2 는 내 완료 선언의 거짓**, W4 는 신규 관찰(도달 불가).

## 이 세션이 두 번 집계된 이유

초판(2명: testing·documentation)은 CRITICAL 0 · WARNING 0 이었다. 그런데 push 게이트가
막았고, 술어를 읽어 원인을 찾았다 — `_summary_is_resolved` 의 **조건 1(forced 커버리지)**.

`meta.json` 기준 forced 는 **7명**인데 나는 라운드마다 타겟으로 좁혀 돌렸다. 실측:

```
12_28_26 → missing forced: maintainability, scope, side_effect
12_52_43 → missing forced: maintainability, requirement, scope, security, side_effect
```

그래서 4·5라운드가 resolved 집합에서 빠졌고 `newest_review` 가 3라운드(`12_00_05`)로
잡혀 차단됐다. **게이트 결함이 아니라 내가 만든 상태였다.**
`BYPASS_REVIEW_GUARD=1` 로 넘기지 않고 누락 5명을 채워 7/7 로 만들고 재집계했다.

## W2 — **내가 쓴 완료 선언이 그 시점에 거짓이었다**

plan 종결 커밋(`ad166120d`)이 *"forced 전원 결과 확보"* 를 근거로 5라운드를 수렴으로
선언했는데, 그때 디스크에는 2건뿐이었다. requirement 리뷰어가 `meta.json` 과 대조해 잡았다.

**메커니즘**: `Workflow(ai-review)` 에 `agents_forced` 를 **내가 좁혀서 넘겼고**, 요약
에이전트는 그 좁힌 목록에 대해 커버리지를 검사했다. orchestrator 가 기록한 진짜 목록과
대조하지 않는다. 그래서 2~5라운드의 *"누락 없음"* 이 **전부 공허했다**.

**왜 오래 못 봤나**: 실패가 조용하다. SUMMARY 는 초록으로 끝나고, 막히는 건 한참 뒤 push
시점이며, 그때 메시지(*"코드가 리뷰 뒤에 수정됐다"*)가 **원인을 가리키지 않는다** — 나는
처음에 timestamp 오탐으로 오진했다.

처분: plan 에 시점차를 명시 정정하고, 재발 방지 항목을 정본 트래커에 등재했다
(진단법 = 시각 비교 **전에** `_forced_coverage_missing()` 를 먼저 볼 것 + 처분 후보 두 개).

## W4 — 신규 관찰. 실재하지만 **오늘은 도달 불가**

`DEEP_REDACT_CACHE` 가 객체 identity 로만 키를 잡으므로 *"같은 identity ⇒ 같은 내용"* 을
전제한다. 이 PR 로 `setStructuredOutput` 이 핸들러 원본을 장기 보관하니 그 전제가 이론상
약해진다는 지적이다. 리뷰어 자신도 *"실제 재현 경로는 확증 못함"* 이라 적었다.

**도달 조건을 실측으로 좁혔다 — 둘 다 필요하고 둘 다 오늘 거짓이다**:

1. 핸들러가 **반환 후** 자기 `config` 를 변형 → 오늘 없고, 신규 캐너리가 그 동작을
   명시적으로 고정해 뒀다.
2. **같은 top-level 객체**가 `deepRedactSecrets` 에 두 번 진입 → 캐시 키는 depth-0 인자다.
   REST 는 `redactStoredDataForResponse(row.outputData)` 로 **쿼리마다 새 객체**이고,
   WS 변형 `deepRedactSecretsPreserving` 은 **캐시를 아예 안 쓴다**(그 함수 JSDoc 이 이유를
   적어 뒀다 — 옵션이 다르면 같은 캐시를 쓰면 안 된다).

재개 신호와 함께 트래커 등재. 지금 고치지 않는다 — 없는 경로에 방어를 두면 다음 사람이
그 방어를 근거로 잘못된 전제를 세운다.

## W1 · W3 — 기지, 조치 불요

- **W1** storage→egress 전환의 트레이드오프(DB 평문 · 크로스-노드 릴레이). R-5 정정 블록 +
  트래커 기등재, 리뷰어도 *"신규 조치 불요"*.
- **W3** doc-link 곁다리 혼입. `12_00_05` scope 가 이미 지적했고 *"머지된 커밋 소급 분리
  안 함"* 으로 처분 완료. 리뷰어도 기지 사안으로 재확인.

## INFO — 전부 양호 확인 또는 기추적

특히 **#11**: `12_28_26` W1 이 실제로 닫혔음을 리뷰어가 **뮤테이션으로 독립 재현**했다 —
`= { ...adapted }` 로 되돌리면 신규 캐너리가 정확히 RED 이고, *"직전 라운드 시점엔 66/66
GREEN 으로 무방비였다"*. 내 M6 실측과 일치한다.

#9(캐스트 2회 반복 — 추출 임계선 3회 미달) · #12(egress 진입점 통합 테스트 갭) ·
#13(defer 항목) 은 형태 변경 없이 유지.
