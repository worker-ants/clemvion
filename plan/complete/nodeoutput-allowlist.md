---
title: "`getStatus` 의 `nodeOutput` 을 fail-open deny-list 에서 fail-closed allowlist 로"
status: complete
worktree: nodeoutput-allowlist-17a6f5
started: 2026-08-23
completed: 2026-08-23
owner: developer
spec_impact:
  - spec/5-system/14-external-interaction-api.md
---

# `nodeOutput` 키 allowlist (EIA §R17 잔여)

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
의 항목 *"`getStatus` 일반 `nodeOutput` 키-allowlist"* (2026-07-10 등재, `plan-coherence` W3).

## 착수 전 프로브 — 항목 전제가 **부분적으로 낡았다**

트래커는 *"그 외 `nodeOutput` 키는 공개 표면에 그대로 실린다"* 고 적었다. 그 사이
`stripAndRedact` 가 도입돼 세 출구 전부에 걸린다. **그래도 갭은 실재한다** — 다만 이유가
트래커 서술과 다르다:

```ts
export const EXTERNAL_STRIPPED_FIELDS = ['llmCalls'] as const;   // deny-list, 한 칸
```

`stripExternalOnlyFields` 는 **deny-list** 다. `deepRedactSecrets` 는 **값**만 가리고 필드를
지우지 않는다. 즉 `nodeOutput` = 노드의 **전체 `outputData`** 에서 `llmCalls` 하나만 뺀 것이고,
**새 핸들러가 새 키를 내면 기본값이 통과(fail-open)** 다.

### 지금 새는 구체 사례 — `_retryState`

`NodeHandlerOutput` 은 엔진 내부 필드를 둘 갖는다:

| 필드 | 성격 | `NodeExecution.outputData` 에 있나 |
| --- | --- | --- |
| `_resumeState` | 엔진 내부 (표현식·UI 에 의도적 미노출) | **아니오** (실측 — outputData 참조 0건) |
| `_retryState` | 엔진 내부 retry continuation | **예** (`retry-turn.service.ts:115,220,932`) |

`_retryState` 는 `llmCalls` 가 아니므로 deny-list 를 통과한다 → **외부 표면으로 나간다**.
자기 문서가 *"`_resumeState` 는 표현식 리졸버·UI 자동완성에 노출되지 않게 `output` 밖에
뒀다"* 고 적은 그 의도가, 외부 REST 에서는 지켜지지 않는다.

> **아직 못 잰 것**: 그 노드 실행이 *waiting* 상태이면서 동시에 `_retryState` 를 갖는
> 조합의 **도달 가능성**은 정적으로 확인하지 못했다. fail-closed 로 바꾸면 도달 가능성과
> 무관하게 닫히므로 이 PR 은 그 증명에 의존하지 않는다 — 다만 **캐너리는 도달성을 가정하지
> 않는 단위 레벨**에 둔다.

## ⚠️ 평평한 allowlist 를 손으로 나열하면 안 된다 (실측된 함정)

위젯 파서가 **`form` 에서 `nodeOutput` 자체를 폼 선언으로** 쓴다:

```ts
form → (ev.nodeOutput?.formConfig ?? ev.nodeOutput)
```

그리고 폼 핸들러는 `formConfig` 를 **안 낸다** — `{ config: {...rawConfig}, output: {},
meta: { interactionType: 'form' } }` 이다(실측). 즉 그 폴백이 **실사용 경로**이고,
좁은 allowlist 는 폼 렌더를 깨뜨린다.

## 설계 — **타입 계약에서 파생**한다 (두 번째 미러를 만들지 않는다)

`nodeOutput` 은 `NodeExecution.outputData` = **`NodeHandlerOutput` shape** 이다. 그러니
allowlist 를 새로 발명하지 않고 그 타입의 **공개 부분집합**으로 정의한다:

| 그룹 | 키 | 근거 |
| --- | --- | --- |
| 핸들러 계약 공개분 | `config` · `output` · `meta` · `port` · `status` | `NodeHandlerOutput` |
| wire 전용 | `formConfig` · `conversationConfig` · `buttonConfig` · `interactionType` | 위젯 파서가 top-level 로 읽는다 |
| **제외 (fail-closed)** | `_resumeState` · `_retryState` · 그 외 전부 | 엔진 내부 / 미지 |

