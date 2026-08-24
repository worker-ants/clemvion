# 신규 식별자 충돌 검토 — `node-output-envelope` (impl-done, scope=spec/5-system/)

## 점검 범위 확인

`origin/main` 대비 실제 diff(`git diff origin/main`)를 1차 근거로 사용했다(HEAD 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/node-output-envelope-458f05`). 변경 파일:

- 코드: `codebase/backend/src/modules/websocket/websocket.service.ts` (+`*.spec.ts`)
- spec: `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` ·
  `spec/5-system/15-chat-channel.md` · `spec/conventions/chat-channel-adapter.md` ·
  `spec/conventions/conversation-thread.md`
- plan: `plan/complete/node-output-envelope.md`(신규) · `plan/complete/sse-nodeoutput-allowlist.md` ·
  `plan/in-progress/spec-draft-eia-62-waiting-payload.md` ·
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- `CHANGELOG.md`

이 작업의 성격은 **새 기능/새 표면 도입이 아니라, 기존 fanout allowlist chokepoint
(`allowlistFanoutNodeOutput`, `#1208` 도입)를 세 번째 위치(`envelope.output`)까지 확장**하고,
그 과정에서 기존 spec 서술의 오류(잘못된 유예 근거·`error` 필드 타입 오기술)를 정정한 것이다.
따라서 신규 요구사항 ID, 신규 엔티티/DTO, 신규 API endpoint, 신규 이벤트명, 신규 ENV
var/config key, 신규 spec 파일이 **원천적으로 존재하지 않는다** — 아래는 그 각 관점에서
실측으로 확인한 결과다.

## 관점별 확인

### 1. 요구사항 ID 충돌
diff 에 새 ID 부여 없음. `CCH-MP-06`(15-chat-channel.md)은 **기존 ID**의 본문 텍스트만
정정됐다(`output.rendered` → `output.output.rendered`). 신규 ID 없음.

### 2. 엔티티/타입명 충돌
`websocket.service.ts` 에 함수 `narrowTopLevelNodeOutput` 이 신규 도입됐다. 전체 저장소에서
grep 한 결과 정의 1곳 + 호출 2곳 + plan 문서 언급 1곳뿐이며, 다른 의미로 기존에 쓰이던
동명 식별자는 없다(module-private 함수, export 없음). 기존 `allowlistFanoutNodeOutput`(정의
`websocket.service.ts:210`, 호출 `:511`)은 `#1208` 에서 이미 도입된 함수로, 이번 PR 은 그
내부 구현만 리팩터했다 — 신규 이름 아님. 충돌 없음.

### 3. API endpoint 충돌
신규 endpoint 없음. 관련 서술(REST `POST /workflows/:id/execute`, `POST /executions/:id/stop`
등)은 모두 기존 문서의 인용이며 이번 diff 로 새로 추가되지 않았다.

### 4. 이벤트/메시지명 충돌
`execution.node.completed` / `execution.node.failed` / `execution.waiting_for_input` 등은
전부 기존에 정의된 이벤트명이고, 이번 변경은 그 payload 내부 `output` 필드의 **필터링 강도**
(deny-list → allowlist)와 **문서 서술 정확도**(래퍼 vs 도메인 값 층 구분, `error` 필드
타입)만 바꿨다. 새 이벤트명·새 webhook/queue/sse 채널 없음.

### 5. 환경변수·설정키 충돌
diff 전체에 신규 ENV var·config key 없음(`EXECUTION_SEQ_TTL_SECONDS`, `MAX_SUBSCRIPTIONS_PER_CONNECTION`
등은 모두 인용된 기존 값이고 이번 PR 이 건드리지 않은 라인).

### 6. 파일 경로 충돌
- 신규 spec 파일 없음(`git diff origin/main --diff-filter=A -- spec/` 결과 0건).
- 신규 plan 파일 `plan/complete/node-output-envelope.md` 1건 — `plan/complete/<slug>.md`
  기존 명명 컨벤션을 그대로 따른다. 완료 상태(`status: complete`)로 바로 생성돼 있고
  `worktree: node-output-envelope-458f05` 로 이 작업 슬러그와 일치한다. 파일명 자체의
  중복은 없다(`find plan -iname "*node-output*"` → 이 파일과 아래 항목뿐).

- **[INFO] plan 슬러그 접두어 유사** — `plan/complete/node-output-envelope.md`(이번 작업,
  WS/SSE fanout envelope 의 `output` 필드 allowlist)와 `plan/in-progress/node-output-redesign/`
  (노드별 `NodeHandlerOutput` shape 재설계 트래커, 29개 노드 서브파일)이 `node-output-` 접두를
  공유한다. 둘은 **주제가 명확히 다르다** — 전자는 egress 필터링(전송 계층), 후자는 노드
  핸들러 출력 스키마 재설계(도메인 계층) — 이므로 실질적 충돌·혼선 위험은 낮다고 판단했으나,
  두 트래커가 공교롭게도 같은 `NodeHandlerOutput`/`outputData` 대상을 다른 각도에서 다루고
  있어 향후 검색(`grep node-output`) 시 결과가 섞일 수 있다. 액션 불요 — 명명 관례 위반은
  아니며 기존에도 있던 병존(둘 다 이번 PR 이전부터 별개로 존재).

## 요약

이번 target 변경분(`node-output-envelope`)은 새 식별자를 도입하지 않는 순수 확장·정정
작업이다 — 코드 측 신규 식별자는 module-private 헬퍼 함수 `narrowTopLevelNodeOutput` 하나뿐이고
저장소 전체에서 유일하게 쓰이며 기존 동명 식별자와 충돌하지 않는다. 요구사항 ID·엔티티/DTO·
API endpoint·이벤트명·ENV var·신규 spec 파일 어느 카테고리에서도 신규 도입 항목이 없어
충돌이 발생할 표면 자체가 없다. 유일하게 언급할 만한 것은 신규 plan 파일이 기존 `node-output-`
접두 트래커와 이름이 유사하다는 INFO 수준 관찰이며, 주제가 뚜렷이 갈려 실질 위험은 없다.

## 위험도

NONE
