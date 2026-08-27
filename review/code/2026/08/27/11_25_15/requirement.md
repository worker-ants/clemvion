# 요구사항(Requirement) 리뷰 — masking-expression-egress-split (C2 (a), `10_53_52` 이후 재검토)

## 변경 개요

`handler-output.adapter.ts` 의 `adaptHandlerReturn` 에서 노드 `config` echo 에 걸려 있던
storage-time 마스킹(`maskSensitiveFields`)을 제거해, 표현식(`$node["X"].config.<field>`)과
DB 가 원문을 보게 하고, 안전성을 REST(`redactStoredDataForResponse`)·WS(`maskWireEnvelope`)
두 egress 로만 위임한다. 안전 전제("`DEFAULT_SENSITIVE_KEYS` ⊆ egress 키 축")는
`mask-sensitive-fields.util.spec.ts` 의 포함관계 캐너리가 상수를 **직접 순회**(export 된
`DEFAULT_SENSITIVE_KEYS`)해 단언한다. 이 diff 자체는 직전 라운드(`10_53_52`, 9-agent 리뷰)가
잡은 CRITICAL(캐너리가 상수에서 파생되지 않고 리터럴을 손으로 나열해 실질적으로 아무것도
검사하지 않던 결함)의 수정 결과물이다.

## 검증한 것

- `mask-sensitive-fields.util.ts` / `.spec.ts`, `handler-output.adapter.ts` / `.spec.ts`,
  `ai-turn-executor.ts` 를 전체 파일로 직접 Read 해 diff 와 최종 상태가 일치함을 확인.
- `DEFAULT_SENSITIVE_KEYS` (21개, 대소문자 정규화 후 유니크) 전 항목을 `CREDENTIAL_KEY_PATTERN`
  (`sanitize-error-message.ts`)에 수동 매칭 — 전부 매치함을 정규식 직접 대조로 재확인(포함관계
  성립).
- `deepRedactSecrets` → `CREDENTIAL_KEY_PATTERN.test(k)` 호출 경로, `redactStoredDataForResponse`
  (REST) · `maskWireEnvelope`→`deepRedactSecretsPreserving` (WS) 가 실제로 이 함수를 거침을
  코드에서 직접 추적.
- `npx jest mask-sensitive-fields.util.spec.ts handler-output.adapter.spec.ts` 직접 실행 —
  **83 passed / 83, 2 suites** GREEN.
- `buildRetryState` 실제 구현을 읽어 "credential 은 allow-list 로 애초에 배제" 주석이 실제
  코드(명시적 필드 나열, `llmConfigId` 등 미기재)와 일치함을 확인.
- production 소비처 grep — `maskSensitiveFields` 의 유일한 잔존 런타임 소비처는
  `explore-tools.service.ts`(workflow-assistant) 하나뿐이며 이 PR 과 무관하게 유지됨을 확인
  (orphan import 없음).
- TODO/FIXME/HACK/XXX 신규 주석 없음 (diff grep 확인).

## 발견사항

