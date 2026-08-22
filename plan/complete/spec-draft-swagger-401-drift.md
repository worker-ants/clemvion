---
title: spec 드리프트 2건 — 401 코드명 정정 + Swagger 길이-예외를 요청 필드까지
status: complete
worktree: spec-drift-planner-batch-fbbeaa
started: 2026-08-22
owner: project-planner
spec_impact:
  - spec/5-system/13-replay-rerun.md
  - spec/conventions/swagger.md
---

# spec 드리프트 2건 (planner 턴)

마커 시리즈(#1188~#1197)가 developer 권한 밖이라 손대지 못하고 정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
에 등재해 둔 **spec 편집 2건**을 집행한다. 둘 다 **문서가 현실보다 낡은** 경우다.

> 같은 배치의 세 번째 항목(`POST /workflows/:id/execute` body DTO 승격)은 **컨트롤러
> 시그니처 변경 = developer 턴**이라 여기 넣지 않는다. 형제 엔드포인트가 이미
> `ExecuteNodeDto` 를 쓰므로 선례는 있다.

## ① `13-replay-rerun.md` §8.1·§8.2 — 401 코드명

`UNAUTHORIZED` 로 적혀 있으나 표준은 `AUTH_REQUIRED` 다.

| 근거 | 실측 |
| --- | --- |
| 런타임 | `http-exception.filter.ts:145` 가 401 에 `AUTH_REQUIRED` 를 낸다 |
| 규약 | `2-api-convention.md:171` · `3-error-handling.md:42` 둘 다 401 = `AUTH_REQUIRED` |
| 자기모순 | §8.1 행은 스스로 *"표준 [Spec 에러 처리] 규약"* 이라 자칭하면서 비표준 이름을 쓴다 |

**계약 변경이 아니다** — 클라이언트가 실제로 받는 값은 이미 `AUTH_REQUIRED` 이고, 문서만
그걸 잘못 적고 있었다. 그래서 `error-codes.md §5`(Rename 이력) 대상도 아니다: 이름이 바뀌는
게 아니라 **오기(誤記)를 고치는** 것이다.

**자매 전수 확인** (실측): spec 전역에서 `` `UNAUTHORIZED` `` 는 **정확히 2곳**, 둘 다 이
파일이다. 다른 문서로 번진 사본은 없다.

### 제안 diff

```diff
- | 401 | `UNAUTHORIZED` | 인증 토큰 없음/만료. 표준 [Spec 에러 처리](./3-error-handling.md) 규약 |
+ | 401 | `AUTH_REQUIRED` | 인증 토큰 없음/만료. 표준 [Spec 에러 처리](./3-error-handling.md) 규약 |

- | 401 | `UNAUTHORIZED` | 인증 토큰 없음/만료 |
+ | 401 | `AUTH_REQUIRED` | 인증 토큰 없음/만료 |
```

## ② `swagger.md §3` — 길이-예외가 **응답** 필드만 문면상 포괄한다

현행 예외:

> *"**응답 값**이 저장된 값과 다를 수 있는 필드(egress 마스킹 대상 등)는 위 길이 제한의
> 예외다. 소비자가 OpenAPI 만 보고 통합할 때 '왜 DB 와 값이 다른가' 를 알 방법이 그
> 설명뿐이기 때문이다."*

**요청 필드에는 같은 크기의 필요가 있는데 문면이 못 덮는다.** `ReRunRequestDto.inputOverride`
는 *"마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부"* 를 적어야
하는데, 이건 응답이 아니라 **요청이 거부되는 규칙**이다. 소비자가 그걸 알 방법도 똑같이
그 설명뿐이다 — 방향만 반대고 논거는 대칭이다.

### 이것도 "이미 굳은 관행의 추인" 이다 (실측)

§3 은 자기 예외를 도입하며 *"새로 만든 관행이 아니라 이미 굳은 관행의 추인"* 이라 적었다.
요청 필드 쪽도 같은 상태다:

| 측정 | 값 |
| --- | --- |
| 요청 DTO 파일 | 73개 · `description` **333개** |
| 집계 기준 | `codebase/backend/src/**/dto/**/*.dto.ts` 중 `responses/`·`*-response.dto.ts` 제외 |
| 40자 초과 | **114개 (34%)** |
| 최장 | `chat-channel-config.dto.ts` **435자** |
| `re-run.dto.ts` 3필드 | **59 · 129 · 174자** — 3/3 초과 |

초과분 상위에는 이 예외가 겨냥한 바로 그 클래스가 있다 — `create-auth-config.dto.ts`
(248자, 인증 상세 설정) · `chat-channel-config.dto.ts`(386자, *"Provider-issued inbound
webhook 인증 자료 plaintext…"*).

### 적용 — 예외 문면을 **양방향**으로 넓히고, 근거는 `## Rationale` 로 옮겼다

> **`22_53_02` W1 반영**: swagger.md 는 `### §0 / §1-4 / §5 / §5-4` 처럼 *"본문=규칙 /
> Rationale=근거"* 이중 구조를 쓰는데 **`### §3` 만 없었다** — 2026-08-17 예외가 근거를
> 본문 인라인으로 두고 갔고, 내 초안이 그 이탈을 답습했다. `### §3` 을 신설하면서
> **2026-08-17 근거도 함께 옮겨** §3 의 근거가 두 곳으로 쪼개지지 않게 했다.

**본문(§3)** — 규칙과 표만 남기고 근거는 링크로 넘긴다:

```text
> **예외 — 보안·정책 캐비엇** (2026-08-17 규약화 · 2026-08-22 요청 필드까지 확장):
> 아래 두 부류는 위 길이 제한의 예외다.
>
> | 부류 | 소비자가 그 설명 없이는 못 알아내는 것 |
> | --- | --- |
> | **응답** 값이 저장된 값과 다를 수 있는 필드 (egress 마스킹 대상 등) | *"왜 DB 와 값이 다른가"* |
> | **요청** 값이 정책으로 거부될 수 있는 필드 (예약어·재제출 금지 값 등) | *"왜 이 값을 보내면 400 인가"* |
>
> 다만 **상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크**로 적는다.
>
> 근거: [§Rationale — §3 보안·정책 캐비엇 예외](#…)
```

**`## Rationale`** — `### §3 …` 을 신설하고 네 문단을 담았다: 왜 예외인가(2026-08-17) ·
새 관행이 아니라 추인이었다(도입 시점 9곳 실측) · 왜 요청 필드까지 넓혔나(대칭 논거 +
`ReRunRequestDto.inputOverride` 계기) · 요청 쪽도 추인이다(73파일/333개 중 114개=34% 실측).
마지막에 *"넓히지 않은 것 — 기본 수치 규칙"* 을 blockquote 로 명시해 범위를 못 박았다.

> **초안과 달라진 점**: 초안은 *"기존 '추인' 문단은 그대로 두고 한 줄 덧붙인다"* 였다.
> `22_53_02` W1 을 반영하면서 **그 문단도 함께 Rationale 로 옮겼다** — 안 옮기면 §3 의 근거가
> 본문과 Rationale 두 곳으로 쪼개져, 고치려던 문제(근거가 본문에 인라인)를 절반만 고치는
> 꼴이 된다.

### 넓히지 **않는** 것 — 기본 수치 규칙

실측 34% 는 예외 클래스보다 넓다. 즉 `10~40자` 규칙 자체가 현실과 벌어져 있을 수 있다.
**그건 이 편집의 범위가 아니다** — 이번 항목은 *"예외가 응답만 덮는다"* 로 등재됐고, 기본
규칙 재검토는 별개 판단이다. 트래커에 별도 항목으로 등재한다.

## 작업

- [x] `/consistency-check --spec` — `22_53_02` **BLOCK: NO**. W1(Rationale 미러링)
      반영, INFO 2건(코드펜스·집계 기준) 반영
- [x] ① `13-replay-rerun.md` 2줄 정정 — `` `UNAUTHORIZED` `` spec 전역 **2 → 0**
- [x] ② `swagger.md §3` 예외 양방향 확장 + `## Rationale` `### §3` 신설
- [x] 트래커 2건 종결 + 기본 수치 규칙 재검토 신규 등재 (미체크 30 → **29**)
- [x] TEST WORKFLOW — lint / unit / build **PASS** (backend 8,904 · frontend **6,127** ·
      web-chat 451). **e2e 면제**: 변경 set 이 `spec/**`(2) · `plan/**`(2) · `review/**`(1)
      뿐이라 `PROJECT.md §e2e 면제 화이트리스트` 의 *"`spec/**` · `plan/**` · `review/**` ·
      `CLAUDE.md` · …"* 항목의 **부분집합**이다 — 영향 추정이 아니라 목록 판정

## 앵커 링크가 실제로 검증되는지 확인했다

본문 → `## Rationale` 링크를 새로 달았다. `check-doc-links.py` 가 GitHub-style slug 로 앵커를
검증한다고 **적혀 있지만**, 그게 내 링크를 실제로 보는지는 별개다 — 통과는 증거가 아니다.

앵커를 일부러 깨서 프로브했다: `BROKEN 2 → 3`, 늘어난 1건이 정확히
`swagger.md:270 ANCH '#3-존재하지-않는-앵커-프로브'` 였다. 체커가 이 링크를 실제로 검사한다.
원복 후 `cmp` 바이트 동일, BROKEN 은 선존 2건(내 것 아님)으로 복귀.
