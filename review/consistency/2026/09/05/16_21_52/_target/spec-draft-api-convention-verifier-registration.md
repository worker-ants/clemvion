---
title: §5.4 검증자 2종을 spec 에 등재하고 역할 경계를 명문화한다
worktree: spec-api-convention-code-and-overview-d81cd6
started: 2026-09-05
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/5-system/2-api-convention.md
  - spec/conventions/swagger.md
---

# §5.4 검증자 등재 + 역할 경계 (planner 턴)

`spec-draft-nullable-notation-followups.md` 의 planner 항목 ③④ 집행. 부수로 ⑧(`## Overview`
유무 불일치)을 실측해 처분한다.

## ① 왜 등재해야 하나 — 게이트가 §5.4 시행 코드를 못 본다

[#1288](https://github.com/worker-ants/clemvion/pull/1288) 이 `response-contract.ts` 를
세웠다. §5.4(부재 표현)를 **실제로 시행하는 유일한 코드**인데, 어떤 spec 의 frontmatter
`code:` glob 에도 걸리지 않는다 (실측: `review_guard._spec_linked_changes()` 가 그 파일을
spec-linked 로 세지 않는다).

결과: 그 파일이 **완화 방향으로 바뀌어도** `--impl-done` SPEC-CONSISTENCY 게이트가
`2-api-convention.md` 를 재검토 대상으로 잡지 않는다. 검증자를 무력화하는 편집이 조용히
통과할 수 있다는 뜻이다.

### `code:` 정의에 맞나 — 맞는다, 선례가 40건이다

`spec-impl-evidence.md` §2.1 은 `code:` 를 *"본 spec 이 약속한 surface 의 구현 경로"* 로
정의한다. 검증자는 구현이 아니라 시행이므로 확인이 필요했다. **실측 결과 가드·테스트를
`code:` 에 등재하는 것은 이미 저장소의 관행이다 — 40건.**

결정적인 것은 **자매 검증자가 이미 등재돼 있다**는 사실이다:

```
spec/conventions/swagger.md
  code:
    - codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts
```

즉 이것은 **재해석이 아니라 기존 관행의 적용**이다. `review-citations.md` 가 만든 예외
(*"시행 코드가 없는 순수 문서형 convention 은 준수 예시를 적는다"*)와도 다른 축이다 — 저쪽은
시행 코드가 **없어서** 예시를 적은 경우고, 여기는 시행 코드가 **있는** 경우다.

## ② 왜 역할 경계를 적어야 하나 — 이름이 인접한 검증자가 둘이다

`review/consistency/2026/09/05/15_53_59` W1 지적. 실측 확인:

| 파일 | 무엇을 대조하나 | 언제 | 타입 |
|---|---|---|---|
| `repo-guards/__tests__/swagger-dto-contract-guard.ts` | **선언 vs 선언** — `@ApiProperty` 데코레이터 ↔ TS 타입 | 정적 (AST) | `ContractMismatch` |
| `shared/testing/response-contract.ts` | **값 vs 선언** — 실 HTTP 응답 ↔ 생성된 OpenAPI 스키마 | 런타임 (e2e) | `ContractViolation` |

`"Contract"` 로 검색하면 어느 쪽인지 즉시 안 갈린다.

**리네임은 하지 않는다.** checker 자신이 *"리네임은 4개 e2e 배선을 건드리므로 강제하지
않음"* 이라 적었고, 4개 e2e 배선 + 37개 스펙을 건드려 얻는 것보다 잃는 것이 크다. 대신 **두
spec 문서 각각에 한 문장**으로 경계를 적어, 어느 쪽을 열어도 다른 쪽의 존재를 알게 한다.

## ③ 변경안

### `spec/5-system/2-api-convention.md`

1. frontmatter `code:` 에 두 줄 추가:
   ```yaml
   - codebase/backend/src/shared/testing/response-contract.ts
   - codebase/backend/src/shared/testing/swagger-probe.ts
   ```
   `swagger-probe.ts` 는 `response-contract.ts` 가 스키마를 얻는 SoT 다 — 그것이 바뀌면
   §5.4 판정 근거가 통째로 바뀌므로 함께 등재한다.

2. §5.4 끝에 **검증 층** 문단 신설 — 두 검증자의 경계와 각자 못 보는 것.

3. `## Overview (제품 정의)` 신설 — 아래 ④ 참조.

### `spec/conventions/swagger.md`

`code:` 에 `swagger-probe.ts` 추가 + 정적/런타임 경계 한 문장. 이 문서가 정적 가드를
소유하므로, 런타임 짝의 존재를 여기서도 가리킨다.

## ④ 부수 — `## Overview` 유무 불일치(항목 ⑧)의 전제가 틀렸다

`--impl-prep 12_48_13` W1 과 `review/consistency/2026/09/05/15_53_59` INFO#2 가
*"`spec/5-system/*.md` 중 6개에 `## Overview` 없음 — 비대칭 결여"* 라 지적했다.
**전수로 재니 내용 결여는 사실상 없다 — 제목 표기가 세 형태로 갈릴 뿐이다.**

| 문서 | 개요 내용 | 형태 |
|---|---|---|
| `5-expression-language.md` · `7-llm-client.md` · `11-mcp-client.md` | **있음** | `## 1. 개요` |
| `16-system-status-api.md` | **있음** | 무제목 도입문 |
| `6-websocket-protocol.md` | 없음 | — |
| `2-api-convention.md` | 없음 | — |

**저장소 전체로 보면 개별 파일의 `## Overview` 는 규범이 아니다** (실측):

| 영역 | Overview 보유 | `_product-overview.md` |
|---|---|---|
| `2-navigation/` | 1/18 | 있음 |
| `3-workflow-editor/` | 0/7 | 있음 |
| `4-nodes/` | 0/2 | 있음 |
| `5-system/` | 11/18 | 있음 |
| `7-channel-web-chat/` | 6/7 | 있음 |
| `data-flow/` | **16/16** | **없음** |

`_product-overview.md` 가 있는 영역은 개별 파일에 Overview 를 두지 않고, **없는 영역
(`data-flow/`)만 전 파일에 둔다.** 이것은 `project-planner/SKILL.md` 가 이미 적어 둔 규칙
그대로다 — *"다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"*. 그리고 같은
문서가 3섹션을 **"권장"** 이라 부른다.

**처분**: 6개 문서에 Overview 를 일괄 추가하지 않는다 — 규칙 카탈로그형 문서에 제목만
얹고 아래에 새 내용이 없으면 소음이다. 다만 **이번 턴이 여는 `2-api-convention.md` 에는
추가한다** (도입 산문이 실제로 없는 두 문서 중 하나이고, 어차피 편집 대상이다).
`6-websocket-protocol.md` 는 잔여로 트래커에 남긴다.

## Rationale

### 기각한 대안 — `spec/conventions/swagger.md` 에만 등재

`response-contract.ts` 가 OpenAPI 스키마를 다루므로 swagger 규약 쪽이 자연스러워 보인다.
그러나 이 검증자가 **판정하는 규칙**은 §5.4(부재 표현)이고 그 규칙의 소유자는
`2-api-convention.md` 다. `code:` 는 "이 spec 이 약속한 것의 코드" 이므로 규칙 소유자를
따른다. swagger 쪽에는 스키마 생성 도구(`swagger-probe.ts`)와 경계 문장만 둔다.

### 기각한 대안 — 리네임으로 혼동을 없앤다

`ContractViolation` → `ResponseContractViolation` 류. 4개 e2e 배선과 37개 스펙 단언이
따라 움직여야 하고, 그 편집이 두 게이트를 재무장시켜 라운드를 하나 더 태운다. 혼동의 비용은
"검색 결과를 한 번 더 본다" 이고, 문장 하나로 해소된다.

### `## Overview` 를 6개에 일괄 추가하지 않는 이유

*"규약에 있으니 맞춘다"* 는 근거를 쓰려면 규약이 그것을 요구해야 하는데, SKILL.md 는
**권장**이라 적고 다중 파일 영역의 제품 정의를 `_product-overview.md` 로 보낸다. 저장소
실태도 그 규칙과 일치한다(위 표). 지적의 전제는 `5-system/` **한 영역만** 본 데서 나왔다 —
그 안에서는 11/18 이 보유라 6개가 예외로 보이지만, 저장소 전체로는 반대다.
