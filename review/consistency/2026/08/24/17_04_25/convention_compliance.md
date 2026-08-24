# 정식 규약 준수 검토 — `plan/in-progress/planner-doc-batch.md`

## 검토 방법

target 은 `plan/` 문서이며 `spec/conventions/**` 9개 파일(`spec_impact` 전체) 자체를 편집하는
작업의 판정/실행 기록이다. 프롬프트 번들에는 "컨텍스트 예산 초과" 로 `spec/conventions/**`
본문이 실려 있지 않아, target 이 인용·근거로 삼는 아래 파일들을 직접 `Read`/`grep` 으로 열어
대조했다: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/node-output.md`,
`spec/conventions/egress-masking.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/conventions/conversation-thread.md`, `spec/conventions/redis-keys.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md`, `.claude/docs/plan-lifecycle.md`,
`.claude/skills/project-planner/SKILL.md`.

## 발견사항

- **[WARNING]** plan 파일명이 "spec draft batch" 명명 선례에서 벗어남
  - target 위치: frontmatter `title:` / 파일 경로 `plan/in-progress/planner-doc-batch.md`
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번
    ("`plan/in-progress/spec-draft-<name>.md` 에 변경안 작성") — CLAUDE.md 가 스킬 체계로
    참조하는 명명 컨벤션. 문자 그대로 `spec/conventions/**` 는 아니지만, 본 검토의 관점 3
    (문서 구조 규약)이 CLAUDE.md 의 명명 컨벤션 준수를 명시적으로 포함한다.
  - 상세: target 은 `--spec` 모드 `/consistency-check` 를 실제로 통과하는 spec-draft 성격
    문서(체크리스트 "1회차(쓰기 전) `/consistency-check --spec`")인데, 파일명이
    `spec-draft-` prefix 를 쓰지 않는다. 동일 상황(여러 spec_impact 파일을 한 planner 턴에
    묶는 "doc batch")의 선례 `plan/complete/spec-draft-cross-audit-doc-batch.md` 는
    `spec-draft-` prefix + `name:` frontmatter 필드를 쓴다. 다만 실측: 이 naming 을 강제하는
    build guard 는 없다 — `consistency_orchestrator.py` 의 `--spec` 인자는 경로 문자열만
    받고 파일명 패턴을 검증하지 않는다(`--spec plan/in-progress/spec-draft-foo.md` 는 help
    text 의 예시일 뿐). 즉 **invariant 파괴는 아니고 명명 일관성 이탈**이다.
  - 제안: target 의 성격이 "draft 텍스트를 담아 spec 에 이관"이 아니라 "변경을 spec 파일에
    직접 적용한 뒤 근거를 기록하는 판정 트래커"라면(실측: node-output.md/egress-masking.md/
    6-websocket-protocol.md/provider 3파일에 이미 변경이 반영돼 있음을 확인), 파일명을
    `spec-draft-planner-doc-batch.md` 로 정정하거나, 혹은 이런 "직접 편집 + 판정 기록" 유형을
    SKILL.md 워크플로에 별도 명명 패턴으로 인정하는 규약 갱신 중 하나를 택할 것을 권한다.

## 준수 확인 (교차검증 결과 — 위반 아님, 근거로 남김)

아래는 target 이 주장하는 "이미 반영됨" 항목들을 실제 spec 파일과 대조해 정식 규약 위반이
없음을 확인한 것들이다 (발견사항에 넣지 않음):

- **B1 (`node-output.md` Principle 0 각주)**: `wire 전용 (위젯 파서)` / `wire 전용
  (chat-channel 렌더러)` 라벨이 `node-output.md:54-55` 와 `spec/5-system/
  14-external-interaction-api.md:1828-1829` (EIA §R17) 양쪽에 **동일 문구**로 등재돼 있다 —
  target 의 "라벨은 EIA §R17 과 같은 문구" 주장과 일치.
- **B4 (`code:` 필드 정의 인용)**: target 이 인용한 "본 spec 이 약속한 surface 의 구현 경로"는
  `spec/conventions/spec-impl-evidence.md` §2.1 표의 `code` 필드 정의 문구와 **정확히 일치**
  (`spec-impl-evidence.md:81`). B4 를 won't-do 로 판정한 근거가 정확하다.
  - `node-output.md` 자체의 frontmatter 도 `status: partial` → `pending_plans:` 의무를
    충족(`plan/in-progress/node-output-redesign/README.md` 실존 확인) — §3 라이프사이클
    규약 준수.
- **B5 (`6-websocket-protocol.md` §3.2 채널 패턴 표 행 추가)**: 추가된
  `background:run:{id}` 행이 같은 표의 다른 행(`execution:{executionId}` 등)과 **동일한
  `{name}` 브래킷 표기**를 쓴다 (`6-websocket-protocol.md:122-128`). `redis-keys.md:84` 는
  같은 채널을 `<id>` 로 표기하지만 이는 문서 간 기존 불일치(이번 배치가 새로 만든 것이 아님)
  이고, target 은 대상 문서(WS protocol)의 로컬 컨벤션을 정확히 따랐다.
- **B7 (provider 3문서 표 각주)**: `telegram.md:162-168` · `slack.md:235-241` ·
  `discord.md:258-264` 세 파일 모두 동일한 "이 표는 핸들러 출력(`NodeHandlerOutput.output`)
  기준" 각주가 삽입돼 있고, `node-output.md` Principle 0 의 wire envelope 각주로 링크한다.
  `node-output.md` Principle 8.1 의 금지 패턴(`output.output.extracted.*`)과 명시적으로
  구분하는 캐비엇(`node-output.md:44-46`)도 있어, provider 표의 `output.rendered` 표기가
  Principle 8 위반으로 오독되지 않게 프레이밍했다 — 금지 항목(관점 5) 재도입 없음.
- **B2 (`egress-masking.md` §2 파이프라인)**: `toFanoutEnvelope` 4단계
  (`maskWireEnvelope` → `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` →
  `attachRoutingContext`)가 본문에 반영돼 있고, "마커 리터럴을 문서에 적지 않는다"는 자기
  규칙(`egress-masking.md` Overview 하단)도 어기지 않는다(값 대신 상수 이름만 사용).
- **frontmatter 일반**: target 자체의 `worktree`/`started`/`owner` 3필드가
  `plan-frontmatter.test.ts` 의무 스키마를 충족하고, `spec_impact` 는 bare string 이 아닌
  YAML 리스트이며 나열된 9개 경로 전부 실존 파일임을 확인(Gate C 형태 요건 충족 — 단, Gate C
  자체는 `complete/` 이동 시점에만 강제되므로 지금은 선제 준수 상태).

## 요약

target(`plan/in-progress/planner-doc-batch.md`)이 실제로 반영했다고 주장하는 spec/conventions
변경분(B1·B2·B4·B5·B7)을 소스로 직접 대조한 결과, 라벨·브래킷 표기·필드 정의 인용·파이프라인
단계 서술이 대상 정식 규약과 정확히 일치했고 금지 패턴(Principle 8.1) 재도입도 없었다. 유일한
발견은 plan 파일명이 "spec-draft 배치" 선례(`spec-draft-cross-audit-doc-batch.md`)의 명명
패턴(`spec-draft-<name>.md`)을 따르지 않는다는 것인데, 이는 build guard 가 강제하지 않는
SKILL.md 수준의 명명 관행 이탈이라 WARNING 이상으로 올릴 근거가 없다. `spec/conventions/**`
자체가 규정하는 출력 포맷(라벨 taxonomy·브래킷·필드 스키마) 관점에서는 CRITICAL 이 없다.

## 위험도
LOW
