# naming_collision 검토 보고서

대상: `plan/in-progress/spec-draft-ws-protocol-intro.md` 가 `spec/5-system/6-websocket-protocol.md`
에 삽입하려는 `## Overview` 헤딩 + 3단락 산문 (§1. 연결 앞).

## 사전 고지 — 번들 갭 보완

프롬프트 지시대로, 번들이 예산 절단되어 target 문서가 빠져 있었던 갭을 디스크 직접 열람으로
메웠다. 열어서 확인한 파일:

- `spec/5-system/6-websocket-protocol.md` (전체 1273줄 — 헤딩 목록 grep + 관련 구간 발췌)
- `spec/5-system/4-execution-engine.md` (16~50행: `## Overview` 선례 구간)
- `plan/in-progress/spec-draft-ws-protocol-intro.md` (실제 target 초안 — working tree 상
  `6-websocket-protocol.md` 자체는 아직 미수정이고, 이 plan 파일이 삽입될 산문의 원본이다)

## 발견사항

### [WARNING] "116건" 인용 개수 주장이 실측과 어긋난다

- target 신규 식별자: 해당 없음(식별자 문제 아님) — 그러나 target 이 `## 1. 개요`(번호형)
  대신 `## Overview`(무번호)를 선택한 **핵심 근거**가 "번호 앵커 인용이 116건이라 갈아엎으면
  전부 깨진다"는 정량 주장이므로, 이 정량 근거 자체를 §Section-number-stability 검증 항목으로
  독립 실측했다.
- 기존 사용처: `plan/in-progress/spec-draft-ws-protocol-intro.md:47,149,173` (세 곳에서 "116건"을
  반복 인용, 체크리스트 항목에도 박혀 있음)
- 상세: `spec/`+`codebase/`+`plan/` 전역에서 `6-websocket-protocol.md#<anchor>` 형태의 인용을
  전수 grep 한 결과:
  - occurrence 기준(`-o`): **96건** (spec 89 + plan 7, codebase 0)
  - line 기준(`-c` 합산): **93건**
  - target 문서 자신이 본문에 나열한 근거 표(§"번호 표기를 실측으로 골랐다")를 그대로 합산하면
    **94건**
  - 셋 중 어느 것도 **116**과 일치하지 않는다 (차이 20~23건).
  - 참고로 `review/` 디렉터리(과거 consistency-check 산출물)까지 포함하면 188건이지만,
    `review/`는 프롬프트가 지정한 3개 스코프(`spec/`·`codebase/`·`plan/`)에 없고 인용이 깨져도
    "저장소가 참조하는 자리"로 볼 근거가 약하다 — 이걸 더해도 116엔 못 미친다.
- 제안: 이 논증의 **결론**(무번호 `## Overview` 는 기존 번호 앵커를 하나도 안 건드린다)은
  인용 개수가 94 든 96 이든 116 이든 **변하지 않는다** — 새 헤딩이 기존 헤딩 텍스트를 하나도
  고치지 않기 때문이다. 따라서 이 개수 오차가 target 의 채택 결정 자체를 뒤집진 않는다. 다만
  체크리스트 항목("번호 앵커 116건 무변경 확인")이 틀린 숫자를 박은 채 다음 사람에게 넘어가면
  "94(또는 96)건만 확인하고 116건을 못 채웠다"는 혼선이 생길 수 있으니, 병합 전에 실측치로
  정정해 두는 편이 낫다. (CRITICAL 이 아니라 WARNING 인 이유: 식별자 충돌이 아니라 서술 정확도
  문제이고, 뒤에 오는 실질 조치인 "삽입 전/후 헤딩 목록 diff"는 숫자와 무관하게 그대로 유효하다.)

### [INFO] Overview 산문이 §3.2 채널 5종 중 4종만 나열한다

- target 신규 식별자: Overview 3단락 중 1문단, "구독 단위는 execution·workflow·notifications·kb
  채널이며(§3)"
- 기존 사용처: `spec/5-system/6-websocket-protocol.md` §3.2 채널 패턴 표 (5개 행: `execution:`,
  `workflow:`, `kb:`, `notifications:`, `background:run:{id}`)
- 상세: 이름 자체의 충돌은 없다 — `execution`/`workflow`/`notifications`/`kb` 넷 다 §3.2 표의
  패턴 접두사와 정확히 같은 의미로 쓰인다(새 의미 도입 없음). 다만 §3.2 가 정의하는 다섯 번째
  채널 `background:run:{id}` 이 Overview 열거에서 빠져 있어, "구독 단위는 이 4종"이라는 문장이
  본문 표와 완전히 정합하지는 않는다.
- 제안: 식별자 충돌은 아니므로 차단 사유는 아니다. 다만 완전성을 원하면 "execution·workflow·
  notifications·kb·background 채널" 로 5종을 다 나열하거나, "예: execution·workflow…" 처럼
  예시화하는 정도의 손질만으로 충분하다.

## 점검했으나 충돌 없음으로 확인된 항목 (근거 포함)

1. **헤딩/앵커 충돌 (신규 `## Overview` → `#overview`)**: `6-websocket-protocol.md` 의 전체
   헤딩을 grep 으로 전수 열거했다 (`# Spec:` 1개, `## 1.`~`## 9.` 및 하위 `###`/`####` 전부,
   `## Rationale` 포함). "Overview" 라는 텍스트를 가진 헤딩은 **현재 0개** — 삽입 후에도
   `#overview` 슬러그는 유일하며, github-slugger 가 `#overview-1` 로 밀어낼 기존 헤딩이 없다.
2. **선-인용 여부**: `spec/`·`codebase/`·`plan/` 전역에서
   `6-websocket-protocol.md#overview` (대소문자·`overview-1` 변형 포함) 를 찾았으나 **0건** —
   아무 문서도 이 앵커를 미리 기대하고 있지 않다. 새 헤딩이 어떤 문구든 기존 계약을 깨지 않는다.
