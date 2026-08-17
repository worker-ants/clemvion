# Plan 정합성 Check 결과

## 검토 방법

`git diff origin/main --stat -- spec/5-system/` 로 실제 target diff(6개 파일: `12-webhook.md`
· `13-replay-rerun.md` · `14-external-interaction-api.md` · `15-chat-channel.md` ·
`3-error-handling.md` · `6-websocket-protocol.md`)를 확인하고, `plan/in-progress/**` 전수
(41개 파일)에서 관련 파일·관련 키워드(`마스킹`/`redact`/`egress`/`inputData`/`outputData`/
`nodeName`/`nodeLabel`/`결정 필요`)를 grep 해 target 과 대조했다.

## 발견사항

이번 target diff 는 `plan/in-progress/eia-fanout-and-internal-data-masking.md`(이 작업 자체를
추적하는 자기-참조 plan, frontmatter `spec_impact` 가 정확히 diff 대상 6개 파일 + `1-data-model.md`
+ `conventions/node-output.md` 를 열거)와, 그 상위 정본 트래커
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 양쪽 모두와 **정합**했다.
CRITICAL/WARNING 급 충돌은 발견하지 못했다.

- **[INFO] 결정 항목을 target 이 일방적으로 닫지 않고 정확히 열어 뒀다**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ③"
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md` :225-233
    ("workflow-assistant LLM 도구가 `inputData`·`outputData`·`error` 를 더 약한 마스킹으로
    내보낸다" — 명시적으로 "결정 항목" 으로 등재된 미해결 항목)
  - 상세: 트래커는 이 항목을 "어느 마스킹 의미가 우선하는지는 결정 항목" 으로 미해결 상태로
    남겨 뒀다. target 의 §R17 "잔여 ③" 은 이를 정확히 "범위 밖 유지" 로만 서술하고
    `explore-tools.service.ts` 쪽 마스킹 강도를 바꾸지 않는다 — 미해결 결정을 우회하거나
    선점하지 않았다. 같은 방식으로 `SECRET_LEAK_PATTERNS` bare `token=` 확장·연결
    문자열/스택 패턴 확장(트래커 미해결 2건)도 target 은 손대지 않았고, `kb:<documentId>`·
    `background:run:<id>` WS 채널의 마스킹(트래커 미해결 1건)도 target 의 새 WS §4.1 캐비엇이
    `execution:<id>` 채널로 범위를 명시적으로 좁혀 침범하지 않는다.
  - 제안: 조치 불요 — 정합 확인 목적의 기록.

- **[INFO] 자매 plan 이 이미 target 의 변경을 선반영해 동기화해 뒀다**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 "값-패턴 마스킹" 캐비엇
    (`WebsocketService.emitExecutionEvent`/`emitNodeEvent` 공유 초크포인트)
  - 관련 plan: `plan/in-progress/ie-resume-turn-boundary-cancel.md` :391-405
  - 상세: 이 plan 은 6차 라운드 리뷰에서 "`USER_MESSAGE` 라이브 시그널의 secret 마스킹
    비대칭" 을 INFO 후속으로 남겼었는데, 2026-08-17 날짜로 "해소" 각주를 이미 추가해
    "`WebsocketService.emitExecutionEvent` 에 값-패턴 마스킹 초크포인트가 생기면서
    `USER_MESSAGE` 를 포함한 모든 execution 이벤트가 마스킹된다" 고 정확히 target 과
    같은 결론을 선반영해 뒀다(`00_59_32 plan_coherence W2` 로 이미 처분 완료 표시). target
    변경이 이 plan 의 후속 항목을 무효화하는 게 아니라 오히려 닫는 방향이며, 그 plan
    쪽에서 이미 그 사실을 인지하고 있다 — 후속 항목 누락 없음.
  - 제안: 조치 불요.

- **[INFO] 같은 Rationale 불릿에 걸린 미해결 "선택" 인계와의 시퀀싱 메모**
  - target 위치: `spec/5-system/6-websocket-protocol.md` `## Rationale` "기각된 대안" 불릿
    바로 다음에 삽입된 `(2026-08-16 보강 — 이 결정은 유지된다)` 단락
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` :243-245
    ("planner 인계 (선택)": 같은 "strip-only 결정" Rationale 항목에
    "2026-08-14: depth-1 → depth-agnostic strip 강화(`81f2c60d6`)" addendum을 남기라는
    아직 미집행 항목)
  - 상세: 충돌은 아니다 — 두 addendum 은 다른 주제(전자는 값-마스킹 병존, 후자는 strip
    깊이 강화 이력)이고 같은 문서·같은 불릿을 겨눈다. target 이 이 자리를 먼저 편집해
    문단을 하나 늘려 놨으므로, 저 미집행 "선택" 항목을 나중에 집행하는 사람은 삽입 위치가
    바뀌었음을 알아야 한다.
  - 제안: `spec-draft-eia-62-waiting-payload.md` 쪽 항목 자체는 "선택(비필수)" 이라
    이번 target PR 이 처리할 의무는 없다. 다음에 그 항목을 집행할 때 이 target 커밋 이후의
    Rationale 블록 구조를 다시 읽고 삽입하라는 메모만 남기면 충분하다(선택사항, 비차단).

## 요약

target(`spec/5-system/**`)의 값-패턴 마스킹·`inputData`/`outputData` 카브아웃·`nodeName`→
`nodeLabel` 정정 변경은 이 작업을 직접 추적하는 자기-참조 plan
(`eia-fanout-and-internal-data-masking.md`)과 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`) 양쪽에 이미 정확히 반영돼 있고, 트래커가
명시적으로 "결정 항목"·"미해결" 으로 남겨 둔 4건(workflow-assistant 마스킹 강도·
`SECRET_LEAK_PATTERNS` bare `token=`·연결문자열/스택 패턴 확장·`kb:`/`background:run:` 채널
마스킹)은 target 이 하나도 선점하지 않고 범위 밖으로 정확히 유지했다. 다른 30여 개
in-progress plan 을 `nodeName`·`inputData`/`outputData`·마스킹 키워드로 전수 대조했을 때도
target 과 상충하는 가정이나 무효화되는 후속 항목은 발견되지 않았고, 오히려
`ie-resume-turn-boundary-cancel.md` 는 target 의 변경을 이미 선반영해 자기 후속 항목을 닫아
둔 상태였다. Plan 정합성 관점에서 이 target 은 안전하다.

## 위험도

NONE
