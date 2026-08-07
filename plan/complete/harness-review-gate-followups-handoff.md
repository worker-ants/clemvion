---
title: 리뷰 게이트 백로그 잔여 3건 — 새 세션 인계
worktree: (미할당 — 착수 시 ensure-worktree.sh 로 생성)
started: 2026-08-07
owner: developer
priority: P3
spec_impact: none
---

# 인계 — `harness-review-gate-followups.md` 잔여 §6 · §9 · §10

> 본체: [`harness-review-gate-followups.md`](harness-review-gate-followups.md).
> 14건 중 **9건 종결 + 1건 철회**(§5)가 끝났고, 남은 셋은 전부 **별도 티켓급**이다 —
> 앞의 아홉과 달리 선행 조건이나 재설계가 걸려 있어 "이어서 하나 더" 로 끝나지 않는다.

## 새 세션에 그대로 붙여 쓸 프롬프트

```
plan/in-progress/harness-review-gate-followups.md 의 남은 항목 §6 · §9 · §10 을 진행해줘.

착수 전에 각 항목의 전제를 코드로 재판정할 것 — 이 백로그는 항목마다 전제가 한 번씩
틀렸다. 특히:
  · grep 은 주석까지 잡는다. 코드에서만 세라(주석·docstring 제외).
  · "미검증" 류 항목은 테스트 존재 여부로 판정하라. 심볼이 있어도 stub 으로만 덮여
    있으면 미검증이다.
  · 전제가 반증되면 항목을 지우지 말고 **반증 근거를 적어** defer 하라.

순서 권고: §9 → §10 → §6. 뒤로 갈수록 선행 조건이 크다.
```

## 항목별 착수 메모

### §9 — `merge_coordinator_orchestrator` 에 `reconcile_state_with_disk` 가 없다

- **재판정 방법**: 주석 제외 후 `reconcile_state_with_disk` 를 세라. 2026-08-07 실측 **0회**
  (주석에만 등장). 자매 orchestrator 둘은 `_shared/retry_state.py` 로 위임 완료 상태다.
- **가장 작다.** 세 사본 중 이 파일만 자기치유가 없어, 디스크와 상태 파일이 어긋나면
  수동 개입이 필요하다.
- 주의: `_emit_summary_state` 만 branch/base 를 다뤄 다른 둘과 다르다 — 그 차이는 유지해야 한다.

### §10 — `_retry_state.json` 의 lost update (`agents_fatal`)

- **재판정 방법**: `retry_state.py` 에서 주석 제외 후 `flock` 을 세라. 2026-08-07 실측 **0회**.
- **`flock` 은 이미 기각됐다** — "모든 훅 경로에 블로킹 프리미티브를 놓는다" 가 사유이고
  그 판단은 코드 주석에 남아 있다. **되살리려 하지 말 것.**
- 남은 설계는 `<name>.fatal` sentinel 파일로 `agents_fatal` 도 디스크에서 **재도출**하는 것.
  수렴 가능한 필드(`agents_success`)는 이미 그렇게 하고 있으므로 같은 축을 넓히는 일이다.
- 왜 중요한가: `agents_fatal` 은 메모리 값을 필터링할 뿐이라 **한 번 유실되면 어떤 reconcile
  로도 복구 불가**하고, `/loop` 가 영구 실패로 판정된 checker 를 다시 돌린다.

### §6 — 브랜치-diff 헬퍼가 두 orchestrator 에 중복

- **선행 조건이 크다**: `hooks/_lib` 와 `skills/_lib` 의 **네임스페이스 충돌 해소**가 먼저다.
  그게 없으면 공유 모듈을 만들어도 import 가 서로를 오염시킨다(`_harness.py` 상단이 그 회피를
  문서화하고 있다).
- 대상: `consistency_orchestrator._branch_changed_rels` 와
  `code_review_orchestrator.get_git_branch_diff_files`.
- 같은 뿌리의 항목이 하나 더 있다 — "origin 기본 브랜치 해석이 4곳에 독립 구현"(본체 문서
  하단). 반환 계약이 서로 달라(로컬 `main` vs `origin/main`) 단순 통합이 불가하므로,
  네임스페이스 해소 뒤 **함께** 설계하는 편이 낫다.

## 이 백로그를 하며 반복해서 확인된 것 (다음 세션이 재사용할 것)

- **전제는 낡는다.** 14건 중 최소 4건에서 내 판정이 틀렸다 — "미경화 4곳" 이 실제로는
  5곳+3곳(성격 다름)이었고, "동일 보일러플레이트 4벌" 은 유사도 44~70% 였다.
- **GREEN 은 증거가 아니다.** 이 백로그에서만 vacuous 테스트를 세 번 만들었다:
  `update-ref -d` 가 symref 를 안 지워 Method 1 을 그대로 탄 것, diff 를 생성 뒤에 꽂아
  분기를 안 탄 것(`exercised=0` 검사가 잡음), 행렬이 대상 분기를 안 탄 것.
  → **주 단언 옆에 "이 픽스처가 그 경로를 실제로 타는가" 를 함께 단언하라.**
- **가드는 메커니즘이 아니라 속성을 봐야 한다.** "`git_in` 을 쓰는가" 로 짠 가드는 이미 옳은
  10곳을 위반으로 잡았고, "`-C` + ceiling 이 걸렸는가" 로 바꾸자 진짜 3곳을 찾았다.
- **고치다가 같은 결함을 재생산할 수 있다.** §1 에서 계상 누락을 고치며 내가 추가한 안내문의
  계상을 또 빠뜨렸다. 예산·계상을 건드리면 **추가한 문자열도 예약했는지** 마지막에 확인하라.
- **가드를 명확하게 만드는 변경이 가드를 약하게 만들 수 있다.** §5 의 래퍼는 훅의 import
  표면을 넓혔고 그 실패 경로가 fail-open 이었다. 게이트를 건드릴 때는 **실패 시 어느 쪽으로
  넘어지는지**를 먼저 보라.

## 정리된 워크트리 (2026-08-07)

`dep-hygiene` · `retry-turn-cancel-guard-ba75a2` · `spec-cancel-invariant-drift-8b41d2` ·
`spec-impl-prep-blockers-9e21b4` 를 제거했다(전부 PR MERGED). 남은 것:

- `harness-review-ci-backstop-91f379` — 이 세션이 안에 있어 스스로 지울 수 없다. 세션 종료 후
  `.claude/tools/cleanup-worktree.sh <절대경로> --force`.
- `retry-turn-terminal-guard-review-7b7629` — clean·0 커밋이지만 이 세션의 앵커로 지목돼 있어 보류.
- **`pr-1075-1080-build-test-8ce72d` — 지우면 안 된다.** dependabot PR 6개를 합쳐 검증한
  워크트리인데, 위쪽 3개 커밋(통합 검증 리뷰 산출물 · prettier 3.9.6 재포맷 · lockfile 재생성)이
  **어느 원격 브랜치에도 없다**. 살릴지 버릴지 판단이 먼저다.

> `cleanup-worktree.sh` 는 bare name 을 **현재 워크트리 기준**으로 푼다. 워크트리 안에서
> 호출하면 엉뚱한 경로를 보고 exit 2 로 죽으므로 **절대경로로 부를 것**.
