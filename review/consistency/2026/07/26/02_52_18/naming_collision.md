# 신규 식별자 충돌 검토 — spec-draft-node-cancellation-chat-channel-correction

## 검토 요약 (실측 방법)

target 문서(`plan/in-progress/spec-draft-node-cancellation-chat-channel-correction.md`)가 실제로
편집을 예고하는 두 spec 파일을 직접 열어 diff 전/후 상태를 대조했다:

- `spec/conventions/node-cancellation.md` (§1 24행, §6 121~142행)
- `spec/4-nodes/1-logic/10-parallel.md` (244행)

그리고 target 이 인용하는 기존 ID(`CCH-AD-05`)가 실제로 `spec/5-system/15-chat-channel.md` 에
이미 정의돼 있는지, target 문서 자신의 파일 경로가 기존 `plan/` 명명 컨벤션·기존 파일과 겹치는지도
grep 으로 확인했다.

**핵심 관찰**: 이 target 초안은 **새 식별자를 도입하지 않는다.** 세 변경(1-a/1-b/1-c/2) 모두 기존
테이블 행·본문 문구를 정정하는 편집이며, 새 요구사항 ID·엔티티명·endpoint·이벤트명·ENV var·spec
파일 경로 중 어느 것도 신설하지 않는다. 아래는 6개 관점 각각에 대한 점검 결과다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌 — 해당 없음
target 은 요구사항 ID 를 신설하지 않는다. 변경 전부가 `node-cancellation.md` §1/§6 과
`10-parallel.md` 의 기존 서술/표 행을 고치는 것이고, 새 `NAV-*`/`ND-*`/`CCH-*` 류 ID 부여가 없다.
target 이 인용하는 `CCH-AD-05` 는 `spec/5-system/15-chat-channel.md:58` 에 이미 정의된 기존 ID이며
(`ChatChannelDispatcher` 가 `executionEvents$` 를 구독하는 outbound 어댑터라는 서술과 정확히 일치),
target 은 이를 새로 정의하지 않고 근거로만 인용한다. 충돌 없음.

### 2. 엔티티/타입명 충돌 — 해당 없음
`ChatChannelDispatcher`, `AbortSignal`, `AbortError`, `NodeExecutionStatus.CANCELLED` 등 target 이
언급하는 명칭은 전부 기존 spec/코드에 이미 존재하는 이름이며, target 은 새 타입/DTO/인터페이스명을
도입하지 않는다.

### 3. API endpoint 충돌 — 해당 없음
target 이 참조하는 `POST /executions/:id/stop` 은 `node-cancellation.md` §2.3 본문에 이미 있던
기존 endpoint 인용이며, target diff 어디에도 새 endpoint 정의가 없다.

### 4. 이벤트/메시지명 충돌 — 해당 없음
`execution.cancelled` 등은 기존에 이미 정의된 이벤트명 인용이다. target 이 새 webhook/queue/SSE
이벤트명을 신설하는 부분은 없다.

### 5. 환경변수·설정키 충돌 — 해당 없음
target 은 어떤 ENV var/config key 도 신설하지 않는다.

### 6. 파일 경로 충돌 — 해당 없음 (검증 완료)
- target 자신의 plan 경로 `plan/in-progress/spec-draft-node-cancellation-chat-channel-correction.md`
  는 `ls plan/in-progress plan/complete` 로 전수 확인한 결과 기존 파일과 겹치지 않는다. `spec-draft-*`
  prefix 컨벤션도 `plan/complete/` 에 이미 42개 선례가 있는 그대로를 따른다 — 컨벤션 위반 없음.
- `spec_impact:` 에 나열된 두 경로(`spec/conventions/node-cancellation.md`,
  `spec/4-nodes/1-logic/10-parallel.md`) 는 모두 기존 파일이며, target 은 새 spec 파일을 만들지
  않는다(기존 파일의 부분 편집만).
- `worktree: node-cancel-chat-9f3e` 가 `plan/in-progress/node-cancellation-residual-signal-propagation.md`
  의 frontmatter 와도 동일한 것을 발견했으나, 이는 같은 worktree 세션 안에서 developer 가 먼저
  MakeShop/Cafe24 cascade 구현(#1019, `e83da5052`)을 완료하며 그 잔여 추적 plan 을 작성했고, 이번
  planner 턴이 이어서 같은 worktree 를 재사용하는 정상 흐름이다 — 식별자 충돌이 아니다.

## 부가 관찰 (범위 경계선 — INFO, 6개 관점에 정확히 매칭되지 않음)

- **[INFO]** §6 표 상태 컬럼에 신설되는 `N/A` 토큰이 표 상단 범례(121~123행)에 정의돼 있지 않음
  - target 신규 표기: diff 1-b 가 `chat-channel 노드 signal 전파` 행의 "상태" 셀을 `—` 에서
    `N/A` 로 바꾼다.
  - 기존 사용처: `node-cancellation.md:123` 의 범례는 `✓ = 구현됨, 🚧 = 부분 구현..., — = 미구현
    (Planned)...` 세 값만 정의한다. 저장소 전체에서 이 표(및 다른 convention 표)에 `N/A` 값이
    쓰인 선례는 없다 (`grep -rn "N/A |" spec/conventions/*.md` 0건).
  - 상세: 이것은 "다른 의미로 이미 쓰이는 식별자와의 충돌"은 아니다 — `N/A` 라는 토큰 자체가
    기존에 다른 의미로 쓰인 적이 없어 CRITICAL/WARNING 기준(반대 의미 충돌)에는 해당하지 않는다.
    다만 표 범례가 정의하는 통제된 어휘(controlled vocabulary) 밖의 새 심볼을 도입하면서 범례
    갱신이 diff 에 포함되지 않아, 이 표만 보는 독자는 `N/A` 의 의미를 셀 안의 볼드체 설명
    ("범주 오류로 철회")에서 유추해야 한다.
  - 제안: (필수 아님) §6 범례 줄(121~123행)에 `N/A = 범주 오류로 철회(해당 없음)` 한 항목을
    추가하면 완전해진다. target 이 이미 셀 안에 충분한 설명을 병기하므로 이 문제로 push 를
    막을 필요는 없다.

## 요약

target 초안은 세 곳의 기존 spec 서술(§1 목적 문단의 노드 목록, §6 구현 현황 표의 chat-channel/
MakeShop/Cafe24 행, 10-parallel.md §best-effort 컨트랙트 문단)을 코드 실측에 맞춰 정정하는
**순수 교정 편집**이며, 어떤 관점에서도 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
환경변수·spec 파일 경로를 신설하지 않는다. target 이 근거로 인용하는 기존 ID(`CCH-AD-05`)와
심볼(`ChatChannelDispatcher`, `POST /executions/:id/stop` 등)은 모두 실제 spec 파일에 이미
정의된 것과 정확히 일치함을 직접 대조로 확인했다. target 자신의 plan 파일 경로도 기존 파일·
컨벤션과 충돌하지 않는다. 유일한 관찰은 §6 표에 새 상태 토큰 `N/A` 가 범례 갱신 없이
등장한다는 표기 완결성 관련 INFO 이며, 신규 식별자 충돌의 정의(기존 의미와의 상충)에는
해당하지 않는다.

## 위험도

NONE
