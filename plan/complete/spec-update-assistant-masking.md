---
title: "spec 동기화 — assistant 마스킹 포맷을 `***` 로, EIA §R17 잔여③ 결정 완료로"
status: complete
worktree: assistant-mask-leak-e36aa6
started: 2026-08-23
completed: 2026-08-23
owner: project-planner
spec_impact:
  - spec/3-workflow-editor/4-ai-assistant.md
  - spec/5-system/14-external-interaction-api.md
  - spec/2-navigation/_product-overview.md
  - spec/conventions/egress-masking.md
---

# planner 턴 — assistant 마스킹 결정을 spec 에 되반영

자매 developer plan: [`assistant-mask-leak.md`](./assistant-mask-leak.md).
그쪽 `--impl-prep` 이 **BLOCK: YES** (`16_09_25`, CRITICAL 1) 를 냈고, 근본 원인이
`spec/` 쓰기라 planner 턴으로 분리했다.

## 왜 같은 PR 안인가 (별도 PR 로 안 쪼갠 이유)

처음엔 별도 planner PR 을 먼저 올리려 했다. **뒤집었다** — spec §4.1.1 이 출력 포맷을
**리터럴로** 못박기 때문에, spec 만 먼저 머지되면 *"spec 은 `***`, 코드는 `****1234`"* 라는
**실시간 spec-impl drift** 가 생긴다. 이 저장소는 그 드리프트를 `/spec-coverage` 로 감시하고
반복해서 비용을 치러 왔다.

그래서 **한 PR 안에서 planner 턴을 앞에 두고** 원자적으로 간다. 역할 분리는 게이트로
지킨다 — spec 쓰기 직전 `--spec`, 구현 후 `--impl-done`.

## 사용자 결정 (2026-08-23)

> **② workflow-assistant 마스킹 — 유출 차단이 우선**

EIA §R17 "잔여 ③" 이 *"어느 의미가 우선하는지는 **별도 결정**이라 분리했다"* 로 명시적으로
열어 둔 항목이다. 이 결정이 그것을 닫는다.

## 고칠 두 곳

### 1. `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 — 요구사항 `ED-AI-37` 정본

현행 서술이 **셋**을 못박는다:

| 못박은 것 | 현행 | 바뀔 것 |
| --- | --- | --- |
| 유틸 | `maskSensitiveFields` 단독 | + `deepRedactSecrets` 중첩 |
| 매칭 키 | 리터럴 9개 나열 | 값-패턴 층이 `token` 계열까지 덮음 |
| 포맷 | `"****<last4>"` / `"****"` | **`"***"`** |

**포맷만 바꾸고 끝내면 안 된다** — "왜 힌트를 버렸나" 가 남지 않으면 다음 사람이 되돌린다.
§Rationale 에 트레이드오프와 실측을 남긴다.

### 2. `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ③"

*"범위 밖 유지"* → **결정 완료**로 flip. 원문의 경고(*"단순 합성하면 안 된다"*)는 **지우지
않는다** — 그 경고는 당시 옳았고(실제로 테스트가 RED 였다), 무엇을 알고도 선택했는지가
기록으로 남아야 한다. 취소선 + 결정으로 덮는다.

## 작업

- [x] `/consistency-check --spec` — **BLOCK: NO** (`16_21_45`, CRITICAL 0 · WARNING 5)
- [x] §4.1.1 마스킹 규칙 + scoping/키축/잔여갭 3블록 + 같은 파일 `:1429` 결정 메모 표
- [x] EIA §R17 잔여③ flip(`~~잔여 ③~~ 해소` 포맷 통일) + 바로 위 캐비엇 취소선
- [x] `_product-overview.md` EH-NAV-04 구현 상태
- [x] `egress-masking.md` §1 표 2행 + `code:` 2건 + §3 에 '표가 낡는 조건' 실례 기록
- [x] 트래커 `17_12_34` W1 종결 + 자매 값 축 잔여를 별도 체크박스로 분리(미체크 27 유지)
- [x] (developer 턴 재개) TEST WORKFLOW 4단계 · `--impl-done`(`17_34_06` BLOCK:NO) ·
      `/ai-review` 3라운드(`16_46_56` → `17_14_18` → `17_53_08`) 전부 완료.
      게이트 전표는 자매 plan [`assistant-mask-leak.md`](./assistant-mask-leak.md) §최종 게이트.

## 검증

- `--spec` BLOCK:NO 여야 spec 에 쓴다.
- spec 이 서술하는 포맷과 코드가 내는 값이 **같은 PR 안에서** 일치할 것 —
  `explore-tools.service.spec.ts` 의 캐너리가 그 일치를 고정한다.

## `--spec` 이 범위를 넓혔다 (`16_21_45` — BLOCK: NO · CRITICAL 0 · WARNING 5)

WARNING 5건이 전부 같은 것을 말한다: **「고칠 두 곳」이 실제 파급을 못 덮는다.** 이 저장소에서
내가 반복해 온 *"방어를 한 칸 좁게 잡는다"* 이고, 이번엔 **편집 전에** 잡혔다. 실측으로 넷 다
확인했다:

| 파급 | 왜 stale 해지나 |
| --- | --- |
| `4-ai-assistant.md:1429` "확정된 결정 사항" 표 | **같은 파일 안**에서 §4.1.1 을 참조하는데 근거가 *"기존 유틸 재사용"* 이라 §4.1.1 이 바뀌면 자기모순 |
| EIA §R17:1647-1651 캐비엇 | *"이 확장은 잔여 ③ 에 미치지 않는다"* 가 잔여③ 을 닫는 순간 **전제가 무너진다** |
| `_product-overview.md:265` EH-NAV-04 | 구현 상태를 *"`maskSensitiveFields` 자동 마스킹"* 한 줄로만 적어 실제로 닫힌 경로를 과소 서술 |
| `egress-masking.md` §1 표 + `code:` | `deepRedactSecrets` 의 **신규 소비처**가 좌표계 표에 없다 |

### scoping 을 명시한다 — 전역 포맷 변경이 아니다

`maskSensitiveFields` 는 3개 소비처가 공유한다. §4.1.1 이 `***` 를 말하면 다른 독자가
**전역 포맷 변경**으로 오독할 수 있다(WARNING #2). 그래서 §4.1.1 에 *"이 포맷은
`explore-tools.service.ts` 의 로컬 합성 결과이고 `maskSensitiveFields` 자체의 포맷
(`****<last4>`)은 불변"* 을 못박는다.

### 트래커 W1 을 닫을 때 자매를 삼키지 않는다

WARNING #5 — 트래커 스스로 *"결합 항목을 한 체크박스로 닫으면 나머지가 조용히 사라진다"*
를 기록해 뒀다. W1 종결과 **동시에** `handler-output.adapter.ts` 의 값 축 잔여를 별도
체크박스로 등재한다.
