---
title: 마스킹 마커 계약을 공유 패키지로 추출한다
status: in-progress
worktree: masked-marker-contract-7d2e14
started: 2026-08-21
owner: developer
spec_impact:
  - spec/5-system/14-external-interaction-api.md
---

# 마스킹 마커 계약을 공유 패키지로 추출한다

PR #1189 의 이월 항목 중 하나 — *"프런트/백엔드 `MASKED_MARKERS` 크로스런타임 동기화 테스트
부재"*. 착수 조사에서 **계약 테스트보다 추출이 옳다**는 결론이 나왔다.

## 다른 plan 과의 관계

정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
이고, **같은 결함이 거기 두 번 등재돼 있다**(실측):

| 위치 | 등재 | 내용 |
| --- | --- | --- |
| `:373` | 2026-08-17, `12_33_36` | *"마커 미러 계약 테스트 — backend SoT ↔ frontend 미러를 기계가 대조하게 한다"* |
| `:757` | 2026-08-21, PR #1189 이월 | *"마커 리터럴 cross-stack 계약 테스트 부재"* |

**`:373` 이 이 작업을 전제조건으로 이미 지목해 뒀다** — *"공유 패키지 추출이 선행돼야 값싸다
— 그래서 별건으로 남긴다"*. 즉 이 PR 은 새 발상이 아니라 그때 미룬 선행 작업의 집행이다.

**둘 다** 구현 커밋과 같은 턴에 `[x]` 처리하고 대체 근거를 적는다(선례:
`ws-event-types-extract.md`). 항목을 지우지 않고 대체 사유를 남기는 이유 — 왜 계약 테스트가
아닌지가 다음 사람에게 필요한 정보다.

> consistency `05_23_14` 등재분은 **wrapper 함수명** 항목이고 미러와 별건이라 여기서 닫지
> 않는다(혼동 주의 — 처음에 "wrapper/미러" 로 뭉뚱그려 적었다가 정정).

## 왜 계약 테스트가 아닌가 — CI 경로 게이팅

가드를 한쪽에만 두면 **반대쪽 변경 때 아예 실행되지 않는다.** 실측:

| 워크플로 | relevant pathspec 에 상대 스택이 있나 |
| --- | --- |
| `frontend-checks.yml` | `codebase/backend/**` **없음** → backend 가 마커를 바꿔도 skip |
| `backend-checks.yml` | `codebase/frontend/**` **없음** → frontend 가 바꿔도 skip |

두 워크플로 모두 `relevant == 'false'` 면 **검사를 생략하고 체크는 통과로 보고**한다. 즉
frontend 에 둔 마커 계약 가드는 *backend 가 마커를 바꾸는 방향* 에 무력하다 — 양쪽에 중복해야
겨우 동작하고, 그건 미러를 감시하려 가드를 미러링하는 꼴이다.

**양쪽 모두 `codebase/packages/**` 는 relevant 로 잡는다.** 공유 패키지에 두면 경로 갭이 없다.

## 선례가 정확히 같은 형태다

`@workflow/ai-end-reason` — *"Single source of truth for the AI node `output.result.endReason`
value domain … shared between the backend handlers that produce it and the frontend
conversation UI that gates on it."* backend 가 만들고 frontend 가 판정하는 값 도메인, 지금
문제와 동일하다. src 2파일짜리라 규모 기준도 이미 이 수준이다.

`git log -S "MASKED_MARKERS"` 상 추출이 기각된 이력은 없다 — 미러는 결정이 아니라 소비처가
늘면서 점진적으로 생겼다.

## 무엇을 옮기나

| 심볼 | 현재 위치(2벌) |
| --- | --- |
| `VALUE_MASK_MARKER` `'***'` · `KEY_MASK_MARKER` `'[REDACTED]'` · `DEPTH_MASK_MARKER` `'[REDACTED_DEPTH]'` | backend `sanitize-error-message.ts` / frontend `masked-markers.ts` |
| `MASKED_MARKERS` · `isMaskedMarker` (정확 일치) | 〃 |
| 깊이 상한 `10` | backend `MAX_REDACT_DEPTH` / frontend `MAX_MARKER_SCAN_DEPTH` |

