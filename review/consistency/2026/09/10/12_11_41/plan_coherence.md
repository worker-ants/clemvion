# Plan 정합성 검토 — `spec-draft-ws-protocol-intro.md`

대상: `plan/in-progress/spec-draft-ws-protocol-intro.md` (spec_impact: `spec/5-system/6-websocket-protocol.md`)
모드: `--spec` (spec draft 검토)

> **주의**: 검토 도중 target 파일이 디스크에서 갱신됐다 (작성자가 §3.2/§6.2/§7.1 자기 대조 +
> `cross_spec` 회신으로 도입문 6곳을 self-correct — 새 절 "초안을 여섯 군데 고쳤다" 추가,
> Overview 본문 갱신, 링크 3건→4건, 체크리스트에 `#overview` 앵커 충돌 확인 항목 추가). 아래는
> **갱신된 최신 버전**을 기준으로 측정·판정했다.

## 점검 항목별 확인 결과

### 1. 스코프 일치 — "두세 줄 도입문" vs 실제 3-paragraph 산출물

트래커 원문(`spec-draft-nullable-notation-followups.md` "`6-websocket-protocol.md` 도입 산문" 항목,
2026-09-05 등재)을 그대로 인용한다:

> `6-websocket-protocol.md` 도입 산문 (planner, 2026-09-05 등재). 위 실측에서 개요 내용이
> **실제로 없는** 두 문서 중 남은 하나. `## 1. 연결` 로 바로 시작한다. 그 문서를 다음에 열 때
> **두세 줄 도입문**을 넣는다 — **형태는 그 문서 관행을 따르면 되고**, `## Overview` 헤딩이어야
> 할 이유는 없다(위 실측 참조).

문구만 보면 "두세 줄"과 draft 의 3-paragraph 산출물은 어긋나 보이지만, **실측 결과 후자의
클로즈("형태는 그 문서 관행을 따르면 되고")가 licensing 조항**이고, 실제로 전자의 문구는
이미 이 저장소의 집행 관행에서 지켜진 적이 없다:

| 문서 | 처리 시점 | 단락 수 | 순내용 문자수(줄바꿈 제외) |
|---|---|---|---|
| `2-api-convention.md` (같은 2026-09-05 처분에서 이미 집행, `983fd0ade`) | 완료 | 2 | 686 |
| `4-execution-engine.md` (기존 관행 문서, draft 가 "내부 계약" 자매로 지목) | 기존 | 3 (prose+list+note) | 1,514 |
| `3-error-handling.md` (기존 관행 문서, 같은 자매) | 기존 | 2 | 1,742 |
| **`spec-draft-ws-protocol-intro.md` 의 산출물 (최신본, 자기 정정 후)** | 제안 | 3 | **1,353** |

draft 는 자기 자신을 `## Overview` 순수 표기를 쓰는 두 "내부 계약" 문서(`4-execution-engine`·
`3-error-handling`) 자매로 명시적으로 분류했는데(제목 표기 선정 근거), 최신본(1,353자)은 그
두 문서의 실측 길이(1,514·1,742자) 범위에 **정확히 들어간다** — 자기 정정 전 초판(957자)보다도
그 자매 범위에 더 가까워졌다. 반대로 문자 그대로 "두세 줄"을 지킨 선례는 없다 — 같은 턴에
집행된 `2-api-convention.md` 조차 6개 wrapped 소스 줄·2단락(686자)로 이미 "두세 줄"을
넘어섰다. 또한 대상 문서(`6-websocket-protocol.md`) 자신의 본문 산문은 문단당 한 줄에
800~2,000자에 이르는 무-wrap 스타일이라(예: §1 「전송 계층」 註 890자 1줄), draft 의
3-paragraph/1,353자는 그 문서의 밀도 관행에 부합한다.

**판정**: over-delivery 로 trim 할 사안이 아니다 — "형태는 그 문서 관행을 따르면 됨" 조항이
명시적으로 이를 허용하고, 실측 선례 범위(686~1,742자, 2~3 단락)가 draft 산출물을 정확히
포괄한다. "두세 줄"이라는 원문구는 이 저장소의 실제 집행 관행보다 좁게 쓰인 것으로 보이며,
이는 트래커 항목 자체의 표현 정밀도 문제이지 draft 의 스코프 위반이 아니다.

### 2. 2026-09-05 처분 재개봉 여부 + `2-api-convention.md` 완료 확인