- **[WARNING]** `spec/conventions/node-output.md:256` 이 `RESOLUTION.md` 가 "고쳤다"고 주장하는
  네 곳 중 하나인데 실제로는 고쳐지지 않았다 — 여전히 폐기된 메커니즘을 근거로 인용
  - 위치: `spec/conventions/node-output.md:256` (`_retryState` 포함 필드 서술 문단)
  - 상세: `review/code/2026/08/27/10_53_52/RESOLUTION.md` "WARNING 5" 는 *"`maskSensitiveFields
    boundary` 를 근거로 인용하는 자리가 `ai-turn-executor.ts` 2곳 · `node-output.md` ·
    `4-execution-engine.md` 에 남아 있었다... **네 곳 모두** '`allow-list 로 애초에 배제 — 그
    boundary 와 무관`' 으로 정정했다"* 고 적는다. 그러나 `node-output.md` 를 직접 Read 하면
    256번째 줄이 지금도 그대로 `"credential 제거 정책은 `_resumeState` 와 동일 (`maskSensitiveFields`
    가 boundary 에서 strip)"` 이다 — 취소선도, "allow-list" 언급도 없다. `git log -- 
    spec/conventions/node-output.md` 로 확인해도 이 PR 의 커밋(`57fb83592`) diff 에 이 줄이
    포함되지 않는다(diff 는 339번째 줄 부근의 새 문단만 추가). 즉 RESOLUTION 의 "네 곳 모두
    정정" 주장이 이 파일에 한해 **사실이 아니다**.
  - 제안: `node-output.md:256` 을 `spec/5-system/4-execution-engine.md:203` 이 이미 적용한
    패턴(`~~maskSensitiveFields boundary~~` **allow-list 배제** — 그 boundary 는 제거됐고 이
    배제는 그것과 무관)으로 정정. planner 턴에서 `plan/in-progress/masking-expression-egress-split.md`
    의 spec_impact 목록(이미 `node-output.md` 포함)의 실제 반영 여부를 재확인.

- **[WARNING]** 같은 파일 안에서 인접한 두 문단 중 하나만 고쳐졌다 — `_resumeCheckpoint` 서술은
  여전히 폐기된 boundary 를 근거로 인용
  - 위치: `spec/5-system/4-execution-engine.md:193` (`_resumeCheckpoint` shape 서술)
  - 상세: 같은 파일 203번째 줄(`_retryState` 서술)은 이 PR 이 정확히
    `~~maskSensitiveFields boundary~~` **allow-list 배제**(2026-08-24 — 그 boundary 는 제거됐고
    이 배제는 그것과 무관) 로 고쳤다. 그런데 불과 10줄 위, **같은 필드 계열**(`_resumeCheckpoint`
    는 `_retryState` 와 "동일 masking 정책"으로 명시적으로 짝지어지는 자매 필드)을 서술하는
    193번째 줄은 `"credential / context-binding 필드는 미동봉 (`maskSensitiveFields` 와 동일
    정책)이며"` 그대로 남아 있다 — 취소선 없이, 폐기된 boundary 를 마치 지금도 유효한 메커니즘인
    것처럼 인용한다. 같은 문서, 같은 커밋에서 형제 문단 하나는 고치고 다른 하나는 놓친
    사례라 "이번엔 놓치지 않았다"는 이 PR 자신의 mirror-sweep 완결성 주장과 정면으로 어긋난다.
  - 제안: 193번째 줄도 203번째 줄과 동일한 정정 패턴(`~~maskSensitiveFields~~` → **allow-list
    배제**)으로 맞춘다.

