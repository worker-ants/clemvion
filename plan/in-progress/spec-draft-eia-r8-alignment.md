---
title: spec draft — EIA §R8 캐시 대상 서술 정합 + fail-open 잔여 위험 카탈로그 보강
worktree: eia-spec-r8-alignment-fff754
started: 2026-08-12
owner: project-planner
status: in-progress
priority: P3
spec_impact:
  - spec/data-flow/15-external-interaction.md
  - spec/5-system/14-external-interaction-api.md
---

## Overview

`spec/data-flow/15-external-interaction.md` 가 idempotency 캐시 대상을 **"2xx 캐시 / 4xx 제외"**
로 두 자리에서 요약하는데, SoT 인 `spec/5-system/14-external-interaction-api.md` §R8 은
**"`400 VALIDATION_ERROR` 만 제외, 2xx·`409`·`410` 은 캐시"** 다. 한 자리는 §R8 을 **인용하면서
정반대로** 요약한다.

`#1153` 의 `--impl-done` (`15_24_11`) rationale_continuity INFO 1 과 `#1152` 의 `13_07_33`
cross_spec WARNING 이 각각 지적했고, 둘 다 **`spec/` 쓰기가 developer 권한 밖**이라 planner
턴으로 인계됐다.

함께: 같은 문서 `## Rationale` 의 "Fail-open 정책의 일관 표기" 절이 잔여 위험 예시로
blacklist 만 들고 있어, `#1153` 이 코드 주석·CHANGELOG 에 적은 **idempotency 저하 위험**보다
정밀도가 낮다.

## 왜 지금 하나 — 다음 구현 작업의 선행 조건이다

`plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 **"구현의 `statusCode >= 400`
이 409·410 까지 떨궈 §R8 위반"** 이 미해결로 남아 있다. 그걸 고치려면 spec 이 먼저 정확해야
한다 — 지금은 data-flow 문서가 구현과 같은 말(4xx 전체 제외)을 하고 있어서, 문서만 보고
착수하면 **구현이 맞다고 결론 내린다.**

그 항목에 이미 적어 둔 함정도 여기서 닫는다: 리뷰어가 제안했던 `statusCode === 400` 은
**§R8 이 400 중에서도 `VALIDATION_ERROR` 를 지목하고 5xx 는 언급조차 하지 않기 때문에**
그대로 쓰면 400 의 다른 에러 코드와 5xx 를 캐시하게 된다.

## 변경 1 — `data-flow/15` §1.2 시퀀스 (현 L98)

```diff
-  Svc->>Q: 2xx 응답을 interaction:idempotency:<key> 에 24h 캐시 (4xx 캐시 제외)
+  Svc->>Q: 2xx·409·410 응답을 interaction:idempotency:<key> 에 24h 캐시 (400 VALIDATION_ERROR 제외)
```

## 변경 2 — `data-flow/15` §2.2 Redis / BullMQ 표 (현 L258)

> **라벨 정정** (`15_49_19` plan_coherence INFO 3): 처음에 "§외부 의존 표" 라고 적었는데
> **오기**다. L258 의 소속은 `### 2.2 Redis / BullMQ`(L253~)이고, `## 4. 외부 의존`(L302)은
> idempotency 행이 없는 **별개 표**다. diff 본문·라인 번호는 정확했고 헤더 라벨만 틀렸다.

```diff
-| Redis | `interaction:idempotency:<key>` | 2xx 응답 캐시 (`{bodyHash, responseJson, statusCode}`) | 24h. 같은 키+다른 body → 409. 4xx (`VALIDATION_ERROR` 등) 캐시 제외 ([Spec EIA §R8]) |
+| Redis | `interaction:idempotency:<key>` | 2xx·409·410 응답 캐시 (`{bodyHash, responseJson, statusCode}`) | 24h. 같은 키+다른 body → 409. **`400 VALIDATION_ERROR` 만** 캐시 제외 ([Spec EIA §R8]). ⚠️ 현행 구현은 `statusCode >= 400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭) |
```

> **이 표에만 구현 갭을 적는 이유**: 본 문서 `## Rationale` 이 "본 문서는 각 표에 해당 정책을
> 명시해 **운영자가 저하 모드의 잔여 위험을 추적**할 수 있게 했다" 고 스스로 밝힌 표다.
> 규범 서술(`5-system/14`)이 아니라 **운영 관점 카탈로그**라 현행 갭을 적는 자리로 맞다.
> plan 링크는 걸지 않는다 — `spec/**` → `plan/in-progress/**` 링크는 그 plan 이 `complete/`
> 로 이동할 때 `spec-link-integrity` 를 깨뜨린다(기존 교훈).

## 변경 3 — `data-flow/15` `## Rationale` "Fail-open 정책의 일관 표기"

