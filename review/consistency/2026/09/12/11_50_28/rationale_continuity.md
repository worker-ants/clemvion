# Rationale 연속성 검토 — spec-draft-setup-error-classification

## 발견사항

- **[WARNING]** message-prefix 판별 프로토콜이 "typed error vs plain-Error 메시지 누출 차단" 원칙과 거리가 있다
  - target 위치: `## 결정` (2) `chat-channel-adapter.md` §1.1.2 신설 부분, `## 구현 위임` 1~2번
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §7.5.2 "typed ExecutionError 와 내부 메시지 누출 차단"` + `spec/5-system/3-error-handling.md §1.3` `FILE_REQUIRED` 행("규약이 메시지 문자열 파싱을 금지하므로 코드로 갈라야 분기할 수 있다") + `spec/conventions/chat-channel-adapter.md R-CCA-5`(`execution.failed` 분류는 `error.code`+`details.statusCode` **화이트리스트만** 입력으로 쓰고 `error.message` 원문은 절대 분류·노출에 쓰지 않는다는 명시 원칙)
  - 상세: target 은 `setupChannel` 이 던지는 **plain `Error`** 의 `.message` 에 `BOT_TOKEN_INVALID:` 접두를 실어 호출자가 `startsWith()` 로 파싱하게 하는 것을 "adapter 가 사유를 선언한다"고 부른다. 그러나 이는 여전히 **문자열 메시지를 파싱해 제어 흐름을 분기**하는 패턴이다 — 판별 대상이 provider 원문(`401|403`)에서 adapter 자작 접두사로 바뀌었을 뿐, "구조화된 타입/코드가 아니라 message 문자열이 분류 채널"이라는 형태 자체는 그대로다. 이 저장소는 정확히 같은 문제(내부 예외 → client 경계 분류)에 대해 두 개의 명시적 대안을 이미 세워 두었다: (a) `4-execution-engine.md §7.5.2` 는 "client 경계 에러는 typed `ExecutionError`(`{code, message, serverDetail}`) 를 따라야 하고, 그 계약을 안 따르는 **plain `Error`/unknown 은 `.message` 를 client 에 전달하지 않는다**"를 **보안 게이트**로 명문화했다. (b) `chat-channel-adapter.md R-CCA-5` 는 형제 파이프라인(`execution.failed`→chat 안내)에서 "`error.code`+`details.statusCode` 화이트리스트만, `error.message` 원문은 배제"를 채택했는데 그 이유가 바로 "노드 핸들러가 message 에 URL·DB 컬럼명·API key 조각을 흘릴 수 있다"였다. `setupChannel` 의 provider 원문 message 도 동일한 위험을 갖는다(대표적으로 discord 의 `BOT_TOKEN_INVALID: Discord verify_key 가 …`, slack 의 `Slack auth.test failed: invalid_auth`). 게다가 target 이 손대지 않는 기존 구현(ⓒ)은 `details: { reason: message.slice(0, 256) }` 로 **그 원문을 이미 클라이언트 응답에 그대로 echo**하고 있다 — (a)(b) 가 막으려는 바로 그 leak 벡터다. target 의 R-CC-23/R-CCA-9 Rationale 초안은 이 두 기존 원칙 중 어느 쪽도 인용·구분하지 않는다.
  - 제안: R-CCA-9(신규 §1.1.2)에 아래 중 하나를 명시적으로 추가한다 — ① 접두-문자열 방식이 §7.5.2 의 "plain Error" 범주에 해당하지 않는 이유(예: "이 채널은 client 에 노출되지 않는 adapter↔caller 내부 계약이라 client 경계 typed-error 요구 밖"이라는 스코프 한정), 또는 ② 이번 기회에 `Error` 서브클래스(e.g. `CredentialRejectedError extends Error { readonly code = 'BOT_TOKEN_INVALID' }`)나 `Object.assign(err, {code:'BOT_TOKEN_INVALID'})` 같은 **구조적 discriminator**로 설계를 바꿔 §7.5.2/R-CCA-5 의 방향과 정렬한다. 어느 쪽이든 `details.reason: message.slice(0,256)` 의 원문 echo 를 이번 결정 범위에서 다룰지(유지한다면 왜 R-CC-15/§7.5.2 의 leak 우려가 이 경로엔 적용 안 되는지 — 예: 호출자가 항상 인증된 워크스페이스 관리자라는 위협모델 차이)도 한 줄 근거를 남긴다.

- **[WARNING]** 편집 대상에서 빠진 `15-chat-channel.md:203` 이 새 Rationale 이 반증한 바로 그 가정을 그대로 담고 있다
  - target 위치: `## 편집 대상 원문` ⓐ 섹션 (수정 대상으로 §5.4 표 두 행만 지정), `## 체크리스트`
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md:203` (`botToken` 필드 설명 — 편집 대상 목록에 없음, target 자체가 편집 범위로 선언하지 않은 부분)
  - 상세: 203행은 *"잘못된 토큰은 `setupChannel` 의 외부 API 401/403 에서 `BOT_TOKEN_INVALID` 로 드러난다"*라고 적고 있다. 이는 target 의 실측(§ "실측 — spec 의 술어가 2/3 provider 에서 구현 불가능하다")이 정확히 반증한 문장이다 — Slack 은 HTTP 200 + `{ok:false}`, Discord 는 상태 코드 자체가 없다. target 이 §5.4 표 두 행(365~366)만 교체 대상으로 지정하고 203행을 언급하지 않으면, 같은 문서 안에 새 R-CC-23 Rationale("provider 가 401/403·`{ok:false}`·`verify_key` 불일치 중 무엇으로 알리든 같은 분류")과 정면으로 어긋나는 구식 서술이 편집 후에도 남는다.
  - 제안: `## 체크리스트` (1) 항목에 "203행 `botToken` 필드 설명의 '401/403' 서술도 새 판별 기준(접두 선언)에 맞춰 정정"을 추가한다.