이 집합은 `config`·`output`·`meta` 를 남기므로 **폼 폴백이 그대로 산다**.

## 작업

- [x] `/consistency-check --impl-prep` — **BLOCK: NO** (`18_30_40`, CRITICAL 0 · WARNING 2)
- [x] (planner 턴) EIA §R17 flip — **범위를 표로 열거**(REST 1곳 · terminal 2곳 제외 · SSE 잔여)
- [x] allowlist 필터 신설 + **컴파일타임 결속**(`NodeHandlerOutput` 공개 키) — deny-list 는
      다른 소비처가 쓰므로 대체가 아니라 `getStatus` 경로에 **추가**
- [x] 캐너리 — 유틸 스위트 + **배선 캐너리**(호출부가 실제로 지나는지)
- [x] 뮤테이션 검증 — **vacuous 캐너리를 드러냈다**(아래)
- [x] TEST WORKFLOW 4단계 PASS + ratchet — **게이트가 신규 타입 오류를 잡았다**(아래)
- [x] `/ai-review` — `19_00_23` CRITICAL 0 · WARNING 4 → **전부 반영** (RESOLUTION.md)
- [x] 상위 트래커 체크박스 flip + 근거 기록 (`18_30_40` INFO 5)

## 검증 기준

- **캐너리 셋**:
  1. `_retryState` 가 있는 `outputData` → 결과에 **없다** (지금 새는 그 사례)
  2. 폼 형태(`{config, output, meta}`) → **셋 다 보존** (폴백이 산다)
  3. 미지 키(`__future`) → **없다** (fail-closed 가 실제로 닫힌다)
- **뮤테이션**:
  - M1 allowlist 필터 제거 → 캐너리 1·3 RED
  - M2 allowlist 에서 `config` 제거 → 캐너리 2 RED (폼 폴백이 깨지는 걸 테스트가 잡나)
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.

## `--impl-prep` 처분 (`18_30_40` — BLOCK: NO · CRITICAL 0 · WARNING 2)

둘 다 **범위 공개**에 관한 것이었고 둘 다 반영했다.

- **W1 (rationale)**: §R17 이 세 출구를 **열거**한 원칙을 신규 방어가 1곳으로 좁히는데 근거가
  spec 에 없다 → §R17 flip 을 **표로** 썼다(REST waiting 1곳 적용 · terminal 2곳 의도적 제외 ·
  SSE 잔여). 이 저장소가 §R17 에서 두 번 겪은 *"부분 해소를 전체로 flip"* 의 3회차를 막는다.
- **W2 (plan_coherence, MEDIUM)**: SSE/fanout 이 같은 `_retryState` 를 나르고 **chat-channel
  어댑터가 구독**해 blast radius 가 더 넓다 → 대칭 적용 대신 **REST 로 범위를 좁히고 트래커에
  별도 항목**으로 등재했다. 실측 근거: `toFanoutEnvelope` 는 **envelope 레벨**에서 strip 하므로
  한 줄 대칭이 안 되고, 그 payload 를 외부 채널 렌더러가 소비한다.
- **INFO 2 (내 과장 표현)**: JSDoc 에 *"발명하지 않고 파생"* 이라 썼는데 실제로는 손으로 맞춘
  평행 목록이었다 → 문구를 낮추는 대신 **컴파일타임 assertion 으로 그 주장을 참으로 만들었다**.
  검증: allowlist 에서 `status` 를 빼니 `TS2322` 로 빌드가 깨진다(실측).
- **INFO 1**: `_resumeCheckpoint` 는 `NodeHandlerOutput` 의 키가 **아니다**(실측 — `stripControlFields`
  에만 등장). fail-closed 라 열거 없이 닫히고, 그 사실을 JSDoc 에 적었다.

## 뮤테이션 — 내 캐너리 하나가 **vacuous** 였다

예측을 먼저 적고 돌렸다.

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| **M1** 호출부에서 allowlist 배선 제거 | 캐너리 1·3 RED | **1 RED**(배선 캐너리) — 유틸 캐너리는 GREEN 이 정답 |
| **M2** allowlist 에서 `config` 제거 | 폼 캐너리 RED | **컴파일 실패**(`TS2322`) — 결속이 먼저 문다 |
| **M2b** allowlist 에서 `formConfig`(wire 전용) 제거 | ? | **전부 GREEN, 91 → 90건** ⚠️ |

