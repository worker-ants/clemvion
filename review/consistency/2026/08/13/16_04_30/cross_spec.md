STATUS=success cross_spec review complete — 1 CRITICAL, 1 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===

# Cross-Spec 일관성 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 방법

target 은 `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (BLOCK:YES 3회 이력을 가진
"종결 이벤트 payload 단일 SoT화" 결정 draft). 번들 프롬프트가 `spec/5-system/14-external-interaction-api.md`
(EIA 본체, 98KB) · `spec/conventions/chat-channel-adapter.md` · `spec/5-system/15-chat-channel.md` ·
`spec/7-channel-web-chat/0-architecture.md` · `spec/data-flow/15-external-interaction.md` 을 컨텍스트
예산 초과로 **모두 생략**했으므로(전자는 "생략 파일 111개" 목록에, 후자 셋은 목록에조차 없음 — 애초에
related_specs 로 선정 안 됨), 위 5개 파일 + EIA 스펙 본문(§6, §Rationale R16/R17)은 리포지토리에서
**직접 Read/grep 하여** 대조했다. 아울러 target 의 핵심 기술 전제(WS flat envelope vs webhook `payload`
이중 래핑, `failRetryExecution` L956 의 `cancelledBy` 누락, PR #228 기원 주장)는 실제 소스
(`websocket.service.ts` L453-489, `notification-fanout.service.ts` L123-137,
`retry-turn.service.ts` L917-966, `git show 9ed6e6305`)로 재현·검증했다 — 전부 사실과 일치했다.

## 발견사항

- **[CRITICAL]** EIA §6 renumbering 이 spec_impact 밖 2개 파일 + 관련 plan 1개 파일의 절 번호 참조를 스테일하게 만든다
  - target 위치: "결정 — 필드 집합은 1곳..." §(1)·(2) ("신설: EIA §6.3", "EIA §6.x — 봉투") 및 체크리스트
    "EIA §6.3 신설(필드 집합) + §6.x 봉투 1회 + §6.4/§6.5 를 참조로 축약"
  - 충돌 대상:
    - `spec/5-system/15-chat-channel.md:95` — "`execution.failed` 이벤트 (**EIA §6.4**) 수신 시"
    - `spec/5-system/15-chat-channel.md:100` — "CCH-ERR-02 ... `error.code` (**EIA §6.4 enum**)"
    - `spec/7-channel-web-chat/0-architecture.md:69` — "AI 메시지 | SSE `execution.ai_message` ... | **EIA §6.5**"
    - `spec/data-flow/15-external-interaction.md:176,262` — "base-4 backoff ... — **§6.6**" (EIA 재시도 절 cross-file bare 참조)
  - 상세: target 은 현재 §6.3(`execution.completed` 페이로드)에 **새 제목의 §6.3**("종결 이벤트가 실어
    나르는 사실" 필드표)을 신설하겠다고 명시한다. 이 저장소의 spec 헤더는 순차 번호(`### 6.1`~`### 6.6`)
    관행이라, 새 §6.3 삽입은 현재 §6.3(completed)·§6.4(failed)·§6.5(cancelled/ai_message)·§6.6(재시도)를
    최소 1칸씩 뒤로 민다. spec_impact 에 등재된 4개 파일(`14-external-interaction-api.md`,
    `6-websocket-protocol.md`, `chat-channel-adapter.md`, `3-workflow-editor/3-execution.md`)은
    체크리스트로 갱신 대상이 명시돼 있으나, **위 3개 파일은 spec_impact/체크리스트 어디에도 없다.**
    이 상태로 (1)(2)를 그대로 실행하면 `15-chat-channel.md`의 "EIA §6.4" 링크는 더 이상
    `execution.failed` 페이로드/에러코드 enum 을 가리키지 않고(신설된 필드표 또는 다른 절을 가리키게
    됨), `0-architecture.md`의 "EIA §6.5"는 더 이상 `ai_message`/`cancelled` 절을 가리키지 않으며,
    `data-flow/15-external-interaction.md`의 "§6.6" 재시도 backoff 참조도 어긋난다.
    이는 정확히 target 자신이 3회 반려(`15_15_08`·`15_28_10`·`15_45_53`)에서 겪은
    "같은 규칙을 일부 절에만 적용" 패턴의 4번째 재현이다 — 이번엔 필드 열거가 아니라 절 번호 참조가
    누락처가 됐다.
  - 추가로 `chat-channel-adapter.md:145,354` 의 "EIA §6.5 **line 536**" 처럼 **리터럴 라인 번호**까지
    핀박은 참조가 2곳 있다 — §6.3 삽입으로 EIA 파일 전체 라인이 밀리면 이 앵커는 절 번호 갱신과
    무관하게 별도로 깨진다(절 번호를 맞게 고쳐도 라인 번호는 자동으로 안 맞다).
  - 제안: (a) target 의 `spec_impact` 에 `spec/5-system/15-chat-channel.md` ·
    `spec/7-channel-web-chat/0-architecture.md` · `spec/data-flow/15-external-interaction.md` 를
    추가하고, 체크리스트에 "EIA §6 renumbering 후 위 3개 파일의 §6.4/§6.5/§6.6 참조 갱신"을 명시 항목으로
    등재한다. (b) 착수 시 `grep -rn 'EIA §6\.\|external-interaction-api.md#6' spec/` 로 전수 재확인—
    본 리뷰가 잡은 목록이 최종이라고 가정하지 말 것(같은 방심이 3회 반복됐다). (c) 가능하면
    `chat-channel-adapter.md` 의 리터럴 "line NNN" 앵커 2곳을 절 번호 전용으로 정리해 향후 같은
    라인-드리프트가 재발하지 않게 한다.

