# Rationale 연속성 검토 — 3차 라운드 (종결 확인)

## 진단 메모

prompt_file 의 diff 섹션 부재(알려진 결함)로, 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서 직접
`git log`/`git show`/`git diff origin/main`으로 실제 변경분을 재수집했다.

2차 라운드(`review/consistency/2026/08/10/01_37_01/rationale_continuity.md`, 판정 **NONE**)가
남긴 유일한 관찰 — `harness-env-value-subpattern-dedup.md`의 `#970` 인용이 원 사건의 도메인
(security 게이트 설계)보다 넓게 일반화됐다 — 이 반영됐는지, 그리고 같은 커밋(`e9b789a44`,
"fix(harness): 2차 consistency 지적 반영 — stale plan 포인터 · 인용 범위 · 도입일")이 함께
만든 두 개의 다른 결정(도입일 정정 · 코드 주석 포인터 정정)이 기존 spec `## Rationale`과
충돌하지 않는지 확인했다.

## 확인 대상 커밋

`e9b789a44` (HEAD) — 변경 파일 3개:
1. `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (주석 1줄)
2. `plan/in-progress/harness-env-value-subpattern-dedup.md` (인용 문단 확장)
3. `spec/conventions/spec-impl-evidence.md` (날짜 1곳)

### 1. `#970` 인용 범위 축소 — 정확한 범위로 되돌아갔는지

**확인됨. 정확하다.**

수정 후 문구:

> `#970`(blind 정규식 vs 정밀 파서)을 그 기준의 출처로 적었다가 **인용 범위를 좁혔다** —
> 그 사건이 세운 원칙은 "막는 쪽은 무지하게, 푸는 쪽만 정밀하게" 라는 **security 게이트
> 설계** 원칙이지, 일반 코드 중복을 문서상 어떻게 나눌지의 기준이 아니다. 이 분리 결정은
> 그 인용 없이도 성립한다 — 코드베이스·언어·실패 모드가 다르다는 독립 근거가 있다.

