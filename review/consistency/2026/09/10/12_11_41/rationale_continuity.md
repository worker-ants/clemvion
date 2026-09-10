# Rationale 연속성 검토 — `6-websocket-protocol.md` 도입 산문

대상: `plan/in-progress/spec-draft-ws-protocol-intro.md` (신설 `## Overview` 3단락,
삽입 대상 `spec/5-system/6-websocket-protocol.md`)

## 발견사항

- **[INFO]** "raw WebSocket 프레이밍을 전제한 항목들 ... 등" 의 열거가 §4.6 의 혼재 상태를 압축한다
  - target 위치: draft 본문 "### 본문" 블록, 두 번째 문단 첫 문장 — *"raw WebSocket 프레이밍을 전제한 항목들(§1.2 서브프로토콜 인증 · §8 close 코드 등)은 **비채택**이다."*
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale`의 `R-wontdo-rawws-rest`(2026-07-08), `R-wontdo-maintenance-appping`(2026-09-02), `R-ws-socket-lifetime-binds-token`(2026-09-02). 그리고 이 세 결정을 한 문장으로 요약해 두는 §1 「전송 계층 (구현 현실)」 註.
  - 상세: draft 가 명시적으로 이름을 대는 항목(§1.2 서브프로토콜 인증, §8 close 코드)은 실제로 `R-wontdo-rawws-rest` 가 종결한 항목과 정확히 일치하고, `auth.token_expired`(§4.6, `R-ws-socket-lifetime-binds-token` 로 **구현 완료**)는 언급하지 않는다 — 그 자체로는 모순이 없다. 다만 문장이 "등" 으로 열려 있고, 바로 그 §4.6 이라는 한 섹션 안에 비채택 결정(`system.maintenance`)과 구현 완료 결정(`auth.token_expired`)이 **공존**한다는 사실을 draft 가 §1 註 인용으로만 넘긴다. 독자가 "raw-WS 전제 항목 등" 을 §4.6 전체로 확대 해석하면 이미 구현된 항목을 비채택으로 오독할 소지가 남는다. 다행히 §1 의 실제 註 문장 자체는 세 갈래(비채택/비채택/구현완료)를 정확히 분리해 적어 두었고, draft 도 "그 경계의 SoT 는 바로 아래 §1 註" 라고 명시적으로 위임하므로 실질적 오류로 이어지지는 않는다.
  - 제안: 강한 조치는 불필요. 원한다면 "등" 을 지우거나 "(근거는 §1 註의 세 갈래 구분 참조)" 정도의 짧은 안전장치를 덧붙여, §4.6 안에 방향이 다른 결정이 공존한다는 것을 도입문 단계에서부터 명시할 수 있다.

- **[WARNING]** "같은 실행 상태가 두 표면으로 나간다" — llmCalls strip·§4.7 "외부 미노출" 행들의 의도적 비대칭과 나란히 놓일 때 완전 대칭으로 오독될 여지
  - target 위치: draft 본문 "### 본문" 블록, 두 번째 문단 — *"둘째, 같은 실행 상태가 두 표면으로 나간다 — 내부 WS 와 외부 EIA 의 REST + SSE + Outbound Notification 이며, 명령·이벤트 매핑의 권위는 §4.7 이 갖는다."*
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` `R5`(외부 WebSocket 채널 신설 — 보류, v1 은 SSE+REST 로 "충분"), `R7`(seq 동일 공유); `spec/5-system/6-websocket-protocol.md` `## Rationale`의 `` `llmCalls` 외부 수신자 strip — 위치·이벤트·표면 무관 (strip-only 결정) ``.
  - 상세: `llmCalls`(및 `requestPayload`/`responsePayload`) strip 결정은 "**인증된 내부 WS 채널에만** 포함하고 **fanout(외부) 경로에서는 strip**" 한다고 명시적으로 결정했고, 그 근거는 보안(민감정보 채널 노출 차단)이다. §4.7 매핑 표에도 `execution.retry_last_turn`·`execution.start`·`execution.continue`/`execution.step` 등 여러 행이 "(외부 미노출)" 로 명시돼 있다. 이 문서의 자체 설계는 "내부/외부가 같은 실행을 다룬다" 는 것이지 "내부/외부가 같은 페이로드를 받는다" 는 것이 아니다 — 오히려 그 반대(의도적 비대칭)가 여러 Rationale 항목의 요지다. draft 의 "같은 실행 상태가 두 표면으로 나간다" 는 §4.7 본문의 기존 표현("동일한 명령·이벤트를 주고받을 수 있게 한다")을 그대로 잇는 것이라 완전히 새로운 주장은 아니지만, Overview 라는 입구 자리에서 한정어 없이 던져지면 "두 표면은 동일 정보를 받는다" 로 확대 해석될 위험이 §4.7 본문보다 크다 — 특히 llmCalls strip 은 **보안 목적의 의도적 비대칭**이라 이 오독이 실제로 위험한 방향(누락 방지가 아니라 유출 방지)을 향한다.
  - 제안: 두 번째 문단에 짧은 한정을 추가한다. 예: *"같은 실행 상태를 두 표면이 보고하되, 매핑은 완전 대칭이 아니다 — 디버그 전용 필드(`llmCalls`)는 외부로 strip 되고 일부 명령·이벤트는 §4.7 표에서 외부 미노출로 표시된다."* 또는 최소한 "명령·이벤트 매핑의 권위는 §4.7 이 갖는다" 뒤에 "(§4.7 은 대칭이 아니라 선택적 매핑 표다)" 정도의 짧은 브레이크를 붙여, 입구 문장이 뒤 섹션들의 의도적 비대칭 결정을 덮어쓰지 않게 한다.

