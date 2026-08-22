---
title: "`ExecutionsService.reRun` 입력 해석 블록을 private 헬퍼로 — 마커 시리즈 마지막 이월 항목"
status: complete
worktree: masked-marker-plan-close-d8edad
started: 2026-08-22
owner: developer
spec_impact: none
---

# `reRun` 입력 해석 블록 추출

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
의 *"마커 재제출 거부 PR 의 이월 항목"* 중 **마지막 남은 1건**이다. 트래커 문면 그대로:
*"다음에 손댈 때 입력 해석 블록을 private 헬퍼로."*

## 무엇을 뽑나 — 트래커가 지목한 그 블록만

`reRun` 은 **141줄·6책임**이다(실측). 그중 가장 크고 가장 복잡한 것이
`executions.service.ts:483-522` 의 **40줄 입력 해석 블록**이다 — 스키마 로드 · 마커 거부
resolve · 검증 예외를 응답 봉투로 매핑까지 한 덩어리다. 이 블록만 뽑는다.

```text
const useOriginal = dto.useOriginalInput ?? true;
const executionInput = useOriginal
  ? (original.inputData ?? {})
  : await this.resolveManualOverrideInput(original.workflowId, dto.inputOverride ?? {});
```

40줄 → **4줄**. 나머지 5개 책임(조회+인가 · dry-run pre-flight · chain 깊이 · execute ·
감사로그)은 **손대지 않는다** — 트래커가 지목한 것은 입력 해석 하나다.

### 설계 판단 두 가지

1. **`useOriginal` 은 호출부에 남긴다.** 아래 `inputModified` 계산이 같은 값을 쓴다.
   헬퍼 안으로 넣고 호출부에서 `dto.useOriginalInput ?? true` 를 다시 쓰면 **기본값
   `?? true` 가 두 곳에 생긴다** — 한쪽만 바뀌면 조용히 갈린다.
2. **헬퍼가 `__triggerSource` 봉투까지 만든다.** 파라미터만 돌려주면 봉투 모양 결정이
   호출부에 남아, "manual override 입력은 이렇게 생겼다" 는 계약이 두 군데로 쪼개진다.

## 동작은 바뀌지 않는다 — 순수 추출

에러 코드·봉투 필드(`INVALID_TRIGGER_PARAMETERS` / `details`)·검사 시점(raw 우선) 전부
그대로다. 이 시리즈가 세 PR 에 걸쳐 고친 것들이라 **한 글자도 바꾸지 않는 것이 요건**이다.

## 작업

- [x] `/consistency-check --impl-prep` — `21_53_41` **BLOCK: NO**. Warning 2건 처리
      (plan 체크리스트 명시 · spec 401 drift 를 planner 항목으로 등재)
- [x] `resolveManualOverrideInput` 추출 (동작 무변경) — **141줄 → 109줄**
- [x] **뮤테이션으로 기존 테스트가 옮겨진 코드를 무는지 검증** — 3종 전부 RED (아래 결과)
- [x] 트래커 `reRun` 항목 종결
- [x] `masked-marker-test-gaps.md` 의 **마지막 두 체크박스를 `[x]` 로 갱신**
- [x] **`masked-marker-test-gaps.md` 를 `complete/` 로 이동**
- [x] TEST WORKFLOW 4단계 + 타입체크 ratchet — 4단계 PASS (backend **8,904** ·
      frontend 6,124 · web-chat 451 · e2e backend 276 + playwright 51), ratchet 199건/38파일
- [x] `/ai-review` — `22_19_56` **Critical 0 · Warning 1**, 그 Warning 이 이 체크리스트다

## 뮤테이션 결과 — 예측을 먼저 적고 실행했다

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| M1 에러 코드를 `INVALID_INPUT` 으로 되돌림 | RED | ✅ RED (2건) |
| M2 `details` → `errors` 되돌림 | RED | ✅ RED (1건) |
| M3 마커 거부를 base resolve 로 되돌림 | RED | ✅ RED (2건) + **CI 가드도 RED** |

> **M3 의 첫 시도는 무효 뮤턴트였다.** `resolveTriggerParameters` 가 import 돼 있지 않아
> TS2304 로 죽은 **거짓 RED**(6건 실패로 보였다). `tsc` 선검증에서 잡아 import 를 함께 넣어
> 유효화한 뒤 다시 쟀고, 그때도 RED 였다.
>
> M3 에서 `masked-reject-callers-guard` 가 함께 RED 인 것이 요점이다 — 호출 지점이 `reRun`
> 본문에서 private 메서드로 옮겨가도 가드의 AST 탐지 축에 그대로 걸린다.

원복 후 `cmp` 바이트 동일, 210/210 재확인.

## 함께 처리 — 앞 PR 의 plan 이동

[`masked-marker-test-gaps.md`](./masked-marker-test-gaps.md) 는 PR #1196 으로 **모든 항목이
끝났는데** `in-progress/` 에 남아 있다. 마지막 두 체크박스(TEST WORKFLOW · `/ai-review`)가
리뷰 **후에** 완료되는 단계라 그 PR 안에서 체크하지 못했다.

> **그 판단의 근거가 틀렸다.** 나는 *"리뷰 뒤 커밋하면 게이트가 다시 막는다"* 고 적었는데,
> `review_guard.py:63` 은 freshness 를 **`codebase/**` 파일 기준**으로만 잰다 —
> plan-only 커밋은 리뷰를 stale 로 만들지 않는다. #1196 안에서 했어야 했다.
>
> [`plan-lifecycle.md §3`](../../.claude/docs/plan-lifecycle.md) 이 *"이동만 담은 별 PR
> 분리 금지"* 를 명시하므로, 이 PR(다음 작업 PR)에 실어 규칙을 지킨다.

## 검증 기준

- **순수 추출 증명**: 기존 e2e·unit 이 그대로 GREEN 이어야 한다. 단, GREEN 은 증거가 아니다
  — **옮겨진 코드에 뮤테이션을 넣어 RED 를 확인**한다. 추출된 헬퍼가 테스트 사각지대로
  이사했다면 그게 리팩터가 만든 회귀다.
  - M1: 에러 코드를 `INVALID_INPUT` 으로 되돌린다 → RED (#1193 이 세운 계약)
  - M2: `details` 를 `errors` 로 되돌린다 → RED (#1189 가 고친 배선)
  - M3: 마커 거부를 base `resolveTriggerParameters` 로 되돌린다 → RED (CI 가드 + 테스트)
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
- `masked-reject-callers-guard` 가 헬퍼 추출로 **무뎌지지 않는지** 확인 — 호출 지점이
  `reRun` 본문에서 private 메서드로 옮겨가므로 가드의 탐지 축(AST identifier)에 그대로
  걸리는지 M3 로 실증한다.
