---
title: review-citations.md — "시행 코드가 없다" 는 전제가 반증됐다
worktree: user-entity-column-defense
started: 2026-09-06
owner: planner
status: in-progress
priority: P1
spec_impact:
  - spec/conventions/review-citations.md
  - spec/conventions/spec-impl-evidence.md
---

# `review-citations.md` 의 전제가 반증됐다 (planner 턴)

`review/consistency/2026/09/06/12_53_29` **Critical 1**. 4개 checker 중 둘이 독립 보고했고
`BLOCK: YES` 가 걸렸다.

## 무엇이 반증됐나

`review-citations.md` 의 `## Rationale` 첫 소절이 이렇게 적는다:

> `spec-impl-evidence.md` 는 `code:` 를 *"본 spec 이 약속한 surface 의 구현 경로"* 로
> 정의한다. **이 규약에는 시행하는 코드가 없다** — 주석 형태를 강제하는 가드가 없기
> 때문이다. 그래서 `code:` 에 **이 규약이 처방하는 형태를 실제로 쓰는 파일**을 적었다.

`user-entity-column-defense` 브랜치가 `dto-jsdoc-citation-guard.ts` 를 세우면서 **그 전제가
거짓이 됐다** — 이제 §3(DTO·컨트롤러 JSDoc 카브아웃)을 AST 로 강제하는 코드가 있다.

## 왜 developer 가 못 고치는가

`CLAUDE.md` 의 자기-반증형 소정정 예외는 **다섯 조건을 전부** 요구하는데 조건 1이 깨진다 —
그 문장은 **developer 가 그 문서에 써 넣은 예고가 아니다.** 2026-09-05 planner 턴이 등재한
Rationale 이고, `git blame` 으로 확인 가능하다. 조건 2도 애매하다: 예고·트리거가 아니라
`code:` 필드의 **해석 근거**다.

그래서 우회하지 않고 planner 턴을 연다.

## 변경안 (A) — Rationale 을 범위로 좁힌다

취소선으로 원문을 남기고, **무엇이 강제되고 무엇이 안 되는지**를 가른다. 통째로 지우면
"왜 `code:` 가 준수 예시를 가리키는가" 라는 원래 질문의 답이 사라진다.

