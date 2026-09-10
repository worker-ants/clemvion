---
title: 4-integration.md §9.1 — "두 derived 필드" 가 DTO 인벤토리보다 좁다
worktree: spec-integration-dto-pointer-4b7e21
started: 2026-09-10
owner: planner
status: complete
priority: P3
spec_impact:
  - spec/2-navigation/4-integration.md
---

# `4-integration.md §9.1` — `IntegrationDto` 확장 필드 포인터 (planner 턴)

`spec-draft-nullable-notation-followups.md` 의 단일 항목(2026-09-05 등재,
`19_08_19` W3 / `19_59_16` W3). **차단 전제가 풀렸다.**

## 착수 전 재판정 (2026-09-10)

등재 당시 사유는 *"대상 5필드 선언이 아직 `origin/main` 에 없다
(`claude/sweep-response-contract-5ba0ad`) — **그 브랜치 머지 후**"* 였다.

| 잰 것 | 값 |
|---|---|
| `origin/main` | `5873b9678` (#1302) |
| 5필드가 `integration-response.dto.ts` 에 선언돼 있나 | **예** — 145~167행 |
| 그 5필드가 `1-data-model.md §2.10` 에 있나 | **예** — 5/5 (포인터 대상이 참이다) |
| `consecutiveNetworkFailures` 의 FE 참조 | **0곳** (재측정 — 캐비엇 여전히 유효) |
| `integration-response.dto.ts` 의 spec-linked 여부 | ✓ (게이트 질의 — C-4 류 갭 없음) |

**5필드의 정체**: `mallId` · `tokenExpiresAt` · `lastRotatedAt` · `lastUsedAt` ·
`consecutiveNetworkFailures` (DTO 145~167행의 연속 블록). 항목이 *"나머지 4개"* 라 부른 것은
앞 넷이다.

## 결함의 형태 — 항목이 적은 것보다 한 겹 더 안쪽이다

항목은 *"§9.1 에 §2.10 포인터 한 줄을 넣는다"* 로 처방을 적었다. 그 처방은 맞지만, **왜
필요한가**는 "5필드가 문서화 안 됐다" 가 아니다. §9.1 의 `GET /api/integrations/:id` 행이
이렇게 적는다:

> `IntegrationDto` 는 **다음 두 derived 필드를 포함한다** — (a) `appUrl` … (b) `autoRefresh` …

**그 문장은 인벤토리 주장으로 읽힌다.** 실제 DTO 는 그 둘 외에 엔티티 컬럼 투영을 여럿 싣는다.
문자적으로는 *"derived 필드가 둘"* 이 참이다(나머지는 derived 가 아니라 컬럼 투영이니) — 그래서
`spec-links` 도 어떤 가드도 이것을 못 잡는다. 그러나 그 행을 읽는 소비자에게는 **응답 형태의
전수 목록**으로 보인다.

**문서화 밀도가 실제로 고르지 않다** (`4-integration.md` 전체 grep):

| 필드 | 언급 수 |
|---|---|
| `tokenExpiresAt` | 11 |
| `lastRotatedAt` | 5 |
| `mallId` | 1 |
| `lastUsedAt` | **0** |
| `consecutiveNetworkFailures` | **0** |

즉 셋은 다른 맥락(§10.4 에러 매핑 등)에서 이미 다뤄지고 둘은 문서 어디에도 없다. **필드별
산문을 §9.1 에 늘어놓는 것은 답이 아니다** — §2.10 이 이미 5/5 를 갖고 있어 중복 SoT 가 하나
늘 뿐이다. 포인터가 맞다.

## 변경안 (`--spec` 3지적 반영본)

`--spec` (`review/consistency/2026/09/10/10_47_01`) 이 **BLOCK: NO** 로 통과했으나 WARNING 3건 +
INFO 1건이 나왔고 **넷 다 이 변경안을 고쳐야 하는 것**이었다. 초안을 아래로 갈았다.

### W1 — 초안이 소유권을 잘못 배정했다 (cross_spec)

초안은 *"의미·**전이 규칙**·마이그레이션은 §2.10 이 SoT"* 라고 적었다. **틀렸다.** 직접 확인:

> `§2.10` 의 `consecutive_network_failures` 행: *"… 3 도달 시 `status='error'` 로 전이 …
> **spec §6 `connected → error(network)` 전이의 구현 기반**"*

즉 §2.10 은 **컬럼**을 기술하고 **전이는 §6 이 소유**하며, §2.10 자신이 그쪽을 되짚는다.
`tokenExpiresAt`(만료 스캐너 판정)·`lastRotatedAt`(background-refresh 임계)도 같다 —
`4-integration.md` 자신의 §6(690행)·§11.1(957행)이 SoT 다.

**내가 막으려던 결함(좁은 인벤토리 주장)을 고치면서 반대 방향의 같은 결함(넓은 SoT 주장)을
만들 뻔했다.** 범위를 **의미·마이그레이션**으로 좁히고 전이 축은 §6·§11.1 로 명시한다.

### W3 — 대상 행은 **2,052자 단일 물리 라인**이다 (convention_compliance)

실측: `4-integration.md:795` = **2,052자**. GFM 표는 리터럴 개행을 허용하지 않으므로
초안 코드펜스의 word-wrap 을 그대로 붙이면 **표 파싱이 깨진다.** 삽입은 그 행 끝에
**개행 없이 이어붙인다.**

### W2 — "왜" 가 plan 에만 남으면 봉인된다 (rationale_continuity)

경계를 명시한 근거(derived vs 컬럼 투영 / §2.10 비복제 / §9.4 아닌 이유 / 캐비엇 비용)가 이
draft 에만 있으면 `plan/complete/` 이동과 함께 봉인된다. `4-integration.md ## Rationale`
(1129행, 기존 관례 다수)에 짧은 항목으로 옮긴다.

### INFO#1 — 인접 서술은 트래커를 직접 링크한다 (plan_coherence)

같은 행의 `[cafe24 백로그 C-6](../../plan/in-progress/cafe24-backlog-residual.md)` 선례에 맞춰
캐비엇도 트래커를 하이퍼링크한다.

### 적용할 것 둘

**(1) §9.1 `GET /:id` 행 끝에 이어붙일 문장** — 개행 없이 한 줄:

> **derived 는 위 둘뿐이고, `IntegrationDto` 는 그 밖에 엔티티 컬럼 투영도 싣는다** —
> `mallId` · `tokenExpiresAt` · `lastRotatedAt` · `lastUsedAt` · `consecutiveNetworkFailures`.
> 그 컬럼들의 **의미·마이그레이션**은 §2.10 이 SoT 다(여기 복제하지 않는다). 단 **전이 규칙은
> §2.10 이 아니다** — 그 컬럼들이 관여하는 상태 전이는 §6, 스캐너 판정은 §11.1 이 SoT 이고
> §2.10 자신도 그쪽을 되짚는다. 위 두 derived 필드는 DB 컬럼이 아니라 매 응답 시점 계산이라
> 이 절이 소유한다. **`consecutiveNetworkFailures` 는 나머지 넷과 동급이 아니다** — 내부 health
> 카운터이고 FE 참조 0곳이라 노출 중단이 별도 트래커 항목으로 추적 중이다. 근거는 Rationale.

**(2) `## Rationale` 신규 항목** — `### §9.1 의 `IntegrationDto` 인벤토리 주장 경계 (2026-09-10)`.
위 W1~W3·INFO 의 판단을 요약하고, 캐비엇 유지 비용과 **제거 시 두 자리(여기 + DTO JSDoc)를 함께
지워야 한다**는 사실을 적는다.

## 캐비엇을 §9.1 에 두는 것의 비용 — 알고 둔다

`consecutiveNetworkFailures` 가 실제로 제거되면 이 문장도 함께 지워야 한다. 그 비용을 감수하는
이유: 캐비엇이 없으면 **다음 FE 작업자가 이 목록을 보고 그 필드를 소비할 수 있고**, 그러면 제거가
파괴적 변경으로 승격되어 그 항목이 닫히지 못한다. 지금 한 문장이 그 경로를 막는다.
DTO JSDoc(167행 부근)이 같은 캐비엇을 이미 갖고 있으므로 **양쪽이 같은 말을 한다** — 제거 시
두 자리를 함께 지워야 한다는 사실도 그 항목에 적는다.

---

## 체크리스트

- [x] `--spec` 게이트 BLOCK:NO 확인 (`review/consistency/2026/09/10/10_47_01` — Critical 0,
      WARNING 3 + INFO 1). **넷 다 변경안을 고치는 지적이라 초안을 갈았다** (위 §변경안).
- [x] `§9.1` `GET /:id` 행에 경계 + 포인터 + 캐비엇 — 표 셀 종료 ` |` **앞에** 삽입해
      단일 물리 라인을 유지했다. 실측: **1,538 → 2,276 문자**, `\n` 없음, `|` 로 종료.
      > **`--spec` 이 인용한 "2,052자" 는 문자수가 아니라 바이트수였다** — macOS `awk` 의
      > `length()` 가 바이트를 센다. 그 행의 멀티바이트 문자가 510자라
      > `1538 + 2×257 = 2052` 로 정확히 맞는다. 내가 잠깐 **다른 행에 붙였나** 의심했는데,
      > 행 번호(795)·시작 문구·종료 문자를 다시 재어 같은 행임을 확인했다.
      > 단위가 다른 두 측정을 대조할 때는 단위부터 맞춰야 한다.
- [x] SoT 범위를 **의미·마이그레이션**으로 좁히고 전이 축은 §6·§11.1 로 명시 (W1) —
      §2.10 자신의 *"spec §6 전이의 구현 기반"* 문구를 인용해 되짚는 방향까지 적었다
- [x] `## Rationale` 신규 항목 `### §9.1 의 \`IntegrationDto\` 인벤토리 주장 경계 (2026-09-10)`
      — 경계를 둔 이유 · §2.10 비복제 이유 · §9.4 아닌 이유 · **초안이 SoT 를 넓게 주장했던
      것과 그 반증** · 캐비엇 유지 비용(제거 시 지울 자리 셋)
- [x] 캐비엇에 트래커 하이퍼링크 (INFO#1) — 같은 행의 `[cafe24 백로그 C-6](…)` 선례에 맞춤
- [x] 문서 가드 `npx vitest run src/lib/docs/__tests__` → **21 files / 3,203 tests GREEN**
      (신규 앵커 3개 `#210-integration`·`#6-상태-전이`·`#111-스캐너-잡` 전부 착지)
- [x] 자매 트래커: 이 항목 플립 + `consecutiveNetworkFailures` 항목에 **지울 자리 셋**
      (DTO JSDoc · §9.1 행 · Rationale 항목) 표로 보강 → **22 → 21 open**.
      **"두 자리" 가 아니라 셋이었다** — Rationale 항목을 W2 로 새로 만들면서 하나 늘었다
- [x] `--impl-done` — **대상 아님.** 게이트에 직접 물었다:
      `blocked=False`, reason=`"no codebase/ changes on this branch — allowed"`.
      이 브랜치의 `codebase/**` diff 는 **0줄**이다(spec·plan 만).