- **[INFO]** Socket.IO 를 "정착된 사실" 로 서술 — 두 이력 항목과 정합
  - target 위치: draft 본문 첫 문단 — *"첫째, 전송 계층은 Socket.IO 다"*
  - 과거 결정 출처: `## Rationale` `전송 계층 정정 — raw WebSocket 프레이밍 → Socket.IO + status partial 강등 (2026-06-03)`, `` `implemented` 승격 — 잔존 "계획·미구현" 배지가 막지 않는 이유 (2026-09-02) ``.
  - 상세: 2026-06-03 항목이 "정정한 사실(구현 일치)" 로 이미 Socket.IO 를 확정했고, `partial` 강등은 Socket.IO 여부에 대한 의심이 아니라 잔여 backlog(§Rationale 상 별도 항목들) 때문이었다. 2026-09-02 에 그 backlog 가 전부 처분되어 `implemented` 로 복귀했다. frontmatter 현재 값도 `status: implemented` 로 확인된다. draft 가 Socket.IO 를 "정착된 사실" 로 서술하는 것은 두 이력 어느 쪽과도 충돌하지 않고, 오히려 가장 최신 상태(구현 완료 재확인)를 정확히 반영한다. 결정을 다시 여는 것도, 근거 없이 번복하는 것도 아니다.
  - 제안: 없음(정보 기록용).

