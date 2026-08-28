---
title: spec draft — 에러 wrapping 시 `cause` 부착 판별 기준 명문화
worktree: eslint10-upgrade-5e3cf9
started: 2026-08-29
owner: project-planner
status: in-progress
priority: P3
spec_impact:
  - spec/5-system/3-error-handling.md
---

> **선행 plan**: `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 의 후속 항목
> "(후속, INFO) `cause` 부착 판단 근거" 가 이 작업을 planner 턴으로 위임한 정본이다.
> 반영이 끝나면 **그 항목에 교차참조를 남겨 닫는다** — 안 그러면 해소된 결정이 미해결로
> 남아 다음 사람이 재검토한다. (`--spec` WARNING #4)

> ### `--spec` 검토 반영 (`review/consistency/2026/08/29/00_13_01`, BLOCK: NO)
>
> WARNING 4건이 나왔고 **전부 이 개정에 반영했다**. 그중 #3 은 기준 자체를 바꿨다:
>
> - **#1·#2 (배치·레이어 스코프)** — §6 은 스스로 "로깅 마스킹" 이라 범위를 선언하는데
>   내 근거는 **클라이언트 노출**(Activity API)이었다. §6.3.1 서두에 채널을 명시하고,
>   REST 경로는 `2-api-convention.md §5.3`(원문 echo **무조건** 금지)이 **먼저** 적용됨을
>   못 박는다. 그 절을 실측 확인했다 — "내부 구현 원문을 echo 하지 않는다" 가 조건 없이 적혀 있다.
> - **#3 (기준 자체가 불충분했다)** — 가장 중요하다. `{ cause: err }` 가 붙이는 것은
>   **message 문자열이 아니라 `err` 객체 전체**다. `err` 가 message 밖에 부가 속성을 들고
>   있으면(pg 의 `detail`/`hint`/`where`, HTTP 응답 헤더 등) "message 가 원문을 포함한다" 가
>   참이어도 cause 부착이 **새 정보를 노출**한다. 원 기준은 그 축을 못 봤다 — `#814` 가
>   확립한 "필드가 아니라 raw content 가 판단축" 을 message 텍스트 하나로 근사한 셈이다.
>   → 기준을 **두 조건의 AND** 로 고친다.
> - **#4 (선행 plan 미인용)** — 위 블록으로 해소.

`#1219`(eslint 10 상향)이 켠 `preserve-caught-error` 룰에 대응하면서 **같은 룰에 두 가지
다른 처분**을 했다. 그 판별 기준이 지금은 **인라인 주석 3곳에만** 있고 정본이 없다.
`#1226` 리뷰가 이것을 INFO 로 짚었고, developer 권한 밖이라 planner 턴으로 넘어왔다.

### 무엇이 갈렸나 (실측, 2026-08-28)

| 위치 | 처분 | 근거 |
|---|---|---|
| `expression-resolver.service.ts:316` | `cause: err` **부착** | 감싼 message 가 이미 `err.message` 를 그대로 싣는다 (`Expression error in config.${path}: ${message}`) |
| `code.handler.ts:454` | `cause: err` **부착** | 위와 같음 (`code has a syntax error: ${message}`) |
| `secret-resolver.service.ts` | **비부착** (`eslint-disable`) | 감싼 message 가 원문을 **일부러 감춘다** (`'Secret decryption failed'`). crypto 에러 상세를 노출하지 않는 것이 그 자리의 목적 |

즉 판별 기준은 **"감싼 `message` 가 원본을 이미 담고 있는가"** 다. 담고 있으면 `cause`
부착이 새 정보를 노출하지 않는다. 담고 있지 않다면 그 비노출이 **의도**이므로 `cause` 를
달면 그 의도를 무효화한다.

### 왜 이 기준이 필요한가 — "서버 로그니까 안전" 은 오전제다

`#814`(SSRF 에러 메시지 일반화)에서 이미 반증됐다. 노드 에러는 Activity API 를 통해
사용자에게 노출되므로 "로그에만 남으니 괜찮다" 는 판단이 성립하지 않는다. `cause` 는
직렬화 여부가 소비처에 달려 있어 **지금 안전한 것이 계속 안전하지 않다** — 그래서 기준을
"현재 직렬화되는가" 가 아니라 **"message 가 이미 원문을 담고 있는가"** 로 잡는다. 후자는
소비처가 바뀌어도 불변이다.

실측 근거: `security`·`rationale_continuity` 두 리뷰어가 독립적으로 다운스트림을 추적해
`.cause` 를 직렬화하는 곳이 **0곳**임을 확인했다(`http-exception.filter.ts` 등). 즉 지금은
어느 쪽이든 노출되지 않지만, 위 이유로 기준은 message 쪽에 건다.

## 제안 — `spec/5-system/3-error-handling.md` §6.3 에 소절 신설

§6.3(민감 정보 마스킹) 아래에 `#### 6.3.1 에러 wrapping 시 `cause` 부착 기준` 을 넣는다.
그 절이 이미 "무엇을 노출하지 않는가" 를 다루므로 같은 자리가 맞다.

내용:

- **원칙**: `catch` 한 에러를 새 에러로 감쌀 때, 감싼 `message` 가 원본 `message` 를
  이미 포함하면 `{ cause: err }` 를 **부착한다**. 포함하지 않으면 그 비노출이 의도이므로
  **부착하지 않는다**.
- 비부착 시 `eslint-disable-next-line preserve-caught-error -- <사유>` 와 함께 **왜 감추는지**
  를 주석에 남긴다. 원본 상세는 `logger` 로만 남겨 운영 가시성을 확보한다.
- 판별을 "현재 `.cause` 가 직렬화되는가" 로 하지 않는 이유를 Rationale 에 적는다
  (`#814` 선례 — 소비처 기준은 시간이 지나면 무너진다).

Rationale 에는 위 §"왜 이 기준이 필요한가" 를 압축해 싣고, `#1219`/`#1226` 을 근거로 건다.

## 왜 `spec/conventions/` 가 아니라 여기인가

`#1226` 리뷰는 "`spec/conventions/secret-store.md` 또는 `error-codes.md`" 를 후보로 적었다.
셋 다 검토한 결과 **`3-error-handling.md` §6.3 이 맞다**:

- `secret-store.md` — 그 문서는 secret 저장/해소 계약이다. 이 기준은 secret 에 국한되지
  않는다(위 표의 두 부착 사례는 secret 과 무관).
- `error-codes.md` — 에러 **코드 문자열**의 SoT 다. `cause` 는 코드가 아니라 wrapping 정책이다.
- `3-error-handling.md` §6 — "로깅 레벨·민감정보 마스킹" 이 이미 그 문서의 선언 범위이고
  (§Overview 가 그렇게 적고 있다), CWE-209 고정 문구 결정도 그 Rationale 에 산다.
  **같은 원칙의 다른 적용**이므로 옆에 두는 것이 맞다.

## 체크리스트

- [ ] `/consistency-check --spec` 통과 (Critical 0)
- [ ] `spec/5-system/3-error-handling.md` §6.3.1 + Rationale 반영
- [ ] 인라인 주석 3곳이 이 절을 참조하도록 정리 — **본 draft 범위 밖**(코드 편집이라
      developer 턴). 정본이 생긴 뒤 후속으로 등재한다.
