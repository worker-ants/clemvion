# Cross-Spec 일관성 검토 — `spec-draft-eia-62-waiting-payload.md`

## 사전 조치 — 번들 절단 보정

`_prompts/cross_spec.md` 에 조립된 "관련 spec 본문" 번들에서 **target 자신의
`spec_impact` 핵심 대상 두 개** — `spec/5-system/6-websocket-protocol.md`,
`spec/5-system/14-external-interaction-api.md` — 가 컨텍스트 예산 초과로
**완전히 절단**되어 있었다 (`spec/5-system/15-chat-channel.md` 도 동일).
`spec/1-data-model.md` 만 전문이 포함됐다. 기존에 기록된 동일 클래스 결함
(`feedback_consistency_spec_mode_budget`)이 이번 세션에서도 재현됨.

번들만으로는 이 target 을 제대로 검증할 수 없어 **해당 3개 파일을 저장소에서
직접 Read** 해 아래 분석을 수행했다. orchestrator 는 이 절단이 다른 checker 의
판정(특히 예산이 더 타이트한 checker)에는 영향을 줬을 수 있음을 감안할 것.

## 방법

target 이 제안하는 (1)~(7) 각 항목을 실제 `spec/5-system/14-external-interaction-api.md`
§6.1~§6.6·§R17, `spec/5-system/6-websocket-protocol.md` §4.4·§4.4.5·§4.4.6·Rationale,
`spec/1-data-model.md` §2.13/§2.14, `spec/5-system/15-chat-channel.md` R-CC-15,
`spec/5-system/2-api-convention.md` §1 의 현재 라이브 텍스트와 대조했다. 인용된
커밋 해시(`81f2c60d6`·`5df89cda6`·`34e32e62f`·`7fa12301c`·`a9574f823`·`7fa12301c`)도
`git log`로 실재·내용을 확인했다.

## 발견사항

- **[INFO]** 항목 (2) 의 URL 예시 정정 지시가 존재하지 않는 섹션 번호를 가리킴
  - target 위치: "### (2) `interaction` 블록" 문단 — "구현 시점의 형태를 `§4.1 endpoints`
    와 같은 **상대경로**로 적는다"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §4.1 은 실제로
    "Webhook 호출 응답 확장"(트리거 등록 응답 확장)이고, `spec/5-system/2-api-convention.md`
    §4.1 은 "목록 조회 쿼리 파라미터"다. 어느 쪽도 "endpoints" 목록이 아니다.
    상대경로 REST 엔드포인트 표기 선례는 실제로는 EIA 문서 **§5.1~§5.5**
    (`POST /api/external/executions/:executionId/interact` 등)에 있다.
  - 상세: 인용 번호가 실재 헤딩과 어긋나 실행자가 잘못된 절을 찾을 수 있다. 다만
    "상대경로로 적는다"는 지시 방향 자체(§1 버전-URL 미포함 규칙 준수)는 맞다 —
    `2-api-convention.md` §1 "버전 | URL 경로에 포함하지 않음" 을 실측 확인했고,
    현재 §6.2 예시(`https://api.clemvion.ai/v1/executions/{id}/interact`)가 그 규칙과
    존재하지 않는 도메인 양쪽 다 위반하는 것도 맞다 — target 의 진단은 정확하다.
  - 제안: `§4.1 endpoints` → `§5.1~§5.5`(또는 "§5 API 명세 — Inbound 의 상대경로 표기")로
    인용을 정정.

- **[INFO]** 항목 (4) 의 "확인 필요" 가 이미 기존 spec 텍스트로 해소되어 있음
  - target 위치: "### (4) `error.code` 를 옵셔널로" 문단의 "파급 2곳" 중
    "`15-chat-channel.md` R-CC-15 ... 확인 후 필요하면 R-CC-15 addendum. 확인
    전에는 (4) 를 완료로 보지 말 것"
  - 충돌 대상: `spec/5-system/15-chat-channel.md` CCH-ERR-04 (§3.5)
  - 상세: 실측 결과 CCH-ERR-04 는 이미 "분류 표에 없는 `error.code`(unknown) 또는
    **`error.code === null`** 는 `executionFailedInternal` key 로 fallback" 이라고
    명시하고 있다 (`git log -S "error.code === null"` → 커밋 `9bf2b7a0e`, 이번
    draft 와 무관한 과거 feature 커밋 #323). 즉 `error.code: null` 은 이미 안전하게
    unknown-code fallback 으로 흡수되도록 **사전에 설계돼 있다** — target 이 "확인 후
    필요하면" 이라 열어둔 검증은 이미 답이 나와 있고, R-CC-15 addendum 은 불필요하다.
  - 제안: 체크리스트/처분 항목에서 이 확인을 "완료 — CCH-ERR-04 가 이미 `null` 을
    처리함, addendum 불필요" 로 닫을 것. (WARNING 이 아니라 INFO 인 이유: 이 발견은
    작업량을 줄이는 방향이라 실행을 막지 않는다.)

