# Consistency Check 통합 보고서 — 라운드 2 (타겟 재검증)

**BLOCK: NO**

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.

**성격**: 이 세션은 **의도적으로 2명만** 돌렸다. 라운드 1(`12_11_41`)이 5/5 를 돌려 Critical 2건
(동일 사안 §6.2)·Warning 4·INFO 10 을 냈고, 그 전부를 반영한 뒤 **Critical 을 올린 두 checker**
(`cross_spec`·`convention_compliance`)에게만 정정 검증을 맡겼다. 나머지 3명(`rationale_continuity`·
`plan_coherence`·`naming_collision`)은 라운드 1 에서 Critical 0 이었고 그 지적은 전부 반영됐다.

> `_retry_state.json` 은 그 3명을 `pending` 으로 남긴다 — **부분 세션임을 숨기지 않기 위해 그대로
> 둔다.** 이 세션의 `BLOCK: NO` 는 "5개 관점 전부 재검토했다" 가 아니라 **"라운드 1 의 Critical 이
> 해소됐다"** 는 뜻이다.

## 집계

| Checker | 위험도 | Critical | Warning | INFO |
|---|---|---|---|---|
| `cross_spec` | **NONE** | 0 | 0 | 1 |
| `convention_compliance` | LOW | 0 | 1 | 2 |
| (3명 미실행 — 라운드 1 에서 Critical 0) | — | — | — | — |

Critical 0 → `BLOCK: NO`.

## 라운드 1 Critical 해소 — 확인됨

**정정 전**: *"놓친 이벤트는 `seq` 기반으로 복구한다(§6.2)."*
**정정 후**: *"끊긴 동안 놓친 것은 재구독 시 **1회성 `execution.snapshot`** 으로 재동기화한다(§6.2)
— `seq` 기반 replay 버퍼는 **native WS 에 없다**(SSE 어댑터 소유, §4.7)."*

`cross_spec`: §6.2 두 문단·§4.7 「핵심 규약」·`## Rationale`「재연결 복구」와 **자구 수준까지 일치**
하며 *"native WS 가 seq 로 replay 한다고 오독할 여지가 없다 — 문장이 명시적으로 부정하고 소유 주체
까지 적었다"*. `convention_compliance`: **재도입 없음** 확인.

라운드 1 의 나머지 검증도 함께 재확인됐다 — §3.2 채널 5종 일치 · EIA 3표면 자기일치 ·
§4.6 두 갈래(비채택/구현 완료) 정확 · 에러 3분할 정확(`3-error-handling.md §1.5` 제목이 실제로
"WS commands 에러 코드") · 헤딩 카운트 9/3 · 앵커 96건·13종 축자 일치 · **116 은 어느 스코프에서도
재현 불가**(96/98/132/228 로 시도).

## 라운드 2 신규 지적 3건 — 전부 반영

| Checker | 등급 | 지적 | 처분 |
|---|---|---|---|
| `convention_compliance` | WARNING | 내용 기반 판별 기준이 3개는 구제하지만 **9개 쪽으로 되짚으면 깨진다** — `2-api-convention.md` 는 접미사를 달고도 그 Overview 가 `1-auth.md` 와 문형·추상도가 같다 | **주장 범위를 좁혔다.** 기준은 "이 문서의 선택이 옳다" 까지만 지지하고, 9/3 분열은 *"어느 단일 기준으로도 완전히 설명되지 않고 상당 부분 역사적 비일관성"* 이라고 적었다. Rationale 항목의 마지막 문장도 같은 폭으로 좁혔다 |
| `convention_compliance` | INFO | `review/` 인용 수치는 **원리적으로 낡는다** — 재검증 시점엔 132(합 228). consistency 라운드마다 그 라운드 산출물이 같은 앵커를 새로 인용한다 | 표에서 **정수를 지웠다.** "빼는 판단은 옳았는데 뺀 값에 숫자를 적은 것" 이 잘못이었다 |
| `convention_compliance` | INFO | `## Rationale` 삽입 위치 미명시 (강제 규약은 없음) | **말미**로 명시. 그 절 19개 항목이 연대순이 아니라 추가 순으로 쌓였음을 실측해 근거로 적었다 |
| `cross_spec` | INFO | `(여러 명령이 "외부 미노출")` — 그 문자열은 문서에 **1건**뿐(`execution.retry_last_turn`). 다른 행은 `외부 미지원`(2)·`해당 없음`(3) | 인용을 라벨 3종 + **이벤트 표 12행의 `—`** 로 교체. 비대칭 결론은 오히려 강해졌고, 문제는 **한 라벨을 인용부호에 넣고 복수로 일반화**한 것이었다 |

## 검증 절차 기록 — 번들이 대상을 또 떨궜고, 직독으로 갈음했다

라운드 2 준비에서 `cross_spec` 이 대상 문서를 **예산 1,500,000 에서도** 생략했다. 원인은 tier-1
오염이다 — 이 브랜치가 편집한 트래커(`spec-draft-nullable-notation-followups.md`)가 거론하는 spec 이
전부 tier 1 로 올라오고, 그중 `4-integration.md` 하나가 156,132자다. 대상까지 담으려면 누적
911,639자 → 예산 ~2,300,000(프롬프트 5개가 각 ~1.3MB)이 필요했다.

**타겟 재검증에 그 비용은 과하므로 직독을 지시했다.** 두 checker 모두 어느 파일을 열었는지 리포트에
명시했고, `cross_spec` 은 §1·§3.2·§4.1·§4.5~§4.7·§5·§6.1~§6.2·§7.1~§7.2·§8·`## Rationale` 전수를,
`convention_compliance` 는 대상 + `1-auth`·`3-error-handling`·`4-execution-engine`·`2-api-convention`
+ `SKILL.md` 를 열었다.

**이 오염 자체를 신규 항목으로 등재했다** — 한 세션에서 **4회** 관측됐고, 기제는
*"tier 1 = 이 브랜치가 건드린 plan 이 이름을 언급함"* 인데 **planner 턴은 트래커를 편집하는 것이
정상 워크플로**라는 것이다. 즉 정상 절차를 밟을수록 게이트가 눈이 먼다. 예산 상향은 이 세션에서
네 번 시도했고 **손계산이 두 번 틀렸다**.

## 적용 결과 (spec 반영 후 실측)

- **번호 heading 36개 전부 무변경** (삽입 전/후 `^#{2,4} [0-9]` 목록 대조) → 13종 96건 인용이
  하나도 깨지지 않는다.
- `## Overview` **4단락 1,767자**. 자매 범위의 **상단** — 최대치(`3-error-handling.md` 1,742)를
  25자(1.4%) 넘는다. "범위 안" 이라 적지 않았다.
- 링크 5건 전부 실재 (Overview 4 + Rationale 항목의 `../../.claude/skills/project-planner/SKILL.md`).
- `#overview` 앵커 충돌 0 · 기존 `…#overview` 인용 0.
