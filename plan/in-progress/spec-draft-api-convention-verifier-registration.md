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

---

## `--spec` 반영 (`review/consistency/2026/09/05/16_21_52` — BLOCK: NO · C0 · W3 · I5)

WARNING 3건 전부 반영한다. 셋 다 내 근거를 직접 겨냥했고, 각각 실측으로 확인했다.

### W1 — 검증자는 **두 spec 의 규칙**을 판정한다. 한쪽에만 등재하면 사각지대가 남는다

지적이 맞다. 검증자의 판정 규칙 5행 중 **마지막 행(undeclared-key)** 은 그 JSDoc 자신이
*"§5.4 아님 — 이 검증자의 확장"* 이라 적어 두었다. 그 행이 시행하는 것은 §5.4 가 아니라
`swagger.md §5-1` 이다 — 원문 실측:

> - 엔티티(`entities/*.entity.ts`) 를 그대로 노출하지 말고, API 응답 형태에 맞춰 별도 DTO 를
>   만듭니다. **비밀값(credentials, passwordHash 등)은 마스킹하거나 제외합니다.**

**감사 로그 유출(26키)을 실제로 잡은 축이 바로 그 행이다.** §5.4 축(required/nullable)은
그 유출을 통과시켰다. 그러니 `2-api-convention.md` 에만 등재하면 **이 draft 가 닫으려던
사각지대가 §5-1 축에 그대로 남는다.**

→ **변경안 수정**: `response-contract.ts` 를 **양쪽 `code:` 에 등재**하고, 각 문서에 그
문서가 소유하는 축을 적는다. 양쪽 등재는 선례가 있다(`error-response.dto.ts`).

### W3 — 12일 전 정반대 판정을 다루지 않았다

`spec-sync-external-interaction-api-gaps.md` 의 **2026-08-24 won't-do** (B4,
`conversation-thread.md` 에 `websocket.service.ts` 등재 반려). 원문 근거 둘:

1. *"`code:` 는 **surface 의 구현 경로**이지 **인용 추적성이 아니다**"* — `websocket.service.ts`
   는 conversation-thread surface 를 구현하지 않는데, 등재 사유가 §8.4 blockquote 의 코드
   인용이었다.
2. *"기존 `code:` **16항목이 전부 도메인 파일**이라 넣으면 `spec-code-paths.test.ts` 가드
   신호가 흐려진다"*

**첫 근거는 이 건에 해당하지 않는다.** 반려된 것은 **인용 추적용 도메인 파일**이고, 이 건은
**그 spec 의 규칙을 시행하는 코드**다. 축이 다르며, 시행 코드 등재는 40건의 선례가 있고
그중 **자매 검증자(`swagger-dto-contract*.ts`)가 이미 `swagger.md` 에 등재돼 있다.**

**두 번째 근거는 가드 동작으로는 성립하지 않는다 — 실측했다.**

```ts
// spec-code-paths.test.ts
it("at least one `code:` entry resolves to a real file", () => {
  expect(codes.some((c) => globMatchesAny(c, root))).toBe(true);
});
```

판정이 `.some()` 이라 **항목을 더해도 흐려질 수 없다.** 그 근거는 가드가 아니라 **사람이
읽는 신호**에 관한 것이었다 — 그리고 그 우려는 유효하다.

> **checker 의 수치 하나를 정정한다**: *"`2-api-convention.md` 의 현재 `code:` 16항목"* 은
> 틀렸다. 16 은 반려 사례인 `conversation-thread.md` 의 것이고, `2-api-convention.md` 는
> **9항목**이다 (실측).

→ **완화**: frontmatter `code:` 에 YAML 주석으로 **구현 / 시행(검증)** 두 묶음을 갈라 적는다.
사람이 읽는 신호를 유지하면서 게이트는 두 묶음을 다 문다.

### W2 — parent 체크박스 갱신 경로가 target 에 없었다

parent(`spec-draft-nullable-notation-followups.md`)의 ⑧ 항목은 *(a) 6개 전부 추가 /
(b) 현상 인정* 이분법으로 적혀 있는데, 이 draft 는 **제3의 처분**(부분 적용 + 잔여 추적)을
낸다. 그러면서 parent 를 어떻게 닫을지를 안 적었다 — **반증된 전제가 parent 문면에 그대로
남을 위험**이 있다.

