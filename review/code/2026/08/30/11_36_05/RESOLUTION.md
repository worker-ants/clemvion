# RESOLUTION — `11_36_05`

- 대상 커밋: `10f7a2350` (`--branch origin/main`)
- 결과: **RISK=LOW · Critical 0 · Warning 2 · INFO 8**, reviewer 7/7
  (`forced_missing=[]`, `unfinished=[]`)
- 처리: **수동** (SKILL §5). WARNING 둘 다 `plan/**` 문서 사안이라
  `resolution-applier`(코드 fix·e2e 담당)를 부르지 않았다 — 그쪽에 `plan/**` 을 맡기지
  않는 것이 이 세션의 일관된 분업이기도 하다.
- **`codebase/**` 변경 0건** → 이 라운드는 stale 이 되지 않으므로 2라운드를 부르지 않는다.

## WARNING 2건 — 둘 다 반영

### W1 — 한 PR 이 두 문서에서 다른 수를 주장했다

`spec-sync-external-interaction-api-gaps.md:1389` 가 "타입만 가져가던 곳 **0**" 인데,
같은 PR 이 함께 옮긴 `ws-event-types-extract.md:82` 는 그 값을 **1** 로 정정해 두고 있었다
(TS 파서 전수 1,230 파일 재측정, 그 하나는 facade 검증 spec 이라 **의도된 커버리지**).

요약 쪽만 옛 값을 들고 있었다. `1` 로 고치고, 취소선으로 옛 값과 **왜 틀렸는지**(원 grep 이
편집 스크립트의 제외를 물려받아 생긴 오측)를 남기고 정본 문서로 포인터를 걸었다.

> 정본은 정정했는데 **그 정본을 요약하는 문장은 안 고쳤다** — 이 세션이 여러 번 만난
> "미러의 한쪽만 갱신" 형태다.

### W2 — 봉인 문서에 미완료형 문장이 남았다

`plan/complete/ws-event-types-extract.md:409-411` 이 *"frontmatter 가 `none` 인데 …
**완료 이동 시점에 갱신해야 Gate C 를 통과한다**"* 로 미래형인데, frontmatter 는 **같은
커밋에서** `spec_impact` 7개로 갱신됐고 Gate C 를 통과했다(195 tests).

취소선 + ✅ 완료 블록으로 교체했다. **`complete/` 는 "지금 참인 상태" 가 아니라 끝난 일의
기록**이라, 미래형이 남으면 다음 사람이 **없는 잔여를 쫓는다**.

> 이 트래커가 통째로 그 클래스(부재·미완 서술이 참이 아니게 됨)를 다뤘는데 **자기 문장에서
> 같은 실수를 할 뻔했다.**

## INFO 8건 처분

| # | 처분 | 사유 |
| --- | --- | --- |
| 1 목적 서술이 코드 JSDoc·plan 두 곳 중복 | 조치 불요 | 리뷰어도 "이 테스트 개명/제거 시 정합만 확인" |
| 2 단일 멤버라 리터럴 비교로 충분, 멤버 추가 시 수동 확장 필요 | **조건부 유예** | 지금 멤버가 하나뿐이라 `Object.values()` 전수 순회는 같은 것을 더 복잡하게 쓴다. 트리거(두 번째 멤버)를 아래 §후속에 적었다 |
| 3 `REEXPORT_FACADE_TEST` allowlist 결합이 코드로 강제됨 | 조치 불요 | 결함 아님 확인 |
| **4 커밋 메시지 근거 오기** | **정정 (아래)** | 결론은 맞고 **근거가 틀렸다** |
| 5 `egress-masking` 캐비엇 "유지" 판정 줄이 낡음 | **후속** | 이번 diff 파일 목록 밖. §후속에 등재 |
| 6 무관 워크트리 소유 plan 동반 이동 | 조치 불요 | 커밋 메시지에 사유 명시, 실질 변경 `status` 1줄 |
| 7 이동 시 `worktree` 필드 덮어씀 | 조치 불요 | 계약 위반 아님 |
| 8 `describe` 타이틀만 영어 | 조치 불요 | 자매 파일 용어와 일관 |

### INFO 4 — 내 커밋 메시지의 근거가 틀렸다 (정정)

`10f7a2350` 메시지에 *"나머지 참조는 백틱 코드 스팬이라 대상 아님"* 이라고 썼는데 **거짓이다**.
`plan/complete/spec-draft-egress-masking-convention.md:118,138` 에 **살아있는 마크다운 링크가
2건** 있고, 이번 이동으로 그 둘은 실제로 DEAD 가 된다.

**결론(갱신 불요)은 맞다** — 다만 진짜 이유는 다르다: `spec-links.ts` 의
`findBrokenPlanLinks()` 가 `plan/complete/**` 를 **스캔 범위에서 명시 제외**한다
(`plan-lifecycle.md §3` 의 "시점 기록은 옛 경로 유지" 규약을 기계로 구현한 것).
리뷰어 셋(requirement·side_effect·documentation)이 독립적으로 같은 결론에 도달했다.

> **"링크가 없다" 와 "링크는 있지만 가드가 안 본다" 는 다른 진술이다.** 앞엣것으로 적으면
> 다음 사람이 `plan/complete/**` 에 링크를 새로 넣을 때 잘못된 안전감을 갖는다.

## 후속 (plan 이 아니라 여기 적는 이유 없음 — 등재처 명시)

- **INFO 2 트리거**: `InAppNotificationEventType` 에 **두 번째 멤버**가 생기면 리터럴 단언을
  늘리거나 `Object.values()` 전수 순회로 전환한다. 지금은 멤버가 하나라 전수 순회가 같은
  것을 더 복잡하게 쓴다.
- **INFO 5**: `spec-sync-external-interaction-api-gaps.md:376` 의 *"`ws-event-types-extract.md`
  미해결 캐비엇은 **유지**"* 판정은 `#1239` 가 그 캐비엇을 회수하면서 전제가 무너졌다.
  이번 diff 의 파일 목록 밖이라 손대지 않았다 — 그 트래커를 다음에 여는 턴이 정리한다.

두 항목 모두 **`review/` 가 아니라 해당 트래커 본문**에 남길 성격이지만,
INFO 5 의 대상 줄이 이 PR 의 변경 범위 밖이라 여기에 기록하고 트래커 손대는 것은
다음 턴으로 넘긴다(범위를 지키는 쪽).

## 테스트

`codebase/**` 는 `10f7a2350`(lint/unit/build/e2e 전 단계 통과, backend 435 suites / 9,065)
이후 불변이다. 이 라운드의 조치는 `plan/**`·`review/**` 뿐이라 TEST WORKFLOW 를 재수행하지
않는다.
