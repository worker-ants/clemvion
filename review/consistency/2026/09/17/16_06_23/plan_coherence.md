# Plan 정합성 검토 — `plan/in-progress/spec-draft-window1-measured.md`

## 검토 방법

- 부모 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 전문에서 관련 항목
  (developer 항목 7 · planner 항목 "창 1 실측 결과를 spec 에 반영한다") 을 직접 grep+발췌해 대조.
- target 이 수정하려는 현재 spec 문면(`spec/2-navigation/2-trigger-list.md §3`,
  `spec/5-system/15-chat-channel.md §5.4` 404 행, 두 문서의 `code:` frontmatter)을 직접 Read.
- target 이 인용하는 코드 사실(`triggers.service.ts` 의 `findById`/`rotateBotToken`/
  `revokePerTriggerToken`/`rethrowEndpointPathConflict`, `http-exception.filter.ts` 의 기본
  500 매핑, `trigger-update-save-window.e2e-spec.ts` 존재)을 직접 확인.
- `plan/in-progress/**` 전체를 대상으로 `trigger-config-lock|동시 쓰기 직렬화|rotate-bot-token|
  revoke-token|CASCADE|trigger-update-save-window|창 1` grep — 겹치는 다른 트래커가 있는지 확인.
- 완료 plan `plan/complete/trigger-save-partial-patch.md` 의 "이 PR 이 안 하는 것" 목록과
  target 의 범위(A1/A2/A3/B) 대조.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** target 은 트래커의 정확히 3개 항목만 닫는 좁은 스코프이고, 새로 발견한 (a)(b)
  두 건도 스코프 밖 확장 없이 같은 절(§3 괄호)에 흡수하는 방식으로 처리한다
  - target 위치: `## 착수 전 실측` 3행 + `### 3 을 재다가 나온 둘`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 마지막
    미체크 항목(`- [ ] **창 1 실측 결과를 spec 에 반영한다 …**`) 표 1·2·3행
  - 상세: 트래커 표의 문구("① 재읽기 뒤 FK CASCADE 는 시끄러운 실패로 실측 … ② 락 밖 컬럼
    경합은 실결함이었고 부분 객체 `save` 로 수정됨", "`code:` 등재", "404 사유 한 줄")와
    target 의 A3/A1/B 변경안이 문구 수준까지 일치한다. (a)(b) 는 트래커 항목 3("404 사유 한
    줄")을 재다가 나온 파생 발견이며, target 은 이를 새 planner 항목으로 등재하지 않고 같은
    변경안 안에서 닫는다 — 스코프 확장이 아니라 같은 커밋 단위의 부수 정정이므로 문제는
    아니나, 트래커의 표 3행 문구("404 사유 한 줄")만 보고 (a)(b) 의 존재를 모르는 다음
    독자를 위해 target 의 `## 반영 후 검증`이 "(a)(b) 기록"을 트래커 반영 항목으로 명시한
    점은 적절하다.
  - 제안: 없음(이미 target 자체에 반영 계획이 있음). 실제 적용 시 트래커 표 3행에 (a)(b)
    요약을 함께 적어야 다음 독자가 `revoke-token` 이중 엔드포인트·심볼-only 인용 정정을
    놓치지 않는다 — target 의 계획대로 진행하면 충족됨.

## 선행 조건 검증

- target 이 전제하는 근거 구현 `#1343`(`plan/complete/trigger-save-partial-patch.md`)은 이미
  `plan/complete/`에 있고, 그 문서의 "이 PR 이 안 하는 것" 목록(114행 W1, 174~175행 W1·INFO#1)이
  target 이 지금 닫으려는 세 항목과 정확히 일치한다 — 선행 plan 미해소 없음.
- `spec/2-navigation/2-trigger-list.md §3` 의 현재 ⚠️ 문단·괄호, `spec/5-system/
  15-chat-channel.md §5.4` 404 행, `triggers.service.ts` 의 `findById`(408행, 트래커·target 이
  인용하는 122행이 아니라 실제로 낡아 있음을 확인 — target 의 "심볼만 남긴다" 처방이 정확),
  `rotateBotToken`/`revokePerTriggerToken` 의 `throwTriggerNotFound()` 두 호출부, 전역 필터의
  기본 500 매핑을 모두 코드에서 직접 재확인했고 target 의 서술과 어긋나는 지점 없음.

## 후속 항목 누락 검증

- `plan/in-progress/**` 전체에서 `trigger-config-lock`/`동시 쓰기 직렬화`/`rotate-bot-token`/
  `revoke-token`/CASCADE/`trigger-update-save-window`/"창 1" 을 grep — target 과 부모 트래커
  두 파일 외에는 어느 plan 도 이 표면을 언급하지 않는다. `chat-channel-discord-gateway.md`·
  `chat-channel-slack-socket-mode.md`·`chat-channel-visual-ssr-png.md`(chat-channel.md 의
  `pending_plans`)는 `telegram.md §5.4`(PNG/carousel)를 가리키는 것으로, target 이 건드리는
  `15-chat-channel.md §5.4`(bot token rotation 404 계약)와 다른 자리 — 충돌·누락 없음.
- `spec-conventions-engine-error-code-surface.md`(에러 코드 자매 const 명명 유보)는 엔진 레이어
  에러 코드 분류에 관한 별개 유보이고, target 이 명시적으로 미결정으로 남기는 "CASCADE 창 500
  을 전용 코드로 승격할지"와는 도메인이 다르다(HTTP 응답 계약 vs 노드 실행 에러 코드
  네임스페이스) — 오인 가능성 낮으나 혼동 방지를 위해 별도 조치 불요로 판단.
- target 의 `## Rationale`은 "500 승격 여부는 별 결정"이라고 스스로 명시하며 그 결정을
  내리지 않는다 — 미해결 결정을 일방적으로 선점하는 서술 없음.

## 요약

target 은 `spec-draft-nullable-notation-followups.md` 트래커의 마지막 미체크 planner 항목이
요구하는 세 가지(§3 ⚠️ 교체·`code:` 등재·404 사유 추가)를 문구 수준까지 정확히 이행하며,
근거 구현(`#1343`)은 이미 `plan/complete/`에 안착해 선행 조건이 해소돼 있다. 재다가 나온
(a)(b) 파생 발견도 스코프를 벗어나지 않고 같은 변경안 안에서 처리되며 트래커 반영 계획도
명시돼 있다. 저장소 전체 plan/in-progress 를 조회한 결과 이 표면(트리거 동시 쓰기 락, CASCADE
창, chat-channel §5.4 404)을 다루는 다른 진행 중 plan은 없어 후속 항목 누락도 없고, target 은
500 승격 여부처럼 실제로 미결정인 사안을 스스로 미결정으로 남겨 두어 결정 우회도 없다.

## 위험도

NONE
