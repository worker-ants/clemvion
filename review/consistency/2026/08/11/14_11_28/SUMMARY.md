# consistency SUMMARY — `14_11_28` (`--impl-done spec/conventions`)

diff-base `origin/main`. checker 5/5 착지.

## BLOCK: NO

Critical **0건**.

| checker | 위험도 | 발견 |
|---|---|---|
| naming_collision | **NONE** | INFO 1 |
| rationale_continuity | **NONE** | Critical 0 |
| convention_compliance | LOW | WARNING 1 · INFO 1 |
| cross_spec | LOW | WARNING 1 (위와 동일 건) |
| plan_coherence | LOW | WARNING 1 |

## 판정 요지

- **rationale_continuity**: 이 PR 이 **과거 결정을 뒤집은 곳 셋**을 전부 검토 — (1)
  `plan-scan.ts` 헤더가 "`spec-links.ts` walker 는 별 문제" 로 갈라 뒀던 범위를 합친 것,
  (2) plan 이 "실측 없이 합치는 것이 더 위험" 이라 미뤘던 것을 실측 후 합친 것,
  (3) `SpecMdFile` 을 `@deprecated` 로 남겼다가 같은 PR 안에서 삭제로 뒤집은 것.
  **셋 다 근거 있는 번복**이고 근거가 코드·커밋 양쪽에 기록돼 있음을 확인.
- **naming_collision**: `walkTree`·`MdFileRef`·`WalkOptions`·`matterNoCache` 전부 전역
  유일. `SpecMdFile` 삭제 후 **실제 타입 참조 0건**(잔존 3건은 삭제를 설명하는 주석).
  `findDanglingSpecImpact` 개명 후 옛 이름의 살아있는 참조 0건.
- **plan_coherence**: `plan-lifecycle.md §3` 이동 요건 **전항 충족**(13/13 `[x]`, 같은 PR
  안 rename, `spec_impact` 실목록, 유효 종료 status). 인입 참조도 `review/**` 밖 잔존 0건.

## Warning — **전부 고침**

| # | checker | 내용 | 처분 |
|---|---|---|---|
| W1 | convention_compliance · cross_spec (**2명 수렴**) | `tree-walk.ts` 가 이제 `impl-anchor-parse.ts`(= `user-guide-evidence.md` 소관)의 의존성인데 **그쪽 `code:` 만 갱신 안 됨**. 이번 리팩터가 두 컨벤션의 구현 격리를 처음으로 깼다 | 양쪽에 등재 + 공유 인프라임을 주석으로 명시 |
| W2 | plan_coherence | 조건부 후속("`plan-scan.ts` 449줄 — 다음 확장 시 재검토")이 **timestamped review 산출물에만** 존재 → plan 이 닫히면 재발견 불가 | 살아있는 자매 plan 으로 이관 |

W1 은 이 PR 의 주제(자매가 조용히 갈린다)가 **spec 문서 층위에서 그대로 재현된** 것이다 —
공유 헬퍼를 만들면서 그 사실을 한쪽 문서에만 적었다.

## INFO (무조치)

- `MdFileRef` 와 `PlanMdFile` 별칭 공존 — 이전 라운드들에서 이미 의도된 설계로 수렴.
- `code:` 목록의 "헬퍼 + 자기 `.test.ts` 동반 등재" 규칙이 문서에 없어 기존 항목도 비일관 —
  다음에 그 문서를 손댈 때 §4.2 에 한 줄 명문화 권장.
