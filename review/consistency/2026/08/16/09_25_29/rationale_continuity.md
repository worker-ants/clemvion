# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 컨텍스트

target 로 지정된 `spec/5-system/` 번들 자체는 최근 커밋(#1157~#1176)으로 이미 정합화된 상태이며,
번들 텍스트만 놓고 보면 자기모순은 발견되지 않았다. 그러나 이 worktree 에는 아직 spec 에
반영되지 않은 착수 전 작업 계획이 있다 — `plan/in-progress/eia-terminal-error-sanitize.md`
(`spec_impact: none`, `Execution.error.message` 를 emit 지점이 아니라 **DB write 시점**에
`sanitizeErrorMessage` 로 새니타이즈하는 결정). `--impl-prep` 게이트의 실질 목적(구현 착수 전
Rationale 저촉 여부 확인)에 맞춰, 이 계획이 `spec/5-system/14-external-interaction-api.md` 의
기존 Rationale(R17)과 맺는 관계를 중심으로 검토했다.

## 발견사항

- **[WARNING]** `Execution.error` write-time 새니타이즈가 R17 의 "egress-only masking" 원칙과 사전 조율 없이 갈라진다
  - target 위치: `plan/in-progress/eia-terminal-error-sanitize.md` §"어디서 새니타이즈할 것인가 — emit 이 아니라 DB write" (spec 자체는 미변경, `spec_impact: none`)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` → **R17** "표면 제약(보안)" 문단 (`conversationThread`/`ai_message`/`nodeOutput.conversationConfig` 마스킹 정책)
  - 상세:
    - R17 은 "저장 시점(append) redaction 은... 채택하지 않았다. 따라서 **DB-at-rest 최소화(append-time redaction)는 문서화된 후속 항목**이다(데이터 최소화가 요구가 될 때)" 라고 명시적으로 적어 두었다. 근거는 "내부 소비처(LLM 컨텍스트 주입, durable 스냅샷, Background body)는 faithful 텍스트를 유지한다" — 즉 **마스킹은 외부로 나가는 egress 지점에서만 걸고, 저장값(DB)은 원본을 보존**하는 것이 이 spec 파일 안에서 이미 합의된 설계 원칙이다.
    - 새 계획은 정확히 그 반대 방향(append/write-time redaction)을 `Execution.error.message` 필드에 채택한다. 근거로 삼은 것은 R17 이 아니라 다른 커밋(#1172 "DB=wire" 불변식, 코드 주석 WARN #7/W16) 이며, plan 어디에도 R17 을 인용하거나 "이 필드는 conversationThread 와 왜 다른가" 를 밝히지 않는다.
    - 두 결정이 실제로 양립 가능하다는 근거는 있다 — `Execution.error.message` 는 (plan 의 자체 audit 대로) LLM 컨텍스트 재주입처럼 내부에서 원문을 재소비하는 경로가 없고, R17 의 "내부 소비처" 열거(LLM 컨텍스트 주입 등)에도 해당하지 않는다. 또한 `execution.cancelled.durationMs` 사례(§6.5, 2026-08-15)에서 "DB 와 wire 가 같은 값을 쓴다" 가 이미 이 spec 안에서 반복 채택된 패턴이라, write-time 정합 자체가 낯선 선택은 아니다.
    - 다만 **내부(신뢰된) 소비처가 완전히 없다고 단정하기는 이르다** — 같은 번들의 `spec/3-workflow-editor/3-execution.md` §3.5 는 워크플로우 에디터(워크스페이스 소유자 전용, 신뢰 채널)의 실행 실패 배너를 `Error: <message> [Details]` 로 명시하는데, 이 `<message>` 의 소스가 바로 `execution.failed` 의 `error.message`(= `Execution.error`) 다. write-time 새니타이즈를 적용하면 이 **내부·신뢰 사용자용** 표시도 마스킹된 값을 받게 되어, 자기 워크플로우의 실패 원인(예: 어떤 API 키가 유효하지 않은지)을 정확히 알기 어려워질 수 있다 — R17 이 "내부 소비처는 faithful 유지" 를 원칙으로 세운 것과 같은 방향의 우려다.
  - 제안: 다음 중 하나를 spec 변경 없이도(코드 주석/커밋 메시지/PR 설명에) 명시적으로 남길 것을 권고한다 — (a) plan 또는 커밋 메시지에 "R17 의 append-time redaction 유예는 `conversationThread`(내부 재소비 존재) 한정이며, `Execution.error` 는 재소비 경로가 없어 그 유예 조건 밖" 이라는 1~2문장 근거를 명시해 두 결정의 관계를 연속성 있게 기록, (b) 내부 워크플로우 에디터(신뢰 채널)의 `Error: <message>` 표시가 마스킹된 값을 받아도 괜찮은지 — 특히 워크스페이스 소유자가 자기 크레덴셜 문제를 디버깅할 때 — 별도로 확인. 둘 다 spec 문서 자체를 고칠 필요는 없지만(spec 은 이미 `{code,message,nodeId,details?}` 형태만 규정하고 원문/새니타이즈 여부를 약속하지 않음), 근거를 남기지 않으면 이후 리뷰어가 R17 과의 관계를 재추적해야 한다.

- **[INFO]** `sanitize-error-message.ts` 첫 줄 정정 시 R17 cross-link 추가 권고
  - target 위치: plan 의 조치 항목 "`sanitize-error-message.ts` 의 과장된 첫 줄 정정"
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R17 "표면 제약(보안)" 문단
  - 상세: plan 은 이 유틸의 docstring 이 "WS 이벤트" 커버리지를 실제보다 넓게 주장한다는 점을 이미 스스로 지적했다(문서한 보장이 구현보다 넓은, 이 저장소에 반복 기록된 형태). 이번 PR 로 WS 경로가 실제로 포함되면 R17 이 이미 규정한 마스킹 SoT(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`, 1447-1448행)와 관계가 한 겹 더 깊어진다.
  - 제안: docstring 정정 시 "본 유틸은 R17 이 규정한 마스킹 SoT 를 종결 error 필드에도 적용한다" 정도의 1줄 cross-reference 를 남기면, 이후 checker 가 두 결정을 다시 대조할 필요 없이 계보를 바로 확인할 수 있다.

## 요약

`spec/5-system/` 번들 자체는 자기 완결적이며 기존 Rationale 사이에 새로 발견된 모순은 없다.
다만 이번 worktree 의 착수 전 작업(`Execution.error` write-time 새니타이즈, `spec_impact: none`)은
같은 spec 파일 안의 R17 이 명시적으로 세운 "마스킹은 egress-only, 저장값은 원본 유지, append-time
redaction 은 데이터 최소화가 요구될 때까지 유예" 원칙과 인접한 설계 공간에서 반대 방향 결정을
내리면서도 R17 을 인용하지 않는다. 두 결정이 서로 다른 필드(재소비되는 `conversationThread` vs
재소비되지 않는 `Execution.error`)를 대상으로 하므로 실제로 상충하지 않을 가능성이 높지만, 그
구분 근거가 어디에도 적혀 있지 않아 "결정의 무근거 번복" 유형의 리스크로 판단해 WARNING 처리한다.
CRITICAL 로 격상할 만한 명시적 기각 이력이나 직접적인 invariant 위반은 확인되지 않았다.

## 위험도
MEDIUM
