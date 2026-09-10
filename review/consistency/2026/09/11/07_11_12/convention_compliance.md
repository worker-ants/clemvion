# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-chat-channel-drift-3.md`

## 검토 방법

target 은 spec 초안 plan(`--spec` 모드)이며, 실제 spec 파일(`15-chat-channel.md`,
`2-trigger-list.md`, `conventions/secret-store.md`, `conventions/chat-channel-adapter.md`,
`providers/telegram.md`, `providers/slack.md`)에 적용될 변경안이다. 프롬프트의
"spec/conventions 정식 규약" 인라인 섹션이 예산 초과로 비어 있어, target 의 `spec_impact`
및 본문이 직접 인용하는 규약 파일을 다음과 같이 **직접 Read** 했다: `spec/conventions/secret-store.md`,
`spec/conventions/chat-channel-adapter.md`, `spec/conventions/error-codes.md`, 그리고 `details.field`
형식의 SoT 인 `spec/5-system/2-api-convention.md §5.3/§5.4`. 아울러 target 이 인용하는 실제 spec
좌표(`15-chat-channel.md:200-201,373,390`, `2-trigger-list.md:118-120,176,333-339` 등)를
`grep`/`Read` 로 대조해 target 의 정량 주장(10곳, 자리별 판정)을 재검증했다.

## 발견사항