```diff
-저하 모드의 잔여 위험 (blacklist 미적용 = exp 까지 토큰 유효 등) 을 추적할 수 있게 했다.
+저하 모드의 잔여 위험 (blacklist 미적용 = exp 까지 토큰 유효, **idempotency 저하 = 같은
+`Idempotency-Key` 재요청이 전부 캐시 미스로 판정돼 다운스트림 중복 실행 가능**) 을 추적할
+수 있게 했다. 후자는 Redis 장애가 **지속되는 동안** 창이 장애 구간 전체로 넓어지므로,
+`EIA-RL-02` 의 "동일 응답 24h 재현" 은 **정상 경로의 계약**이고 저하 구간에서는
+best-effort 임을 함께 읽어야 한다.
```

## 변경 4 — `5-system/14` §R8 에 5xx 명확화

> **표기 정정** (`15_49_19` convention_compliance INFO 2): 처음엔 삽입할 문장을 `>` 인용으로
> 적었는데, R8 을 포함한 Rationale 항목(R1~R15)은 전부 **평문 단락**이라 blockquote 마크업을
> 넣으라는 지시로 읽힐 수 있었다. 변경 1~3 과 같은 `diff` 블록으로 통일한다 —
> **아래 `+` 줄이 그대로 들어갈 평문이다.**

`§R8` **채택** 문단 끝에 이어붙임:

```diff
-... 그 외 (성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다.
+... 그 외 (성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다. `5xx` 는 캐시하지 않는다 — 일시적 서버 오류를 24h 고정하면 클라이언트가 같은 키로 재시도해도 계속 같은 실패를 돌려받아 `EIA-RL-02` 의 취지(정상 응답의 재현)와 정반대가 된다.
```

**근거** 문단 뒤에 단락 하나 추가:

```diff
+**캐시 대상은 닫힌 목록이다**: 위에 열거한 `2xx` · `409` · `410` 이 전부다. `400` 중 `VALIDATION_ERROR` 외의 코드와 `5xx` 는 "재시도가 의미 있는 실패" 라 캐시하면 재시도 자체를 막는다. 구현이 이 목록을 조건으로 옮길 때 **단일 비교로 축약하면 안 된다** — 예컨대 `statusCode === 400` 은 400 의 다른 에러 코드와 5xx 를 캐시 대상으로 만들고, `statusCode >= 400` 은 반대로 `409`·`410` 을 떨궈 `EIA-RL-02` 를 그 범위에서 깨뜨린다. 열거를 그대로 조건에 옮겨야 한다.
```

## 비목표

- **구현 수정 안 함** — `statusCode >= 400` 을 좁히는 것은 developer 턴이다. 본 draft 는 그
  작업의 근거를 정확하게 만드는 데까지다.
- `5-system/14` §3.4 `EIA-RL-02` **행 자체는 건드리지 않는다** — 그 행은 요구사항 한 줄
  요약이고, 저하 구간 단서는 §R8 과 data-flow Rationale 이 담는 편이 문서 성격에 맞다.

## 체크리스트

- [x] `consistency-check --spec` (본 draft) — **BLOCK: NO** (`15_49_19`, checker 5명 전원 성공,
      Critical 0 · WARNING 0). INFO 3건은 전부 반영: 라벨 오기 정정(변경 2 제목) · `>` 표기를
      diff 블록으로 통일(변경 4) · data-flow 표 셀에 "닫힌 목록" 명시 추가
      > **기본 예산으로는 검토가 무의미했을 뻔했다** — 첫 세션(`15_48_23`)의 `cross_spec`
      > 프롬프트는 12KB 였고 "예산 초과로 생략된 파일 113개" 목록의 **맨 앞 두 개가 정확히
      > 대조 대상**(`5-system/14`, `data-flow/15`)이었다. `CONSISTENCY_MAX_CONTEXT_SIZE=600000`
      > 으로 재생성해 둘 다 싣고(생략 109개) 실행했다. 기존 교훈("`related_specs` 는
      > `5-system/` 에 도달 못 함")이 그대로 재현된 것이다.
- [x] 변경 1·2·3 — `spec/data-flow/15-external-interaction.md`
- [x] 변경 4 — `spec/5-system/14-external-interaction-api.md`
- [x] `backend-lint-gate-broken-on-main.md` 의 planner 인계 2건 체크 + 후속 구현 항목에
      "spec 이 정확해졌으므로 착수 가능" 표시
- [x] **사후 기록 — developer 턴이 §2.2 의 갭 caveat 을 지웠다** (`18_27_29` plan_coherence
      WARNING). 이 draft 는 §2.2 표에 "⚠️ 현행 구현은 `statusCode >= 400` 전체를 제외한다
      (선재 갭)" 를 **넣는** 것까지였는데, 그 갭을 실제로 해소한 developer 턴
      (`eia-r8-cache-scope`)이 **코드 수정과 같은 커밋에서 그 문장을 제거**했다.
      > `spec/` 쓰기는 원칙적으로 planner 권한이지만, 그 문장은 "현행 구현이 이렇다" 는
      > **서술**이라 구현이 바뀌는 커밋과 원자적으로 지워지지 않으면 그 사이에 spec 이
      > 거짓이 된다. 제품 결정 변경이 아니라 기계적 동기화로 판단했고, checker 도
      > "내용 자체는 §R8 SoT 와 정합 · 이번 PR 을 막을 필요 없음" 으로 확인했다.
      > planner 사후 확인으로 여기 남긴다.
