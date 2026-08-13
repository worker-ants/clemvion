# 정식 규약 준수 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 범위
- target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (--spec 모드, spec draft 검토)
- 대조: `spec/conventions/chat-channel-adapter.md`, `spec/conventions/redis-keys.md`, `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`, `.claude/docs/plan-lifecycle.md`, `.claude/skills/project-planner/SKILL.md`, 및 target 이 수정 대상으로 지목한 `spec/5-system/14-external-interaction-api.md` §6 / `spec/5-system/6-websocket-protocol.md` §4.1 실측.

## 발견사항

- **[INFO]** redis-keys.md 인용이 정확한 워딩이 아니라 paraphrase
  - target 위치: `## 왜` 절, "이 저장소는 같은 문제의 해법을 이미 갖고 있다" 단락의 인용구
    (`"인벤토리는 **포인터만** 갖는다. 한 표에 상세까지 모으면 그 표가 곧 두 번째 SoT 가 된다."`)
  - 위반 규약: 해당사항 없음(직접 위반 아님) — `spec/conventions/redis-keys.md` §1 원문 대조
  - 상세: 원문은 "각 소유 문서가 SoT. **본 문서는** 포인터만 갖는다. 한 표에 상세까지 모으면 그 표가 곧
    두 번째 SoT 가 된다." (주어가 "본 문서"). target 은 인용부호(`"..."`)로 직접 인용처럼 표기하면서
    주어를 "인벤토리는" 으로 바꿔 적었다 — 의미는 동일(§3 전역 인벤토리를 가리키는 문맥이라 등가)하지만
    글자 그대로의 인용은 아니다.
  - 제안: 인용부호 안 문구를 원문 그대로("본 문서는 포인터만 갖는다...")로 맞추거나, 인용부호를 벗기고
    paraphrase 임을 명확히 한다. 사소한 형식 이슈로 반려 사유는 아니다.

## 확인된 준수 사항 (근거 포함, 감점 없음)

- **파일 명명**: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 는
  project-planner SKILL.md §"draft 작성" 규정(`plan/in-progress/spec-draft-<name>.md`)과 정확히
  일치하며, 저장소에 동일 패턴 선례(`spec-draft-eia-r8-alignment.md`)가 이미 있다. 본문 끝
  `## Rationale` 도 SKILL 의무("본문 끝에 `## Rationale` 로 결정 근거 명시")를 충족한다.
- **frontmatter 스키마**: `worktree`/`started`/`owner` 3필수 필드 충족. `spec_impact` 는 bare string
  이 아닌 리스트로 실존 spec 4개 경로를 정확히 나열(Gate C 형식 위반 없음). `pending_plans` 2건
  (`spec-sync-external-interaction-api-gaps.md` / `spec-sync-websocket-protocol-gaps.md`) 모두
  `plan/in-progress/` 에 실존.
- **spec-impl-evidence 정합**: target 이 대상으로 삼는 `14-external-interaction-api.md`(`status: partial`,
  `pending_plans: spec-sync-external-interaction-api-gaps.md`) 와 `6-websocket-protocol.md`(`status: partial`,
  `pending_plans: spec-sync-websocket-protocol-gaps.md`) 는 이미 target frontmatter 의 `pending_plans`
  와 정확히 일치한다. target 이 `durationMs`/`result.outputs` 를 "미구현(Planned)" 으로 남기고
  "Planned gap 2건을 `spec-sync-*-gaps.md` 에 등재" 하겠다는 체크리스트 항목은 `spec-impl-evidence.md`
  §3(`partial` 상태의 `pending_plans` 의무)이 요구하는 정확한 절차다 — status 하향/frontmatter 위반
  없이 기존 gap-tracking plan 에 편입하는 방식.
- **"§6 도입부는 비어 있다"는 실측 주장**: `14-external-interaction-api.md` 실제 파일 552~554행 확인
  — `## 6. API 명세 — Outbound Notification` 직후 빈 줄 하나만 있고 바로 `### 6.1 헤더`. target 의
  실측 주장과 일치한다. 또한 동일 문서 §5(271~273행)에 **이미 번호 없는 blockquote 인트로가 `## 5.`
  와 `### 5.1` 사이에 선례로 존재**("전송 봉투 (전 REST 엔드포인트 공통)" 단락) — target 이 제안하는
  "번호 없는 §6 도입부" 패턴은 신규 발명이 아니라 같은 문서 안 기존 구조 관행의 반복이다. 문서 구조
  규약 위반 아님.