- **[WARNING]** 신규 400 분기(D-2) 첫 항목의 "이유" 서술이 200 vs 400 을 뒤섞을 위험
  - target 위치: `## (b) 신규 400 두 분기` 표, 1행(`chatChannel` 이 없는 트리거에 PATCH 로 처음 붙이려 함)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` — `details` 는 **에러 봉투**(`{ error: { code, message, details } }`, 4xx/5xx 전용) 소속 필드다. 200 응답에는 이 vocabulary 가 적용되지 않는다.
  - 상세: 해당 행은 `details.field='chatChannel'` 로 **400** 임을 주장하면서, 같은 셀 안에서 "PATCH 는 비밀을 못 실어 반드시 실패하고, 그 실패가 best-effort catch 에 삼켜져 **degraded 로 조용히 200** 이 된다" 고 적는다. 문면만 보면 "그 실패가 삼켜져 200 이 된다" 가 **실측된 실제 응답**인지, 아니면 "이 가드가 없으면 200 이 됐을 것이므로 가드를 신설했다" 는 반사실적 정당화인지 구별되지 않는다. 전자라면 실제 응답은 200 인데 400/`details.field` 로 SoT 표에 등재하는 것이 되어 §5.3 의 에러 봉투 스코프를 넘어서는 오기재이고, 후자라면 문장 순서상 오독 소지가 매우 크다 — 같은 세션 체인이 이미 "형식만 보고 일괄 처리하려다 철회" 를 반복해 왔다는 점(§(a) 자체 인정)에서 이 모호성은 다음 사람이 반대로 읽을 위험이 실질적이다.
  - 제안: A3 적용 전에 이 문장을 "가드 도입 전 관찰값(반사실)" 과 "가드 도입 후 실제 응답(400)" 으로 명확히 분리해서 적을 것. 만약 실측이 실제로 200/degraded 라면 이 행은 "신규 400" 표에서 빼고 `chatChannelHealth: 'degraded'` 계열 서술로 옮겨야 한다(§5.3 스코프 준수).

- **[INFO]** 신규 두 400 분기에 `details.code` 미기재
  - target 위치: `## (b) 신규 400 두 분기` 표 전체, `## 변경안` A3/B1
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` — 배열 형태(`{field, message, code}`)·객체 형태(`{field, code, …}`) 예시 모두 `code` 서브필드를 포함한다.
  - 상세: target 은 `chatChannel`/`provider` 두 분기 모두 `details.field` 값만 정하고 `details.code`(예: 기존 `INVALID_FIELD` 재사용 여부)는 언급하지 않는다. 다만 같은 파일의 기존 형제 행들(`botTokenRef`, `inboundSigningPlaintext`, `type`, `endpoint_path`)도 동일하게 `details.code` 를 명시하지 않아 **이 target 이 새로 만든 갭은 아니다** — 기존 문서 스타일의 연장.
  - 제안: A3/B1 실제 반영 시 `details.code` 값(재사용 `INVALID_FIELD` 인지, 신규 코드인지)을 한 번에 확정해 표에 명시하면 §5.3 예시 shape 과 완전히 일치한다. 차단 항목은 아니다.

- **[INFO]** 신규 400 분기의 카탈로그 등재 여부 미명시
  - target 위치: `## 결정` D-2, `## 변경안` A3/B1
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` "도메인 세부 사유를 어디에 싣는가" — "어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다. 등재되지 않은 코드는 소비자가 존재를 알 방법이 없다."
  - 상세: 두 신규 분기가 top-level `code` 를 기존 `VALIDATION_ERROR` 그대로 쓰고 `details.field` 로만 사유를 구분한다면(기존 형제 행과 동일 패턴), 이 카탈로그 요구는 `code` 값(═`VALIDATION_ERROR`)이 이미 등재돼 있으므로 추가 조치가 불필요할 가능성이 높다. 다만 target 자체가 이 판단을 명시하지 않아 실행 시점에 재확인이 필요하다.
  - 제안: A3/B1 적용 시 "기존 `VALIDATION_ERROR` 재사용, 신규 카탈로그 항목 불필요" 를 한 줄로 남기면 §5.3 요구를 명시적으로 충족했음이 드러난다.

## 검증되어 위반 없음으로 확인된 항목 (참고)

- **`details` 두 형태(배열/객체) 병존** — `2-api-convention.md §5.3` 은 "`details` 의 형태는 두 가지이고 둘 다 유효하다"(배열=ValidationPipe 다중 필드, 객체=단일 도메인 예외)를 이미 정식으로 규정한다. target D-1 의 "두 갈래 표기" 결정은 이 규약을 정확히 따르는 것이며, 오히려 "한쪽만 적으면 반대 갈래에서 틀린 문서를 읽는다"(D-1 사유)는 이 규약의 취지와 정합한다. **위반 아님.**
- **`store()`→`rotate()` 10곳 카운트** — `grep -rEn "(SecretResolver|secrets|this\.secrets)\.store" spec/` 재실행 결과 정확히 10건이며, target 이 나열한 파일·줄(15-chat-channel.md:200,201,373,390 · chat-channel-adapter.md:354,359 · telegram.md:58,219 · slack.md:278 · secret-store.md:301)과 100% 일치. `secret-store.md:301` 은 §5.1 코드 예시가 같은 문서 §2.1("Trigger 생성 시 rotate() 권장")과 이미 자기모순 상태였음을 확인 — target 의 C2 수정은 그 기존 모순을 해소하는 방향이라 **규약 위반이 아니라 기존 규약(§2.1)과의 정합화.**
- **`providers/slack.md:275` · `providers/discord.md:297` 를 손대지 않는 판단** — 두 자리 모두 `assertInboundSigningPlaintextByProvider`(생성 시점 서비스 가드)의 flat `details.field='inboundSigningPlaintext'` 이며, `2-api-convention.md §5.3` 의 "객체 형태 — 단일 도메인 예외" 패턴과 정확히 일치. 이 두 자리를 변경 대상에서 제외한 target 의 판단은 **정확**하다.
- **R-12 cross-link** — `2-trigger-list.md` 의 기존 `R-12`("변경하려면 트리거 삭제·재생성")는 target B3 가 인용하는 내용과 실제로 일치한다. Rationale ID 존재 확인 완료.
- **Rationale ID 관례** — `15-chat-channel.md` 는 "본 절 신규 항목은 `R-CC-N` prefix" 를 명시적으로 규정한다. target 은 D-2 를 "R-CC-21 의 필연적 귀결"(신규 결정이 아니라 문서화 누락)로 자리매김해 새 `R-CC-N` 항목을 만들지 않기로 했다 — 이 근거가 맞다면 새 Rationale ID 를 신설하지 않는 것이 과잉 문서화를 피하는 정합적 선택이다(단, 위 WARNING 이 지적하는 모호성이 해소되어야 "필연적 귀결" 판단 자체가 성립한다).

## 요약

target 은 세 축(`details.field` 두 갈래, 신규 400 두 분기, `store()`→`rotate()`)을 각각 `spec/5-system/2-api-convention.md §5.3`(details 두 형태 정식 규약)와 `spec/conventions/secret-store.md §2.1/§2.2`(rotate 권장·멱등성 표)에 대조해 검증했고, 정량 주장(10곳 카운트, 손대지 않는 자리 2건, R-12 cross-link)은 전부 실측과 일치했다. 명명·출력 포맷·문서 구조 규약을 새로 위반하는 지점은 발견되지 않았다 — 유일한 실질 우려는 신규 400 분기 중 첫 항목의 서술이 "400 vs 200(degraded)" 을 한 문장에서 뒤섞어, `details`(에러 봉투 전용 필드)의 적용 범위를 넘어서는 오기재로 굳어질 위험이 있다는 점이다. 이 모호성만 해소하면(실제 응답이 400 인지 200 인지 명시) A3/B1 반영에 규약상 걸림돌이 없다.

## 위험도

LOW