- **[WARNING]** "§6.x" 로 남겨둔 봉투 절의 최종 번호가 미확정 — renumbering 범위가 실행 시점까지 불명
  - target 위치: "(2) 봉투는 채널별로 각 한 번만 서술 — EIA §6.x"
  - 충돌 대상: 위 CRITICAL 항목과 동일 파일군(§6.3~§6.6 순번에 의존하는 모든 cross-reference)
  - 상세: draft 자체가 봉투 절 번호를 "§6.x" placeholder 로 남겨, §6.3(필드표)/§6.x(봉투)/§6.4·§6.5(축약)
    사이의 최종 번호 배치가 구현 단계로 미뤄져 있다. 이는 draft 문서로서는 정상이지만, 위 CRITICAL 이
    지적한 3개 외부 파일을 실제로 몇 번으로 고쳐야 하는지도 그만큼 미정이라는 뜻이라 별도 항목으로
    분리해 기록한다.
  - 제안: 구현 착수 시 최종 번호를 먼저 확정한 뒤, 위 CRITICAL 제안의 grep 전수 재확인을 그 번호 기준으로
    1회만 수행하도록 순서를 체크리스트에 명시.

- **[INFO]** "finalNodeId·finalPort ... 엔진에 개념 자체가 없다(grep 0건)" — 정확히는 미사용 타입 흔적 1건 존재
  - target 위치: "### (1) 신설: EIA §6.3" 표 마지막 행 "~~삭제~~" 비고
  - 충돌 대상: `codebase/backend/src/modules/chat-channel/types.ts:388` —
    `result: { outputs?: unknown; finalNodeId?: string; finalPort?: string }`
  - 상세: 엔진 emit 로직(런타임 값 생성)에는 실제로 0건이 맞지만, `chat-channel/types.ts` 에 미사용
    optional 타입 필드로 흔적이 남아 있어 "grep 0건" 표현은 엄밀하지 않다. 다만 target 의 후속 목록이
    이미 "`chat-channel/types.ts:388` 을 (1) 최종형과 동기화"를 별도 항목으로 잡고 있어 실질 누락은
    아니다 — 표현만 과장됐다.
  - 제안: "엔진에 개념 자체가 없다(grep 0건)"을 "emit 로직상 0건, 단 `chat-channel/types.ts:388` 에 미사용
    타입 흔적 1건(후속에서 함께 정리)"로 다듬으면 이후 재검토자가 같은 문장을 두고 재반박할 여지가
    없어진다.

