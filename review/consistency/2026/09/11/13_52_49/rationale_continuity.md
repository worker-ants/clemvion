# Rationale 연속성 검토 — `spec-draft-details-code-landed.md`

## 조사 방법

target 의 결정 1~5 각각에 대해 인용된 과거 Rationale(R-CC-10·R-CC-21·R-2·R-14·R-12·
`2-api-convention.md §5.3`·`3-error-handling.md` §1.9/§1.10·`error-codes.md §4.2`)을
실제 spec 파일에서 직접 열어 대조했고, 관련 이전 세션의 rationale-continuity 산출물
(`review/consistency/2026/09/11/10_28_52/rationale_continuity.md`)과 병행 트래커
(`plan/in-progress/spec-draft-nullable-notation-followups.md`)도 대조해 "이미 지적된
잔여 항목을 이번 턴이 뒤집는지" 를 확인했다.

## 발견사항

- **[INFO]** "라벨 네임스페이스 재발" 근거로 든 `D-3`·`D-9` 실재 인용이 부정확하다(경미, 처방에 영향 없음)
  - target 위치: `plan/in-progress/spec-draft-details-code-landed.md` `## 결정` 서두 —
    *"편집 대상 `15-chat-channel.md` 에 `D-1`·`D-2`·`D-3`·`D-9` 가 **살아 있고**"*
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-21 본문(`D-1`·`D-2`) 및
    §3.3 인접 서술(`R-D-3`·`R-D-9`, Discord provider Rationale ID)
  - 상세: 실측 — `15-chat-channel.md` 에 독립 라벨 `D-1`·`D-2` 는 실재한다(R-CC-21,
    *"D-1(필드를 받지 않는다)과 D-2(경로가 그 두 비밀을 쓰지 않는다)를 함께 결정한다"*).
    그러나 **bare `D-3`·`D-9` 라벨은 존재하지 않는다** — grep 이 잡은 것은
    `R-D-3`(discord provider 의 "v1 = Interactions Webhook only" Rationale) ·
    `R-D-9`(discord provider 의 "file 필드 v1 한계" Rationale)의 **부분 문자열**이고, 이
    둘은 `D-*` 네임스페이스와 무관한 별개 prefix(`R-D-*`, Discord 전용)다. 결론(`D-*`
    prefix 를 새로 쓰지 않는다) 자체는 실재하는 `D-1`·`D-2` 만으로도 이미 충분히
    정당화되므로 이 부정확성이 처방을 바꾸지는 않지만, "이 체인에서 라벨 네임스페이스를
    두 번 틀렸다" 는 자기평가 문장 바로 다음 문장에서 **같은 종류의 grep 정밀도 오류**가
    재발했다는 점은 기록해 둘 가치가 있다.
  - 제안: `D-3`·`D-9` 언급을 삭제하거나 "R-D-3/R-D-9 는 별개 네임스페이스이므로 무관"으로
    정정. 처방(결정 라벨 신설 안 함)은 그대로 유지해도 된다.

## 확인했으나 문제 없음 (양성 대조)

target 이 명시적으로 다루는 4개 결정 축을 과거 Rationale 과 대조한 결과, 아래는 **기각된
대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 것에도 해당하지 않는다**:

- **결정 1 (시제 3곳 갱신)** — §5.4.1·§5.4.1.1 의 "배선 전 관측값" 라벨, §5.4.1.2 닫는
  문단의 "그 PR 이 머지되기 전까지" 시한절을 실측(`15-chat-channel.md:375,411-416,426`)
  대조한 결과 target 의 술어 구분(① 라벨=거짓 아님/일관성 ② 시한절=명백히 거짓/필수)이
  정확하다. 이는 사실 갱신이지 결정 번복이 아니다.
