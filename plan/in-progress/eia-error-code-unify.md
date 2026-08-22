---
title: 두 Manual 엔드포인트의 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일한다
status: in-progress
worktree: eia-error-code-unify-a87cea
started: 2026-08-22
owner: planner
spec_impact:
  - spec/4-nodes/7-trigger/1-manual-trigger.md
  - spec/5-system/13-replay-rerun.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/12-webhook.md
  - spec/5-system/14-external-interaction-api.md
  - spec/conventions/error-codes.md
---

# 두 Manual 엔드포인트의 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일한다

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 *"두 Manual 엔드포인트의 최상위 `error.code` 가 다르다"* 항목 집행 + 같은 절의 **spec 편집
3건**.

## 결정 (2026-08-22, 사용자)

같은 검증 실패(`resolveTriggerParameters` 가 던지는 `TriggerParameterValidationException`)를
두 엔드포인트가 다른 최상위 코드로 감싸고 있다:

| 엔드포인트 | 현재 코드 | 발행처 |
| --- | --- | --- |
| `POST /workflows/:id/execute` | `INVALID_TRIGGER_PARAMETERS` | `workflows.controller.ts:324` |
| `POST /workflows/:id/save` | `INVALID_TRIGGER_PARAMETERS` | `workflows.service.ts:931` |
| `POST /executions/:id/re-run` | **`INVALID_INPUT`** | `executions.service.ts:506` |

**`INVALID_TRIGGER_PARAMETERS` 로 통일한다** — 즉 re-run 쪽을 바꾼다.

## 이것은 규약의 명시적 예외다 — 근거를 실측했다

`spec/conventions/error-codes.md §2` 는 두 문장을 못박는다:

> - 에러 코드 rename 은 **breaking change** 다.
> - **이름 정확성 향상만을 위한 rename 은 하지 않는다.**

그러므로 이 변경은 *"해도 되는 정리"* 가 아니라 **예외를 주장해야 하는 변경**이다. §5
(Rename 이력)의 선례 3건은 전부 같은 형태로 예외를 정당화했다 — *"소비자가 자사 클라이언트뿐
… 외부 client 코드에 분기로 노출된 적이 없다(문서 목록에만 노출됐던 코드는 신규 코드로
동기화)"*.

**같은 실측을 했다** (2026-08-22, `7b0e65aa8`):

| 소비 표면 | 실측 |
| --- | --- |
| 프런트 re-run 모달의 코드 분기 | `rerun-modal.tsx` `ERROR_CODE_TO_KEY` 는 **`RERUN_*` 4종만** 매핑한다. `INVALID_INPUT` 은 키가 없어 **generic fallback** 으로 떨어진다 — 즉 값으로 분기하지 않는다 |
| 프런트/위젯 전체 grep | `codebase/frontend/src` · `codebase/channel-web-chat` 에서 `INVALID_INPUT` 히트 = **유저 가이드 mdx 2곳뿐**(코드 0건) |
| backend | 발행 1곳(`executions.service.ts:506`) + Swagger 서술 1곳 + 테스트 1파일 |

