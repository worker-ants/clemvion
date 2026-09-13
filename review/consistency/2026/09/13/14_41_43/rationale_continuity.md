# Rationale 연속성 검토 — `spec/conventions/` (impl-done)

## 스코프 판단

`git diff origin/main...HEAD --stat` 실측: **`spec/conventions/**` 델타 0개 파일.** 이번 PR
(`#1331`, `guide-error-code-existence` → `guide-identifier-existence` 확장)은 spec 을 고치지
않았다 — 변경은 `codebase/frontend/src/lib/docs/__tests__/{guide-identifier-scan.ts,
guide-identifier-existence.test.ts}`(신규, 구 `guide-error-code-*` 대체) · `PROJECT.md` · 두 개
`plan/` 문서에 국한된다. 따라서 이번 검토는 "target(spec/conventions) 자체가 자기 Rationale 을
어겼는가" 가 아니라 **"이번 코드 변경이 기존 spec Rationale 이 세운 원칙과 충돌하는가"** 를
본다.

같은 스코프의 직전 라운드(`review/consistency/2026/09/13/12_33_41/rationale_continuity.md`,
--impl-prep)가 이미 핵심 지점 하나를 WARNING 으로 잡았다. 아래는 그 지점이 impl-done 시점에도
**해소되지 않았음**을 재확인하고, 이번 구현 diff 로 상태가 어떻게 바뀌었는지(악화/개선/불변)를
판정한다.

## 발견사항