- `#970` 원 사건의 실제 원칙("차단은 무지하게, 해제만 정밀하게")을 `plan/complete/harness-guard-followups.md:468-469`와
  `plan/complete/push-guard-worktree-scope.md:219-220`("blind substring 은 무지해서 안전하고,
  틀리는 방향이 항상 엄격한 쪽")에서 실측 대조했다. 두 문서 모두 이 원칙을 **security
  gate(push 차단·mutating bash 차단) 설계**의 맥락에서만 서술하며, 일반 코드 중복을 어느
  plan 문서에 배치할지의 기준으로 확장 서술한 곳은 없다 — 수정된 문구의 "security 게이트
  설계 원칙" 한정이 원 이력과 정확히 일치한다.
- 인용을 완전히 삭제하지 않고 괄호 안 역사적 각주로 남기면서 "이 분리 결정은 그 인용 없이도
  성립한다"고 독립 근거(코드베이스·언어·실패 모드 상이)를 명시한 것은, 2차 라운드가 제안한
  "인용 범위를 좁혀 쓰면 더 정확하다"는 완화 방향과 정확히 부합한다 — 인용 자체를 지어내거나
  왜곡하지 않았고(사용자 메모 "Rationale 기각된 대안은 실제 이력 필수" 기준 충족), 결정의
  근거 구조도 인용 의존형에서 독립 근거형으로 명확히 재배치됐다.
- 대응하는 자매 plan(`plan/in-progress/docs-guard-walker-dedup.md` §"왜 별 plan 인가")도
  같은 독립 근거(코드베이스·언어·실패 모드 상이)를 대칭적으로 서술하고 있어 양쪽 문서가
  상호 정합하다.

### 2. 새로 생긴 결정 — 도입일 정정

`spec-impl-evidence.md §2.2`:

```diff
- (**plan frontmatter**, 2026-08-10 추가) ... 2026-08-10 부터 build 가드 대상이
+ (**plan frontmatter**, 2026-08-09 추가) ... 2026-08-09 부터 build 가드 대상이
```

- 실제 build 가드 도입 커밋(`9e880e908`, "feat(harness): plan 이동이 남기던 두 갭에 게이트…")의
  author date 는 **2026-08-09 23:33:51 +0900**이다 — `git log -1 --format=%ad --date=iso-local 9e880e908`
  로 재확인했다.
- 자매 문서 `plan-lifecycle.md:84`("2026-08-09 신설")와 `plan-frontmatter.test.ts:27`
  ("2026-08-09: 이동(...)이 남기는 두 갭을 함께 막는다") 둘 다 이미 08-09 로 적혀 있어, 이번
  정정은 세 SoT를 값 수준에서 일치시킨다.
- 이는 spec 내 결정을 번복한 것이 아니라 **순수 날짜 오기 정정**이며, 오히려 `spec-impl-evidence.md`
  자신의 `## Rationale R-8`이 명시한 관행("cutoff 값은 spec-impl-evidence·plan-lifecycle·test
  3곳에 동기 유지")과 정합적인 방향의 수정이다. 새 Rationale이 필요한 종류의 결정 번복이
  아니므로 그 부재는 결함이 아니다.
- 충돌 없음.

### 3. 새로 생긴 결정 — 코드 주석 포인터 정정

`plan-scan.ts` 주석:

```diff
- 그 통합은 `harness-env-value-subpattern-dedup.md` 에 등재했다.
+ 그 통합은 `plan/in-progress/docs-guard-walker-dedup.md` 에 등재했다.
```

- `harness-env-value-subpattern-dedup.md`는 `.claude/hooks/*.py`의 정규식 상수 중복을 다루는
  plan이고, walker 통합(Gate C `collectCompletePlans` 잔존 이슈)은 실제로는 `docs-guard-walker-dedup.md`
  §"함께 볼 것 — Gate C 의 4번째 walker"에 등재돼 있다 — 직접 확인함(해당 절 실존, 내용도
  주석이 요약하는 것과 일치: "`collectCompletePlans` 도 여전히 독립 구현이다… 필터 값은 현재
  `walkPlanMarkdown` 과 일치").
- 이는 설계 결정의 번복이 아니라 **잘못된 참조를 정본으로 교정**한 것 — round-2가 지적한
  "이관을 되돌린 커밋이 코드 주석 포인터는 갱신하지 않았다"는 결함의 직접 수정이다. 대응하는
  Rationale 재작성 의무는 발생하지 않는다(포인터 오류 정정에는 새 Rationale이 불필요).
- 두 plan 문서 사이의 상호 참조(`harness-env-value-subpattern-dedup.md` → `docs-guard-walker-dedup.md`,
  역방향도 존재)가 양쪽에서 대칭적으로 유지되고 있어 orphan 링크나 일방향 참조로 인한 새로운
  발견 여지도 없다.
- 충돌 없음.

## 발견사항

새 발견 없음. 3차 라운드는 2차 라운드가 남긴 유일한 관찰(인용 범위)의 정확한 반영을 확인했고,
같은 커밋 안에서 함께 이뤄진 두 개의 부수 정정(도입일·코드 주석 포인터)도 기존 spec
`## Rationale`(R-8 cutoff 동기화 관행 포함)과 충돌하지 않는 순수 정합화 수정임을 확인했다.
기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 — 네 관점 모두 해당 사항 없음.

## 요약

3차 라운드는 종결 확인 라운드다. 2차가 지적한 `#970` 인용 범위 문제는 이번 커밋에서 정확히
좁혀졌다 — 원 사건("차단은 무지하게, 해제만 정밀하게")을 실제 이력 문서로 재대조한 결과,
수정된 문구가 그 사건의 실제 도메인(security 게이트 설계)을 정확히 반영하며, 결정 자체는
그 인용 없이도 성립하는 독립 근거(코드베이스·언어·실패 모드 상이)를 명시하고 있어 인용 오용
위험이 해소됐다. 같은 커밋에서 이뤄진 도입일 정정과 코드 주석 포인터 정정은 각각 사실 오류
교정에 불과하며, spec의 `## Rationale`이 세운 어떤 원칙(R-8의 cutoff 3곳 동기화 관행 포함)과도
충돌하지 않는다. Rationale 연속성 관점에서 이 게이트는 열려도 된다.

## 위험도

NONE

STATUS=success
