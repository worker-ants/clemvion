# RESOLUTION — `review/code/2026/09/06/20_08_49` (+ consistency `20_08_51`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 3 ·
consistency **BLOCK: NO** · Critical **0** · WARNING 2
**처분**: WARNING 1건 수정(내 편집이 만든 렌더링 결함), 2건은 판정대로 무조치·기등재.
consistency 는 checker 가 *"이번 PR push 를 막을 사유 없음"* 으로 명시.

이 라운드는 CI(`backend 타입체크 ratchet`) 실패를 고친 뒤의 **freshness 재검증**이다.

---

## W3 (documentation) — 내가 방금 만든 렌더링 결함

직전 라운드에서 CHANGELOG 의 두 관심사를 분리하면서 불릿 뒤 **빈 줄을 안 넣었다.**
CommonMark lazy continuation 으로 *"이 두 축이 `User` 컬럼 방어의 전부다"* 라는 **결론
문장이 직전 불릿의 일부처럼** 렌더링된다 — 아직 서술되지 않은 두 번째 축을 가리키는
문장이 첫 번째 축의 세부사항으로 읽힌다.

같은 문서의 다른 자리(73~78행)는 빈 줄을 정확히 두고 있어 **이 자리만의 누락**이다.
빈 줄 하나 추가.

> `CHANGELOG.md` 는 `codebase/**` 가 아니므로 이 수정은 리뷰 freshness 를 깨지 않는다.

## W1 (scope) — 무조치

네 관심사 병존. 리뷰어 판정: *"조치 불요(투명 disclose 확인). 향후 유사 상황에서는 분리"*.
인과는 CHANGELOG·plan·커밋 메시지·PR 본문에 적혀 있다.

## W2 (database) — 이미 등재, 이번에도 안 한다

`WorkspacesService.listMembers` 의 투영 없는 `User` 로드. **`findOne` 이 이번 PR 에서
실유출로 확인·수정한 것과 같은 클래스**라는 지적이 맞다 — 다만 그쪽은 응답으로 나갔고
이쪽은 JS 단 수동 매핑이 막는다. 남는 것은 **DB→앱 전송**과 *"구조 가드가 원리적으로 못
본다"* 는 사실이고, 후자는 이번 브랜치에서 화이트리스트 주석 + 단위 테스트 2건 + e2e 로
고정했다.

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 있고, 전환하면
**화이트리스트에서 그 항목이 빠지는 것**이 완료의 기계적 증거가 된다고 적어 뒀다.

**네 라운드 연속 지적됐다.** 그래도 이 PR 에서 안 하는 이유는 같다 — scope reviewer 가
관심사 확산을 반복 지적한 상황에서, **응답이 이미 안전한 자리**를 위해 모듈을 하나 더
여는 것은 그 지적을 정면으로 무시하는 것이다.

---

## 조치하지 않은 INFO (16건)

전부 확인 기록(양성) · 이미 plan 등재 · 범위 밖이다. 몇 가지만:

| # | 사유 |
|---|---|
| 4·5·6 | `details` 표현 이원화 · `integration-oauth` 치환 · `WorkflowVersionDetail` 손-미러 — 셋 다 실측과 함께 등재됨 |
| 8 | 파서 수정의 저장소 전역 영향 — **의도된 것**. PR 본문에 *"다른 브랜치가 갑자기 spec-linked 로 걸리면 이 커밋을 의심하라"* 고 적었다 |
| 9 | `citations` 필드 주석의 *"매치된 텍스트 **전부**"* 가 구현(형태별 첫 매치)보다 넓게 읽힌다 — 같은 파일의 `findCitations` docstring 은 *"형태당 첫 매치 하나씩"* 으로 정확하다. **표현 긴장이고 동작 오류는 아니다.** 다음에 이 파일을 만질 때 좁힌다 |
| 10 | `@ApiConflictResponse` 설명이 서비스의 리터럴 값을 옮겨 적어 두 데코레이터에 중복 — 값이 바뀌면 손으로 따라가야 한다. 상수화는 다음 편집에서 |
| 12·13 | 술어 fixture 의 하위 경로(`constraint` 부재) · bare 시각 오탐 대조군 — 낮은 우선순위 |
| 15 | 다른 워크트리 소유 plan 의 lifecycle 이동 — **근거 검증 가능**(`#1289` 머지 확인 후 이동, consistency WARNING 정정) |

## 검증

lint / unit(backend 452 suites) / build / e2e(299) + **두 타입체크 ratchet** 전부 PASS.
ratchet 은 이번 라운드부터 매번 돌린다 — `run-test.sh` 4단계가 원리적으로 못 보는 축이다.