→ **spec 반영과 같은 커밋에서** parent ⑧ 을 `[x]` 로 닫으며 (1) 원 전제 반증(4/6은 형태
차이), (2) 실제 처분(부분 적용), (3) `6-websocket-protocol.md` 잔여를 **별도 열린 항목으로
재등재**한다.

### INFO 반영

| # | 반영 |
|---|---|
| 1 | "검증 층" 문단은 **경계와 사각지대만** 적는다. 판정 규칙 표의 SoT 는 코드 JSDoc 에 남긴다 — 옮겨 적으면 drift 소스가 하나 는다 |
| 4 | `## Overview` 헤딩 형태 근거를 Rationale 에 한 줄 (§1 기술 요약이 아니라 제품 정의라 별도 헤딩) |
| 5 | `swagger-probe.ts` 등재가 §5.4 무관한 변경까지 재검토 트리거로 넓힌다는 사실을 "검증 층" 문단에 한 문장 |
| 2 | **harness 결함으로 별도 등재** — 아래 |
| 3 | 조치 불요 (인용부호 표기, 의미 왜곡 없음) |

### INFO#2 — `--spec` 번들이 `spec_impact` 의 conventions 파일을 떨궜다

`spec/conventions/swagger.md` 는 이 draft 의 `spec_impact` 에 있는데 **5개 프롬프트 어디에도
본문이 실리지 않았다** (그 문서에만 있는 헤딩 `### 5-1. 응답 DTO 위치` 로 판정: 5개 전부 0건.
대조군인 이 draft 의 헤딩은 1건이라 판정 명령 자체는 정상).

**나는 실행 전에 "적재됨" 이라고 판정했다가 틀렸다** — 문자열 `conventions/swagger.md` 의
**언급 횟수**를 셌는데 그것은 다른 문서의 링크 참조였다. 본문 적재를 물었어야 했다.

이번 라운드는 checker 들이 직접 조회로 보완해 유효하다(cross_spec 이 §5-1 원문을 정확히
인용). 그러나 **`spec_impact` 에 명시된 파일이 번들에서 빠지는 것은 구조적 결함**이므로
트래커에 등재한다.

---

## 반영 중 발견 — YAML 주석이 게이트 파서를 조용히 끊는다

W3 완화책으로 `code:` 블록 리스트에 **구현 / 시행(검증)** 을 가르는 YAML 주석을 넣었다.
넣고 나서 게이트에 물어보니 **spec-linked 0건** 이었다.

원인은 `review_guard._parse_frontmatter_code` 의 블록 리스트 루프다:

```python
while j < n:
    mm = re.match(r"^\s*-\s*(.+)$", fm[j])
    if not mm:
        break          # ← `  # 주석` 이 여기서 걸려 뒤 항목이 전부 사라진다
```

주석 **뒤의 모든 항목이 조용히 없어진다.** 실측: `2-api-convention.md` 가 9개(주석 앞까지),
`swagger.md` 가 5개만 반환됐다 — 정확히 종전 개수다.

**두 파서가 서로 다른 답을 낸다.** 프런트엔드 가드(`spec-frontmatter-parse.ts`)는
`matterNoCache`(gray-matter → 진짜 YAML)를 쓰므로 주석 뒤 항목을 **본다**. 즉 유효한 YAML 에
대해 `spec-code-paths.test.ts` 는 통과시키고 `--impl-done` 게이트는 못 보는 상태가 된다.

**이 자리가 특히 위험한 이유**: 이 항목이 고치려던 결함이 *"등재했는데 게이트가 못 본다"* 인데,
주석을 남겼으면 **등재했다고 적어 놓고 게이트는 여전히 못 보는** 상태로 머지될 뻔했다.
문서에 "등재 완료" 라고 쓰는 것만으로는 등재가 아니다.

→ **주석을 걷고** 구현/시행 구분은 §5.4 "검증 층" 산문이 담당한다. harness 결함은 별도 등재.

## 최종 등재 형태 — 게이트에 직접 물어 확인했다

`.spec.ts` 도 덮이도록 자매 선례(`swagger-dto-contract*.ts`)와 같은 글롭 형태를 썼다:

```yaml
- codebase/backend/src/shared/testing/response-contract*.ts
- codebase/backend/src/shared/testing/swagger-probe*.ts
```

`shared/testing/` **전 4파일 전수 확인**: `_spec_linked_changes()` 가 4/4 를 spec-linked 로
판정한다. 테스트를 약화시키는 편집도 재검토 트리거를 건드린다.