- **`EIA §6.5 line 536` 하드코딩 인용 "전수 6곳"**: `grep -n "line 536"` 실측 결과 정확히 6곳
  (`chat-channel-adapter.md:145`, `:354`, `15-chat-channel.md:76`, `chat-channel.dispatcher.ts:506`,
  `chat-channel.dispatcher.spec.ts:428`, `chat-channel/types.ts:378`) — target 의 "spec 3 / 코드 3"
  분류와 정확히 일치한다. §6.5 실제 위치가 675행이라는 stale 판정도 실측과 일치.
  - `EIA §6\.` grep 총 매치는 42~44 라인이지만 target 체크리스트의 "~15곳" 은 **파일 단위**로 보면
    16개 파일에 근접(list 확인)한다 — "곳" 을 site/file 단위로 읽으면 근사치가 타당하다. 오탐 아님.
- **R3 인용 정확성**: `chat-channel-adapter.md` R3("EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union
  만 정의... 구체 필드의 spec 갱신은 항상 EIA spec 우선")를 target 이 "구체 필드 갱신은 항상 EIA
  spec 우선"으로 요약 인용 — 원문 취지와 일치. 3차 draft 의 "코드 타입을 SoT" 문구가 R3 와 모순이었다는
  target 의 자기 정정도 R3 문면과 정합.
- **PR #945 / §5.4(L1198) Rationale 인용**: 두 인용 모두 실제 문서에 존재하는 이력이며
  (`6-websocket-protocol.md` Rationale "§4.4 wire 필드 caveat...(2026-07-14, PR #945)", 및
  `14-external-interaction-api.md:1198` "2026-08-10 정정" 문단) target 의 재구성이 지어낸 근거가
  아니다 — memory 로 지적된 "Rationale 기각된 대안은 실제 이력 필수" 위험을 통과.
- **필드/에러코드 명명**: `durationMs`/`executionId`/`cancelledBy` 등 camelCase, `HTTP_4XX`/`RESUME_*`
  등 `UPPER_SNAKE_CASE` 패턴은 `error-codes.md` §1 규약과 정합. 신규 코드 신설이 아니라 기존 코드
  분류 서술이라 §2 rename-안정성 정책과도 충돌 없음.
- **부재 표현 (null vs 키 생략)**: `cancelled.error?` 를 "일반 user cancel 에는 부재"(키 생략)로
  서술 — 기존 EIA/§6.5, WS §4.1, chat-channel-adapter.md 서술과 표현 방식이 일관되고, `#904` 로 확립된
  "closed oneOf + 부재는 키 생략(널 아님)" 정책과도 어긋나지 않는다.
- **닫힌 union 보존**: `cancelledBy: 'user'|'system'|'timeout'` 3값 union 을 "확장하지 않는다"(EIA
  §6.5:678) 는 기존 제약을 target 이 그대로 승계·이관하며 확장을 시도하지 않는다.
- **API 문서(swagger/DTO) 규약**: target 은 실제 코드의 DTO/데코레이터를 신설·변경하지 않는 spec-only
  draft 라 `swagger.md` 의 DTO 명명 패턴이 직접 적용될 표면이 없다. 위반 없음(해당 없음).
- **금지 패턴 준수**: target 이 스스로 지목한 "같은 계약을 여러 문서에 필드 단위로 재서술" 이라는
  구조는 redis-keys.md 가 명시적으로 경계하는 "표가 두 번째 SoT 가 되는" 패턴과 동일 계열이며, target
  의 (B) 단일화 결정은 그 금지 취지를 이번에 처음 종결 이벤트 payload 에 적용하는 것 — 금지 패턴을
  답습하는 것이 아니라 해소하는 방향이다.

## 요약

target 문서는 정식 규약(`spec/conventions/**`) 및 `.claude/docs/plan-lifecycle.md`·project-planner
SKILL.md 의 plan draft 구조·frontmatter 스키마를 실질적으로 위반하지 않는다. 파일 명명, frontmatter
스키마(`spec_impact` 리스트 형식·`pending_plans` 실존), `spec-impl-evidence.md` 의 `partial`/
`pending_plans` 정합, 에러 코드·필드 camelCase 명명, "닫힌 union 비확장"·"부재=키 생략" 등 기존 정식
규약과의 정합성이 실측(grep·원문 대조)으로 확인됐다. 유일한 지적은 INFO 등급 — `redis-keys.md` 를
인용부호로 직접 인용하면서 주어를 살짝 바꿔 적은 것으로, 의미 왜곡은 없고 반려 사유가 아니다. target
이 제안하는 "EIA §6 번호 없는 도입부" 구조도 같은 문서 §5 에 이미 있는 선례를 재사용하는 것이라 문서
구조 규약과 충돌하지 않는다.

## 위험도
NONE
