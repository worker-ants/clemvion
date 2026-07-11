# 정식 규약 준수 검토 — spec-decide-webchat-execution-residuals.md

검토 모드: spec draft 검토 (--spec)
target: `plan/in-progress/spec-decide-webchat-execution-residuals.md`

## 발견사항

### [CRITICAL] `cancelledBy='channel_idle_timeout'` — 닫힌 enum 규약 위반

- **target 위치**: `## (B) 설계 — client cancel(source) + 채널 idle-wait timeout(backstop)` §B-2 "**회수 동작**" 문단
  ("terminal(`cancelled`, `cancelledBy='channel_idle_timeout'`)로 전이한다") 및
  `## 변경안 (spec 편집 — 결정 lock)` §(2) "동작=`cancelled`/`channel_idle_timeout`" 문구.
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` L133/L342 — `execution.cancelled` 이벤트의
  `result.cancelledBy` 를 **닫힌 union** `"user" | "system" | "timeout"` 으로 타입 계약함 (모든 chat
  channel adapter 가 만족해야 하는 정식 컨벤션). 동일 닫힌 3값 계약은 `spec/5-system/14-external-interaction-api.md`
  §6.5(`cancelledBy: "user" | "system" | "timeout"`), `spec/5-system/6-websocket-protocol.md` §4.1 에도
  SoT 로 존재하며, `codebase/backend/src/modules/chat-channel/types.ts:405` ·
  `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 전역에 리터럴 union 타입으로
  하드코딩돼 있다. 또한 `spec/conventions/swagger.md §1-4`("닫힌 union 을 `additionalProperties` 로 뭉개지
  않는다")가 이런 "variant 집합이 코드로 확정된 필드"는 닫힌 계약으로 유지해야 함을 원칙으로 명문화한다.
- **상세**: target 은 익명 idle-wait backstop 회수 시 `cancelledBy` 에 **4번째 리터럴 값**
  `'channel_idle_timeout'` 을 직접 대입하도록 설계했다. 이는 (1) 세 군데 spec SoT + 1개 conventions 파일이
  선언한 닫힌 3값 계약을 깨고, (2) `chat-channel.dispatcher.ts`/`types.ts`/`execution-engine.service.ts` 등
  기존 TS 코드의 `'user' | 'system' | 'timeout'` 리터럴 union 타입과 충돌해 채택 시 컴파일 타임에 즉시
  깨진다. 반면 target 문서와 같은 spec(`4-execution-engine.md §8`)이 이미 다루는 선행 사례
  — 큐 대기 초과 시스템 취소 — 는 정확히 이 문제를 **`cancelledBy` 값을 확장하지 않고** `cancelledBy='timeout'`
  (기존 3값 중 하나 재사용) + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'`(UPPER_SNAKE_CASE 신규 코드)로
  해결한 전례다 (`spec/5-system/4-execution-engine.md:1587`, `spec/5-system/3-error-handling.md:127`). target
  의 R-B2 Rationale 은 이 직접적인 선례를 인지·대조하지 않은 채 `cancelledBy` 자체를 확장하는 경로를
  택했다.
- **제안**: `cancelledBy` 는 기존 닫힌 3값(`'system'` 권장 — 사용자 발원 아님) 을 그대로 쓰고, 세부 사유는
  `error.code`(예: `CHANNEL_IDLE_TIMEOUT`, `error-codes.md §1` UPPER_SNAKE_CASE·의미 기반 명명 규약 준수)
  로 이관해 `EXECUTION_QUEUE_WAIT_TIMEOUT` 전례와 대칭을 맞춘다. 이 경우 `spec/conventions/chat-channel-adapter.md`
  의 `error?.code` 분기 로직(RESUME_* 시 graceful 문구)도 `CHANNEL_IDLE_TIMEOUT` 을 새 분기로 추가할지 검토
  필요 — `변경안 §(2)` 에 이 컨벤션 파일 동반 갱신 항목을 명시적으로 추가해야 한다(현재 §(1)~(5) 어디에도
  `spec/conventions/chat-channel-adapter.md` 갱신이 등재돼 있지 않음). `cancelledBy` 자체를 넓히는 대안을
  고수한다면, 최소한 EIA §6.5·WS-protocol §4.1·chat-channel-adapter.md L133/L342·백엔드 리터럴 union 4곳을
  전부 동반 갱신 대상으로 `변경안` 에 명시하고 R-B2 에 "왜 error.code 대신 cancelledBy 확장을 택했는가"
  (기존 3값 재사용 전례와 다른 이유)를 근거로 남겨야 한다.

### [WARNING] plan 파일명이 SKILL.md 의 `spec-draft-<name>.md` 명명 규약과 다른 prefix 사용

- **target 위치**: 파일 경로 자체 — `plan/in-progress/spec-decide-webchat-execution-residuals.md`.
  target 문서 헤더에 스스로 명시한 "검토 모드: spec draft 검토 (--spec)" 및 `## 변경안 (spec 편집 — 결정
  lock)` 섹션 구조.
- **위반 규약**: `.claude/skills/project-planner/SKILL.md` §"draft 작성" — *"`plan/in-progress/spec-draft-<name>.md`
  에 변경안 작성. 본문 끝에 `## Rationale` 로 결정 근거 명시."* (CLAUDE.md 가 역할별 워크플로 SoT 로 지목).
- **상세**: 저장소 전체에서 이 패턴(spec 변경안 + Rationale + 편집 lock 을 담은 plan 문서)에 해당하는
  기존 파일 39개가 전부 `spec-draft-*.md` prefix 를 쓴다(`plan/complete/spec-draft-*.md` 다수,
  현재 `plan/in-progress/spec-draft-pr874-deferred-docs.md` 포함). target 은 동일한 문서 유형
  ("변경안 — spec 편집 — 결정 lock" 섹션, `--spec` 검토 모드 자체 명시)이면서도 `spec-decide-` 라는
  저장소 유일무이한 신규 prefix 를 쓴다. 이는 자동화가 이 prefix 를 파싱하는 CRITICAL 파손은 아니지만
  (grep 결과 `consistency_orchestrator.py` 의 `--spec` 인자는 자유 경로라 prefix 비의존), 문서 유형
  식별을 사람·향후 tooling 모두에 흐리는 "규약과 거리감이 있는 표현"에 해당한다.
- **제안**: `spec-draft-webchat-execution-residuals.md` 로 리네임하거나, "결정(decide) 단계와 draft 단계를
  분리하는 신규 하위 유형"이 의도라면 SKILL.md §"draft 작성" 에 `spec-decide-` prefix 를 공식 등재(어떤
  경우에 draft 대신 decide 를 쓰는지 기준 포함)해 규약 자체를 갱신한다.

