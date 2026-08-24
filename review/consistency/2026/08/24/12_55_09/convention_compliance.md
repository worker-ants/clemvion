# 정식 규약 준수 검토 — node-output-envelope (impl-done, diff-base=origin/main)

## 검토 범위

`spec/conventions/chat-channel-adapter.md` · `spec/conventions/conversation-thread.md` (diff 존재) +
교차 참조되는 `spec/5-system/6-websocket-protocol.md` · `spec/5-system/14-external-interaction-api.md` ·
`spec/5-system/15-chat-channel.md` + 코드 `codebase/backend/src/modules/websocket/websocket.service.ts`
(HEAD 워킹트리 절대경로 기준 확인).

## 발견사항

- **[WARNING] `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 타입 표가 이번 diff 로 깨졌다 (Markdown 테이블 문법 위반)**
  - target 위치: `spec/5-system/6-websocket-protocol.md` L187–L193 (`execution.node.completed` / `execution.node.failed` 행)
  - 위반 규약: 명시적 `spec/conventions/*.md` 항목은 아니나, 본 검토 관점 §3 "문서 구조 규약"(정상 렌더되는 구조화 문서) 및 CLAUDE.md 의 "정보 저장 위치 단일 진실" 문서들이 전제하는 "표는 표로 렌더된다" invariant.
  - 상세: `execution.node.failed` 행(L188)이 표 셀 안에 새 설명을 추가하면서 **닫는 `|` 없이 줄이 끝나고**, 바로 뒤에 일반 문단(`**⚠️ error 는 문자열이다**...`, L190)과 blockquote(`> 이 문구가 프런트 결함을 낳았다...`, L192)가 **테이블 행 문법(`| ... | ... | ... |`) 없이** 삽입됐다. GFM 은 헤더+구분선 뒤에 연속된 행이 끊기면 그 지점에서 테이블을 종료한다 — 이후 `execution.node.skipped`(L193)부터 `execution.node.cancelled`, `execution.waiting_for_input`, `execution.ai_message`, `execution.tool_call_started/completed`, `execution.message`, `execution.user_message` 등 **표 나머지 전체(§4.1 의 사실상 전 이벤트 카탈로그)가 새 헤더 없이 고아 행이 되어 테이블로 렌더되지 않는다.** 이 문서는 diff 곳곳에서 "SoT: WS §4.1" 로 반복 인용되는 문서라(예: `spec/conventions/chat-channel-adapter.md` §1.3, `spec/5-system/15-chat-channel.md` CCH-MP-06) 렌더 손상의 파급이 크다.
  - 제안: `execution.node.failed` 행 안의 신규 설명(경고 문구 + 프런트 결함 인용)을 **한 줄로 합치거나**, 표 밖으로 완전히 빼서 표 바로 아래 별도 단락/각주로 옮긴다 (예: 표에는 "`error` 는 string — 상세 §4.1-a 참조" 정도만 남기고, 상세 서술은 표 뒤 각주 `#### 4.1-a` 로 분리). 현재 구조(표 셀 중간에 문단·인용구 삽입)는 어떤 Markdown 렌더러에서도 유효한 테이블로 그려지지 않는다.

- **[WARNING] `NodeHandlerOutput` 래퍼 vs 도메인 값(`output.output`) 구분 서술이 단일 SoT 없이 5곳에 중복 산문으로 흩어짐**
  - target 위치: `spec/conventions/chat-channel-adapter.md` §1.3 JSDoc(L177-183) · §3 매핑표(L382) · `spec/conventions/conversation-thread.md` §9.7 표(L569-570) · `spec/5-system/6-websocket-protocol.md` §4.1(L187) · `spec/5-system/15-chat-channel.md` CCH-MP-06(L81) — (+ 기존 `spec/5-system/4-execution-engine.md:581` 도 같은 개념을 더 짧게 서술)
  - 위반 규약: CLAUDE.md "정보 저장 위치(단일 진실 원칙)" 표 — "정식 규약 → `spec/conventions/<name>.md`", "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". `spec/conventions/node-output.md` 가 `NodeHandlerOutput` 5-필드(`config/output/meta/port/status`, Principle 0)의 유일한 정본임에도, "wire 의 `output` 은 이 래퍼 전체이고 도메인 값은 한 겹 아래(`output.output`)" 라는 **동일 개념**이 5개 문서에 **각각 다른 문장으로** 반복 서술돼 있고 그중 어느 것도 `node-output.md` 를 이 구체적 서술의 SoT 로 지목하지 않는다(참조는 있지만 Principle 3.2/3.2.1 국한 — wrapper 정의 자체는 인용 안 함).
  - 상세: 이 산개형 중복이 실제로 문제를 일으켰다는 근거가 이번 세션 자체의 git 이력에 있다 — 같은 "한 겹 얕음" 결함이 `10_44_28`(naming W2) → `12_02_30`(cross_spec W1) → `12_13_36` → `12_24_55`(cross_spec CRITICAL) 로 **4 라운드에 걸쳐 각 문서를 따로 정정**했다(커밋 `feb1967a2`·`40ff94307`·`20ec30308`·`dc7debba6`). 각 문서가 자기 언어로 이 불변식을 재서술하는 구조라 한 곳을 고쳐도 나머지가 stale 로 남는 패턴이 반복됐다.
  - 제안: `spec/conventions/node-output.md` Principle 0 에 "이 래퍼가 WS/SSE wire envelope 에 실릴 때는 envelope 필드명도 `output`/`nodeOutput` 이 되어, 도메인 값 접근은 `envelope.output.output` 한 겹 더 아래가 된다" 는 문장을 **정본으로 1회** 추가하고, 나머지 4곳은 그 앵커로 링크만 걸어 산문 재서술을 걷어낸다. 다음에 이 shape 이 바뀌면 한 곳만 고치면 되게 한다.

- **[INFO] `output.output.*` wire 표기가 `node-output.md` Principle 8.1 의 금지 패턴과 문자열이 동일해 혼동 소지**
  - target 위치: `spec/conventions/chat-channel-adapter.md` L382 (`**output.output.rendered**`) · `spec/5-system/6-websocket-protocol.md` L187/L190 (`output.output.error`)
  - 위반 규약: `spec/conventions/node-output.md` §Principle 8.1 "이중/불필요한 중첩 제거" — "❌ `output.output.extracted.*` (현재 `information_extractor`)" 를 **명시적으로 금지 패턴**으로 등재. `spec/4-nodes/3-ai/3-information-extractor.md:185` 는 "옛 `output.output.extracted.*` 이중 중첩 포맷은 폐기 (Principle 8)" 라고 이 금지를 재확인한다.
  - 상세: 이번 diff 가 새로 정착시킨 wire 표기 `output.output.rendered` / `output.output.error` 는 **레이어가 다르다** — Principle 8.1 의 금지는 "핸들러 자신의 반환값 안에서" 의 이중 래핑(같은 `NodeHandlerOutput` 안에서 `output` 필드가 또 `output` 을 감싸는 것)을 가리키고, 이번 wire 표기는 "envelope(래퍼 전체) 필드명이 우연히 `NodeHandlerOutput.output` 필드명과 같아서" 생기는 **교차 계층 표기**다. 실질적으로 다른 개념이라 규약 "위반"은 아니지만, 문자열이 완전히 동일하고 이 저장소가 방금 4라운드에 걸쳐 "한 겹 깊이" 혼동으로 반복 정정했다는 사실(위 WARNING 항목)을 고려하면, 향후 신규 기여자가 이 wire 패턴을 보고 Principle 8.1 위반으로 오인하거나 반대로 "8.1 이 허용하는 패턴이니 새 핸들러에서 진짜 `output.output` 이중 래핑을 써도 된다" 고 오독할 위험이 있다.
  - 제안: Principle 8.1 금지 항목 옆에 "(wire envelope 이 `NodeHandlerOutput` 전체를 `output` 키로 실을 때 생기는 `envelope.output.output` 교차 계층 표기는 본 금지의 대상이 아니다 — 위 WARNING 항목의 SoT 문장 참조)" 한 줄 각주를 다는 것을 권고.

## 그 외 확인 사항 (위반 없음)

- `spec/conventions/chat-channel-adapter.md` Rationale ID 컨벤션(`R-CCA-N`) — 이번 diff 는 신규 Rationale 항목을 추가하지 않고 기존 JSDoc/표 셀만 수정, 위반 없음.
- `review/consistency/2026/08/24/**` 산출물 경로 — `<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` nested-ISO 패턴 준수 확인.
- `NODE_OUTPUT_ALLOWED_KEYS`(`codebase/backend/src/shared/utils/node-output-allowlist.ts`) 는 `config/output/meta/port/status` (Principle 0 의 5필드 중 공개 4+1) 를 그대로 반영 — `_resumeState`/`_retryState`/`_resumeCheckpoint` internal 필드는 의도적 제외로 Principle 0 의 "internal top-level 필드 허용 예외" 서술과 정합.
- `spec/conventions/swagger.md`(API 문서 데코레이터 규약)· `spec/conventions/redis-keys.md`· `spec/conventions/error-codes.md` — 이번 diff 범위 밖(코드 diff 는 `websocket.service.ts` 한 파일, Swagger 데코레이터·Redis 키·에러 코드 enum 신설 없음). 적용 대상 아님.

## 요약

이번 PR 은 "wire `output` 필드가 `NodeHandlerOutput` 래퍼 전체이고 도메인 값은 한 겹 아래" 라는 실측 사실을 5개 spec/conventions 문서에 반영하는 정정 작업으로, 서술 자체는 (여러 라운드를 거쳐) 정확해졌다. 다만 그 정정 과정에서 (1) `6-websocket-protocol.md` 의 이벤트 타입 표에 문단/인용구를 셀 안에 끼워 넣어 **Markdown 테이블이 실제로 깨졌고**(표 이하 전 이벤트 카탈로그 렌더 손상), (2) 같은 "래퍼 vs 도메인 값" 불변식이 5개 문서에 각기 다른 산문으로 중복 서술되어 CLAUDE.md 의 단일 진실 원칙에 어긋나며 — 이 중복 구조 자체가 이번 세션에서 4라운드 연쇄 정정을 유발한 근본 원인으로 보인다. 두 WARNING 모두 재발 방지 관점에서 실질적 가치가 있는 지적이며, CRITICAL 급 정식 규약 직접 위반은 발견되지 않았다.

## 위험도

MEDIUM
