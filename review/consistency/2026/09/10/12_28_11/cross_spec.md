STATUS: success

# Cross-Spec 일관성 검토 — 타겟 재검증 (Round 2)

## 대상

- `plan/in-progress/spec-draft-ws-protocol-intro.md` (draft, `### 본문` 코드펜스가 실제 삽입될 산문)
- `spec/5-system/6-websocket-protocol.md` (편집 대상 문서, §1(전송 계층 註)·§3.2·§4.1·§4.5~§4.7·§5·§6.1~§6.2·§7.1~§7.2·§8·`## Rationale`(특히 "재연결 복구", "`llmCalls` 외부 수신자 strip") 전수 확인)
- `spec/5-system/3-error-handling.md` (Overview·§1.5 heading 확인)
- `spec/conventions/error-codes.md` (Overview·책임 경계 서술 확인)

읽은 파일은 위 네 개이며, 1차 리뷰(`review/consistency/2026/09/10/12_11_41`)가 아니라 실제 spec 본문·plan 원문을 직접 대조했다. 프롬프트 번들(`_prompts/cross_spec.md`)이 언급한 예산 누락(타겟 문서가 tier 예산에서 잘려나간 것) 은 위와 같이 디스크에서 직접 읽어 메웠다.

## 검증 결과 (요청 순서대로)

### 1. Round-1 CRITICAL 정정 — 정확하고 빈틈이 없다

Draft 문구:
> "끊긴 동안 놓친 것은 재구독 시 **1회성 `execution.snapshot`** 으로 재동기화한다(§6.2) — `seq` 기반 replay 버퍼는 **native WS 에 없다**(SSE 어댑터 소유, §4.7)."

`6-websocket-protocol.md` §6.2 원문과 정확히 일치한다:
- "**native WebSocket 복구 모델 — `execution.snapshot`.** 재연결 후 채널을 다시 구독하면 서버는 해당 execution 의 현재 전체 상태를 1회성 `execution.snapshot` 이벤트로 발행한다" (§6.2 첫 문단)
- "**seq 기반 정밀 재전송은 SSE 전송 표면의 메커니즘이다.**... 5분 버퍼는 SSE 어댑터(`external-interaction/sse-adapter.service.ts`)가 자체 보유하며, native WS 는 위 snapshot 으로 갈음한다." (§6.2 두 번째 문단)
- §4.7 「핵심 규약」 불릿 "5분 버퍼는 SSE 어댑터 소유" 도 동일 내용을 재확인한다.
- `## Rationale` 「재연결 복구 — native WS 는 snapshot, seq 버퍼-replay 는 SSE 전송」 항목이 이 정정의 결정·근거·폐기된 대안을 못박고 있고, draft 는 그 결정과 정확히 정렬한다.

"native WS 가 `seq` 로 replay 한다"고 오독할 여지는 없다 — 문장이 "**native WS 에 없다**"로 명시적으로 부정하고, 소유 주체(SSE 어댑터)까지 적었다. 1차 CRITICAL은 완전히, 정확하게 해소됐다.

### 2. 표면 비대칭 새 문단 — §4.7·Rationale 과 정합

Draft 문구:
> "§4.7 표는 대칭이 아니라 **선택적** 매핑이고(여러 명령이 "외부 미노출"), 디버그 필드(`llmCalls`·`requestPayload`·`responsePayload`)는 **외부 수신자에게 strip 된다**. 그 비대칭은 누락이 아니라 **보안 목적의 결정**이므로..."

- 필드 목록: `## Rationale` 「`llmCalls` 외부 수신자 strip」 항목의 결정문과 일치 — "**결정 (strip-only)**: `llmCalls` (및 그 안의 `requestPayload`/`responsePayload`) 는 **인증된 내부 WS 채널에만** 포함하고, **fanout(외부) 경로에서는 strip** 한다."
- 동사 "strip": Rationale 이 스스로 "strip-only"로 명명하고 있어 정확한 용어 선택이다.
- 보안 프레이밍: 같은 Rationale 항목이 "SSE 는 `iext_*`/`itk_*` interaction 토큰만으로 접근 가능하고(워크스페이스 체크 없음) 채널 end-user 클라이언트에 전달되므로, raw payload 를 그대로 흘리면 채널 사용자에게 노출된다"고 명시 — "보안 목적의 결정"이라는 draft 의 표현은 Rationale 이 실제로 내린 판단과 일치한다.
- "선택적 매핑" 자체도 §4.7 두 표에서 확인된다: Client→Server 표의 `execution.retry_last_turn`("외부 미노출"), Server→Client 표의 다수 이벤트(Outbound Notification 열이 "—")가 그 근거다.

