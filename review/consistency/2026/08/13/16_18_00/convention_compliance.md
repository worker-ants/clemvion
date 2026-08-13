# 정식 규약 준수 검토 — convention_compliance

target: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (5차 라운드,
`16_18_00`)

## 검토 범위·방법

`spec/conventions/**` 전수(요약 예산 초과분은 원본 파일을 직접 Read) + 대상 spec/plan
문서(`spec/5-system/14-external-interaction-api.md` §6, `spec/5-system/6-websocket-protocol.md`
§4.1, `spec/conventions/chat-channel-adapter.md`, `.claude/skills/project-planner/SKILL.md`,
`.claude/docs/plan-lifecycle.md`, `spec/conventions/spec-impl-evidence.md`)를 직접 대조.
target 이 인용하는 근거(redis-keys.md 문구, chat-channel-adapter.md R3, WS `## Rationale`
PR #945 문단, EIA L1198 `/cancel` 문단, `websocket.service.ts`/`notification-fanout.service.ts`
실 코드)는 전부 소스와 대조해 **일치**를 확인했다 — 지어낸 인용·근거 없음.

## 발견사항

- **[INFO]** plan 자기 frontmatter 의 `pending_plans:` 키가 spec-impl-evidence.md 의
  정의와 다른 방향으로 쓰인다
  - target 위치: frontmatter 3~13행 `pending_plans: [spec-sync-external-interaction-api-gaps.md,
    spec-sync-websocket-protocol-gaps.md]`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `pending_plans` 는 **spec
    frontmatter** 전용 필드로 "이 spec 의 미구현 surface 를 책임지는 plan" (spec→plan,
    `status: partial` 의무 필드) 을 뜻하도록 정의돼 있다.
  - 상세: target 은 `plan/in-progress/*.md` 문서인데, **자기 자신의 frontmatter**에
    같은 키 이름 `pending_plans:` 를 얹어 "관련/의존하는 다른 in-progress plan" 이라는
    **다른 방향(plan→plan)** 의미로 썼다. `plan/in-progress/*.md` 전체를 grep 해도 이
    사용례는 target 이 유일하다(선례 없음). `.claude/docs/plan-lifecycle.md` §4 는
    plan frontmatter 에 "priority/status/title 등 추가 필드는 허용" 이라 명시해 **금지된
    것은 아니고**, `spec-pending-plan-existence.test.ts` 가드도 `spec/**.md` 만 검사하므로
    build 가드를 깨지 않는다 — 그래서 CRITICAL/WARNING 이 아니라 INFO. 다만 같은 키가
    이미 정식 규약 문서에 특정 방향(spec→plan)으로 정의돼 있어, 향후 이 필드를 다루는
    자동화나 사람이 방향을 혼동할 여지가 있다.
  - 제안: `related_plans:` / `blocking_plans:` 같은 별도 키로 바꾸거나, 이 용법이 앞으로도
    반복될 의도라면 `plan-lifecycle.md` §4 에 "plan 자기 frontmatter 의 `pending_plans:`
    는 spec 쪽과 별개로 '관련 plan 포인터' 의미로도 쓸 수 있다" 를 명시해 규약을 갱신하는
    편이 낫다. 직전 4개 라운드의 convention_compliance 검토도 이 사용법을 지나쳤으므로
    (round 1~4 보고서에 미언급), 급한 조치는 아니다.

- **[INFO]** plan draft 에 `## Overview` 절이 없음 (참고용, 강제 규약 아님)
  - target 위치: 문서 전체 — `## 왜` 로 바로 시작
  - 관련 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" —
    "각 spec 문서는 3섹션 (Overview / 본문 / Rationale)"
  - 상세: 이 3섹션 권장은 **`spec/**.md`(정식 spec 문서)** 대상이며, SKILL.md 는 plan
    draft 에 대해 "본문 끝에 `## Rationale` 로 결정 근거 명시"만 요구한다 — target 은 이
    요구를 충족한다(`## Rationale` 존재, 내용도 충실). 형제 draft
    `plan/in-progress/spec-draft-eia-r8-alignment.md` 는 `## Overview` 를 두면서도
    `## Rationale` 명시 섹션은 없어(인라인 근거만) 두 draft 모두 3섹션을 그대로 따르진
    않는다 — plan draft 단계에서는 강제되지 않는 것으로 보인다.
  - 제안: 조치 불요(정보성). 통일성을 원하면 `## 왜` 를 `## Overview` 로 개명하거나 그 앞에
    1~2문장 Overview 를 추가하는 정도.

## 확인된 준수 사항 (근거 포함 — 오탐 방지용 기록)

- **파일 명명**: `plan/in-progress/spec-draft-<name>.md` 패턴 정확히 준수
  (`.claude/skills/project-planner/SKILL.md` §작업 워크플로 3단계).