`spec-draft-nullable-notation-followups.md` 의 "`spec/5-system/` 의 `## Overview` 유무 불일치"
항목(`[x]` 완료 표시)을 직접 확인했다. 그 처분은:

- (a) "6개 파일에 로컬 Overview 추가" — **기각** ("규칙 카탈로그형 문서에 제목만 얹고 아래 새
  내용이 없으면 소음")
- (b) "`project-planner/SKILL.md` 에 현 상태를 규약으로 인정" — **기각** (SKILL.md 는 planner
  쓰기 권한 밖 + 해당 문장이 이미 존재)
- **실제 처분**: 그 턴이 이미 여는 `2-api-convention.md` 에만 추가, `6-websocket-protocol.md`
  는 별도 항목으로 재등재.

`2-api-convention.md` 는 `983fd0ade`(#1289, 2026-09-05)에서 실제로 `## Overview (제품 정의)`
+ 2단락이 추가된 것을 `git show 983fd0ade -- spec/5-system/2-api-convention.md` 로 직접
확인했다 — draft 의 서술과 일치한다. draft 의 "무엇을 하지 않나" 절은 (a)/(b) 둘 다 기각한
결정을 그대로 인정하고 "그 결정을 다시 열지 않는다"고 명시하며, 실제 변경안도 오직
`6-websocket-protocol.md` 하나(spec_impact 도 하나)로 국한돼 있다. **재개봉 없음 — 확인.**

### 3. `harness-review-gate-followups.md` 정정 분리(PR #1305) 계정 검증

draft 는 이 브랜치가 원래 `harness-review-gate-followups.md` 의 산술 정정(바이트/문자 혼동)도
함께 담고 있었는데, 그 상태로 `--spec` 을 준비하니 그 트래커가 거론하는 spec 6개가 전부 tier 1
로 승격돼 대상 문서가 예산 밖으로 밀렸고, 정정을 단독 PR(`#1305`)로 분리했다고 적었다.

`git log`/`git show` 로 직접 확인:

- `origin/main` 최신 커밋 `c7ccdb9c7` = **"docs(plan): 바이트를 자로 읽어 진단을 틀렸다 —
  어제 등재한 번들 예산 항목 산술 정정 (#1305)"** — draft 가 인용한 PR 번호·내용과 정확히
  일치.
- 그 커밋의 diff 는 `plan/in-progress/harness-review-gate-followups.md` **단독** 변경
  (56 insertions/10 deletions), `codebase/`·`spec/` 변경 0건 — draft 의 "게이트: `codebase/`
  변경 0건, `spec/` 변경 0건" 서술과 일치.
- 커밋 본문 자체가 "이 정정은 원래 `6-websocket-protocol.md` 도입 산문 브랜치에 얹혀 있었는데
  … 무관한 두 변경을 분리하니 그 오염도 함께 사라진다" 고 명시 — draft 의 계정을 원본 커밋이
  직접 뒷받침한다.

**분리로 인해 반쪽 상태가 된 것은 없다.** 그 harness 항목 자체("승격은 됐는데 굶는다")의 실제
처방 선택((a) 파일당 상한 / (b)… / (c)… / (d) greedy fill 중 택일)은 여전히 미결이지만, 이는
분리 **이전부터** 존재하던 별개의 미해결 결정이며 이번 분리 작업이 만들어낸 반쪽짐이 아니다 —
분리는 정확히 "정정(완료)"과 "처방 선택(미결)"을 갈랐을 뿐이고, draft 의 체크리스트도 그 배경
링크만 인용할 뿐 처방 결정을 대신 내리려 하지 않는다.

### 4. `6-websocket-protocol.md` 를 건드리는 다른 in-progress plan

`grep -rl "6-websocket-protocol" plan/in-progress/` 로 11개 파일을 찾았다. 전수 확인 결과:

- `spec-update-node-cancellation-shutdown-classification.md`, `ws-token-expired-socket-lifetime-impl.md`,
  `eia-terminal-payload.md`, `spec-sync-external-interaction-api-gaps.md`,
  `spec-draft-eia-62-waiting-payload.md`, `ie-resume-turn-boundary-cancel.md`,
  `spec-draft-eia-notification-payload-contract.md`, `execution-engine-residual-gaps.md`,
  `backend-lint-gate-broken-on-main.md` — **전부 §1~§9 번호 섹션 본문**(§4.1/§4.2/§4.4 이벤트
  페이로드, replay/cancel 서술 등)을 인용하거나 수정 대상으로 삼는다. draft 가 삽입하려는
  위치(`---` 와 `## 1. 연결` 사이, 번호 밖 `## Overview`)를 건드리거나 그 자리의 소유권을
  주장하는 plan 은 **없다.** 번호 섹션 자체를 이동/개편하려는 계획도 없어 draft 의 "번호 앵커
  116건 무변경" 전제와 충돌하지 않는다.

- 다만 **교차 참조 누락을 하나 발견했다** — 아래 발견사항 참조
  (`spec-sync-external-interaction-api-gaps.md` 의 앵커 가드 미결 항목).

### 5. Gate C — `spec_impact`

frontmatter:
```yaml
spec_impact:
  - spec/5-system/6-websocket-protocol.md
```
YAML 리스트 형식(bare string 아님, Gate C 통과 조건)이며 항목이 정확히 하나다. 대상 파일
`spec/5-system/6-websocket-protocol.md` 실재를 확인했다(frontmatter `status: implemented`).
draft 본문 전체(`grep -n "spec/" spec-draft-ws-protocol-intro.md`)를 훑어도 이 파일 외에
실제로 편집을 제안하는 두 번째 spec 파일은 없다 — `spec/5-system/` 일반 언급은 "나머지 표기
분열을 통일하지 않는다"는 **비목표** 서술뿐이고, 최신본 체크리스트가 추가한 4번째 링크
(`./3-error-handling.md`)도 **인용 링크**일 뿐 편집 대상이 아니다. **일치 — 문제 없음.**

### 6. `plan/complete/archive/` 의 stale 앵커 2건 방치 — lifecycle 규칙과의 정합성

draft 는 `from-followup-conversation-reconcile/spec-draft-conversation-reconcile-doc.md` 가
인용하는 `#44-실행-진행-이벤트`(현재 헤딩은 `### 4.4 사용자 입력 대기 이벤트 상세` 로 개명돼
실재하지 않음)를 발견했으나, "1회성·역사 문서 보관" 구역이므로 사후 개작하지 않는다고 적었다
(이 불릿은 target 파일 개정 전후로 문구가 동일하다).

`.claude/docs/plan-lifecycle.md` §1 을 확인한 결과, 그 문서는 archive 에 대해 **"옛 memory/·
user_memo/ 의 1회성·역사 문서 보관. 신규 생성 금지"** 만 규정한다 — 기존 archive 문서를
사후에 고쳐도 되는지/안 되는지에 대한 **명시 규칙은 없다.** 유일한 관련 언급(§3)은 push-gate
맥락에서 "`plan/complete/` 로 이동(archive 제외)"만 완료-이동으로 인정한다는 것뿐, 내용 편집
가부와는 무관하다. 따라서 draft 의 "역사 기록으로서 당시 인용이 맞다 → 사후 개작 안 함"은
**명문 규칙의 직접 인용이 아니라 archive 의 보관 취지에서 끌어낸 합리적 추론**이다 — 틀렸다고
할 근거는 없지만, lifecycle 문서가 이 경우를 명시적으로 다루지는 않는다는 점은 적어 둔다.

그런데 이 사안은 **plan-lifecycle 해석 문제로 끝나지 않는다** — 아래 발견사항 참조.

---

## 발견사항

- **[WARNING]** archive 앵커 방치 결정이 다른 in-progress plan 이 이미 등재한 **미해결 결정**과
  같은 사실관계를 다루면서 교차 참조 없이 독자적으로 답을 내리고 있다
  - **target 위치**: `plan/in-progress/spec-draft-ws-protocol-intro.md` §"무엇을 하지 않나"
    마지막 불릿 ("`plan/complete/archive/` 의 stale 앵커 2건은 고치지 않는다…")
  - **관련 plan**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 미해결
    체크리스트 항목 "`spec-links` 가드가 앵커를 검사하지 않는다" (2026-08-31 등재)
  - **상세**: 두 plan 이 **정확히 같은 두 앵커**(`#44-실행-진행-이벤트` → 존재한 적 없는 헤딩,
    `from-followup-conversation-reconcile/spec-draft-conversation-reconcile-doc.md` 내
    2줄)를 "선재 결함"으로 각각 독립적으로 언급한다. `spec-sync-external-interaction-api-gaps.md`
    쪽은 이를 명시적 **미해결 결정**으로 남겨 두었다 — *"범위 주의: 앵커 검사를 켜면 위 2건을
    포함한 선재 위반이 한꺼번에 드러난다. `plan/complete/archive/**` 를 검사 대상에서 뺄지부터
    **정해야 착수할 수 있다**."* 즉 "archive 를 앵커 가드 스코프에서 뺄 것인가"는 아직 답이
    나지 않은 질문으로 그 plan 에 등재돼 있다.

    이번 draft 는 그 plan 을 인지하거나 인용하지 않은 채, "역사 문서는 사후 개작하지 않는다 +
    가드가 spec/ 만 훑으므로 main 은 green" 이라는 자체 근거로 **사실상 같은 질문에 답**(archive
    는 그대로 둔다)을 내리고 있다. draft 자신의 행동(2건을 고치지 않음)은 스코프 밖 파일을
    건드리지 않는다는 점에서 정당하지만, 그 **근거 서술**이 다른 곳의 명시적 미결 항목을
    선점하는 형태로 남으면, 다음에 `spec-sync-external-interaction-api-gaps.md` 의 그 항목을
    집행할 사람이 "이미 다른 곳에서 결정됐다"고 오인하거나, 반대로 이 draft 의 서술을 못 보고
    독자적으로 반대 결론(archive 포함)을 낼 위험이 있다 — 결정이 두 곳에서 암묵적으로 갈릴 수
    있는 구조다.
  - **제안**: `spec-draft-ws-protocol-intro.md` 의 해당 불릿에
    `spec-sync-external-interaction-api-gaps.md` 의 앵커 가드 항목을 교차 참조로 추가하거나
    (또는 반대 방향으로 그 plan 의 항목에 이 draft 의 판단을 메모), 두 plan 이 같은 근거를
    공유하고 있음을 명시한다. **"archive 를 검사/수정 대상에서 뺄지"라는 결정 자체를 이 draft
    가 다시 열 필요는 없다** — 그 결정의 소유권은 `spec-sync-external-interaction-api-gaps.md`
    에 있다. 필요한 것은 교차 참조뿐이다.

- **[INFO]** 트래커 항목의 "두세 줄" 표현이 실제 집행 관행(686~1,742자, 2~3 단락)보다 좁게
  쓰였다
  - **target 위치**: draft 상단 인용 항목 및 "변경안 > 본문"
  - **관련 plan**: `spec-draft-nullable-notation-followups.md` "`6-websocket-protocol.md`
    도입 산문" 항목
  - **상세**: 위 "점검 항목별 확인 결과 §1" 참조. draft 의 3-paragraph/1,353자 최신 산출물은
    이 문서가 스스로 분류한 자매 문서(`4-execution-engine`·`3-error-handling`, 1,514~1,742자)
    범위 안에 든다 — 같은 처분 턴에 집행된 `2-api-convention.md`(686자)보다는 크다. 실측
    선례 범위 안이다. 트림 불필요.
  - **제안**: 조치 불요. 다음에 유사 항목을 등재할 때는 "두세 줄" 대신 "그 문서 관행에 맞는
    길이"로만 적어 문구-실제 괴리를 줄이는 것을 권고(선택 사항).

## 요약

`spec-draft-ws-protocol-intro.md` 는 2026-09-05 처분(archive 항목 (a)/(b) 기각 + 두 진짜
빈 문서만 채우기)을 재개봉하지 않고, `2-api-convention.md` 완료 사실과 harness 예산 오염 분리
(#1305)에 대한 계정도 origin/main 실측과 정확히 일치한다(검토 중 draft 자신이 도입문 6곳을
self-correct 했으나 이 두 사실관계는 개정 전후로 변하지 않았다). spec_impact 는 단일 파일로
Gate C 를 충족하고, 다른 in-progress plan 들은 본문 번호 섹션만 건드려 draft 의 삽입 위치·번호
무변경 전제와 충돌하지 않는다. "두세 줄" 문구와 3-paragraph 산출물의 불일치는 트래커 항목
자신의 licensing 조항과 실측 선례 범위로 흡수되는 INFO 수준이다. 유일한 실질 이슈는 archive 내
stale 앵커 2건 방치 근거가 `spec-sync-external-interaction-api-gaps.md` 에 이미 등재된 **명시적
미해결 결정**(archive 를 앵커 가드 스코프에서 뺄지)과 같은 사실관계를 다루면서도 교차 참조가
없다는 점이다 — 결정 자체를 뒤집을 필요는 없지만 두 plan 이 서로를 모른 채 같은 질문에 답하고
있어 WARNING 으로 등재한다.

## 위험도

LOW
