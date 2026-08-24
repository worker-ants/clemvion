# 신규 식별자 충돌 검토 — node-output-envelope

## 검토 범위 확인

`--impl-done` scope=`spec/conventions/`, diff-base=`origin/main`. 프롬프트에 번들된 `spec/conventions/` 전체(272개 파일 대부분 컨텍스트 예산으로 생략) 대신, 실제 diff 대상 파일을 `git diff origin/main...HEAD --stat`로 먼저 확정하고 각 diff 전문을 직접 대조했다:

- `spec/conventions/chat-channel-adapter.md` (+13/-2)
- `spec/conventions/conversation-thread.md` (+1/-1)
- `spec/5-system/14-external-interaction-api.md` (+59/-20)
- `spec/5-system/15-chat-channel.md` (+1/-1)
- `spec/5-system/6-websocket-protocol.md` (+6/-6)
- `codebase/backend/src/modules/websocket/websocket.service.ts` / `.spec.ts`

이 PR 은 **기존에 이미 정의돼 있던 wire 필드 `output`(= `NodeExecution.outputData` / `NodeHandlerOutput` 래퍼)에 대한 주석·spec 정정 + fail-closed allowlist 를 `nodeOutput` 외 `output` 자리까지 확장**하는 범위다. 완전히 새로운 요구사항 ID, 엔티티, endpoint, 이벤트명, ENV var, spec 파일을 도입하지 않는다.

## 발견사항

### 신규 식별자 목록 (target 이 실제로 도입한 것)

- 함수 `narrowTopLevelNodeOutput(envelope, key: 'nodeOutput' | 'output')` — `codebase/backend/src/modules/websocket/websocket.service.ts:182` 신규 private 헬퍼.
- 기존 함수 `allowlistFanoutNodeOutput` 의 책임 확장 (조립 로직만 변경, 이름 변경 없음).
- spec 상 신규 서술: "wire `output` = `NodeHandlerOutput` 래퍼 전체, 도메인 값은 `output.output`" (기존 필드의 의미를 정정 — 필드 자체는 origin/main 시점부터 이미 wire 에 존재).

이 셋 모두에 대해 저장소 전체(`git grep`)로 기존 사용처 충돌 여부를 확인했다.

- **[INFO] 신규 헬퍼 `narrowTopLevelNodeOutput` 충돌 없음**
  - target 신규 식별자: `narrowTopLevelNodeOutput` (함수, `websocket.service.ts`)
  - 기존 사용처: 없음 — `git grep -n "narrowTopLevelNodeOutput"` 결과 이 파일의 정의·호출 2곳(215, 216행)과 JSDoc 참조(173, 206행)뿐. export 되지 않는 module-local 함수라 외부 네임스페이스와 충돌 여지 없음.
  - 상세: 이름이 기존 `allowlistNodeOutputKeys`(`shared/utils/node-output-allowlist.ts`), `allowlistFanoutNodeOutput`(동일 파일)과 접두어(`allowlist*`/`narrow*`)가 겹치지 않게 의도적으로 분리돼 있어 혼동 여지도 낮다.
  - 제안: 없음.