- **결정 2 (`authConfigId` 판별 기준 추가)** — `2-api-convention.md §5.3`(2026-09-11
  규약화) 현재 문면 실측 결과, "field 가 없는 진단 payload 는 대상이 아니다 → 있으면
  `details.code` 를 싣는 것이 겹쳐 쓰기가 아니다" 라는 기존 §5.3 의 암묵적 구조와
  target 이 명문화하려는 "top-level 과 같은 사유 반복=금지 / generic 표지=허용" 기준이
  정합한다. 「형태와 무관하다」를 **좁히는 대신 기준을 더하는** 처방은 tracker
  (`spec-draft-nullable-notation-followups.md` 의 "authConfigId 자리" 항목)가 제안한
  "carve-out으로 좁히기" 대안을 **의식적으로 재검토해 명시적으로 기각**하고 그 사유
  (특례가 생겨 소비자가 그 필드를 따로 처리해야 함)를 적었다 — 무근거 번복이 아니라
  근거를 갖춘 대안 채택이다.
- **결정 3 (`AUTH_CONFIG_NOT_FOUND` 등재)** — `§5.3` 의 "어느 쪽을 택하든 카탈로그에
  등재한다" 의무를 이행하는 것이고, `§1.9`/`§1.10` 의 "도메인 spec 참조" 등재 패턴
  선례와 형식이 일치한다(실측: `3-error-handling.md:220,232`). 신규 원칙 도입이 아니다.
- **결정 4 (예시 9곳 `details.code` 병기)** — `providers/slack.md:275`·`discord.md:297`
  의 flat 표기가 "생성 시점 서비스 가드"를 서술한다는 이전 판정(`#1315`)은 **경로 형태
  축**이고, 이번 추가는 **`code` 축**이라고 target 스스로 축을 분리해 명시한다. 두 축이
  독립이라는 target 의 주장은 실측(§5.4.1 "계약값은 INVALID_FIELD" 서술)과 정합하고,
  `endpoint_path` 행(자기 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` 보유)을 제외한
  것도 §5.3 표의 "top-level 특화 코드 선례" 행과 일치해 올바르게 경계를 긋는다.
- **결정 5 (`botToken` 형식 서술 정정)** — 이전 세션의 rationale-continuity 산출물
  (`review/consistency/2026/09/11/10_28_52`)이 이미 INFO 로 지적해 둔 "문서가 구현보다
  넓다"(regex 미구현 + `BOT_TOKEN_INVALID` 메커니즘 오기) 갭을 이번 target 이 실제로
  닫는다. "spec 에 규정만 있고 강제하는 코드가 없다"는 `conventions/swagger.md §3
  Rationale` 의 원칙(문서한 보장은 구현과 같아야 한다)과 정합하는 처방이며, 없는
  검증을 spec 에 새로 추가해 "산다는 방식으로" 합리화하지 않고 **없는 것을 없다고
  적는** 방향을 택해 그 원칙을 강화한다.
- **자기-반증형 소정정 미적용 판단** — target 은 (a)의 대상 문장을 `#1316` planner
  턴이 썼고 이번 턴도 정규 planner 턴이므로 조건 1(작성자=본인)이 blame 기준이 아니라
  "diff 스코프·게이트 종류·plan owner" 기준으로 성립하지 않는다고 명시하며, 취소선
  보존(조건 4) 없이 정정하는 이유를 정확히 CLAUDE.md 규약에 맞춰 서술한다.

## 요약

target 문서는 결정마다 실제 spec 파일의 인용문·라인·과거 PR 번호를 대며 「기각한 대안」
표를 갖추고 있고, 실측으로 대조한 결과 그 인용들은 (한 건의 경미한 grep 부정확성을
제외하면) 정확하다. 다섯 결정 모두 과거 Rationale(R-CC-10/R-CC-21/R-2/R-14/R-12·
`§5.3`)이 세운 원칙을 위반하거나 이미 기각된 설계를 되살리지 않으며, 오히려 결정 2 는
자신이 앞서 쓴 규칙(`#1316`)의 과도한 넓이를 스스로 인지하고 "좁히기"라는 유혹적이지만
부작용 있는 대안을 근거와 함께 명시적으로 기각한 뒤 대안 처방(판별 기준 추가)을
택했다 — 이는 무근거 번복이 아니라 이 checker 가 요구하는 "새 Rationale 동반" 요건을
정확히 충족하는 사례다. 검토 범위 안에서 CRITICAL/WARNING 급 연속성 결함은 발견되지
않았다.

## 위험도

NONE
