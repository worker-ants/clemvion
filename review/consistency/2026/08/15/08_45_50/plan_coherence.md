# Plan 정합성 검토 — target: `spec/5-system/` (--impl-prep)

## 컨텍스트

현재 작업 중인 plan 은 `plan/in-progress/eia-terminal-payload.md`(uncommitted, "재판정 ④" 신규
추가분 — `durationMs` 종결 3종 emit 을 "다음 PR" 로 착수 준비 중)다. "이번 PR"(`error` 객체화)
은 이미 `origin/main`(`e3825cc2c`, #1170)에 머지 완료 상태다. target 스캔 결과 `spec/5-system/`
현재 내용(§6 필드 집합 표 `durationMs` 행, §6.3/§6.4 Planned 주석, §6.5 무언급, `1-data-model.md`
`duration_ms` 컬럼 서술 등)은 plan 이 서술하는 현재 상태와 전부 실측 일치했다 — 이 축에서는
충돌·왜곡 없음.

## 발견사항

- **[WARNING]** `eia-terminal-payload.md` 의 `spec_impact` frontmatter 가 plan 본문이 스스로
  선언한 spec 변경 대상보다 좁다
  - target 위치: N/A (plan 자체 정합성 — target 은 참조 대상)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` frontmatter `spec_impact:` (현재
    `spec/5-system/14-external-interaction-api.md` 1건만 등재) vs 같은 파일의 "재판정 ④ →
    spec 동반 변경 (전수)" 표(우커밋 diff, L226-236)가 명시하는 대상: `spec/conventions/
    chat-channel-adapter.md`(:159-160)·`spec/3-workflow-editor/3-execution.md`(:307)
  - 상세: `update-returning-tuple-shape.md`·`spec-draft-eia-notification-payload-contract.md`
    는 동일 상황(“이 PR 은 spec 을 직접 안 바꾸지만 본문이 planner 위임 spec 각주를 스스로
    명시” 또는 “여러 spec 파일에 걸친 변경”)에서 `spec_impact` 를 실제 영향 파일 전체로 채워
    `complete/` 이동 시 Gate C(`spec-plan-completion.test.ts`)가 오판하지 않도록 명시적으로
    관리해 왔다(두 plan 모두 그 이유를 frontmatter 위 blockquote 로 남김). 이 plan 은 같은
    패턴을 아직 반영하지 않았다 — `durationMs` PR 이 실제로 착수되면 두 파일의 spec 갱신이
    빠진 채 `spec_impact` 가 1건으로 좁게 남을 위험이 있다
  - 제안: `durationMs` PR 착수(또는 완료) 시점에 `spec_impact` 리스트에 두 파일을 추가할 것.
    지금 당장 차단 사유는 아니나(§14 자체는 developer 권한 내에서 안 건드리므로 CRITICAL 아님),
    구현 착수 전에 갱신해 두는 편이 Gate C drift 를 막는다

- **[WARNING]** 정본 트래커 두 곳의 "result.outputs · durationMs" 결합 항목이 이 plan 의
  분리 결정을 아직 반영하지 못한다
  - target 위치: N/A
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L13
    ("**종결 이벤트의 `result.outputs` · `durationMs` emit**" 단일 미해결 항목,
    "구현되면 필드 집합 표의 '미구현 (Planned)' 를 '구현됨' 으로 flip" 이라고 두 필드를
    한 번에 전제) / `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
    L187 ("emit 에 `durationMs`·`result.outputs` 채우기" 단일 체크박스)
  - 상세: `eia-terminal-payload.md` 재판정 ④(우커밋)는 두 필드를 **의도적으로 분리**했다 —
    `durationMs` 는 이번 착수, `result.outputs` 는 "spec 이 내용을 정의한 적 없다" 는 이유로
    별도 planner 턴으로 재이연했다. 이 분리는 근거가 확실하지만(스펙 §6 표가 실제로 shape
    미정), 위 두 정본 문서는 여전히 두 필드를 하나로 묶어 서술한다. `durationMs` 만 먼저
    구현·flip 되면 두 트래커의 결합 서술이 "절반만 참" 인 상태로 남고, 그 상태로 체크박스를
    그대로 `[x]` 처리하면 `result.outputs` 미구현 사실이 묻힌다(이 저장소가 이미 여러 번
    지적한 "SoT 한쪽만 고친다"·"결합 항목을 통째로 닫는다" 패턴과 같은 모양)
  - 제안: `durationMs` 구현 시 두 트래커 항목을 분리해 `durationMs` 부분만 닫고
    `result.outputs`(planner 턴 대기)는 별도 미체크 줄로 남길 것. `eia-terminal-payload.md`
    의 기존 "다른 plan 과의 관계" 절(L264-275, 이번 diff 밖)이 이미 이 세 트래커·
    `retry-turn-terminal-guard.md` 를 "동시 갱신 대상" 으로 지목해 뒀으므로, 실행 시 그
    절차를 그대로 따르되 **분리된 형태로** 반영해야 한다는 점만 이번 라운드에서 명시적으로
    덧붙일 필요가 있다

- **[INFO]** plan 헤더의 "실제 브랜치" 서술이 재판정 ④ 시점 기준으로 stale
  - target 위치: N/A
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` L12-16 (도입부 blockquote:
    "워크트리 이름이 작업과 무관하다... 실제 브랜치는 `claude/eia-terminal-payload` 다")
  - 상세: 현재 워크트리의 실제 체크아웃 브랜치는 `claude/eia-terminal-duration-outputs`
    다(`git branch --show-current` 실측, `HEAD` 도 `origin/main` 최신 `e3825cc2c`(#1170)
    직후). "이번 PR"(error 객체화, `claude/eia-terminal-payload`)은 이미 머지돼 별도
    브랜치이고, "다음 PR"(재판정 ④, durationMs)은 새 브랜치에서 진행 중인 것으로 보인다.
    plan 이 스스로 "harness 오탐의 예고된 재발" 이라 경고해 둔 바로 그 클래스(워크트리·
    브랜치 이름이 프롬프트에 박혀 검토를 오염)가, 이번엔 plan 문서 자신의 서술 쪽에서
    stale 해진 형태로 재발했다
  - 제안: 차단 사유 아님(정보 서술 오기). 다음 편집 시 브랜치명을 갱신하거나 "이번 PR
    기준" 캐비엇을 붙일 것

## 요약

target(`spec/5-system/`)의 현재 상태는 `eia-terminal-payload.md` 재판정 ④(durationMs 착수
준비)가 서술하는 전제와 실측상 전부 일치했고, 미해결 결정을 일방적으로 우회하는 CRITICAL 급
충돌은 발견되지 않았다. 다만 이 plan 이 다음 PR 로 넘어가면서 (a) 자신의 spec 변경 범위를
frontmatter 에 완전히 반영하지 않았고 (b) 두 정본 트래커의 결합 항목이 이 plan 의 분리 결정을
아직 못 따라가고 있어, 구현이 끝난 뒤 체크리스트·spec_impact 동기화 단계에서 "절반만 닫혔는데
전체가 닫힌 것처럼 보이는" drift 가 생길 위험이 있다. 둘 다 지금 당장 구현 착수를 막을 사유는
아니며, `durationMs` PR 실행/완료 시점에 함께 처리하면 된다.

## 위험도

LOW
