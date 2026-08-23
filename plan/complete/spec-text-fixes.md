---
title: "spec 문구 3건 정정 — union stale · 유효기간 넘긴 대비 문구 · 미정의 ID 참조"
status: complete
worktree: spec-text-fixes-8de464
started: 2026-08-23
completed: 2026-08-23
owner: project-planner
spec_impact:
  - spec/5-system/15-chat-channel.md
  - spec/5-system/14-external-interaction-api.md
  - spec/data-flow/15-external-interaction.md
---

# spec 문구 3건

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
의 미체크 3항목. 셋 다 **문서 stale** 이고 런타임 결함이 아니다 — 그래서 한 planner 턴으로
묶는다.

## 착수 전 재확인 — 셋 다 살아 있다 (실측)

| # | 항목 | 실측 |
| --- | --- | --- |
| 1 | `15-chat-channel.md` §5.1·§8 이 `InteractionRequestContext` 를 *"단일 인터페이스 + optional `scope`"* 로 서술 | **살아 있다** — 319행·507행 확인. EIA §3.3.1(125행)은 이미 **discriminated union**(`ExternalInteractionRequestContext`/`InternalInteractionRequestContext` + `isInternalCtx()`)이고 *"v1 구현 완료"* 로 적혀 있다 |
| 2 | EIA §5.1 이 webhook §5.2 를 *"legacy `statusCode/errors` shape"* 라 서술 | **살아 있다** — 331행. 그런데 webhook §5.2(293행)는 이미 `{error:{code,message,requestId,details}}` 정합 형식이다(직접 열어 확인). **대비 문구가 유효기간을 넘겼다** |
| 3 | `data-flow/15-external-interaction.md:119` 가 미정의 `EIA-AU-09` 참조 | **살아 있다** — EIA 의 `EIA-AU-*` 는 `01`~`08` 만 정의(전수 grep) |

## 처분 방침 — 각각 다르다

- **①은 포인터로 대체한다.** 앵커는 EIA **§3.3.1 전체 절**로 잡는다 — §3.3 요구사항 행만
  가리키면 *"외부 HTTP guard 는 `scope` 를 절대 set 하지 않는다"* 불변식 문장을 놓친다
  (`21_24_43` rationale INFO 5). chat-channel 고유 맥락 1~2문장은 남긴다(INFO 1). 같은 사실을 두 문서가 각자 서술하면 또 갈린다. 체커가
  *"보안 민감(토큰-우회 타입)이라 우선도 있다"* 고 표시한 항목이라 재-drift 비용이 특히
  크다 → `15-chat-channel.md` 는 **EIA §3.3.1 을 SoT 로 가리키고** 그 문서가 무엇을 보장하는지만
  적는다.
- **②는 대비 문구를 지운다.** "legacy 형식이라 안 따른다" 는 근거가 사라졌으므로, 두 문서가
  **같은 봉투를 쓴다**는 사실로 바꾼다. 취소선으로 이력을 남긴다 — 그 대비가 당시에는 옳았다.
- **③은 숫자를 지운다.** `EIA-AU-09` 가 존재한 적이 없으므로 "고칠 번호" 가 없다. `08` 만
  참조하도록 좁힌다.
  > ⚠️ **실제 표기는 결합형 `EIA-AU-08/09` 다 — `/09` 부분만 제거한다.** 정본 트래커가
  > *"단독 `grep 'EIA-AU-09'` 는 0건을 낸다"* 고 이미 경고해 뒀는데 이 plan 이 안 이어받았고
  > (`21_24_43` plan_coherence INFO 10), **실제로 내가 그 grep 을 먼저 돌렸다**. 결합형을
  > 모르면 "이미 고쳐졌다" 로 오독하고 조기 종료한다.

## 작업

- [x] `/consistency-check --spec` — **BLOCK: NO** (`21_24_43`, CRITICAL 0 · WARNING 0)
- [x] ① `15-chat-channel.md` §5.1·§8 → EIA §3.3.1 포인터
- [x] ② EIA §5.1 legacy 대비 문구 정정 — 취소선 + `7e181ed8e`(#754) 근거 병기
- [x] ③ 결합형 `EIA-AU-08/09` 에서 `/09` 만 제거 — 잔존 참조는 정의된 `04`·`08` 뿐(실측)
- [x] 트래커 3항목 종결 + **코드 주석 동일 오기**를 developer 후속으로 등재(INFO 7)
- [x] doc-link(기존 2건 무관) · 하네스 **1074 tests OK**

## 검증

- `--spec` BLOCK:NO 여야 spec 에 쓴다.
- **`codebase/**` 무변경**이라 리뷰 게이트는 push 를 막지 않는다(실측된 스코프 규칙) —
  그래도 문구가 코드와 맞는지는 각 항목의 실측으로 이미 확인했다.

## `--spec` 처분 (`21_24_43` — BLOCK: NO · CRITICAL 0 · **WARNING 0**)

checker 5명 전원 CRITICAL·WARNING 0. INFO 10건 중 실행에 영향을 준 셋을 반영했다.

- **INFO 10 — 내가 이미 그 함정에 빠졌다.** 정본 트래커가 *"실제 표기는 결합형
  `EIA-AU-08/09` — 단독 `grep 'EIA-AU-09'` 는 0건을 낸다"* 고 경고해 뒀는데 이 plan 이
  안 이어받았고, **실제로 내가 그 grep 을 먼저 돌렸다**. 결합형을 몰랐으면 "이미 고쳐졌다"
  로 오독하고 조기 종료했을 것이다 → 처분 방침에 명시.
- **INFO 5**: ① 의 포인터 앵커를 **§3.3.1 전체 절**로 잡았다. §3.3 요구사항 행만 가리키면
  *"외부 HTTP guard 는 `scope` 를 절대 set 하지 않는다"* 불변식 문장을 놓친다.
- **INFO 6**: ② 취소선에 `7e181ed8e`(#754) 커밋 해시를 근거로 병기했다 — 향후 재검토 시
  "언제 왜 바뀌었나" 를 다시 조사하지 않게.
- **INFO 7**: `interaction.guard.ts:27` JSDoc 에 **같은 오기**가 남아 있다(실측 확인).
  코드는 developer 소관이라 이 턴에서 못 고치고 트래커에 등재했다 — `+ §3.3.1 EIA-AU-09`
  부분만 지우면 된다는 착수 지침까지 함께.
- INFO 1·9 는 처분 방식이 이미 그 문서들의 선례와 일치한다는 **확인**이었다.

## 게이트

| 게이트 | 결과 |
| --- | --- |
| `--spec` (`21_24_43`) | **BLOCK NO** · CRITICAL 0 · WARNING 0 |
| doc-link | BROKEN 2 (둘 다 기존 무관 건) |
| 하네스 | **1074 tests OK** |
| review-gate | `codebase/**` 무변경 — push 미차단 |

트래커 미체크 30 → 29 (3건 종결, 1건 신규 등재).
