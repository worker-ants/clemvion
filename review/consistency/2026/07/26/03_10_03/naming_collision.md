# 신규 식별자 충돌 검토 — spec/conventions/ (impl-done)

## 검토 범위 확정

`git diff origin/main...HEAD --stat -- spec/conventions/` 결과, 이번 변경은 **`spec/conventions/node-cancellation.md` 1개 파일, +5/-5 라인**뿐이다. 프롬프트에 번들된 `spec/conventions/` 전역(감사 액션·Cafe24/MakeShop API 카탈로그 등)은 충돌 검색용 코퍼스이며 target 자체가 아니다. 아래는 그 diff가 실제로 도입하는 식별자만을 대상으로 한다.

diff 요지:
1. §1 목적 문단에서 "chat-channel" 을 장기 외부 I/O 노드 예시 목록에서 제거.
2. §6 표 범례에 새 상태값 `N/A`(= 범주 오류로 대상에서 철회) 추가.
3. §6 표에서 `chat-channel 노드 signal 전파` 행을 취소선 처리하고 상태를 `N/A` 로 변경, 근거로 `CCH-AD-05`·Rationale `R1`(둘 다 `spec/5-system/15-chat-channel.md`)을 인용.
4. §6 표에서 `MakeShop 노드 signal 전파`·`Cafe24 노드 signal 전파` 행의 상태를 `—`(미구현)→`✓`(구현됨)로 변경.

## 발견사항

### 1. 상태 마커 `N/A` 신규 도입 — 충돌 없음 (참고용)
- target 신규 식별자: 표 범례의 상태값 `N/A` (`spec/conventions/node-cancellation.md:123`, 사용처 `:137`)
- 기존 사용처: 없음. `grep -rln '| N/A |' spec/` 결과 이 파일이 유일하다. `spec/conventions/cafe24-api-catalog/**`·`makeshop-api-catalog/**` 의 `status` 컬럼은 별도 enum(`supported`/`planned`/`deprecated`)을 쓰며 `N/A` 를 쓰지 않는다.
- 상세: `N/A` 는 이 표에만 국한된 지역(local) 상태값이고, 기존 `✓`/`🚧`/`—` 범례와 병기되어 의미가 문서 내에서 명확히 정의된다. 다른 conventions 표의 `status`/`상태` 컬럼과 이름은 같지만(둘 다 "상태" 컬럼) 각 표가 자신의 enum 을 갖는 것은 이 저장소 전반에 이미 확립된 패턴(예: `audit-actions.md` §3 의 "구현"/"미구현" vs cafe24 카탈로그의 `supported`/`planned`/`deprecated`)이라 신규 충돌이 아니다.
- 제안: 없음. 다만 향후 다른 conventions 표에서도 "범주 오류로 철회" 유형의 항목이 생기면 동일 토큰 `N/A` 를 재사용하도록 유도하면 표기 일관성에 도움된다 (강제 사항 아님).

### 2. `CCH-AD-05` 인용 — 기존 정의와 일치, 충돌 없음
- target 참조: `spec/conventions/node-cancellation.md:137` 이 `CCH-AD-05` 를 인용
- 기존 정의처: `spec/5-system/15-chat-channel.md:58` — `| CCH-AD-05 | EIA outbound notification 의 ... execution.cancelled ... 이벤트를 어댑터(ChatChannelDispatcher)가 ... subscribe ... |`
- 상세: target 은 이 ID 를 **새로 부여하지 않고** 기존 정의를 그대로 인용한다. 인용 문맥("execution.cancelled 를 발송하는 책임")과 원 정의(EIA outbound 5종 이벤트에 `execution.cancelled` 포함, 어댑터가 구독)가 의미상 정합한다. 충돌 없음.

### 3. Rationale `R1` 인용 — 기존 정의와 일치, 충돌 없음
- target 참조: `spec/conventions/node-cancellation.md:137` 이 "같은 문서 Rationale R1" 을 인용
- 기존 정의처: `spec/5-system/15-chat-channel.md:513` — `### R1. 새 트리거 유형 신설하지 않음`
- 상세: 인용 취지("chat-channel 을 별도 노드로 두지 않은 근거")와 R1 본문("Webhook 트리거 + chatChannel config 채택 ... 신규 노드로 두면 트리거 종류가 N+1 로 늘고")이 정확히 일치. 신규 ID 부여가 아니라 기존 근거 문서 참조이므로 충돌 없음.

### 4. `1-data-model.md §2.8 Trigger` 앵커 — 존재 확인, 충돌 없음
- target 참조: `spec/conventions/node-cancellation.md:137` 의 `[데이터 모델 §2.8](../1-data-model.md#28-trigger)`
- 기존 정의처: `spec/1-data-model.md:223` — `### 2.8 Trigger`
- 상세: 앵커가 실제로 존재하고 섹션 제목과 일치한다. 새 식별자를 만들지 않았으므로 충돌 관점에서는 이슈 없음.

### 5. `MakeShop`/`Cafe24` 노드 signal 전파 행 상태 전환 — 신규 식별자 없음
- target 변경: 기존 표 행(`MakeShop 노드 signal 전파`, `Cafe24 노드 signal 전파`)의 **상태값만** `—`→`✓` 로 변경. 행 라벨 자체는 origin/main 에도 이미 존재했다(diff 의 `-` 라인 확인).
- 상세: 새로 도입되는 엔티티·타입·endpoint·이벤트명이 없다. 인용된 코드 파일명(`makeshop-api.client.ts`, `makeshop.handler.ts`, `cafe24-api.client.ts`, `cafe24.handler.ts`)도 기존 파일이며 이번 diff 로 새로 명명된 것이 아니다(최근 커밋 `e83da5052` "feat(nodes): MakeShop·Cafe24 노드에 execution abortSignal 전파" 참고). 신규 식별자 충돌 관점에서는 검토 대상 자체가 아니다.

## 요약
이번 target(`spec/conventions/node-cancellation.md`, +5/-5)은 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로 중 **어느 것도 새로 발급하지 않는다**. 유일하게 신규인 것은 표 범례의 로컬 상태 토큰 `N/A` 이며, 저장소 전체(`spec/`)에서 유일한 용례로 다른 상태 enum 과 겹치지 않는다. 문서 내에서 인용하는 `CCH-AD-05`·Rationale `R1`·`1-data-model.md §2.8` 앵커는 모두 기존 정의를 정확히 가리키며 의미 불일치도 없다. 신규 식별자 충돌 관점에서 보고할 CRITICAL/WARNING 사항은 없다.

## 위험도
NONE

STATUS: OK