3. **번호 섹션 안정성**: 위 WARNING 에서 다룬 개수 오차와 별개로, **삽입 자체가 기존 헤딩
   텍스트를 단 하나도 바꾸지 않는다**(§1 연결 앞에 새 H2 를 끼워 넣을 뿐, `## 1. 연결` ~
   `## 9. …` 텍스트/순서는 그대로)는 것을 직접 확인했다. 따라서 94~96건의 살아있는 인용은
   앵커 문자열이 그대로라 전부 깨지지 않는다. 개별 검증: `#42-실행-제어-명령-client--server`
   (29건, `### 4.2 실행 제어 명령 (Client → Server)` 와 슬러그 일치) · `#44-사용자-입력-대기-
   이벤트-상세-executionwaiting_for_input` (28건, `### 4.4 사용자 입력 대기 이벤트 상세
   (`execution.waiting_for_input`)` 와 일치) · `#446-messagessource-마커`(7)·`#41-실행-이벤트-
   server--client`(7)·`#71-에러-코드`(5)·`#22-서버--클라이언트-이벤트-래퍼`(5)·`#45-알림-
   이벤트-server--client`(4)·`#445-conversation-thread-snapshot-conversationthread`(3)·
   `#rationale`(2)·`#62-놓친-이벤트-복구`(2)·`#47-외부-표면-매핑-external-interaction-api`(1)·
   `#4-이벤트-목록`(1) — 전부 현재 헤딩과 슬러그가 정확히 일치한다.
4. **선재(pre-existing) 깨진 인용 1건 발견 — target 과 무관, 이미 target 이 알고 있음**:
   `plan/complete/archive/from-followup-conversation-reconcile/spec-draft-conversation-reconcile-doc.md`
   16행·21행이 `6-websocket-protocol.md#44-실행-진행-이벤트` 를 인용하는데, 현재 §4.4 헤딩은
   `사용자 입력 대기 이벤트 상세` 로 개명되어 있어 이 앵커는 **현재 실재하지 않는다** (2건,
   같은 파일). target 초안이 "무엇을 하지 않나" 절에서 이 정확히 같은 2건을 스스로 찾아 "archive
   는 역사 기록이라 사후 개작하지 않는다"고 이미 처분했음을 확인했다 — 독립 재검증 결과 그
   판단에 이견 없음(새 조치 불필요).
5. **엔티티/식별자 의미 정합 (`Execution`/`NodeExecution`, `seq`, 채널명)**: Overview 산문이
   "실행 상태 전이(Execution/NodeExecution 상태 머신)는 실행 엔진이 SoT" 라고 적은 문장을
   `4-execution-engine.md` §1.1/§1.2(`### 1.1 Execution 상태`, `### 1.2 NodeExecution 상태`)
   와 대조 — 같은 엔티티, 같은 의미로 위임 관계만 서술한다(새 정의 없음, 충돌 없음). `seq` 는
   본 문서 §2.2(113행)가 이미 "채널 내 순서 번호 (`ExecutionSeqAllocator`, Redis
   `INCR exec:seq:<executionId>`)" 로 정의한 것과 동일 개념을 재언급할 뿐 신규 의미 도입이
   아니다. 채널명 `execution`/`workflow`/`notifications`/`kb` 는 §3.2 표의 기존 패턴과 그대로
   일치한다(위 INFO 참조 — 완전성만 4/5로 아쉬움, 의미 충돌은 없음).
6. **선례 인용 정확성**: target 초안이 "`4-execution-engine.md` 의 Overview 는 이미 이 문서의
   §4.2 를 WS ack SoT 로 인용한다"고 주장한 부분을 직접 열어 확인 — `4-execution-engine.md:32`
   에 `[WebSocket 프로토콜 §4.2](./6-websocket-protocol.md#42-실행-제어-명령-client--server)`
   가 실재한다. 주장 그대로 사실이다.
7. **링크 대상 파일 실재**: Overview 가 인용하는 `./4-execution-engine.md`·
   `../conventions/error-codes.md`·`./14-external-interaction-api.md` 3개 파일 모두 디스크에
   실재함을 확인했다(파일 크기 조회로 존재 확인).

## 요약

target 이 새로 도입하는 식별자는 헤딩 `## Overview` 하나뿐이며, 이 문서에는 그 텍스트를 가진
기존 헤딩이 없어 앵커 슬러그 충돌(`#overview`/`#overview-1`)이 발생하지 않는다. 어떤 문서도
`6-websocket-protocol.md#overview` 를 미리 인용하고 있지 않아 기대-불일치 문제도 없다. 삽입이
기존 번호 헤딩의 텍스트/순서를 전혀 바꾸지 않으므로, 저장소 전역의 살아있는 번호-앵커 인용
94~96건은 삽입 전후로 전부 그대로 해석된다 — 다만 target 이 그 개수를 "116건"으로 적은 것은
세 가지 계산 방식(occurrence 96 / line 93 / 자체 표 합계 94) 중 어느 것과도 맞지 않아 정정이
필요한 서술 오차다(결론에는 영향 없음). Overview 산문이 언급하는 `Execution`/`NodeExecution`·
`seq`·채널명은 모두 기존 정의와 동일 의미로 쓰였고 새 의미를 얹지 않는다 — 다만 채널 5종 중
4종만 나열해 완전성이 약간 아쉽다. 사전에 존재하던 archive 내 깨진 앵커 인용 1건(2 occurrence)
은 target 이 이미 인지하고 의도적으로 방치하기로 한 것으로, 재검증 결과 그 처분에 동의한다.

## 위험도

LOW