- **[INFO]** `## Overview` 헤딩 표기 — 사전 고정 결정 없음, draft 의 처리는 적절하나 산문이 plan 문서에만 남는다
  - target 위치: draft "## 제목 표기를 실측으로 골랐다" 절 전체
  - 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 2026-09-05 처분 항목(`` `spec/5-system/` 의 `## Overview` 유무 불일치 ``) 및 그 열린 후속 항목(`` `6-websocket-protocol.md` 도입 산문 ``); 자매 실행 `plan/complete/spec-draft-api-convention-verifier-registration.md`(커밋 `983fd0adee0`).
  - 상세: 확인한 결과 **헤딩 문구를 고정한 선행 결정은 어디에도 없다.** 2026-09-05 처분은 "형태는 그 문서 관행을 따르면 되고, `## Overview` 헤딩이어야 할 이유는 없다" 라고 적었는데, 이는 **금지가 아니라 강제 부재를 알리는 문장**이다 — 어떤 표기든 허용된다는 뜻이지 특정 표기를 배제한다는 뜻이 아니다. 자매 실행(`2-api-convention.md`, 커밋 `983fd0adee0`)은 `## Overview (제품 정의)` 를 선택했지만, 그 실행 자체의 `--spec` 반영 기록도 이를 "판단" 으로 적었을 뿐 "프로젝트 규칙" 으로 승격하지 않았다(그 기록의 INFO#4 는 오히려 *"Overview 헤딩 형태 근거를 Rationale 에 한 줄 적으라"* 고 권고했는데, 실제 병합된 `2-api-convention.md` 본문·Rationale 을 확인한 결과 그 문장은 반영되지 않았다 — 즉 선례조차 헤딩 선택 근거를 spec 자체에 공식화하지 못한 채 남아 있다). 현재 저장소 실태도 `5-system/` 안에서 `## 1. 개요`(3개) · `## Overview (제품 정의)`(8개) · 무제목(1개) · 순수 `## Overview`(2개) 로 이미 갈려 있어 단일 규범이 없다. 따라서 draft 가 판별 기준(내부 계약/정책 문서 vs 사용자 인지 제품 표면)을 새로 세워 순수 `## Overview` 를 고른 것은 **기존 결정의 재도입/번복이 아니라 첫 결정**이며, draft 는 이를 "다수결이 아니라 판별 기준으로 골랐다" 고 스스로 명시해 소급 정당화의 위험(과거 세션에서 반복 지적된 "선례에 없는 근거를 소급 부여" 패턴)을 피하고 있다.
  - 제안: 이 판별 기준과 소수 선택 사유는 현재 plan 문서에만 있다. plan 이 `complete/` 로 이동하면(또는 archive 되면) 다음 사람이 "왜 8개 다수를 안 따랐는가" 를 되짚어야 한다 — 자매 선례의 INFO#4 권고가 실제로 실행되지 못했던 것과 같은 유실이 반복될 수 있다. `## Overview` 삽입 시 한두 문장짜리 근거를 target spec 자신의 `## Rationale` 에도 남기는 것을 권한다(예: 기존 항목 형식에 맞춰 "`## Overview` 표기 선택 — 내부 계약 문서 분류" 같은 짧은 신설 항목).

## 요약

이 draft 는 대상 문서의 매우 길고 촘촘한 `## Rationale`(raw-WS 비채택 2건, 소켓 수명 결정 1건, 상태 승격 이력, 두 표면 매핑 R5/R7/llmCalls strip)을 반복하지 않고 정확히 가리키는 방식으로 작성돼 있고, 사실관계(§1.2·§8 이 실제로 비채택 표기인지, Socket.IO 상태가 `implemented` 로 복귀했는지, §4.7 이 실제로 "단일 구현 경로"·"매핑 권위" 문구를 이미 갖고 있는지)를 모두 실측으로 대조한 결과 명시적으로 기각된 결정을 재도입하거나 구현 완료 항목을 비채택으로 오도하는 CRITICAL 급 충돌은 발견하지 못했다. 다만 (1) "raw WS 전제 항목 등" 열거가 §4.6 안의 혼재된 두 결정(비채택 vs 구현완료)을 도입부에서 뭉뚱그릴 여지가 남아 있고, (2) "같은 실행 상태가 두 표면으로 나간다" 는 문장이 `llmCalls` strip·§4.7 "외부 미노출" 행들이 세워 둔 **의도적 비대칭**을 한정 없이 대칭처럼 읽히게 할 위험이 있어 WARNING 으로 표시했다. 헤딩 표기(`## Overview`)는 선행 결정이 존재하지 않음을 확인했고, draft 의 판별 기준 도출 방식 자체는 건전하나 그 근거가 plan 문서에만 남아 있어 유실 위험이 있다는 점을 INFO 로 남긴다.

## 위험도

LOW