- **[WARNING]** 동일 spec 절(§6.2 blockquote)을 두 개의 in-progress draft 가
  동시에 겨냥 — 적용 순서·소유권 미확정
  - target 위치: "### (3) 'SSE 필드명 매핑' blockquote 정정" 및 그 아래 인용문
    ("형제 plan 과 충돌한다")
  - 충돌 대상: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
    (동일 `spec/5-system/14-external-interaction-api.md` §6.2 blockquote 를 대상으로 함)
  - 상세: 실측(`git show --stat 7fa12301c`)으로 확인 — 커밋 `7fa12301c` 가 이
    target 문서와 형제 plan 문서 양쪽을 동시에 건드렸고, 형제 plan 에 "반증 각주"를
    달았다는 target 의 서술은 사실과 일치한다. 다만 **두 plan 이 동일 spec 문단의
    소유권을 놓고 아직 최종 정리(하나로 merge 하거나 명시적 순서 결정)되지
    않은 채 병존**한다 — 형제 plan 이 어제 "완료 처리"한 전제가 이 target 에서
    반증됐는데, 형제 plan 자체의 상태(완료/재오픈)가 이 target 안에서 갱신되는지
    불명확하다. 두 plan 이 각자 다른 시점에 `--spec` 을 통과해 spec 에 반영되면,
    나중에 반영되는 쪽이 먼저 반영된 쪽의 blockquote 를 덮어써 순서에 따라
    결과가 달라질 수 있다.
  - 제안: planner 가 두 plan 중 어느 쪽이 §6.2 blockquote 최종 텍스트의 단일
    소유자인지 명시하거나(예: 형제 plan 에서 해당 절을 제거하고 이 target 으로
    일원화), 형제 plan 의 완료 상태를 이 target 의 처리 결과에 맞춰 갱신할 것.
    (cross-spec 관점의 파생 위험만 기재 — plan 정합성 자체는 plan_coherence 검토
    영역과 겹친다.)

## 검증되어 충돌이 아님으로 확인된 항목 (참고용)

다음은 target 이 "결함"으로 지목한 것들이 실제로 다른 spec 영역과 상충하지
않고, 오히려 기존에 존재하던 실제 cross-spec 불일치를 올바르게 겨냥하고
있음을 직접 대조로 확인한 것이다 (새 충돌이 없다는 근거로 남긴다):

- §6.2 `payload` 래퍼 누락(항목 1): §6.3/§6.4 라이브 텍스트가 이미
  `payload:` 래퍼 + "webhook 봉투 기준. SSE 는 payload 래퍼 없이…" 주석 패턴을
  쓰고 있음을 확인. §6.2 만 이 패턴에서 벗어나 있다 — 실제 결함, 수정 방향 일치.
- §6.4 `nodeId: "uuid" | null` 은 이미 라이브 스펙에 존재하는데
  `spec/1-data-model.md` §2.14 "구조" 행(`{ nodeId: "uuid", code: "ERROR_CODE",
  message: "에러 설명" }`)은 이를 반영하지 못하고 있음을 확인 — 항목 (5) 는
  실재하는 EIA↔data-model 불일치를 올바르게 겨냥.
- WS §4.4 Rationale "`ai_message.llmCalls[]` 외부 수신자 strip" 및 §4.4 라인
  519 blockquote 는 현재 "strip 대상은 본 WS 이벤트 필드뿐" 이라고 좁게
  선언하고 있고, EIA §R17 라인 1349 는 "에디터 전용 `turnDebug.llmCalls` 는
  건드리지 않음" 이라고 명시하고 있음을 확인 — 실제 코드 수정 커밋
  (`81f2c60d6`·`34e32e62f`·`7fa12301c`, 전부 실재)이 이 좁은 선언보다 넓게 이미
  구현을 확장했으므로, 항목 (7) 이 제안하는 spec 확장은 진짜 spec-vs-code drift
  해소이지 새 충돌 생성이 아니다.
- EIA `waiting_for_input`(§4.4) 라인 394 blockquote 는 이미 "외부 클라이언트가
  소비하는 필드 매핑의 SoT 는 EIA §6.2 blockquote… WS 내부 부가 식별자는 본
  §4.4 가 소유" 라는 오너십 분리를 명시하고 있음 — target 의 실측표에서
  `waitingNodeLabel`/`nodeExecutionId`/`startedAt` 을 "의도된 스코프 밖"으로
  처리한 판단과 정확히 일치한다.
- `conversation-thread.md` §5.1(messages 모드 매핑)은 실재하는 앵커이고,
  §4.4.6 은 `conversation-thread.md` 가 아니라 `6-websocket-protocol.md` 소속
  헤딩(라인 700)임을 확인 — 항목 (6) 의 인용 오귀속 지적이 정확함.

## 요약

target 의 spec_impact 3개 파일 중 2개(WS·EIA)가 번들 절단으로 빠져 있어 직접
소스를 대조했다. 그 결과 target 이 제안하는 7개 항목은 데이터 모델·API 계약·
오너십 분리 측면에서 **기존 spec 텍스트를 실측으로 정확히 인용**하고 있으며,
새로 CRITICAL 급 모순을 만들지 않는다 — 오히려 §6.2 payload 래퍼 누락,
`Execution.error.nodeId` nullable 미반영, `llmCalls` strip 선언 범위 협소 등
**기존에 실재하던 spec-내부/spec-vs-code 불일치를 정정**하는 방향이다.
다만 (a) URL 상대경로 지시의 절 번호 인용 오류(§4.1→§5.1~5.5), (b) `error.code
=== null` fallback 이 이미 CCH-ERR-04 에 있어 "확인" 항목을 닫을 수 있다는 점,
(c) 형제 plan(`spec-draft-eia-notification-payload-contract.md`)과 §6.2
blockquote 소유권이 완전히 정리되지 않은 채 병존한다는 점은 짚어야 한다.

## 위험도

LOW