**M1 예측이 빗나간 이유**는 의미 있다 — 유틸 캐너리는 유틸을 직접 부르므로 *배선* 제거에
영향받지 않는다. 즉 배선 캐너리가 헬퍼와 호출부 사이를 지키는 **유일한** 테스트다.

**M2b 가 진짜 발견이다.** wire 전용 키는 컴파일타임 결속이 안 덮는데(설계상 allowlist 가
타입보다 넓을 수 있다), 내 `it.each([...NODE_OUTPUT_ALLOWED_KEYS])` 는 **fixture 를 구현
상수에서 파생**해서 목록이 줄면 케이스도 함께 줄었다 — 한 건 적게 돌고 전부 초록.
테스트 수가 91 → 90 으로 준 것이 유일한 흔적이었다.

→ **리터럴 대조 캐너리**를 앞에 뒀다(wire 키 4개 + 전체 집합 정렬 비교). 같은 뮤턴트를 다시
거니 **RED**. 이건 이 저장소가 이미 겪은 *"생성 입력 vs 큐레이션 코퍼스"* 형태다.

## ratchet 이 제 캐너리의 타입 오류를 잡았다

배선 캐너리가 `interaction.service.spec.ts` 의 타입 오류를 4 → 5 로 늘렸다. **jest 는 타입을
strip 하고 `nest build` 는 `*.spec.ts` 를 exclude** 하므로 이 게이트 말고는 아무도 못 본다 —
게이트가 존재하는 이유 그대로다. 기존 4건과 같은 형태(`as unknown` 경유)로 맞춰 baseline
199건에 복귀했다.

## 게이트·수치

- **TEST WORKFLOW**: lint · unit(backend **8,976**) · build · e2e(285 + **Playwright 51**) PASS — 리뷰 3R fix 후 재수행분
- **ratchet**: 199건 / 38파일 — baseline 일치
- 부수: 첫 e2e 는 postgres 컨테이너가 `No space left on device` 로 죽었다(테스트 실패 아님).
  `docker builder prune -af` + `image prune -f` 로 **49.8GB** 회수 후 재실행 PASS. 볼륨은
  건드리지 않았다.

## `/ai-review` 처분 (`19_00_23` — CRITICAL 0 · WARNING 4 · MEDIUM)

전문은 [`RESOLUTION.md`](../../review/code/2026/08/23/19_00_23/RESOLUTION.md). 요지:

- **W1 (security)**: SSE 잔여는 `--impl-prep` 에서 **의도적으로 정한 범위**라 유지. 다만
  리뷰어가 **내가 못 찾은 호출부 2곳**(`waitForFormSubmission`·`waitForButtonInteraction`)을
  짚어, 그 실측을 트래커 항목에 옮겨 적었다 — 후속 착수자가 다시 찾지 않도록.
- **W2 (architecture)**: 내가 **순수·범용 유틸을 도메인 타입에 결속**시켰다(계층 역전).
  `node-output-allowlist.ts` 로 분리하고 테스트도 갈랐다.
- **W3**: `getStatus` JSDoc 이 *"allowlist 는 별개 잔여 항목"* 이라 말하는데 **바로 그 메서드
  본문에** 배선을 넣었다. spec 표는 갱신했는데 이 한 줄만 남은, 이 세션에서 반복한 형태다.
- **W4**: 같은 표면의 선행 보안 수정(`llmCalls`)은 CHANGELOG 에 운영 영향까지 남겼는데 이번엔
  없었다. 같은 형식으로 추가하되 `_retryState` 가 자격증명이 아님도 함께 적어 과장하지 않았다.
- **INFO 5건 조치**(`__proto__`·buttons 분기·terminal 경계 캐너리 · `delete` 근거 · 체크박스),
  8건 미조치 사유는 RESOLUTION 표에.

부수: 첫 unit 재수행에서 무관 파일(`node-components.module.spec.ts`)이 **SIGSEGV** 로 죽었다 —
실패 테스트는 0건이었고 단독 재실행은 통과. phantom 으로 기록하고 정식 재실행했다.

## `/ai-review` 2라운드 (`19_24_24` — CRITICAL 0 · WARNING 2)

전문은 [`RESOLUTION.md`](../../review/code/2026/08/23/19_24_24/RESOLUTION.md). 4명 전원이
1라운드 WARNING 4건의 실제 반영을 재확인했다.