## 검증되어 충돌 없음으로 확인한 항목 (참고)

- WS `emitExecutionEvent`(L453-489)의 flat spread → `notification-fanout.service.ts`(L123-137)의
  `payload` 재래핑(중복 `executionId`/`seq`/`timestamp`) 서술은 소스와 정확히 일치. 새 거짓을 만들지
  않는다는 target 의 자체 검증이 유효함을 재확인.
- `failRetryExecution` L956 이 `cancelledBy` 를 emit 하지 않는다는 target 의 주장도 실제 소스
  (`retry-turn.service.ts` L917-966)에서 정확히 확인 — 후속 항목 인용도 유효.
- Rationale "§5.4 코드가 SoT" 선례 인용(2026-08-10, R16/L1198)과 "§6.3 이 같은 PR(#228) 기원" 주장은
  `git show 9ed6e6305:spec/5-system/14-external-interaction-api.md` 로 실측 — `finalNodeId`/`finalPort`
  가 최초 커밋부터 존재해 사실과 일치.
- `retry-turn-terminal-guard.md` **#2** 참조(파일·항목 존재, 아직 미완료 상태)도 실제 파일 대조로 확인.
- `finalPort` 열거값 중 `"completed"`(Information Extractor multi-turn 정상 종료 포트) 삭제는
  `spec/4-nodes/3-ai/3-information-extractor.md` §3.2 의 **노드 레벨 포트** 개념과는 별개 층위라
  후자 문서에 dangling 참조를 만들지 않는다 — information-extractor.md 는 EIA 를 역참조하지 않는다.
- RBAC·상태 전이·요구사항 ID 신설·계층 책임 분리 관점에서는 target 이 기존 규약과 충돌하는 지점을
  찾지 못했다(payload 문서 재구성에 한정된 변경).

## 요약

target 의 핵심 기술 전제(두 wire 가 실제로 다르다는 실측, `error`/`cancelledBy`/`durationMs` 현황,
PR #228 기원 Rationale)는 소스·git 이력 대조로 전부 사실과 일치했고, "단일 SoT + 포인터" 설계 방향
자체는 이 저장소가 이미 `redis-keys.md` 로 증명한 패턴과 정합해 반대할 근거가 없다. 다만 target 이
`spec_impact`/체크리스트로 스코프를 정한 4개 파일 밖에서, EIA §6 절 번호 renumbering 이 실제로 깨뜨릴
cross-reference 를 3개 파일(`15-chat-channel.md` ×2, `0-architecture.md` ×1,
`data-flow/15-external-interaction.md` ×2, 그중 2곳은 리터럴 라인 번호까지 핀박음)에서 확인했다 —
이는 target 문서 스스로가 3회 반려로 정의해 온 "같은 규칙을 일부 절에만 적용" 실패 패턴의 정확한
재현이며, 그대로 실행하면 4번째 라운드에서 같은 사유로 다시 걸릴 것으로 예상된다. spec_impact 확장과
체크리스트 항목 추가로 해소 가능한 범위이므로 (B) 방향 자체를 되돌릴 필요는 없다.

## 위험도

HIGH — CRITICAL 1건은 전략적 오류가 아니라 스코프 누락이라 (B) 방향은 유지 가능하지만, 이 draft 그대로
`--spec` 재검토를 통과시키면 실행 단계에서 3개 파일에 새 stale reference 를 만들 것이 사실상 확실하다.
spec_impact·체크리스트 보정 후 재검토를 권고.
