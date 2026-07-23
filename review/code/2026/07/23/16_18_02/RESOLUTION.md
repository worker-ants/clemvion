# RESOLUTION — review/code/2026/07/23/16_18_02

대상: branch `claude/presentation-previousoutput-spec-drift-e74b2f` (base `origin/main`).
리뷰 시점 마지막 커밋 `ffaa5e506`.

SUMMARY 판정: **RISK=HIGH / CRITICAL=2 / WARNING=2 / INFO=2**. forced 2/2(documentation·requirement)
전원 결과 확보.

> `summary_written=false`(write_blocked) 라 main 이 `SUMMARY.md` 를 직접 Write. reviewers[](2) vs
> 디스크 리포트(2) 대조 — 누락 0.

## CRITICAL 2건 — **내가 이 PR 에서 새로 만든 사실 오류다** (전량 반영)

이 PR 은 `previousOutput` "폐기" 오기재를 고치려는 것이었는데, **Form 에 대해 정반대 방향의 새
오류를 도입**했다. 리뷰어 지적을 실측으로 재확인했고 **전부 맞다**:

| 검증 | 결과 |
|---|---|
| `FormInteractionService` 가 `previousOutput` 을 주입하는가 | **아니오** — 파일 전체 등장 **0건**. 재개 출력은 `{ config, output: { interaction }, status:'resumed', port:'out', meta? }` 뿐 (`form-interaction.service.ts:254-266`) |
| Form 이 `ButtonInteractionService` 경로를 타는가 | **아니오** — `4-form.md` 의 `buttons` 언급 **0건**. `config.buttons` 자체가 없어 도달 불가 |
| SoT 인 `node-output.md:194` 의 예외 스코프 | **carousel / chart / table / template** — **form 이 애초에 없다** |

→ `4-form.md` 의 **원래 "금지 필드" 서술이 옳았고**, 내 "지금도 주입한다" 캐비어가 틀렸다.
0-common 의 패턴을 Form 실동작 확인 없이 복사한 것이 원인이다.

| # | 조치 |
|---|---|
| CRITICAL 1 | `4-form.md` — `output.previousOutput` 을 **금지 필드 목록으로 원복**. 추가로 "§4.2 과도기 예외는 Form 에 해당 없음 — `FormInteractionService` 가 주입하지 않으므로 완전한 금지 필드" 를 명시해 같은 오독이 재발하지 않게 했다 |
| CRITICAL 2 | sibling `plan/in-progress/node-output-redesign/form.md` — 동일하게 원복 + "Form 은 해당 없음(예외는 carousel/chart/table/template 전용)" 병기 |

## WARNING 2건 (전량 반영)

| # | 내용 | 조치 |
|---|---|---|
| 1 | `node-output-redesign/README.md:263` 이 문장 안에서 자기모순 — 인라인 캐비어와 결론부 "모두 … 반영 완료" 가 상충 | **반영** — 인라인 캐비어를 제거해 목록을 원상 복구하고, 결론부 뒤에 예외를 **별도 문장**으로 분리("단 `previousOutput` 은 예외 — … Form 은 해당 없음"). `chart.md`/`form.md` 와 같은 "목록 분리 + 각주" 패턴으로 통일 |
| 2 | `0-common.md` 공통 캐비어가 서비스명만 적고 **적용 범위를 안 밝혀** 하위 문서 저자가 Form 까지 확대 적용 (= CRITICAL 1 의 직접 원인) | **반영** — 캐비어에 "**적용 범위 — `config.buttons` 를 갖는 노드 전용**(carousel/chart/table/template) · **Form 은 해당 없음**" 단락 추가. 재발 방지 지점을 공통 문서에 둔다 |

## INFO 2건

| # | 내용 | 조치 |
|---|---|---|
| 1 | plan draft 의 예시 상대경로가 2단계(`../../`)로 얕음 — 실제 적용본은 3단계라 커밋 파일엔 미전파 | **반영** — draft 예시를 `../../../spec/conventions/node-output.md#42-폐기할-필드--구조` 로 정정 |
| 2 | "transitional legacy" 표현이 코드 주석/규약/chart 에서 조금씩 다름 | **미조치** — 리뷰어가 "필수 아님, SoT anchor 로 값 도메인 일원화되어 실질 혼선 낮음" 으로 판정 |

## 확인됨 — 유지 (리뷰어가 line-level 로 정확성 확인)

`0-common.md` 캐비어(범위 추가 후) · `3-chart.md:230-232`·`:275` · 동반 정정 A(Continuation Bus 6종) ·
동반 정정 B(`processAiResumeTurn` / no-op park)는 실측 코드와 일치. **Chart 는 실제로 `config.buttons`
를 지원해 `ButtonInteractionService` 경로를 타므로 `previousOutput` 주장이 정확**하다.

## 검증

- docs 가드 **18 files / 2658 passed** (`spec-link-integrity` 포함).
- Form 배제 근거 실측 재확인: `grep -c previousOutput form-interaction.service.ts` → **0**,
  `grep -c buttons 4-form.md` → **0**, `node-output.md:194` 열거에 form 부재.
- 코드 변경 0줄 (spec/plan/review 문서만) → 테스트·e2e 불요.

## 교훈 (plan §Rationale 에도 기록)

**공통 문서의 캐비어를 하위 문서로 복사할 때는 그 하위 노드가 실제로 그 경로를 타는지 확인해야
한다.** 이번엔 "presentation resume 경로" 라는 뭉뚱그린 표현을 Form 에 그대로 적용해 정반대 사실을
단정했다. `node-output.md:194` 가 이미 스코프를 열거하고 있었는데도 그 열거를 대조하지 않은 것이
근인이다 — **고치려던 오류와 같은 클래스의 오류를 반대 방향으로 만든 셈**이다.