깊이 상한이 리터럴보다 위험한 미러다 — 값 마스커가 상한 지점에서 서브트리를 **치환**하므로
스캐너가 그 깊이에 못 닿으면 마커를 놓친다.

### canonical 이름은 `MAX_MASK_DEPTH`

패키지는 중립 이름 하나만 export 한다. 지금 두 이름(`MAX_REDACT_DEPTH` 마스커 관점 /
`MAX_MARKER_SCAN_DEPTH` 스캐너 관점)은 **같은 수를 다른 역할에서 부른 것**이라, 어느 한쪽을
정본으로 고르면 반대편에서 오독된다. backend 는 기존 소비처를 위해
`MAX_REDACT_DEPTH` 별칭을 재export 하고 JSDoc 한 줄로 관계를 명시한다.

### `MAX_SANITIZE_DEPTH`(websocket)는 **건드리지 않는다** — 실측 근거

세 번째 `10` 이 `websocket.service.ts` 에 있지만 **다른 불변식**이다.

```
deepRedactSecrets   : depth >= 10 → 치환.  실측 = 마커가 놓이는 최대 깊이 **10**
frontend scanner    : 값 검사 먼저 → depth >= 10 에서 하강 중단. 검사 범위 **0..10**  ← 맞물림
sanitizePayloadForWs: depth >  10 → 치환.  마커가 놓이는 깊이 **11**
```

WS 쪽만 한 칸 깊다. 그런데 프런트 스캐너의 소비처를 전수로 보면 **REST `inputData`(deepRedact
경로)와 사용자 입력 JSON 뿐**이고 WS 페이로드는 스캔하지 않는다 — 살아있는 갭이 아니다.

> 억지로 합치면 이 시리즈가 배운 *"공유 프리미티브를 넓히면 무관한 경로가 오염된다"* 를 그대로
> 반복한다. WS 는 자기 마스커의 자기 상한이다. 관계만 주석으로 명시하고 상수는 분리 유지한다.

## 등록 표면 (실측 8곳) — **자동 검증은 2곳뿐이다**

`ai-end-reason` 전수 grep 으로 뽑았다. 처음엔 *"하나라도 빠지면 가드가 잡는다"* 고 적었는데
**거짓이었다** — `internal-package-registration-guard.ts` 가 읽는 파일은 `TEST_STAGES` 와
`PACKAGES_CHECKS` **둘뿐**이다(실측).

| # | 표면 | 자동 검증 |
| --- | --- | --- |
| 1 | `.claude/test-stages.sh` — `INTERNAL_PACKAGES` | ✅ 가드 |
| 2 | `.github/workflows/packages-checks.yml` — pathspec **+ matrix 두 곳** | ✅ 가드 |
| 3 | `codebase/backend/package.json` — `workspace:` 의존 | ❌ **없음** |
| 4 | `codebase/frontend/package.json` — `workspace:` 의존 | ❌ 없음 |
| 5 | `codebase/backend/Dockerfile` — COPY | ❌ 없음(도커 빌드가 사후 실패) |
| 6 | `codebase/frontend/Dockerfile` — COPY | ❌ 없음 |
| 7 | `codebase/frontend/Dockerfile.playwright-e2e` — COPY | ❌ 없음 |
| 8 | `pnpm-lock.yaml` | `pnpm install` 산출 |

> **③ 이 특히 위험하다.** 가드는 `packages-checks.yml` 의 기대 목록을 *backend package.json 의
> `@workflow/*` 의존에서 **파생**시킨다* — 즉 backend 의존을 아예 빠뜨리면 기대 집합에서도
> 빠져 **조용히 통과**한다. 가드가 자기 입력의 누락은 못 본다.
>
> 그래서 ③~⑦ 은 PR 에서 **수동 대조**한다. 가드 확장은 이 PR 의 범위 밖(후속 항목).

## 작업

- [x] `/consistency-check --plan` (BLOCK:YES → 처분 후 재실행)
- [x] `codebase/packages/masked-markers/` 신설 (package.json·tsconfig·eslint·README·src)
- [x] 등록 8곳 (③~⑦ 수동 대조 체크)
- [x] backend `sanitize-error-message.ts` → 패키지에서 import 후 **재export 유지**
      (소비처 5파일의 import 경로를 바꾸지 않기 위해 — 이관과 소비처 개편을 한 PR 에 섞지 않는다)
