# RESOLUTION — `review/code/2026/08/09/20_53_07`

대상 커밋: `9b775e878` (반증된 앵커 정정 — nil-UUID 회귀 캐너리)
결과: **Critical 0 · WARNING 1 → 1건 처리 · INFO 4 → 2건 후속 등재 / 2건 조치 불요**

## WARNING #1 — 자매 plan 체크리스트 stale → **처리**

**지적**: 이번 커밋이 정확히 해소한 항목 2건이
`plan/in-progress/spec-draft-auth-invariants-sync.md` §후속 "developer 범위" 에 여전히
미해소(`[ ]`)로 남아 있다.

**실측**: 맞다. 해당 절을 직접 열어 확인했고 두 항목 모두 본 PR 이 해소한 것이다 —
(1) `uuid.ts` docstring 캐너리 지목 정정 (2) 캐너리 주석 "73건" 수치 정정.

**조치**: 두 항목을 `[x]` 로 갱신하고 각각에 완료 노트를 달았다.

**"권한 밖" 권고를 따르지 않은 근거**: 그 plan 의 frontmatter `worktree:` 는 다른
worktree 를 가리키지만 **그쪽 작업은 끝났다** — `#1112` 가 2026-08-09 20:30 에 머지됐다.
권고대로 포인터만 남기면 **아무도 체크하지 않는다**. 이 저장소가 이미 같은 판단을 한
전례가 있다(`auth-guard-reflection-hardening.md §부수 — checker 권고를 오버라이드했다`).
체크박스만 담은 별 PR 은 `plan-lifecycle.md §3` 이 금지하므로 인접 PR 에 싣는 것이 정본이다.

> 완료 노트에 리뷰가 몰랐던 사실 하나를 추가했다 — 사본이 지목된 것보다 하나 더 많았다.
> `uuid.ts` 외에 `uuid.spec.ts` 에도 있었고, 본 PR 이 신설한 픽스처 모듈이 **세 번째 사본을
> 새로 만들 뻔했다**(작성 시점엔 반증을 몰랐다).

**재리뷰 불요**: 이 fix 는 `plan/**` 만 건드린다. 리뷰 게이트 스코프는 `codebase/**` 이므로
원 리뷰가 stale 해지지 않는다.

## INFO #1 · #2 — 후속 등재 (이번 PR 에서 조치 안 함)

- **#1 정정 문단이 4곳에 재복제 · SoT 부재** — 근거를 `uuid.ts` 한 곳에 모으고 나머지는
  포인터로 축약하는 편이 낫다는 지적. 타당하다.
- **#2 정정 이력 표기 스타일이 파일마다 다름** — `uuid.ts` 는 인용-각주로 이력 보존,
  나머지 둘은 조용히 재작성.

**지금 하지 않는 이유**: 둘 다 `codebase/**` 편집이라 방금 Critical 0 로 수렴한 리뷰가 다시
stale 해지고 TEST WORKFLOW 를 한 번 더 돈다. INFO 등급 구조 개선에 비례하지 않는다.
[`auth-guard-reflection-hardening.md §후속`](../../../../../../plan/in-progress/auth-guard-reflection-hardening.md)
에 트리거와 함께 등재했다 — **다음에 이 파일들을 만질 때** 함께 처리한다.

## INFO #3 · #4 — 조치 불요

- **#3 본 worktree 대응 plan 부재**: 의도된 구성이다. 이 PR 은 두 기존 plan
  (`auth-guard-reflection-hardening` · `backend-lint-gate-broken-on-main`)의 §후속 항목을
  집행하는 것이라 그 두 문서가 추적처다. 신규 plan 을 만들면 추적처가 셋으로 갈린다.
- **#4** 는 reviewer 자신의 확인용 기록(갭 없음).
