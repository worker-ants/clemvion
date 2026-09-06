# RESOLUTION — `review/consistency/2026/09/06/11_27_54`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 2 · 위험도 MEDIUM
**처분**: 코드 변경 없음. 두 WARNING 은 **같은 planner 항목의 3차 재확인**이고, 새 INFO 는
실측 결과 이미 덮여 있다.

## WARNING 1·2 — 3차 재확인, 신규 조치 없음

checker 들이 명시적으로 *"이미 plan 에 등재됨"*·*"planner 담당"* 이라고 적었다. 두 건 모두
`spec/` 쓰기라 이 브랜치가 집행할 수 없다.

**등재문은 이미 필요한 것을 다 담고 있다** — 직전 라운드에 지시를 한 번 더 정확히 고쳤다:
*"두 검증자"* 라고 개수를 못 박은 문장 **둘**(§5.4 검증 층 · `swagger.md §5-1`)을 표로
명시하고, **새 개수를 적어 넣지 말고 나열하라**고 못 박았다. 이번 checker 도 같은 처방을
독립적으로 냈다 (*"새 숫자로 교체 말고 표/나열 형태로"*) — 등재문과 일치한다.

3회 반복이라는 사실 자체는 우선순위 신호이므로 여기 남긴다. 다만 **반복이 곧 미조치는
아니다** — developer 가 할 수 있는 일(등재·지시 정확화)은 끝났고, 남은 것은 권한 밖이다.

## INFO#1 — 새 지적처럼 보이지만 이미 덮여 있다

checker 가 `WorkflowVersionCreatorDto`/`WorkflowVersionDto` 의
`creator?: T | null`(§5.4 금지 조합)을 짚고 *"`swagger-dto-contract-guard.ts` 에 정적 검출
축 추가 고려"* 를 제안했다.

**실측: 그 축은 이미 있고 이 필드도 이미 동결돼 있다.**

```
swagger-dto-contract.spec.ts:430  'workflow-version-response.dto.ts:WorkflowVersionDto.creator'
swagger-dto-contract.spec.ts:432  'workflow-version-response.dto.ts:WorkflowVersionListItemDto.creator'
```

선행 PR(#1291)이 §5.4 금지 조합 전수 래칫(78건)을 세우면서 이 두 자리를 목록에 넣었다.
즉 이 필드들이 조용히 늘거나 줄면 그 래칫이 잡는다. checker 가 이 브랜치의 diff 만 보고
있어 선행 래칫을 못 본 것이다 — **신규 항목을 만들지 않는다.**

## INFO 나머지 — 조치 불요

`## Overview (제품 정의)` 표기 · §5.4 스윕 카운트(plan 이 이미 "착수 시점 재실측" 명시) ·
`SRC_ROOT` 형제 가드 반복 선언(의도) · `USER_SECRET_KEYS` 명명 계열 — 전부 비차단이거나
이번 diff 가 만든 드리프트가 아니다.

## 검증

코드 변경 없음. 직전 커밋에서 lint PASS · unit PASS · build PASS · e2e PASS **299**.
