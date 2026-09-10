---
title: 4-integration.md §9.1 — "두 derived 필드" 가 DTO 인벤토리보다 좁다
worktree: spec-integration-dto-pointer-4b7e21
started: 2026-09-10
owner: planner
status: in-progress
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

## 변경안 — `GET /:id` 행의 인벤토리 주장을 좁히고 포인터를 붙인다

`… (b) **`autoRefresh: boolean`** …` 서술 끝(현재 문장 종료 지점)에 이어 붙인다:

```markdown
**derived 는 위 둘뿐이고, `IntegrationDto` 는 그 밖에 엔티티 컬럼 투영도 싣는다** —
`mallId` · `tokenExpiresAt` · `lastRotatedAt` · `lastUsedAt` ·
`consecutiveNetworkFailures`. 그 컬럼들의 의미·전이 규칙·마이그레이션은
[데이터 모델 §2.10](../1-data-model.md#210-integration) 이 SoT 이며 여기 복제하지 않는다
(위 두 derived 필드는 DB 컬럼이 아니라 매 응답 시점 계산이라 이 절이 소유한다).
단 **`consecutiveNetworkFailures` 는 나머지 넷과 동급이 아니다** — health 판정의 내부
카운터이고 **프런트엔드 참조가 0곳**(2026-09-10 재측정)이라, 노출 중단이 별도 항목으로
추적 중이다(`plan/in-progress/spec-draft-nullable-notation-followups.md`). 새 소비자를
만들지 말 것.
```

### 왜 "derived 는 위 둘뿐이고" 를 앞세우나

원문의 *"다음 두 derived 필드를 포함한다"* 를 **지우지 않는다.** 그 문장은 참이고, 참인 문장을
지우면 왜 그 둘만 이 절이 소유하는지(계산 필드 vs 컬럼 투영)가 사라진다. 대신 그 뒤에 경계를
명시해 **인벤토리 주장으로 읽히는 것**을 막는다.

### 왜 §2.10 을 복제하지 않나

§2.10 이 5/5 를 이미 갖고 있고, 그중 `mall_id`·`consecutive_network_failures` 항목은 UNIQUE
인덱스·상태 전이 규칙·마이그레이션 번호까지 담는 긴 서술이다. §9.1 에 옮기면 **두 자리가
갈리는 drift 소스**가 생긴다 — 이 저장소가 반복해 기록한 형태다.

### 왜 §9.4 가 아닌가

§9.4(공통 응답 포맷)는 봉투(`{ data }`)와 **에러 코드 카탈로그** 소관이다. DTO 필드 인벤토리를
말하는 자리는 `GET /:id` 행이고, 좁은 주장이 실제로 그 행에 있다.

## 캐비엇을 §9.1 에 두는 것의 비용 — 알고 둔다

`consecutiveNetworkFailures` 가 실제로 제거되면 이 문장도 함께 지워야 한다. 그 비용을 감수하는
이유: 캐비엇이 없으면 **다음 FE 작업자가 이 목록을 보고 그 필드를 소비할 수 있고**, 그러면 제거가
파괴적 변경으로 승격되어 그 항목이 닫히지 못한다. 지금 한 문장이 그 경로를 막는다.
DTO JSDoc(167행 부근)이 같은 캐비엇을 이미 갖고 있으므로 **양쪽이 같은 말을 한다** — 제거 시
두 자리를 함께 지워야 한다는 사실도 그 항목에 적는다.

---

## 체크리스트

- [ ] `--spec` 게이트 BLOCK:NO 확인
- [ ] `§9.1` `GET /:id` 행에 경계 + 포인터 + 캐비엇
- [ ] 문서 가드(`vitest src/lib/docs/__tests__`) — `#210-integration` 앵커 실재
- [ ] 자매 트래커: 이 항목 플립 + `consecutiveNetworkFailures` 항목에 **"제거 시 §9.1 문장도
      함께 지운다"** 한 줄 보강
- [ ] `--impl-done` 발화 여부는 게이트에 물어 판정 (`codebase/**` 변경 0줄 예상)
