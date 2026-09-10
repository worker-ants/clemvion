# Consistency Check 통합 보고서 — `--spec` **1라운드**

**BLOCK: YES** (Critical **4** · Warning **9**) → 전면 개정 후 2·3라운드로 해소

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.

**대상**: `plan/in-progress/spec-draft-chat-channel-patch-token.md` (planner 턴)
**후속 라운드**: `20_29_00`(2R, BLOCK: YES) → `20_47_53`(3R 확인 전용, **Critical 0 / Warning 0**)

## 집계 (헤딩 기준 실측)

| Checker | Critical | Warning |
|---|---|---|
| `cross_spec` | 1 | 2 |
| `rationale_continuity` | 1 | 2 |
| `convention_compliance` | 1 | 1 |
| `plan_coherence` | 0 | 3 |
| `naming_collision` | 1 | 1 |
| **합계** | **4** | **9** |

> **개수는 `grep -c` 가 아니라 헤딩으로 셌다.** 태그 문자열은 각 리포트의 요약 문단에도 나와
> 단순 카운트가 부풀려진다 — 이 세션에서 개수를 반복해 틀린 자리라 방법을 바꿔 적어 둔다.

## CRITICAL — 한 사안, 다섯 checker 가 전원 지목

**신설하려던 Rationale 번호 `R-CC-21`(초안은 `R-CC-17`)이 이미 점유돼 있었다.**
`15-chat-channel.md:689` 의 `R-CC-17. render_form v1 임시 텍스트 fallback` 이고,
`conventions/chat-channel-adapter.md:382` 가 그 anchor 를 인용한다. 반영됐으면 같은 문서에 같은 ID 로
무관한 결정 둘이 공존하고 교차 링크가 깨졌다.

**등급까지 만장일치는 아니었다** — 넷이 `[CRITICAL]`, `plan_coherence` 는 *"target 내부 ID 공간
충돌"* 이라는 이유로 `[WARNING]` 으로 매겼다. (이 구분은 3라운드 `rationale_continuity` 가 내 부정확한
서술을 잡아 정정한 것이다.)

**원인은 내 쪽이 명확하다 — 시퀀스를 세지 않고 골랐다.** `convention_compliance` 가 `git log -S` 로
**14 가 실제로 존재했다가 철회된 영구 결번**임을 찾아(`f4640ff2d`→`841d6cfb8`) 이 저장소가 결번을
재사용하지 않는 관례임을 확인했고, 그래서 다음 번호는 **21** 이다.

## Warning 9건 — 전부 내 근거·처분이었고, spec 편집 내용은 하나도 지적받지 않았다

사안 단위로 묶으면 7건(+ INFO 1건을 반영 대상에 포함해 draft 의 처분 표는 8행이다).

| 사안 | checker | 처분 |
|---|---|---|
| *"형제 세 필드를 전부 400 으로 막고 있다"* — **slack/discord 는 부재가 400** 이고 값이 있으면 통과·회전한다 | `rationale_continuity` W2 | **규칙을 `inboundSigningPlaintext` 까지 통일**(변경안 C). 구조가 같은 **두 번째 우회**를 이 턴에서 함께 닫는다 |
| *"형제가 `details.field` 규약을 이탈"* — `@IsEmpty()`+전역 파이프라 **거꾸로일 가능성** | `cross_spec` W1 · `convention_compliance` W1 · `naming_collision` W1 | 필드 경로를 이 턴에 **규정하지 않고** e2e 실측 후속으로. 표의 그 칸에는 placeholder |
| D-2 의 선례(§5.4.1 표 2행)가 **현재 구현에서 발생하지 않을 수 있다** | `cross_spec` W2 | 인용 삭제. 행 정확성은 후속 |
| R-CC-10 본문이 확장을 모른 채 남는다(단방향 인용) | `rationale_continuity` W1 | 변경안 F(전방 포인터) 신설 |
| 트래커 처방문이 D-2 없이 *"developer 수정 대기"* 로 남아 있다 | `plan_coherence` W1 | 본문 직접 수정으로 갱신(2R·3R 확인) |
| 후속을 *"등재한다"* 고 **선언만 했다** | `plan_coherence` W2 | **2R 에서 이 처분마저 거짓으로 판명** — 실제 등재는 그 뒤에 했다 |
| `R-CC-17` 충돌 | `plan_coherence` W3 | 위 CRITICAL 과 같은 사안 |

## 이 라운드가 막은 것

**spec 에 한 글자도 쓰기 전이었다.** CRITICAL 은 교차 링크를 깨뜨렸을 것이고, Warning 중 둘은
**내 전제가 틀렸다는 것**을 알려 이 턴의 범위 자체를 바꿨다(두 번째 우회 발견 · 필드 경로 유예).
수정 비용은 0 이었다.
