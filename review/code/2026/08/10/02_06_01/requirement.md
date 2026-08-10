# 요구사항(Requirement) 리뷰 — plan-lifecycle-gates (02_06_01)

## 리뷰 대상

1. `review/consistency/2026/08/10/01_37_01/rationale_continuity.md` (신규 — consistency-checker 산출물, "Review" 유형)
2. `spec/conventions/spec-impl-evidence.md` (누적 diff: `dd7da2d1b` + `88555a52b` + `e9b789a44` — plan `status` 가드 신설분에 대한 spec 반영)

두 파일 모두 애플리케이션 코드가 아니라 문서(리뷰 산출물 · spec convention)이므로, "기능 완전성/엣지케이스/반환값" 류 관점은 문서가 서술하는 **실제 구현(`plan-scan.ts`, `plan-frontmatter.test.ts`, `.claude/docs/plan-lifecycle.md`)과의 사실 일치**로 치환해 점검했다.

## 실측 검증 방법

- `git log -S`/`git show` 로 `88555a52b`·`e9b789a44`·`dd7da2d1b`·`ebb6f9598`·`9e880e908` diff 를 직접 열어 spec 서술과 대조
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`, `plan-frontmatter.test.ts`, `plan-scan.test.ts` Read 로 실제 동작(3개 검사 구성, `TERMINAL_PLAN_STATUSES` 값 4종) 확인
- `.claude/docs/plan-lifecycle.md` §4 와 spec 표 행(§4.2) 상호 대조
- backend `TERMINAL_STATUSES` 실존(`execution-engine.service.ts:499`, `interaction.service.ts:44`) 및 `plan/complete/spec-sync-5-system-metrics-gap.md:37` 인용 grep 검증
- `codebase/frontend/src/lib/docs/__tests__/` 전체에 개명 후 잔존 `TERMINAL_STATUSES`(구명) 없음 확인 (rename 완결성)
- `docs-guard-walker-dedup.md` / `harness-env-value-subpattern-dedup.md` 두 plan 문서 Read 로 "자기 정정" · "Rationale" 서술 실재 확인

## 발견사항

- **[INFO]** `rationale_continuity.md` 의 인용 위치가 실제 heading 과 어긋남 — "plan 분리는 `docs-guard-walker-dedup.md ## Rationale`("왜 별 plan인가")" 라고 썼으나, 실제로 "왜 별 plan 인가" 문구는 `## Overview` 아래 blockquote 콜아웃(`docs-guard-walker-dedup.md:17`)에 있고, 그 문서의 `## Rationale` 절(63행)은 "왜 P3 인가"·"왜 지금 합치지 않았나" 를 다룬다(별개 질문).
  - 위치: `review/consistency/2026/08/10/01_37_01/rationale_continuity.md:31` (게이트 `31|`)
  - 상세: 결론("plan 분리에 새 근거가 남아있다")은 사실이나, 그 근거가 어느 heading 아래 있는지의 인용이 부정확하다. "왜 별 plan 인가" 콜아웃과 "## Rationale" 절은 같은 문서의 다른 섹션이다.
  - 제안: 인용을 "`docs-guard-walker-dedup.md` Overview 콜아웃("왜 별 plan 인가") + `## Rationale`" 로 분리 표기하면 정확해진다. 결론에는 영향 없어 CRITICAL/WARNING 격상 대상 아님.

- **[INFO]** (검증 결과, 발견 아님) `spec-impl-evidence.md` §2.2/§4.2 diff 는 실제 구현과 line-level 로 일치한다. 구체적으로: (a) `code:` 목록에 추가된 `plan-scan.ts` 실존, (b) §2.2 신규 문단의 "`TERMINAL_PLAN_STATUSES` 가 SoT" 서술이 `plan-scan.ts:100-105` 의 실제 export(`complete`/`implemented`/`applied`/`superseded` 4종)와 정확히 일치, (c) 도입일 "2026-08-09" 가 그 가드를 신설한 커밋 `9e880e908` 의 author date(2026-08-09)와 일치(이전 라운드 `88555a52b` 는 "2026-08-10" 오기였고 `e9b789a44` 에서 정정 — 현재 diff 는 이미 정정된 최종 상태), (d) §4.2 `plan-frontmatter.test.ts` 행이 서술하는 "셋을 본다 (1)worktree/started/owner (2)complete/** status 종료값 (3)top-level 상대링크" 가 `plan-frontmatter.test.ts` 의 실제 3개 검사 블록과 정확히 대응, (e) 개명(`TERMINAL_STATUSES`→`TERMINAL_PLAN_STATUSES`) 이 `codebase/frontend/src/lib/docs/__tests__/` 전역에서 완결돼 구명 잔존 0건.
  - 위치: `spec/conventions/spec-impl-evidence.md:87`, `:132` (게이트 기준)
  - 상세: spec fidelity 관점에서 CRITICAL 판정 대상인 "함수 시그니처·필드명·에러코드·기본값·검증규칙·상태전이 불일치"가 이 diff 범위에는 없음.
  - 제안: 해당 없음 (정보성 기록).

- **[INFO]** `rationale_continuity.md`(파일 1)에 인용된 사실관계(`execution-engine.service.ts:499`·`interaction.service.ts:44` 의 동명 `TERMINAL_STATUSES` 실존, `plan/complete/spec-sync-5-system-metrics-gap.md:37` 의 별개 재개명 항목)를 grep 으로 재확인 — 모두 일치. `#970` 인용 범위를 좁힌 것에 대한 "경미 관찰" 판정도 `harness-env-value-subpattern-dedup.md` 의 실제 콜아웃 문구와 대조해 타당함을 확인.
  - 위치: `review/consistency/2026/08/10/01_37_01/rationale_continuity.md:22` (게이트 `22|`)
  - 상세: 발견 아님, 검증 결과 기록.

TODO/FIXME/HACK/XXX 주석은 두 파일 어디에도 없음. 이 diff 는 문서 전용이라 에러 시나리오·데이터 유효성·반환값·비즈니스 로직 등 코드 레벨 관점은 해당 사항 없음(N/A) — 서술 대상 가드(`plan-frontmatter.test.ts`, `plan-scan.ts`)의 실제 동작과 spec 서술 간 정합만이 실질 점검 대상이었고, 위에서 CRITICAL 급 불일치는 발견되지 않았다.

## 요약

두 파일 모두 코드가 아닌 문서(consistency-checker 산출물·spec convention 갱신)이며, 서술하는 실제 구현(`plan-scan.ts`/`plan-frontmatter.test.ts`/`.claude/docs/plan-lifecycle.md`)과 line-level 로 대조한 결과 모든 핵심 주장(`TERMINAL_PLAN_STATUSES` 4값, 가드 3검사 구성, 도입일 2026-08-09, backend 동명 상수 실존, 개명 완결성)이 사실과 일치했다. 유일한 흠은 `rationale_continuity.md` 가 인용 근거의 섹션 위치("## Rationale" vs 실제로는 Overview 콜아웃)를 다소 부정확하게 표기한 것으로, 결론 자체를 훼손하지 않는 INFO 수준이다.

## 위험도

NONE