- **[WARNING]** "허용목록 없음" 원칙의 번복이 여전히 spec `## Rationale` 밖에 머문다 — impl-prep 지적이 impl-done 시점에도 미해소
  - target 위치: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (3건)" 표) —
    이 PR 이 리네임·확장한 `guide-identifier-existence.test.ts`(구 `guide-error-code-existence`)
    가 여전히 이 표에 없다. `PROJECT.md` 는 이번 diff 에서 이 가드 줄을 "SoT:
    `spec/conventions/user-guide-evidence.md §2`" 라고 갱신했는데(`git diff` 확인), 그 SoT
    문서 자체는 이번에도 안 바뀌어 그 인용이 가리키는 대상이 여전히 없다.
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D`("**전수 열거(82종) +
    허용목록도 검토했고 기각했다** … backend-only 기준집합이 옳은 것은 대상이 에러 코드일 때뿐이다",
    "탈출구를 만들지 않는다 … 허용목록을 미리 파 두면 '…' 로 오늘의 결함이 다시 들어온다").
    이 결정은 **spec Rationale 이 아니라 완료된 plan 문서**에 살아 있다 — 그 자체가 이미
    직전 라운드가 지적한 구조적 공백이다.
  - 상세: 이번 PR(`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단
    주석, `plan/in-progress/guide-identifier-existence.md §C`)이 그 "허용목록 없음" 을
    **실측 근거를 갖춰 명시적으로 뒤집는다** — 문맥으로 좁힌 판이 이 가드를 만들게 한 과거
    결함(`MCP_INSECURE_URL_ALLOWED`)을 못 잡는다는 것을 재현 테스트로 증명하고,
    `GUIDE_EXTERNAL_VOCABULARY` 4강제(외부 시스템 이름 의무·상한·인용 여부 단언·기준집합
    부재 단언)로 은폐 위험을 낮췄다. **결정 자체는 무근거 번복이 아니다** — 코드 JSDoc 과
    plan 문서 양쪽에 왜 뒤집었는지가 상세히 남아 있다. 문제는 이 근거가 **CLAUDE.md 가 정한
    자리**(해당 spec 문서 끝 `## Rationale`)로 승격되지 않았다는 것이다. developer 는 이
    사실을 스스로 인지하고 있고(plan frontmatter: "`user-guide-evidence.md §2` 등재는
    필요하고 **developer 권한 밖**"), `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 가 그대로 옮겨 쓸 수 있는 수준의 Rationale 초안을 남겼다(diff 확인 —
    "함께 등재할 Rationale: `#1330` 이 세운 '허용목록 없음' 원칙을 `#1331` 이 실측으로
    번복했다 … 표·frontmatter·Rationale 을 한 턴에 처리해야 표가 두 번 미완결이 되지
    않는다"). **절차는 옳다** — developer 는 spec 을 쓸 권한이 없고, 여기서 자기-반증형
    소정정 예외(다섯 조건 중 조건 2 "예고·트리거 문장" 에 해당 안 함 — 이건 설계 원칙이지
    예고가 아니다)도 적용되지 않으므로 planner 턴으로 넘기는 것이 맞는 경로다.
  - 왜 CRITICAL 이 아니라 WARNING 인가: (1) 뒤집힌 원칙이 애초에 spec `## Rationale` 에
    있던 적이 없다 — plan 문서·코드 JSDoc 에만 있었으므로 "spec 이 명시적으로 기각한
    대안의 재도입" 요건을 문자 그대로 충족하지 않는다. (2) 번복에 실측 근거가 딸려 있고
    은폐 방지 강제가 코드로 구현·뮤테이션 검증까지 됐다(plan §B/§C, 7건 중 RED 6). (3)
    developer 가 권한 경계를 지키며 명시적으로 planner 백로그에 등재했다 — spec 을
    직접 고치는 월권을 하지 않았다.
  - 왜 그럼에도 WARNING 을 유지하는가: 이 가드 계열(`#1330`→`#1331`)은 바로 이전 완료
    plan(`guide-error-code-truth.md §J`)에서 "등재했다고 처분 표에 적고 실제로는 안 썼다"
    가 **세 번 반복**된 전력이 있다 — (1) 가드 하나만 등재, (2) 산문 표만 겨냥하고
    frontmatter 누락, (3) 아예 안 쓰고 등재했다고 표기. 이번 라운드는 그 실패 패턴이
    재발하지 않도록 백로그 항목 자체는 완결되게 작성됐지만, **spec 문서는 여전히 0
    상태**이고 그 완결이 실제 planner 턴에서 한 번에 처리되지 않으면 네 번째 반복이 된다.
    이 가드 계열의 실측된 재발률을 고려할 때 이 공백을 "이미 알려진 문제이니 무시"로
    접지 않고 계속 표면화하는 것이 맞다.
  - 제안: planner 턴에서 `spec/conventions/user-guide-evidence.md` 를 한 번에 갱신 —
    (1) §2 표에 `guide-identifier-existence.test.ts`(+ `guide-identifier-scan.ts`) 와
    `guide-sanitized-message-parity.test.ts` 행 추가, (2) frontmatter `code:` 목록에 두
    파일(+`guide-identifier-scan.ts`) 추가, (3) 새 `## Rationale` 항목 신설 — ①
    "왜 이 가드는 허용목록 없음 원칙을 유지 못 했는가"(§B 실측: 문맥 게이팅이 가드
    존재 이유였던 결함을 못 잡음), ② "왜 이번 허용목록은 `guide-error-code-truth.md §D`
    가 기각한 것과 다른가"(4강제 + 뮤테이션 검증으로 은폐 불가). `spec-draft-nullable-
    notation-followups.md` 의 해당 항목이 이 세 조각을 이미 초안으로 갖고 있으므로 복붙
    수준의 작업이며, 세 조각을 **한 턴에** 처리해 네 번째 "좁은 등재" 재발을 막는다.

- **[INFO]** 백로그 문서 자체는 이번 라운드에서 개선됐다 — 재발 방지 관점의 진전
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목,
    `git diff` 확인 — "함께 등재할 Rationale" 문단 신설)
  - 상세: 직전(impl-prep) 라운드는 "developer 가 planner 백로그에 Rationale 필요성만
    적고 실제 문구 초안은 없다" 는 취약점을 안고 있었다. 이번 diff 는 그 초안(위 WARNING
    제안의 ①·②에 해당하는 문장)을 백로그 항목 안에 이미 심어 뒀다 — `guide-error-code-
    truth.md §J` 가 세 번 반복한 "의도만 적고 결과를 확인 안 함" 패턴에 대한 학습이
    반영된 형태다. Rationale continuity 관점에서 이것은 실제 spec 갱신을 대체하지
    않지만, 다음 planner 턴의 실패 확률을 낮춘다.
  - 제안: 없음 — 위 WARNING 의 처리로 자동 해소.

- **[INFO]** 넓힌 기준집합(소스 ∪ env 선언처)은 `guide-error-code-truth.md §D` 가 기각한
  "frontend 를 기준집합에 포함" 과 형식적으로 다른 자원이라 재도입이 아님 — 직전 라운드
  판단 유지
  - target 위치: `plan/in-progress/guide-identifier-existence.md §B`
  - 상세: §D 가 기각한 것은 "frontend 소스 포함(자기증명 오염 위험)" 이고, 이번 PR 이
    추가한 것은 "env 선언처(`.env.example`·compose)" 다. §B 는 env 전용 21종이 전부
    인프라 이름이고 에러코드꼴이 0건임을 실측했다. 자기증명 오염 축과 무관한 확장이라
    §D 재도입이 아니라는 직전 라운드 판단을 유지한다. 단 이 판단의 실측 근거 역시
    spec Rationale 밖에 있으므로 위 WARNING 처리 시 함께 등재하면 된다(별도 조치 불요).

## 요약

이번 diff(`spec/conventions/**` 델타 0)는 spec 문서 자체의 Rationale 을 직접 어기지
않는다 — 관련 문서(`error-codes.md`, `user-guide-evidence.md`)의 기존 `## Rationale`
항목 중 이번 변경과 충돌하는 것은 없다. 그러나 이번 구현은 **plan 이력에만 살아 있던
설계 원칙("허용목록 없음")을 실측 근거로 명시적으로 뒤집으면서도, 그 근거를 CLAUDE.md 가
정한 자리(spec `## Rationale`)로 승격하지 않은 채** developer 권한 경계를 지켜 planner
백로그로 완결된 형태의 초안까지 갖춰 위임했다 — 절차는 옳고 번복 자체에 근거도 있지만,
spec 은 여전히 "가드가 3건" 이라고 말하는 상태(§2 표 미갱신)가 유지된다. 같은 가드
계열이 직전 완료 plan 에서 "등재했다고 적고 안 했다" 를 세 번 반복한 전력이 있어, 이
공백이 다음 planner 턴에서 한 번에 닫히지 않으면 네 번째 반복이 될 위험이 남는다.

## 위험도

MEDIUM