**경미한 정밀도 이슈 (INFO)**: draft 의 "(여러 명령이 "외부 미노출")" 는 따옴표로 직접 인용하는 형태인데, 문서 전체에서 문자열 "외부 미노출" 은 `execution.retry_last_turn` 행 **단 1건**뿐이다(grep 확인, `외부 미지원`·`해당 없음` 은 다른 행들이 쓰는 별개 라벨). "여러 명령"이 비대칭 매핑이라는 결론 자체는 여전히 참(다른 라벨의 행들·Outbound Notification 열의 "—" 다수)이지만, 인용부호 안 문구를 복수 행에 일반화한 것은 근거 인용으로는 한 칸 느슨하다. Cross-spec 모순은 아니며 정정 필수 사항도 아니다.

### 3. §4.6 claim — 두 절반 모두 정확

Draft: "§4.6 한 절 안에서도 `system.maintenance` emit 은 비채택인데 서버발신 `auth.token_expired` 는 **구현 완료**다."

- §4.6 표에서 `system.maintenance` 행: "_(비채택 won't-do)_" 라벨이 행 자체에 붙어 있고, 본문이 "발화 주체가 존재하지 않는다"며 `R-wontdo-maintenance-appping` 을 근거로 든다.
- `auth.token_expired` 의 "구현 완료" 는 §4.6 표 자체 행에는 라벨이 없지만, §1.2 본문("**구현 완료** (2026-09-02, 근거 §Rationale `R-ws-socket-lifetime-binds-token`)")과 §1의 「전송 계층 (구현 현실)」 註("서버발신 `auth.token_expired` emit(§4.6)은 **구현 완료** 다")가 명시적으로 §4.6 대상 이벤트를 "구현 완료"로 못박는다. Draft 가 "(바로 아래 §1 의 「전송 계층」 註가 갈라 적어 두었다)"고 근거 위치를 명시하고 있어, §4.6 자체 표기가 아니라 §1 註의 판정을 인용하는 구조가 정확하다.

두 절반 모두 사실과 부합.

### 4. 에러 3분할 — 각 절반 확인, §1.5 는 실제로 WS 명령 코드

Draft: "명명 규율은 `conventions/error-codes.md`, 카탈로그·응답 봉투·처리 정책은 `3-error-handling.md`(WS 명령 코드는 그 문서 §1.5), 본 문서 §7.1 은 transport 계층의 `WsErrorCode`."

- `3-error-handling.md` §Overview 원문: "에러 코드의 **명명 규율**...의 SoT 는 [conventions/error-codes.md] 이고, 본 문서는 **표기·카탈로그·응답 envelope·처리 정책**을 정의한다." — draft 문구와 자구까지 일치.
- `conventions/error-codes.md` §Overview 는 스스로 "카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)"·"응답 봉투(envelope) 형식: `3-error-handling.md §2.1`·`2-api-convention.md §5.3` (SoT)" 라고 위임해, 3-error-handling.md 쪽 서술과 상호 정합하며 자기 자신은 "의미 기반 명명 원칙·rename 안정성·historical-artifact 예외" 만 소유한다고 명시한다. 두 문서가 서로 다른 영역을 주장하지 않는다 — 충돌 없음.
- `3-error-handling.md` heading 목록을 grep 하면 **§1.5 의 제목이 정확히 "1.5 WS commands 에러 코드 (도메인 spec 참조)"** 다 — draft 의 "WS 명령 코드는 그 문서 §1.5" 주장이 문자 그대로 맞다.
- `6-websocket-protocol.md` §7.1 원문: "`ws-error-codes.ts` 의 `WsErrorCode` enum 이 transport/auth/ownership 코드... 담는다" — draft 의 "transport 계층의 `WsErrorCode`" 규정과 일치.