- [x] frontend `masked-markers.ts` → 패키지에서 import 후 재export 유지
- [x] 미러 소멸 캐너리 — **심볼 재선언** 스코프 (아래 참조)
- [ ] **spec R17 정정 (planner 턴 필요)** — `14-external-interaction-api.md` 의
      *"마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다"* 가
      이관 후 **사실과 어긋난다**. SoT 를 `@workflow/masked-markers` 로 바꾸고, frontmatter
      `code:` 목록에서 **`masked-markers.ts` 항목 옆**에 패키지 경로를 추가한다
      (라인번호로 지목하지 않는다 — 인접 항목이 `sanitize-error-message.ts` 라 오편집하기 쉽다).
      developer 는 `spec/` read-only 라 planner 턴으로 분리 집행
- [x] 정본 트래커 **`:373`·`:757` 두 항목** `[x]` + 대체 근거 (구현 커밋과 같은 턴)
- [x] TEST WORKFLOW 4단계 + 타입체크 ratchet
- [ ] `/ai-review`

## 미러 소멸 캐너리 — **리터럴이 아니라 심볼을 본다**

처음엔 *"패키지 밖에 마커 리터럴이 재등장하면 RED"* 로 적었다. 실측하니 **오탐 기계**가 될
설계였다 — 마커 리터럴을 **정당하게 독립 사용**하는 파일이 최소 5곳이다:

| 파일 | 용도 |
| --- | --- |
| `nodes/core/error-codes.ts` | 이메일 로컬파트 마스킹 `'***'` |
| `nodes/integration/http-request/http-request.handler.ts` | 쿼리 파라미터 `'[REDACTED]'` |
| `nodes/integration/_base/sanitize-response-headers.util.ts` | `const REDACTED = '[REDACTED]'` (webhook §5.3) |
| `nodes/integration/_base/integration-handler-base.ts` | 응답 본문 `'***'` |
| `nodes/logic/_shared/value-masking.util.ts` | `const MASK_SECRET = '***'` |

spec 은 이 중 일부를 **독립 메커니즘으로 명시 확정**했다(잔여③ workflow-assistant `redact.ts`
는 값-패턴 마스킹과 **합성 금지**). 즉 리터럴 일치는 우연이지 계약이 아니다.

> 오탐 나는 가드는 약화되거나 무시된다 — 이 시리즈가 반복해 겪었다.

**스코프**: 패키지가 export 하는 **심볼 이름의 재선언**만 본다 —
`MASKED_MARKERS` · `isMaskedMarker` · `VALUE_MASK_MARKER` · `KEY_MASK_MARKER` ·
`DEPTH_MASK_MARKER` · `MAX_MASK_DEPTH`. 재export(`export { X } from …`)와 지역 별칭
(`export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH`)은 선언이 아니므로 통과한다.
AST + allowlist 는 선례(`masked-reject-callers-guard.ts`)를 그대로 재사용한다.

## 검증 기준

추출 자체는 **동작 무변경**이어야 한다. 기존 스위트가 그대로 GREEN 인 것이 1차 근거이고,
"미러가 실제로 사라졌는가" 는 위 심볼 재선언 캐너리로 고정한다.

## Rationale

계약 테스트를 먼저 제안했다가 **CI 경로 게이팅 실측으로 뒤집었다.** 가드가 있는데 그것이
지켜야 할 변경 방향에서 실행되지 않으면 없느니만 못하다 — 있다고 믿게 만든다. 이 판단은
PR #1189 에서 같은 형태를 네 번 겪고 얻은 것이다.

**기각한 대안**:

- *계약 테스트를 양쪽에 중복 배치* — 경로 갭은 닫히지만 미러가 남고 가드까지 미러가 된다.
  추출이 같은 값을 더 적은 표면으로 얻는다.
- *`MAX_SANITIZE_DEPTH` 까지 통합* — 위 실측대로 다른 불변식이다. 통합하면 WS 마스킹 깊이가
  11→10 으로 바뀌는 **동작 변경**이 근거 없이 끼어든다.