## 요약

target 문서는 EIA/execution-engine/widget-app 간 설계 정합성 자체는 상세한 Rationale 로 잘 뒷받침하지만,
정식 규약 준수 관점에서 하나의 CRITICAL 이슈를 안고 있다 — B-2 idle-wait backstop 이 제안하는
`cancelledBy='channel_idle_timeout'` 은 EIA §6.5·WS-protocol §4.1·`spec/conventions/chat-channel-adapter.md`
가 공통으로 선언하고 백엔드 TS 리터럴 union 으로 이미 하드코딩된 **닫힌 3값 enum**(`'user'|'system'|'timeout'`)
을 깨며, 같은 spec 문서(§8 큐 대기 초과)가 이미 정립한 "reason 은 `cancelledBy` 가 아니라 `error.code`
로"라는 직접 선례와도 어긋난다. 이 문서가 `## 변경안` 대로 그대로 spec 에 lock 되면 하위 여러 시스템
(chat-channel adapter 렌더링, 프론트/백엔드 타입, 기존 테스트)의 불변식이 깨지므로 spec 편집 전에 반드시
정정이 필요하다. 부차적으로 파일명이 project-planner SKILL 의 `spec-draft-` 명명 규약에서 벗어나 있다
(WARNING). 그 외 명명·frontmatter(`worktree`/`started`/`owner`/`spec_impact` 리스트 형식)·문서 구조는
관찰된 규약과 정합적이다.

## 위험도

HIGH