세 갈래 모두 실측과 부합하며, 세 문서(이 문서·`3-error-handling.md`·`conventions/error-codes.md`) 사이에 영역 주장이 겹치거나 모순되는 지점은 없다.

### 5. 정정이 새로 깨뜨린 것 — 발견 없음

- **§3.2 채널 목록**: draft "execution: · workflow: · kb: · notifications: · background:run: 다섯 종" 은 §3.2 표(정확히 5행: `execution:{executionId}` / `workflow:{workflowId}` / `kb:{documentId}` / `notifications:{userId}` / `background:run:{id}`)와 1:1 일치. 1차 리뷰가 지적한 "4채널(background:run: 누락)" 결함은 해소됐다.
- **EIA 표면 서술**: draft "외부 EIA 의 REST + SSE + Outbound Notification" 는 §4.7 원문("REST + SSE + Outbound Notification 으로 동일한 명령·이벤트를 주고받을 수 있게 한다")과 3문단 앞의 서술과도 자기 일치 — 1차 리뷰가 지적한 "EIA를 REST 로 축약"하는 자기모순도 해소됐다.
- **실행 엔진 SoT 문구**: "Execution/NodeExecution 상태 머신·블로킹/재개 계약" 은 `4-execution-engine.md` Overview("상태 머신(§1) — Execution / NodeExecution 두 레이어의 상태와 전이, 노드 핸들러의 블로킹/재개 컨트랙트")와 정확히 대응.
- 링크 4건(`./4-execution-engine.md`·`../conventions/error-codes.md`·`./14-external-interaction-api.md`·`./3-error-handling.md`)은 모두 실재하는 파일이며 상대 경로도 `spec/5-system/` 기준으로 맞다.
- 신규 `## Overview` 삽입이 만드는 `#overview` 앵커가 문서 내 기존 헤딩과 충돌하지 않는다(heading grep 결과 `## Overview` 는 draft 삽입 전 0건).
- 새 Rationale 항목("`## Overview` 표기 선택...")의 앵커 카운트(96건, `spec/`89·`plan/`7·`codebase/`0)는 plan 문서 자체가 이미 재검산해 기록한 값과 일치.

새로 도입된 문구·용어 중 기존 spec 과 충돌하거나 다른 영역의 정의를 침범하는 것은 발견되지 않았다.

## 요약

Round-1 이 제기한 CRITICAL("놓친 이벤트는 `seq` 기반으로 복구한다")은 완전히 정정됐다 — 새 문구는 native WS 의 복구 모델(1회성 `execution.snapshot`)과 `seq` 버퍼-replay 의 소유자(SSE 어댑터, §4.7)를 명시적으로 분리해 적으며, `## Rationale`「재연결 복구」 항목이 확정한 결정과 자구 수준까지 일치한다 — 어떤 방식으로 읽어도 "native WS 가 seq 로 replay 한다"는 오독 경로가 남지 않는다. 새로 추가된 표면 비대칭 문단(§4.7 선택적 매핑, `llmCalls`/`requestPayload`/`responsePayload` strip, 보안 목적 프레이밍)과 §4.6 claim(`system.maintenance` 비채택 vs `auth.token_expired` 구현 완료), 에러 3분할(명명 규율/`error-codes.md`, 카탈로그·응답 봉투·처리 정책/`3-error-handling.md` §1.5, transport `WsErrorCode`/본 문서 §7.1)은 모두 대조 소스 문서(§4.7, 두 곳의 Rationale 항목, `3-error-handling.md` §1.5 heading, `conventions/error-codes.md` Overview)와 정확히 부합한다. §3.2 채널 5종·EIA 3표면 서술도 1차 리뷰가 지적한 오류가 해소된 채로 자기 일치한다. 유일하게 발견한 것은 "(여러 명령이 "외부 미노출")" 인용구가 실제로는 문서에 1회만 등장하는 정밀도 문제(INFO)이며, 이는 cross-spec 모순이 아니고 결론(비대칭 매핑)도 다른 근거로 여전히 참이다. 새로 도입된 문장들이 다른 spec 영역의 데이터 모델·API 계약·요구사항 ID·상태 전이·권한 모델·계층 책임과 충돌하는 지점은 발견되지 않았다.

## 위험도

NONE