```markdown
### `code:` 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는 이유

`spec-impl-evidence.md` 는 `code:` 를 *"본 spec 이 약속한 surface 의 구현 경로"* 로 정의한다.
~~이 규약에는 **시행하는 코드가 없다** — 주석 형태를 강제하는 가드가 없기 때문이다.~~

> **정정 (2026-09-06)**: 이제 **한 축의 절반이 강제된다.**
> `repo-guards/__tests__/dto-jsdoc-citation-guard.ts` 가
> *"**응답 DTO** 의 `/** */` JSDoc 에 리뷰 인용을 쓰지 않는다"* 를 AST 로 센다.
> 같은 위반이 **세 번** 났고 세 번 다 사람이 읽고 잡은 것이 계기다
> (`review/code/2026/09/06/12_28_02` W2).
>
> | 절 | 강제되나 | 근거 |
> |---|---|---|
> | §2 (bare `hh_mm_ss` 금지) — `codebase/**` 전반 | **아니오** | 가드 없음 |
> | §3 — **응답 DTO** JSDoc | **예** | 위 가드 |
> | §3 — **컨트롤러** JSDoc | **아니오** | 위 가드는 `isResponseDtoFile()` 로 `dto/responses/**` 만 훑는다. 컨트롤러는 여전히 사람이 본다 |
>
> **§3 을 한 덩어리로 "강제됨" 이라 적지 않는다.** 그 절은 DTO 와 컨트롤러를 함께 묶는데
> 가드는 절반만 본다 — 묶어서 적으면 **문서한 보장이 구현보다 넓어진다**. 이 문서의
> Rationale 자신이 그 실패를 두 번 기록하고 있다.
>
> 그래서 `code:` 는 이제 **두 종류**를 담는다: 준수 예시(아래 두 파일)와 시행 코드.

그래서 `code:` 에 **이 규약이 처방하는 형태를 실제로 쓰는 파일**을 적었다 (저장소에 10개
있고 backend·frontend 에서 하나씩).
```

## 변경안 (B) — `code:` 에 시행 코드 등재

```yaml
code:
  - codebase/backend/src/common/guards/roles.guard.spec.ts
  - codebase/frontend/src/components/llm-config/sanitize-loader-error.ts
  - codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts
```

**이것이 이 항목의 실질**이다. 등재하지 않으면 그 가드를 약화·삭제해도
`--impl-done` SPEC-CONSISTENCY 게이트가 물지 않는다 — 래칫에 fixture 가 없어 술어가 죽어도
그린이던 것과 같은 등급의 사각지대다.

> **glob 폭에 주의**: `dto-jsdoc-citation*.ts` 여야 한다 —
> `dto-jsdoc-citation-guard*.ts` 로 좁히면 **`.spec.ts` 가 빠진다.** 베이스라인
> (`EXPECTED_DTO_JSDOC_CITATIONS`)과 fixture 대조군이 사는 곳이 그 spec 파일이고,
> 그것이 약화되는 것이 정확히 이 등재로 막으려는 사각지대다
> (`review/consistency/2026/09/06/13_06_22` W2). 자매 plan
> (`spec-draft-nullable-notation-followups.md`)의 같은 항목도 이 폭으로 맞췄다.
>
> **`swagger.md` 에는 등재하지 않는다 — 의도다.** 이 가드가 강제하는 것은 응답 계약이
> 아니라 **주석 형태 규약**이라 `review-citations.md` 가 소유자다.

## 변경안 (C) — `spec-impl-evidence.md §2.1` 의 선례 인용을 **좁힌다**

**실측 결과 낡았다.** `spec-impl-evidence.md:81` 의 `code` 행이 이렇게 적는다:

> **예외 — 시행 코드가 없는 순수 문서형 convention**: … (선례: `review-citations.md` —
> **주석 형태를 강제하는 가드가 없다**)

괄호 안 근거가 이제 거짓이다.

**예외 규칙 자체는 유효하다** — 지우지 않는다. 선례 인용만 축으로 좁힌다:

```markdown
(선례: [`review-citations.md`](./review-citations.md) — **§2 축**(bare 시각 금지)에는
여전히 강제하는 가드가 없다. §3 의 DTO 카브아웃은 2026-09-06 이후 강제된다)
```

한 문서 안에서 축마다 강제 여부가 갈릴 수 있다는 것이 이 정정의 요지다 — 그래서 "선례" 를
문서 단위가 아니라 **축 단위**로 읽게 만든다.

## 함께 처리할 것 (checker 가 같은 턴을 권고)

이번 Critical 과 **조사 대상이 겹치므로** 같은 턴에서 처리하면 중복 비용이 없다. 셋 다
`spec-draft-nullable-notation-followups.md` 에 이미 등재돼 있다:

1. §5.4 「검증 층」에 구조 축·이름 축 등재 + `swagger.md §5-1` 의 *"두 검증자"* 문구 —
   **개수를 다시 쓰지 말고 나열형으로.**
2. `1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 +
   `## Rationale` 에 결정 근거 승격.
3. `spec-draft-api-convention-verifier-registration.md` 를 `plan/complete/` 로 이동
   (열린 체크박스 0, PR #1289 로 머지됨).

## 종결 조건

- [x] (A) Rationale 정정 — 취소선 + **DTO/컨트롤러를 가른** 강제 여부 표
- [x] (B) `code:` 에 `dto-jsdoc-citation*.ts` 등재 (glob 폭 주의)
- [x] (C) `spec-impl-evidence.md §2.1` 선례 인용을 **축 단위**로 좁힘
- [x] **자매 plan 동기화** — `spec-draft-nullable-notation-followups.md` 의 「신규 검출 3축
      등재」 항목에서 **JSDoc 축 행을 이 draft 가 선행 집행**한다는 사실과 같은 glob 폭을
      반영 (`13_06_22` W1·W2). 안 하면 두 문서가 같은 `code:` 슬롯에 다른 폭을 지시한다
- [x] `--spec` 게이트 BLOCK:NO 확인 후 `spec/` 반영 (`review/consistency/2026/09/06/13_18_59` — Critical 0 · WARNING 0)
- [ ] `--impl-done` 재실행으로 Critical 해소 확인

> 위 「함께 처리할 것」 3건은 **이 draft 의 종결 조건이 아니다** — 자매 plan 이 소유하고
> 있고 이 draft 가 단독 머지돼도 그쪽 체크박스가 남는다. 여기 적은 것은 *"같은 턴에 하면
> 조사 비용이 겹치지 않는다"* 는 권고이지 구속이 아니다 (`13_06_22` INFO#3).