- **[INFO] wire 필드 `output` 의 층위 중의성(자기 자신과의 이름 겹침) — target 도입 아님, 사전 존재**
  - target 신규 식별자: 해당 없음 (target 은 기존 필드 `output` 의 서술을 정정할 뿐 새 식별자를 만들지 않음)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.completed`/`.failed` 이벤트 표, `NodeHandlerOutput` 타입 정의(`spec/conventions/node-output.md`, 이번 diff 미포함)
  - 상세: wire 최상위 `output`(= `NodeHandlerOutput` 래퍼 전체)과 그 안의 `output.output`(도메인 값)이 같은 리터럴 `output` 을 두 계층에서 재사용한다. 이 구조 자체는 `NodeHandlerOutput.output` 필드가 origin/main 시점부터 이미 존재했고, target 은 그 위에 fail-closed allowlist 를 추가로 씌우면서 "종전 주석이 한 겹 얕았다"고 정정하는 것뿐이라 **target 이 새로 만든 충돌이 아니다** — 이번 리뷰의 "신규 식별자 충돌" 판단 대상에서는 제외.
  - 제안: 조치 불요 (참고용 기록). 다만 후속 문서 독자가 "wire `output`" 과 "domain `output`" 을 혼동하지 않도록, target 자체가 이미 두 곳(WS §4.1 표, chat-channel-adapter.md §1.3 JSDoc)에서 "한 겹 아래" 표현으로 명시 구분해 두었으므로 추가 조치 불필요.

- **[INFO] 유니온 리터럴 `'nodeOutput' | 'output'` — 필드명 자체는 기존 존재, 신규 통합 지점만 추가**
  - target 신규 식별자: `narrowTopLevelNodeOutput` 의 파라미터 타입 `'nodeOutput' | 'output'`
  - 기존 사용처: `nodeOutput` 은 EIA `waiting_for_input` fanout envelope 필드(§EIA §6.2, `spec/5-system/6-websocket-protocol.md` §4.4)로 기존 사용 중, `output` 은 `execution.node.completed`/`.failed` 필드(§4.1)로 기존 사용 중. 둘 다 target 이전부터 각자 다른 이벤트에서 이미 정의돼 있던 필드명.
  - 상세: 두 필드명이 어댑터 코드 안에서 처음으로 "같은 헬퍼가 처리하는 두 개의 키"로 나란히 묶였다. 의미가 다른 두 필드를 한 함수가 다루긴 하지만, 파라미터 이름으로 그 필드명을 그대로 재사용하고 있어 명명 자체의 충돌(다른 의미로 이미 쓰이는 이름을 다시 씀)은 없다 — 오히려 기존 필드명을 정확히 가리키는 정합적 명명.
  - 제안: 조치 불요.

## 그 외 점검 관점 (요구사항 ID / API endpoint / 이벤트명 / ENV / 파일 경로)

- **요구사항 ID**: target 이 새로 부여한 R-CCA-*, CCH-*, EIA §R* 번호 없음. diff 는 기존 R17(EIA)·CCH-MP-06(chat-channel)·§4.1(WS)의 **본문만** 정정 — ID 신설 없음.
- **엔티티/타입명**: 새 DTO·interface 없음. `NodeHandlerOutput`, `NodeExecution.outputData` 등은 전부 기존 타입 재인용.
- **API endpoint**: 신설 없음.
- **이벤트/메시지명**: `execution.node.completed`/`.failed` 는 기존 이벤트 재사용(새 이벤트 타입 도입 없음). SSE/webhook 외부 화이트리스트(EIA §6.1 5종)도 변경 없음 — 명시적으로 "EIA §6.1 outbound 5종 화이트리스트는 변경 없음" 서술 유지.
- **환경변수·설정키**: 신규 ENV/config key 없음.
- **파일 경로**: 신규 spec 파일 없음(기존 5개 파일만 수정). 코드도 기존 파일(`websocket.service.ts`, `.spec.ts`) 내 수정.

## 요약

이 PR 은 wire envelope 의 `output` 자리에 대한 fail-closed allowlist 확장과 관련 spec 서술 정정으로, 완전히 새로운 요구사항 ID·엔티티·endpoint·이벤트명·ENV var·spec 파일 경로를 도입하지 않는다. 유일한 신규 식별자는 module-local 헬퍼 함수 `narrowTopLevelNodeOutput` 이며 저장소 전체 검색 결과 다른 의미의 기존 사용처와 충돌하지 않는다. 참조된 `nodeOutput`/`output` 필드명은 모두 target 이전부터 각각 다른 이벤트에서 이미 정의돼 있던 것을 그대로 재사용한 것이라 신규 식별자 충돌로 분류할 항목이 없다.

## 위험도

NONE
