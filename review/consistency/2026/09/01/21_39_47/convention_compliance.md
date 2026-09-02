# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 발견사항

- **[WARNING]** `## Rationale` 이 문서 최종 섹션이 아니다
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md:71`(`## Rationale`) 뒤에 `:89`
    `## 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다` 섹션이 이어짐 (`### 범위 한정 — 일반 원칙
    선언이 아니다` 이후, `## Rationale` 이전 위치가 아니라 그 뒤에 붙어 있다)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §워크플로 3단계 "draft 작성" — "`plan/in-progress/
    spec-draft-<name>.md` 에 변경안 작성. **본문 끝에** `## Rationale` 로 결정 근거 명시." (CLAUDE.md 가
    "Spec 문서 3섹션 구성(Overview/본문/Rationale)…각 SKILL.md 참고" 로 위임하는 바로 그 규정이며, 대상
    문서 종류(`spec-draft-<name>.md`)가 정확히 이 규칙의 적용 대상이다)
  - 상세: 현재 구조는 `Overview → 실측 → 변경 제안(+ 범위 한정) → Rationale → 판단 기준은 이번에 안
    쓴다`. 마지막 섹션은 내용상 "왜 지금 판단 기준을 안 쓰는가" 라는 결정과 근거를 담고 있어
    성격상 Rationale 에 속하는 내용인데, 별도 `##` 섹션으로 Rationale **뒤에** 분리돼 있다. 문서 구조
    규약이 가정하는 "Rationale = 본문 종결부" 를 깨서, 이 문서를 템플릿으로 참고하는 다음 draft 가
    같은 배치를 답습할 위험이 있다.
  - 제안: `## 판단 기준은 이번에 안 쓴다` 절을 `## Rationale` 내부의 하위 절(`### 판단 기준은…`)로
    합치거나, Rationale 의 마지막 bullet 로 흡수한다. 별도 최상위 섹션으로 유지하는 것이 의도(예:
    "결정" 임을 시각적으로 부각)라면 SKILL.md 규정을 "Rationale 다음에 별도 `## 결정` 섹션을 둘 수
    있다" 로 갱신해 규약과 실제 관행을 맞추는 편이 안전하다.

- **[WARNING]** `EngineErrorCode` 4종 전체 열거가 카탈로그 SoT 를 중복시킨다
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md:44-45` (`- \`EngineErrorCode\` —
    **엔진 전용**. 4종(\`EXECUTION_QUEUE_WAIT_TIMEOUT\` · \`WORKER_HEARTBEAT_TIMEOUT\` ·
    \`SERVER_INTERRUPTED\` · \`WEBCHAT_IDLE_TIMEOUT\`)이고…`) — §Overview 에 그대로 삽입될 "변경 제안" 문구
  - 위반 규약: `spec/conventions/error-codes.md` §Overview 자신의 "책임 경계" 선언 — "**카탈로그·분류·
    트리거**: [`5-system/3-error-handling.md §1`](../5-system/3-error-handling.md) (SoT)." 이 문서는
    "① 의미 기반 명명 원칙 ② rename 안정성 정책 ③ historical-artifact 예외 레지스트리" 만 유일 소유하며
    카탈로그는 소유하지 않는다고 스스로 못박고 있다
  - 상세: 실측 결과 `WORKER_HEARTBEAT_TIMEOUT`(`3-error-handling.md:114`)·`EXECUTION_QUEUE_WAIT_TIMEOUT`
    (`:142`)·`WEBCHAT_IDLE_TIMEOUT`(`:144`) 는 이미 `5-system/3-error-handling.md §1` 에 개별 행으로
    카탈로그돼 있다(SERVER_INTERRUPTED 는 미확인이나 같은 패턴으로 추정). §1 의 기존 기명 예시들
    (`CAFE24_INSTALL_INVALID_HMAC` 등)은 "이름 패턴을 보여주는 예시" 로 제시되고 개수를 단정하지
    않는 반면, 이번 삽입문은 "4종" 이라 **개수를 못박은 완전 열거**다. `EngineErrorCode` 에 5번째
    멤버가 추가돼도 이 Overview 문구를 갱신할 어떤 빌드 가드도 없어 조용히 stale 해질 수 있다 —
    "카탈로그 SoT 는 다른 문서" 라는 이 문서 자신의 규약과 정면으로 다른 성격의 정보(개수+전체 목록)를
    같은 문서 안에 병존시키는 셈이다.
  - 제안: §Overview 삽입문에서 4종 전체 열거 대신 "예: `WORKER_HEARTBEAT_TIMEOUT` 등(전체 목록·정의는
    [`3-error-handling.md §1`](../5-system/3-error-handling.md) 참조)" 형태로 1개 예시 + 링크로
    낮추거나, 전체 열거를 유지하려면 "이 목록은 스냅샷이며 SoT 는 `3-error-handling.md §1`" 캐비엇을
    명시해 drift 위험을 문서 자체에 남긴다.

- **[INFO]** 대표 surface 단수→복수 조정은 이미 draft 에 반영됨 (확인만)
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md:82-83`
  - 상세: 이전 라운드(`--spec 21_30_10`) `convention_compliance` INFO #1 이 지적한 "대표 surface(단수)"
    표현 조정 항목이 이번 draft 의 "변경 제안" 절에 이미 반영 계획으로 명시돼 있다. 재지적 불요 —
    새 위반 아님.

## 요약

target 은 `spec/conventions/error-codes.md` §Overview 의 "적용 범위" 문단에 `EngineErrorCode` surface 를
병기하는 spec draft로, 파일 명명(`spec-draft-<name>.md`)·frontmatter 3필드(`worktree`/`started`/`owner`)·
`spec_impact` 리스트 스키마(YAML 파싱 확인, 두 경로 모두 실재)는 정식 규약을 정확히 따른다. 다만 문서
자체의 구조가 project-planner SKILL.md 가 규정한 "본문 끝에 `## Rationale`" 배치를 어기며(Rationale
뒤에 별도 섹션 존속), §Overview 에 삽입하려는 문구가 `EngineErrorCode` 4종을 완전 열거해 이 문서 스스로
"카탈로그는 `3-error-handling.md` 가 SoT" 라 선언한 책임 경계와 성격이 충돌한다(스냅샷이 stale 해질
경로를 가드 없이 만듦). 두 건 모두 시스템 invariant 를 깨는 수준은 아니라 WARNING 이며, target 은
그 외 명명·출력 포맷·API 문서 규약 관점에서는 위반이 관찰되지 않는다.

## 위험도
LOW