관측 범위에서는 §5 선례가 든 조건(*"자사 클라이언트가 값으로 분기하지 않고, 문서 목록에만
노출"*)과 **같은 그림이다.** 다만 선례와 결정적으로 다른 점이 하나 있고, 그것을 아래에 적는다.

> **남는 위험을 숨기지 않는다 — 그리고 선례에 없는 근거를 빌려오지 않는다**
> (`16_34_50` rationale_continuity W1 정정):
>
> 처음 이 자리에 *"§5 의 선례 3건도 같은 한계에서 같은 판단을 내렸다"* 고 적었는데
> **거짓이었다.** 실측하니(`27f390700` #558 PR4b · `47282085b` #566 + §5 표 비고) 선례들이
> 실제로 주장한 것은 *"소비자가 자사 클라이언트뿐이라 **breaking 영향이 없음을 확인**했다"*
> 다 — **잔여 위험을 인수한 것이 아니라 위험이 없다고 판정한 것**이다. 두 판단은 다르다.
>
> 이번 건은 **선례보다 한 단계 위험하다.** `POST /executions/:id/re-run` 은 워크스페이스 JWT
> 만 있으면 공식 UI 밖에서도 호출 가능한 내부 API 이고(용어는 EIA §R11 의 internal /
> `/api/external/*` 구분을 따른다 — "공개 표면" 이라 부르지 않는다), 저장소 밖 서드파티가
> 이 값으로 분기했을 가능성을 **코드로는 배제할 수 없다.** 즉 판정 근거가 "없음 확인" 이
> 아니라 **"관측(grep) 범위에서 미발견"** 이다.
>
> 그 차이를 안고 진행하는 것이 **사용자 결정**이다. `error-codes.md §5` 신규 행 비고에
> **이번이 그 잔여 위험을 명시 인수한 최초 사례**임을 적어, 이후 §5 표가 *"아무 API 든
> rename 안전"* 으로 과잉 일반화되지 않게 한다.

### 왜 반대 방향이 아닌가

`3-error-handling.md:80` 에는 **정반대 방향의 Rationale** 이 이미 적혀 있다:

> **`RERUN_` prefix 를 붙이지 않는 것은 의도** — 이미 발행 중인 코드라 §2 rename-stability 상
> 유지한다

이 문장은 *"`INVALID_INPUT` → `RERUN_INVALID_INPUT`"* 을 기각한 기록이지 *"두 경로를 통일하지
않는다"* 를 결정한 기록이 **아니다**. 그래도 통일 후에는 이 문장이 자기모순이 되므로
**함께 개정한다** — 지우지 않고 *"무엇이 기각됐고 무엇이 뒤집혔는지"* 를 남긴다.

또 `INVALID_INPUT` 쪽으로 통일하는 안은 **범위가 더 넓다** — `execute` 는 저장 경로
(`POST /:id/save`)와 코드를 공유하므로 세 엔드포인트가 동시에 바뀐다. 바꾸는 표면이 작은
쪽을 택했다.

## 동반 개정 표면 (실측)

### spec (6파일)

| 파일 | 위치 | 내용 |
| --- | --- | --- |
| `4-nodes/7-trigger/1-manual-trigger.md` | §6 경로별 코드 표 (181행) | re-run 행의 코드 교체 |
| `5-system/13-replay-rerun.md` | §8.1 표 (246행) · §10.2 콜아웃 (377행) | 정의 SoT |
| `5-system/3-error-handling.md` | 카탈로그 (80행) · `details[]` 노트 (189행) | 카탈로그 + 반대 방향 Rationale 개정 |
| `5-system/12-webhook.md` | §5.2 구현 노트 (313행) | *"Manual re-run `INVALID_INPUT`"* 서술 |
| `conventions/error-codes.md` | §4 표 · §5 Rename 이력 | 아래 두 항목 |
| `5-system/14-external-interaction-api.md` | §R17 | 아래 wrapper·볼드 항목 |

> **편집 대상 텍스트의 출처** (`16_34_50` plan_coherence INFO): 위 spec 위치 다수
> (`3-error-handling.md:80,189` · `13-replay-rerun.md:246,377`)는 1~2일 전 완료된 자매 plan
> [`spec-draft-inputoverride-marker-reject.md`](../complete/spec-draft-inputoverride-marker-reject.md)
> (PR #1188·#1189 계열)이 짜 넣은 **다중 관심사 텍스트**다 — `details[]` 카탈로그 참조,
> re-run `details` 배선 정정 각주, §2 rename-stability 반대 방향 Rationale 이 한 문장에
> 섞여 있다. **코드명 토큰만 치환하고 나머지 서술은 보존한다** — 문장을 통째로 다시 쓰면
> 그 PR 들이 심어 둔 근거가 조용히 사라진다.

### 코드·테스트·가이드

| 파일 | 내용 |
| --- | --- |
| `executions.service.ts:506` | `code: 'INVALID_INPUT'` → `'INVALID_TRIGGER_PARAMETERS'` |
| `executions.controller.ts:274` | Swagger `description` |
| `executions-rerun.service.spec.ts:330,422` | 단언·제목 |
| `02-nodes/triggers.mdx:33` · `.en.mdx:22` | **선존 drift 동반 정정** (아래) |

> **유저 가이드는 지금도 틀려 있다 (실측)**: 두 가이드는 Manual Trigger 의 `required` 필드를
> *"값 누락 시 실행이 `INVALID_INPUT` 으로 실패해요"* 라 설명하는데, **주 실행 경로**
> (`POST /:id/execute`)가 내는 코드는 `INVALID_TRIGGER_PARAMETERS` 다. 이번 통일이 이 문장을
> **우연히 맞게** 만든다 — 그래도 "우연히 맞아졌다" 가 아니라 정정으로 다룬다.

## 같은 절의 spec 편집 3건 (트래커 이월분)

- **wrapper 함수명이 spec 본문에 없다** — `resolveTriggerParametersRejectingMasked` /
  `reject-masked-resubmission.ts` 가 `1-manual-trigger.md §6` · `14-…md §R17` 어디에도 이름으로
  안 나온다(실측: `grep -rn 'resolveTriggerParametersRejectingMasked' spec` = **0건**).
  `spec-impl-evidence` **§4 `spec-code-paths.test.ts`**(글로브 ≥1 파일 매치)는 충족해
  가드는 통과하지만 *"공유 함수에 넣지 않는다"* 는 설계
  의도가 코드 추적선에서 흐려진다. 두 문서에 함수·파일명 명시 + `code:` frontmatter 추가.
- **§R17 "닫는 조건" 표의 신규 4번째 행만 볼드** — 기존 3행은 평문. 통일한다.
- **`error-codes.md §4` "패턴" 표에 trigger-parameter reason 계열이 없다** — `12-webhook.md:313`
  과 `3-error-handling.md:189` 이 둘 다 *"[error-codes 규약 §4] 패턴"* 을 참조하는데 §4 표에는
  **Code 노드 내부 분류 코드만** 있다. 참조가 착지하지 않는다.
  > **단순 append 는 금지** (`16_34_50` convention_compliance W2). §4 는 본문과 열 헤더로
  > 스스로 scope 를 *"Code 노드 핸들러 내부 분류 → 정규화 → 노드 `output.error.code`"* 라
  > 선언한다. trigger-parameter reason 계열은 **파이프라인이 다르다**
  > (`toTriggerParameterErrorDetails`, 목적지는 `output.error.code` 가 아니라 봉투의
  > `details[].code`). 그대로 행만 추가하면 표가 자기 scope 선언과 모순된다.
  > → **§4.1(Code 노드 내부 분류) / §4.2(trigger-parameter 내부 분류)로 분리**하고 §4 상단
  > scope 문장을 두 파이프라인을 포괄하도록 일반화한다. 인입 참조 2곳(`12-webhook.md:313`,
  > `3-error-handling.md:189`)의 앵커도 함께 본다.

## 작업

- [x] `/consistency-check --plan` — **BLOCK: NO** (`16_34_50`). WARNING 2 · INFO 8 전부 반영:
      W1(선례에 없는 근거 소급 부여) 정정 · W2(`§4` 단순 append 금지) · INFO 1·3·4·5·6·7·8
- [x] spec 6파일 개정 (`error-codes.md §5` Rename 이력 행 신설 포함)
      - `§5` 신규 행 **"PR" 컬럼**은 **이 작업의 PR 번호**를 쓴다 — 실측 근거로 인용한
        커밋 `7b0e65aa8` 을 옮겨 적지 않는다 (`16_34_50` naming_collision INFO)
      - `§5` 신규 행 **비고**에 리스크 등급 명시 — *"내부 REST 엔드포인트, 제3자 분기는
        코드로 배제 불가, 관측(grep) 기준 판정, 잔여위험은 사용자 결정으로 인수"*
      - `3-error-handling.md §1.3` 카탈로그의 `INVALID_TRIGGER_PARAMETERS` 행에
        **"세 엔드포인트 공용"** 명시 (현재 이 코드의 행 자체가 없다 — rename 이 카탈로그
        갭도 함께 메운다)
      - `13-replay-rerun.md §8.1` 표에 **`RERUN_` prefix 미사용이 의도**임을 각주로 —
        형제 `RERUN_*` 와 어긋나 보이는 이유가 *"Manual 실행/저장 경로와 코드를 공유"* 임
- [x] spec 편집 3건 (wrapper 함수명 · §R17 볼드 · `error-codes.md §4` 표 → **§4.1/§4.2 분리**)
- [x] 코드·Swagger·테스트
- [x] 유저 가이드 KO/EN 2곳 (선존 drift 동반 정정)
- [x] 정본 트래커 4항목 `[x]` (결정 항목 + spec 3건) — 미체크 38 → 34
- [x] TEST WORKFLOW 4단계 + 타입체크 ratchet — lint / unit(backend 8,896 · frontend 6,107 ·
      web-chat 451) / build / e2e(backend 276 + playwright 51). ratchet 199건/38파일 일치.
      > build·e2e 가 각 1회씩 Docker VM 디스크 부족으로 죽었다 — 코드 결함 아님.
      > `docker builder prune -af`(10.12GB) + `docker image prune -f`(33.33GB) 후 통과.
      > 볼륨은 건드리지 않았다.
- [x] `/ai-review` — 2라운드. `17_06_14`(Critical 0 · W6) → 처분 → `17_32_01`(Critical 0 · W2).
      남은 2건은 (a) 사용자가 인수한 breaking 결정 자체 (b) PR 생성 전엔 채울 수 없는
      `#TBD_PR` — 둘 다 코드 조치 없음. W5(테스트가 제목만 주장)는 **대조군 뮤테이션으로
      판별력을 실증**하고 고쳤다.

## 검증 기준

- **실측 (2026-08-22, 편집 직후)**: `grep -rn 'INVALID_INPUT' codebase spec` = **5건**,
  전부 *"여기가 예전에 `INVALID_INPUT` 이었다"* 를 적은 **이력 기록**이다 — 발행 지점 0건.

| # | 잔존 위치 | 성격 |
| --- | --- | --- |
| 1 | `executions.service.ts:508` 발행부 주석 | 왜 자매와 같은 코드인지 |
| 2·3 | `3-error-handling.md:91,93` §1.3 콜아웃 | 무엇이 기각됐고 무엇이 뒤집혔는지 |
| 4 | `13-replay-rerun.md:252` §8.1 각주 | `RERUN_` prefix 미사용 근거 |
| 5 | `error-codes.md:145` §5 Rename 이력 행 | 은퇴 코드 정본 등재 (**구 코드 컬럼**) |

  > 처음 이 자리에 *"잔존은 `error-codes.md §5` 이력 행 하나여야 한다"* 고 적었는데
  **너무 좁았다** — 이력은 한 곳에 모으는 것이 아니라 **뒤집힌 서술이 있던 자리마다**
  남겨야 다음 사람이 그 자리에서 읽는다. 기준을 실제 결과로 교체한다.

- **세 엔드포인트가 같은 코드를 낸다는 것이 각 소비처 테스트로 고정돼 있다** (실측:
  `INVALID_TRIGGER_PARAMETERS` 를 단언하는 spec 파일 **3개** —
  `workflows.controller.spec.ts`(주 실행) · `workflows.service.spec.ts`(저장) ·
  `executions-rerun.service.spec.ts`(re-run)). `details[]` 항목 코드는 셋 다
  `toTriggerParameterErrorDetails` 를 거치므로 원래 동일하다.

## Rationale

**기각한 대안**:

- *현상 유지 + 트래커 묘비 종결* — `error-codes.md §2` 가 rename 을 breaking 으로 규정하고
  `3-error-handling.md:80` 에 유지 근거가 이미 있어 규약상 가장 값싼 선택이었다. **사용자가
  통일을 택했다.** 규약 예외를 주장하되, 근거를 선례에서 빌려오지 않고 **이번 건의
  관측 범위와 그 한계를 그대로 적는** 경로를 골랐다.
- *`INVALID_INPUT` 으로 통일* — `execute` 가 저장 경로와 코드를 공유해 세 엔드포인트가 동시에
  바뀐다. 바꾸는 표면이 더 넓다.
- *deprecated alias 로 양쪽 동시 발행* — `error.code` 는 단일 값이라 alias 를 실을 자리가
  없다. `details[]` 항목 코드는 이미 양쪽이 동일하므로 이행 경로로서도 이득이 없다.