- **[WARNING]** `ai-agent.md` 의 "정정"이 두 곳에서 **다른 방향으로 틀렸다** — "미동봉/미포함"과
  "egress 마스킹"을 나란히 써서 자기모순
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md:755`, `:979`
  - 상세: 두 줄 모두 정확히 이 형태다 — *"credential ... 필드는 **미동봉**이며(~~
    `maskSensitiveFields` boundary strip`~~ → **egress 마스킹**, 2026-08-24 정정)"*
    / *"credential **미포함** (~~`maskSensitiveFields` boundary strip`~~ → **egress 마스킹**,
    2026-08-24 정정)"*. 그런데 이 필드들(`_resumeState`/`_resumeCheckpoint`/`_retryState` 의
    `llmConfigId` 등 credential/context-binding 필드)의 실제 메커니즘은 —
    `ai-turn-executor.ts` 의 `buildRetryState`/`buildResumeState`(및 그 코드에 붙은 이번 PR
    자신의 수정 주석: *"credential 은 **allow-list 로 애초에 배제**한다... 그 boundary 와
    **무관**하게 allow-list 로 성립한다"*, `ai-turn-executor.ts:3280-3283`) — **allow-list
    구성**이다. 즉 그 필드는 애초에 객체에 **복사되지 않으므로** "미동봉/미포함"이 맞는
    서술이고, 미동봉인 값에는 "egress 마스킹"이 적용될 대상 자체가 없다 (마스킹은 *존재하는
    값을 가리는 것*이지 *애초에 없는 값*에는 작동하지 않는다). "egress 마스킹" 이라는 교정은
    같은 파일·같은 커밋에서 정확히 이 문제(잘못된 메커니즘 귀속)를 고치려던 시도인데, 정정문
    자체가 **또 다른 틀린 메커니즘**으로 대체됐다 — `spec/5-system/4-execution-engine.md:203`
    이 올바르게 적용한 "allow-list 배제" 표현과 나란히 놓고 대조하면 불일치가 바로 드러난다.
  - 제안: 두 자리를 `"미동봉이며 (~~maskSensitiveFields boundary strip~~ → **allow-list 로
    애초에 배제** — 그 boundary 는 2026-08-24 제거됐고 이 배제는 그것과 무관, 정정)"` 형태로
    재정정. (참고: 같은 파일 1114번째 줄의 "`requestPayload` 의 credential 은 egress 에서 자동
    마스킹" 서술은 **다른 필드**— `llmCalls[].requestPayload` 는 실제로 값이 존재할 수 있는
    자유 필드라 egress 마스킹이 논리적으로 성립하는 별개 케이스이며 본 지적과 무관함.)

- **[INFO]** 위 세 항목은 모두 **문서(spec) 전용** 결함이며 런타임 동작에는 영향이 없다
  - 상세: `buildRetryState`/`buildResumeState` 의 실제 구현(allow-list 로 credential 필드를
    애초에 조립하지 않음)은 diff 전후로 변경되지 않았고 정확하다 — 이번 PR 이 바꾼 것은 그
    메커니즘을 설명하는 **주석/문서의 근거 문구**뿐이다. 따라서 기능 회귀는 아니지만, 이
    PR 이 "출구 중 하나를 빠뜨린다"는 이 저장소의 반복되는 실패 클래스를 언급하며 스스로
    엄격한 mirror-sweep 완결성을 주장하는 만큼(`RESOLUTION.md`, CHANGELOG), 그 주장과 실제
    상태의 괴리 자체가 신뢰도 문제로 남는다.

- **[INFO]** 핵심 코드 변경(`adaptHandlerReturn`, `DEFAULT_SENSITIVE_KEYS` export, 포함관계
  캐너리)은 기능·엣지케이스·반환값·에러 시나리오 관점에서 결함을 찾지 못했다
  - 상세: `config` 기본값 처리(`r.config ?? {}`, null/undefined 케이스 테스트 존재), 순환 참조
    방어(`maskSensitiveFields` 자체는 변경 없음), 비-문자열/중첩 credential 값 처리, aliasing
    변경(참조 전달로 바뀐 것)이 모두 전용 캐너리로 고정돼 있고 `npx jest` 로 GREEN 을 직접
    확인했다. 포함관계 캐너리도 `[메타]` 케이스(목록 길이 > 15)로 파생 단절 시 즉시 실패하게
    설계돼 있어, 직전 라운드가 지적한 CRITICAL(무의미한 캐너리)의 재발 방지 장치가 실효성
    있게 구현됐다.

## 요약

핵심 코드 변경(어댑터 마스킹 제거 → egress-only, 포함관계 캐너리의 진짜 파생화)은 직접 파일을
읽고 테스트를 실행해 확인한 결과 의도한 기능을 정확히 구현하며 회귀나 새로운 CRITICAL 결함은
발견되지 않았다. 다만 이 PR 이 스스로 "완결된 mirror sweep"이라고 주장하는 spec 문서 동기화
작업에는 구멍이 있다 — `node-output.md:256` 은 아예 손대지 않았음에도 RESOLUTION.md 가 고쳤다고
기록했고, `4-execution-engine.md:193`(`_resumeCheckpoint`)은 바로 아래(203번째 줄,
`_retryState`) 문단만 고쳐지고 형제 문단이 누락됐으며, `ai-agent.md:755`·`:979` 는 고치긴
했으나 정정문 자체가 논리적으로 성립하지 않는 다른 오류("미동봉"인 값에 "egress 마스킹"을
귀속)로 대체됐다. 세 항목 모두 런타임 동작에는 영향이 없는 문서 전용 결함이지만, 이 저장소가
반복해 겪어 온 "동일 문구가 여러 곳에 흩어져 한쪽만 고쳐진다" 패턴의 재발이며, 이번 PR 자신이
경계했던 바로 그 실패 모드다.

## 위험도

LOW