- **frontmatter 스키마**: `worktree`/`started`/`owner` 필수 3필드 보유, `spec_impact` 4개
  경로·`pending_plans`(spec 쪽 의미 혼용은 위 INFO) 2개 경로 전부 저장소에 실존 파일로 확인
  (`.claude/docs/plan-lifecycle.md` §4).
- **인용 정확성**: `redis-keys.md:20-21`("포인터만... 두 번째 SoT"), `chat-channel-adapter.md`
  R3(§527-529, "구체 필드의 spec 갱신은 항상 EIA spec 우선"), WS `## Rationale`
  "§4.4 wire 필드 caveat"(§958-963, PR #945, "전체 매핑을 세 문서에 복제하면 새 drift 표면이
  열린다" 문구 verbatim 일치), EIA L1198 "/cancel" 문단("코드가 SoT 이고 spec 서술이 낡았던
  것" verbatim 일치, 날짜 2026-08-10 일치) 모두 원문과 대조해 정확함을 확인 — 지어낸
  Rationale/근거 없음.
- **기술 전제 실증**: `websocket.service.ts:453-489` (`emitExecutionEvent`) 의 WS flat wire
  (L461-468) + `notification-fanout.service.ts:123-137` 의 `payload:` 재래핑을 직접 코드로
  대조 확인 — target 이 서술한 "두 wire 가 다르다" 는 실제 코드와 일치(허위 아님).
  `chat-channel-adapter.md` 현재본의 `EiaEvent` union(§146-148)도 대조해 `finalNodeId`/
  `finalPort`/`nodeCount` 삭제 대상·`error:{code,message,nodeId,details?}` 목표 형태가
  이미 그 파일에 그대로 있음을 확인.
- **재넘버링 없음 주장 검증**: `spec/5-system/14-external-interaction-api.md:552-554` 를
  직접 읽어 `## 6.` 과 `### 6.1` 사이가 실제로 빈 줄 하나뿐임을 확인 — "번호 없는 도입부"
  삽입이 기존 번호를 밀지 않는다는 target 의 핵심 전제가 사실과 일치.
- **문서 구조 선례**: 같은 spec 문서의 `## 4. Trigger 등록 페이로드 확장`(L161-)이 이미
  `### 4.1` 이전에 번호 없는 도입 문단 + JSON 예시를 두는 패턴을 쓰고 있어, target 이
  제안하는 "§6 번호 없는 도입부" 구조가 이 문서 내에서 **이미 확립된 패턴**과 일치한다.
  즉 신규 규약 위반이 아니라 기존 패턴의 재사용.
- **직전 라운드(`16_04_30`) convention_compliance WARNING 4 정정 확인**: 4차 draft가
  "코드 타입(`chat-channel/types.ts`)을 SoT로" 라 적어 `chat-channel-adapter.md` R3와
  모순됐던 지적을, 본 5차 draft는 "SoT는 EIA spec이다"로 명시 정정하고 그 정정 사실 자체를
  본문에 인용해 두었다 — 재발 없음.
- **error 객체 명명**: EIA §6.4 의 `error:{code,message,nodeId,details?}` 는
  `node-output.md` §3.2 `output.error:{code,message,details}` 표준 형태와 계층은
  다르지만(엔진/실행 레벨 vs 노드 레벨) `code`(UPPER_SNAKE_CASE) / `message` / `details`
  네이밍 정신은 일치 — 별도 위반 아님.
- **`duration`(WS) vs `durationMs`(EIA) 불일치**: target 도 이 drift 를 인지하고
  "비목표"에 명시적으로 반경 밖으로 분리(전역 개명은 후속)했다 — 이 저장소의 다른
  conventions(`execution-context.md` §원칙3, `swagger.md` §1-4 "적용 범위 — 신규 변경
  한정")와 동일한 "소급 강제하지 않고 forward-only 적용" 패턴이라 처리 방식 자체는
  일관적이다.

## 요약

target 은 정식 규약(`spec/conventions/**`) 관점에서 실질적 위반이 없다. 파일 명명·frontmatter
스키마는 project-planner SKILL·plan-lifecycle 규약을 정확히 따르고, 인용한 모든 근거(다른
conventions 문구·spec Rationale·실제 코드)는 원문 대조로 정확함이 확인됐다. 직전
라운드(`16_04_30`)가 지적한 convention 위반(코드 타입을 SoT로 오기)도 이번 라운드에서
명시적으로 정정됐다. 유일하게 눈에 띄는 점은 plan 자기 frontmatter 에 spec 전용 의미로
정의된 `pending_plans:` 키를 다른 방향(plan→plan)으로 재사용한 것인데, 이는 build 가드를
깨지 않고 plan-lifecycle 이 허용하는 "추가 필드" 범위 안이라 INFO 수준이다.

## 위험도

LOW