- **W1 (SSE 잔존)**: 범위 유지. **리뷰어가 호출부를 또 짚었다**(`processButtonResumeTurn`·
  `nodeOutputForEvent`) — 트래커에 전부 옮기고 재사용할 헬퍼 경로도 적었다. 후속 착수자가
  세 번째로 같은 grep 을 돌리지 않도록.
- **W2 (깨진 링크)**: 1라운드 W2 대응으로 파일을 분리하며 JSDoc 을 **그대로 옮겨** `{@link}`
  가 자매 **파일**의 심볼을 "위" 라 가리켰다. 파일명 명시 산문으로 정정 — import 추가는
  방금 끊어 낸 결합을 되살리므로 택하지 않았다.
- **INFO 2**: `Object.freeze` 적용. `as const` 는 컴파일타임 리터럴 타입만 주는데 이 상수의
  JSDoc 이 "보안 경계" 라 주장하므로 런타임 불변까지 참으로 만들었다.
- **INFO 1 (재배치)**: 미조치, 트래커 등재. 같은 라운드에 이미 한 번 옮겼고, **SSE 항목이
  소비처를 하나 늘리므로 그 작업과 함께 정하는 게 낫다**(소비처가 둘이면 배치 답이 달라진다).

### ⚠️ 새 캐너리가 내 가정을 반증했다

`error` 출구 캐너리가 첫 실행에서 **실패**했다. 원인은 코드가 아니라 **내 fixture** —
두 terminal 출구는 **둘 다 `execution.outputData`** 를 읽는데(분기는 `status` 로만) 나는
`execution.error` 에 넣었다. 리뷰어는 제안에 정확히 `outputData` 라 적었는데 내가 옮겨 적으며
틀렸다. 고치면서 **"두 출구가 같은 컬럼을 읽는다"** 는 사실이 테스트 주석으로 남았고,
그게 원래 INFO 가 겨눈 "통합 리팩터링 시 한쪽만 바뀌는 것" 을 막는 핵심이다.

## `/ai-review` 3라운드 — **수렴** (`19_43_33` — CRITICAL 0 · WARNING 0)

두 reviewer 가 1·2라운드 지적의 반영을 재확인했다. 남은 INFO 3건은 전부 1줄짜리라 **지금
반영하는 게 남기는 것보다 쌌다**:

- **INFO 1**: 호출부 인라인 주석만 *"타입에서 파생"* 이라는 옛 표현을 쓰고 있었다(메인
  JSDoc·CHANGELOG 는 이미 "결속" 으로 정밀화됨) → 통일.
- **INFO 2**: `Object.freeze` 를 **아무도 안 지킨다**는 걸 리뷰어가 뮤테이션으로 실증했다
  (빼도 21/21 GREEN). 캐너리 1줄 추가.
- **INFO 3**: `makeExecution` 의 `overrides: Partial<Execution>` 가 반환 `Pick` 밖 키를
  조용히 받아, **내가 실제로 그 함정에 빠졌다**(2R 에서 `error` 에 fixture 를 넣음).

### INFO 3 을 고치다 **기존 호출부 6곳**이 걸렸다

타입을 `Partial<ExecutionFixture>` 로 좁히니 `conversationThread` 를 넘기는 6곳이 컴파일
에러가 났다. **그 여섯은 정당했다** — `getStatus` 의 2단계 조회가 **같은 `repo.findOne`** 을
쓰므로 이 헬퍼가 두 조회를 다 먹인다. 그래서 그 키를 `ExecutionFixture` 에 넣고, 그 사실을
JSDoc 에 적었다. `error` 는 어느 조회도 안 읽으므로 계속 막힌다.

**좁히기가 실제로 무는지 확인했다** — fixture 에 `error` 를 넘기니 `TS2353`. 내가 빠졌던
함정이 이제 컴파일 에러다.

## 수렴 판정

발견의 성격: **동작(내부 필드 유출) → 구조(계층 역전·파일 분리) → 표현 정밀도·fixture 타입**.
구조가 사라졌다.

| 라운드 | CRITICAL | WARNING |
| --- | --- | --- |
| `19_00_23` | 0 | 4 |
| `19_24_24` | 0 | 2 |
| `19_43_33` | 0 | **0** |