- **[INFO]** "판별 원칙은 누가 고칠 수 있는가" 인용이 `3-error-handling.md` 의 축자 인용이 아니다
  - target 위치: `## 왜 그게 틀린 분류인가` 문단
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` §1.2 `VALIDATION_ERROR`(`X-Workspace-Id`) 행("클라이언트 입력 오류가 서버 오류로 보인다"), §1.3 `FILE_REQUIRED` 행("클라이언트가 취할 행동이 다르다")
  - 상세: 실제로 `3-error-handling.md` 에는 "4xx/5xx 경계 = 누가 고칠 수 있는가"라는 문장이 grep 0건이다 — target 의 인용은 그 파일의 두 개별 사례(클라이언트 입력 오류 vs 서버 오류 구분, 코드별 클라이언트 행동 차이)를 일반화한 재진술이며, 방향 자체는 기존 사례들과 정합하지만 "그것이 그것이다"라는 문장은 과잉 확정이다. Rationale 위반은 아니고, 오히려 기존 사례들과 결이 같다.
  - 제안: R-CC-23 본문에서 `3-error-handling.md` 를 인용할 때 위 두 구체 사례 중 하나를 앵커로 걸어 "이 파일이 반복적으로 적용해 온 구분"이라고 표현을 조정하면 근거가 더 방어 가능해진다.

## 요약

target 의 핵심 결정(원인 기반 분류로 전환 + adapter 가 접두 문자열로 원인을 선언)은 `discord.adapter.ts` 의 기존 관행을 승격한다는 점에서 급진적 새 결정이 아니며, 15-chat-channel.md 의 기존 R-CC 계열(R-CC-15/R-CC-19/R-CC-20 등)이 세워 둔 "v1 단순성 + fail-safe fallback 유지" 스타일과 결도 맞는다. 다만 그 구현 메커니즘 — `Error.message` 문자열 접두를 `startsWith()` 로 파싱해 400/502 를 가르는 것 — 은 이 저장소가 같은 문제(내부 예외 → client 경계 에러 분류)에 대해 이미 두 곳(`4-execution-engine.md §7.5.2` typed `ExecutionError` 게이트, `chat-channel-adapter.md R-CCA-5` 의 `error.code`+`statusCode` 화이트리스트-only 분류)에서 명시적으로 선호해 온 "구조화된 typed 필드" 방향과 반대쪽으로 한 걸음 더 간다. 어느 쪽도 명시적으로 기각된 대안을 다시 채택한 것은 아니지만(직접적인 "재도입" CRITICAL 은 없음), 새 Rationale(R-CC-23/R-CCA-9)이 이 긴장을 인지·해소하지 않고 지나가는 점, 그리고 편집 범위가 15-chat-channel.md:203 의 구식 서술을 놓쳐 같은 문서 안에서 자기모순을 남기는 점은 실측·근거는 튼튼하되 반영 완결성에서 보완이 필요하다.

## 위험도

MEDIUM
