# 문서화(Documentation) 리뷰 — masking-residuals-0b195b (`10_53_52` → `11_25_15` 누적, 산출물 커밋 포함)

## 검토 범위와 방법

이번 diff(`origin/main` 대비)는 (a) config echo 마스킹을 어댑터→egress 로 옮긴 원 변경과 그
CRITICAL 수정(`348c2b3ca`, `fa6e2294c`), (b) 보안 Rationale 6개 spec 정정(`57fb83592`), (c)
그 정정의 미러 스윕 잔여를 다시 잡은 수정(`23e1c91a0`, `11_25_15` W1~W4), (d) 그 세 라운드의
`review/**` 산출물 커밋을 모두 포함한다. `review/**` 산출물은 과거 라운드의 읽기 전용 기록이라
재판정 대상에서 제외했다. 핵심 코드 4개 파일·spec 6개(spec_impact)·plan 2개·`CHANGELOG.md` 를
`Read`/`grep`/`git log -p`/`git blame` 으로 직접 열어 **현재 저장소 상태**를 실측했다 —
이전 라운드가 "고쳤다"고 선언한 항목이 실제로 고쳐졌는지를 별도로 재현했다.

## 발견사항

- **[WARNING]** `spec/4-nodes/3-ai/1-ai-agent.md:480` — `11_25_15` WARNING 3 가 잡은 것과 **같은
  자기모순**이 형제 문단에 그대로 남아 있다 (이번 스윕에서 검토되지 않음)
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md:480` (§7 "Config echo 정책" 문단, 마지막 문장)
  - 상세: 현재 문구는 `"credential (llmConfigId 가 가리키는 provider secret 등) 은 ~~maskSensitiveFields
    에 의해 자동 마스킹 (adaptHandlerReturn boundary)~~ → egress(REST/WS)에서 마스킹 (2026-08-24
    정정)"` 이다. 그런데 `llmConfigId` 는 AI Agent 의 `output.config` echo 에 **애초에 실리지
    않는다** — 직접 `Read` 로 확인한 세 조립 지점(`assembleSingleTurnConfigEcho`,
    `RawAiAgentMultiTurnConfig`/`buildMultiTurnConfigEcho`, waiting 틱의 인라인 `config: {...}`,
    모두 `ai-turn-executor.ts`)이 전부 `{mode, model, systemPrompt, userPrompt, maxTurns,
    maxToolCalls, knowledgeBases, conditions, responseFormat, ...}` 만 하드코딩된 필드로
    조립하고, `llmConfigId` 는 어느 목록에도 없다. 즉 이 필드는 (과거 `maskSensitiveFields`
    시절에도, 지금도) **egress 마스킹의 대상이 될 기회 자체가 없다** — 키 이름 완전일치인
    `DEFAULT_SENSITIVE_KEYS`/`CREDENTIAL_KEY_PATTERN` 어느 쪽도 `llmConfigId` 를 매칭하지
    않는다는 점도 별도로 확인했다.
    `11_25_15` 라운드(WARNING 3, 커밋 `23e1c91a0`)가 정확히 이 클래스의 오류("미동봉인 값에
    마스킹을 적용한다는 자기모순")를 `:755`·`:979` 에서 고쳤지만, 그 수정은 *"부재(미동봉/미포함)를
    말하면서 그 부재를 egress 마스킹에 귀속시키는 문장"* 을 찾는 **주장 기반 grep** 으로
    수행됐다(`RESOLUTION.md` 자백). `:480` 은 "미동봉"이라는 단어 자체를 쓰지 않고 곧바로
    "credential 은 … 마스킹" 이라고만 서술해 그 grep 패턴을 통과했다 — 같은 파일 안에
    "제대로 고친 두 곳"과 "여전히 틀린 한 곳"이 공존한다.
  - 제안: `:480` 을 "credential(`llmConfigId`)은 config echo 필드 조립 시점에 **애초에 포함되지
    않는다**(allow-list 조립, egress 마스킹과 무관)"로 재정정한다. 실제 보안 성질은 지금 문서가
    말하는 것보다 **더 강하다**(마스킹이 아니라 미노출)는 점도 함께 명시하면 다음 감사자가
    "egress 가 실패하면 llmConfigId 가 샌다"는 잘못된 위협 모델을 갖지 않는다.

- **[WARNING]** `spec/5-system/4-execution-engine.md:1510` — 같은 spec_impact 파일 안에서
  `maskSensitiveFields` 를 여전히 현재형으로 인용하는 **네 번째** 자리 (미검토 잔여)
  - 위치: `spec/5-system/4-execution-engine.md:1510` ("선례 일반화" 문단, `_resumeCheckpoint` 서술)
  - 상세: `"credential / context-binding 필드는 동일하게 미동봉(`maskSensitiveFields` 와 동일
    allow-list 정책; 정책 적용 경로는 §5.1)하고 …"` — 바로 위 `:193`·`:203` 두 자리는 이번
    PR 이 정확히 이 표현("`maskSensitiveFields` boundary" 류)을 취소선+"allow-list 로 애초에
    배제"로 정정했는데(`Read`/`grep` 으로 확인), `:1510` 은 `git log -L`로 확인한 결과 이번
    diff 가 손대지 않은 더 오래된 문장(#884, 2026 이전 커밋)이라 취소선 없이 그대로 남아 있다.
    `maskSensitiveFields` 는 boundary 가 제거된 지금은 이 credential 제외와 **아무 관계가
    없는데도**, 문장은 여전히 "`maskSensitiveFields` 와 동일 allow-list 정책"이라고 현재형으로
    귀속시킨다(이 phrasing 자체가 원래도 부정확했다 — `maskSensitiveFields` 는 blacklist-마스킹이지
    allow-list 가 아니다). 이 파일은 이번 PR 의 spec_impact 6개 중 하나이자 바로 위 두 문단이
    같은 종류로 이미 정정된 파일이라, 같은 파일 안에서 형제 문단 셋을 고치고 넷째를 놓친
    모양이 된다 — 이 저장소가 이 PR 체인에서만 세 번째로 반복한 "미러 스윕이 몇 곳을 놓친다"
    클래스다.
  - 제안: `:193`/`:203` 과 동일한 톤(취소선 + "이 배제는 `maskSensitiveFields` 와 무관 —
    allow-list 로 조립 시점에 배제")으로 정정한다.

- **[WARNING]** `mask-sensitive-fields.util.ts` 의 취소선 정정이 남긴 문법 파괴 문장이 **아직도
  고쳐지지 않았다** — `RESOLUTION.md`(`11_25_15`)의 "처리했다" 주장이 사실과 다르다
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:32-36`
  - 상세: `10_53_52` requirement.md(INFO)와 `11_25_15` documentation.md(INFO)가 각각 같은 문제를
    지적했고, `11_25_15` 의 `RESOLUTION.md` 는 *"INFO #6 취소선이 남긴 끊어진 문장 —
    유일한 잔존 소비처(`explore-tools.service.ts`)를 주어로 재연결했다. 직전 라운드에서
    지적받고도 안 고친 것이라 이번엔 처리했다"* 라고 완료를 선언했다. 그런데 실제 커밋
    (`23e1c91a0`)의 diff 를 `git show` 로 대조하면, 추가된 것은 새 문장 `"**소비처는 이제
    explore-tools.service.ts(workflow-assistant) 하나다.**"` 하나뿐이고, 그 뒤에 원래부터
    떠 있던 문장 조각 `"내보낸다 — 비-자격증명 config 필드가 이 이름들과 겹치면 멀쩡한 값이
    가려진다."`(:36)는 **손대지 않은 채 그대로 남아 있다**. 현재 저장소 파일을 직접 `Read`
    해도 이 조각은 여전히 주어 없이 앞 문장("…표현식은 원문을 읽는다.") 뒤에 이어 붙어 문법이
    깨진 채다 — "재연결했다"는 것은 원래 절 중간에 새 주어 문장을 하나 끼워 넣었을 뿐, 끝에
    남은 잔여 절 자체는 재연결되지 않았다. `RESOLUTION.md` 가 실제로 고쳐지지 않은 것을
    고쳤다고 기록한 것은, 이 세션이 스스로 경계해 온 "no-op 을 성공으로 보고한다" 클래스와
    같은 결이다(같은 문서가 W1 에서 정확히 이 실패 모드를 자인했다).
  - 제안: `:36` 의 잔여 절을 `:32` 의 새 주어("남은 유일한 소비처 `explore-tools.service.ts`")에
    붙이거나("…그 소비처가 DB·WS·표현식 대신 자신의 응답으로 내보낸다 — 비-자격증명 config
    필드가…"), 전체를 취소선 처리해 붕 뜬 절이 사라지게 한다. 아울러 `RESOLUTION.md` 류
    산출물에 "처리했다"고 적을 때 `git show`/`git diff` 로 실제 반영 여부를 재확인하는 습관을
    다시 한 번 권한다(이 프로젝트가 이미 여러 차례 겪은 패턴).

- **[INFO]** plan 의 "실측" 테스트 카운트가 이 PR 의 마지막 커밋 이후 다시 stale 해졌다
  - 위치: `plan/in-progress/masking-expression-egress-split.md:127`
    (`- [x] TEST WORKFLOW 4단계 + ratchet — backend 9,018 passed …`)
  - 상세: 이 줄은 `126609555` 커밋 시점의 실측이다. 그런데 그 뒤에 온 CRITICAL 수정
    (`fa6e2294c`)과 미러 스윕 재정정(`23e1c91a0`)이 테스트를 더 추가했고, `23e1c91a0` **자신의
    커밋 메시지**가 "TEST WORKFLOW 4단계 PASS — backend **9,020 passed** / 433 suites" 라고
    적고 있다 — 즉 plan 체크리스트의 수치가 이 PR 의 최신 실측과 2건 어긋난다. `10_53_52`
    documentation.md 가 이미 "plan 의 '18 passed' 가 실제와 안 맞는다"를 지적했던 바로 그
    항목이 다음 라운드에서 또 늘어난 커밋으로 인해 다시 stale 해진 사례다 — 이 프로젝트가
    반복 경험한 "PR 이 닫히는 시점의 값이어야 한다"는 교훈과 정확히 같은 모양이다.
  - 제안: 이 PR 이 실제로 닫히는(머지되는) 시점의 최종 실행 결과로 갱신한다. 값 자체보다
    "커밋이 이어지는 한 이 숫자는 매번 다시 stale 해진다"는 점을 감안해, 정확한 숫자보다
    "최신 TEST WORKFLOW 실행 결과는 최근 커밋 메시지 참조"처럼 갱신 부담이 적은 표현을
    쓰는 것도 고려할 만하다.

## 잘된 점 (참고)

- `CHANGELOG.md` 에 이 PR 의 운영 영향(config 가 DB 에 원문으로 저장됨)과 안전성이 두 마스커의
  키-집합 포함관계에 의존한다는 점을 명시한 항목이 정확히 이 클래스 변경들의 기존 관례대로
  추가돼 있다 — `10_53_52` 가 지적한 WARNING(CHANGELOG 누락)이 해소됐음을 재확인했다.
- `plan/in-progress/masking-expression-egress-split.md` 의 체크리스트는(위 테스트 카운트 1건
  제외) 실제 상태와 일치하도록 갱신돼 있다 — `/ai-review` 만 미체크로 정확하다.
- `spec/2-navigation/14-execution-history.md`(R-5)·`spec/3-workflow-editor/4-ai-assistant.md`·
  `spec/conventions/{egress-masking,node-output}.md`·`spec/5-system/4-execution-engine.md:193,203,1558`·
  `spec/4-nodes/3-ai/1-ai-agent.md:755,979` — 대다수의 stale "boundary" 인용이 원문을 취소선으로
  보존한 채 정확한 톤("allow-list 로 애초에 배제" 또는 "egress 마스킹")으로 정정돼 있음을
  직접 대조 확인했다. 세 번째 라운드까지 온 미러 스윕이 8개 파일 중 대부분(6/8 지점)을
  실제로 닫았다는 점은 인정할 만하다 — 남은 것은 위 WARNING 셋뿐이다.
- `ai-turn-executor.ts:3281`,`:3356` 의 코드 주석 두 곳은 이번 라운드에서 spec 과 같은 톤으로
  정확히 정정돼 있다(직접 `Read` 로 확인) — `10_53_52` maintainability.md 가 지적했던 항목이
  실제로 닫혔다.

## 요약

핵심 안전 서사(포함관계 캐너리 재작성·egress 대조군·config echo 마스킹 제거)는 실제 코드와
정확히 일치하고, 3라운드에 걸친 미러 스윕도 대부분의 stale "boundary" 인용을 실제로 닫았다.
다만 그 스윕 자체가 이 PR 내내 반복해 겪어 온 "몇 곳을 놓친다" 클래스를 이번에도 재현했다 —
`1-ai-agent.md:480`(자기모순 재정정 대상 발견), `4-execution-engine.md:1510`(같은 spec_impact
파일 안의 넷째 잔여), 그리고 `mask-sensitive-fields.util.ts` 의 취소선 파괴 문장은 `RESOLUTION.md`
가 "처리했다"고 명시적으로 선언했음에도 실제로는 고쳐지지 않았다(`git show` 로 반증). 셋 다
기능·보안 회귀는 아니지만(실제 credential 제외/마스킹 메커니즘 자체는 건재), 다음 독자가
"이 문서가 최근 정정을 전부 반영했다"는 신뢰를 근거로 삼을 때 어긋난 정보를 얻게 된다는 점에서
문서 신뢰성 문제로 남긴다. plan 의 테스트 카운트 stale 은 낮은 우선순위 INFO 다.

## 위험도

MEDIUM
