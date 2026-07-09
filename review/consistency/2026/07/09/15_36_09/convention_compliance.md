# 정식 규약 준수 검토 — spec-draft-nav-spec-cleanup

대상: `plan/in-progress/spec-draft-nav-spec-cleanup.md` (검토 모드 `--spec`)
실제 diff 대조 대상: `spec/0-overview.md` · `spec/2-navigation/11-error-empty-states.md` ·
`spec/2-navigation/14-execution-history.md` · `spec/2-navigation/_product-overview.md`

## 발견사항

- **[WARNING]** "bare ID 라 불변" 서술이 `conversation-thread.md` 에는 사실과 다름 — 실제로는 살아있는 link
  - target 위치: 본문 §"파급 정리" (b)(c) 다음 괄호 문장 — "(1-ai-agent·conversation-thread·data-hydration-surfaces 의
    EH-DETAIL-12 언급은 링크가 아닌 bare ID 라 불변.)"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` 가 지키려는 invariant
    (spec 간 위임/참조가 실제로 존재하는 대상을 가리켜야 함) — 그리고 본 target 자체의 §"Rationale"이 재현하는
    `14-execution-history.md §Rationale R-6` 의 문제의식("dangling 위임" 방지)과 정확히 같은 종류의 문제.
  - 상세: `1-ai-agent.md:1156`, `data-hydration-surfaces.md:72` 는 실제로 `EH-DETAIL-12` 를 링크 없는 순수 텍스트로만
    언급해 target 의 주장대로 "bare ID" 다. 그러나 `conventions/conversation-thread.md:417` 은
    `[Spec Execution History §EH-DETAIL-12](../2-navigation/14-execution-history.md)` 형태의 **실제 markdown 링크**이며,
    "상세 복원 규약은 … 의 ConversationThread 재구성 정책에 **위임**" 이라는 문구로 `14-execution-history.md` 가 그 정책을
    담고 있다고 전제한다. 이번 변경으로 EH-DETAIL-12 행 전체(및 그 "정책·UI 미정" 서술)가
    `_product-overview.md §3.15` 로 이관되어, `14-execution-history.md` 에는 더 이상 그 위임 대상이 존재하지 않는다.
    링크 자체는 파일 단위 anchor 가 없어 `spec-link-integrity.test.ts` 를 기술적으로는 통과하지만(파일 존재만 검사),
    "무엇에 위임하는가" 라는 내용상의 정합은 이번 변경으로 새로 깨졌다 — 정확히 R-6 이 고치려 한 "dangling 위임" 패턴의 재발.
  - 제안: `conversation-thread.md:417` 의 링크 타깃을
    `../2-navigation/_product-overview.md#315-execution-history-실행-내역` 로 갱신하고, target 본문의 "불변" 서술에서
    conversation-thread 를 제외하거나 "링크는 유지하되 위임 대상 갱신 필요" 로 정정한다. (같은 세션에서 이 파일도
    같이 손보는 편이 이번 cleanup 의 취지에 부합한다.)

- **[INFO]** "이 파일만 유일하게 `## Overview (제품 정의)` 보유" 서술이 heading 매칭 기준으로는 부정확
  - target 위치: §"2. `14-execution-history.md`" 첫 불릿
  - 위반 규약: 없음(hard violation 아님) — `project-planner` SKILL §Spec 문서 구조 규약(3섹션 권장)의 취지 자체는
    이번 변경으로 오히려 더 잘 충족됨. 다만 target 의 근거 서술이 좁게 읽으면 사실과 다르다.
  - 상세: `spec/2-navigation/6-config.md` 도 `## Overview (제품 정의)` 헤딩을 그대로 갖고 있다(Auth+Models 두 PRD
    서브섹션을 한 파일로 합친 이유를 설명하는 짧은 문단). 따라서 "형제 중 유일하게 `## Overview (제품 정의)` 헤딩을
    보유" 라는 문자 그대로의 주장은 grep 기준 반례가 있다. 다만 실질적으로 문제였던 것 — `_product-overview.md` 와
    동일한 ID-태깅 요구사항 매트릭스(EH-LIST/EH-DETAIL/EH-NAV)를 **중복 SoT** 로 별도 보유한 것 — 은
    `14-execution-history.md` 에만 있었고 `6-config.md` 의 Overview 는 매트릭스가 아닌 범위-설명 문단이라 이 문제에
    해당하지 않는다. 즉 실제 판단은 맞지만 근거 표현이 과도하게 일반화됨.
  - 제안: (수정한다면) "유일하게 자체 요구사항-ID 매트릭스 Overview 를 보유" 로 좁혀 쓰거나, 현행 그대로 두어도
    실제 spec 변경의 정당성에는 영향 없음 — 정보성 지적.

## 점검 관점별 요약

1. **명명 규약** — 신규 식별자 없음(`WorkspaceSlugGate`/`resolveFallbackWorkspace` 는 실제 코드 심볼과 1:1 확인됨,
   `EH-*` ID 체계는 기존 `NAV-*`/`ED-AI-*` 패턴과 동일하게 `_product-overview.md` 로 이관 — 오히려
   `spec/0-overview.md §4` 의 "요구사항 식별자는 각 영역의 `_product-overview.md` 안에서 사용" 서술과 완전히 정합).
   위반 없음.
2. **출력 포맷 규약** — 대상 changeset 은 순수 문서 재배치라 API/이벤트/에러코드 출력 포맷과 무관. 해당 없음.
3. **문서 구조 규약** — `project-planner` SKILL §"Spec 문서 구조 (3섹션 권장)" 의 "다중 spec 파일을 가진 영역은
   `_product-overview.md` 별도 파일" 규정을 정확히 따름. 2-section(본문+Rationale) 전환 후 `14-execution-history.md`
   가 형제 문서(`0-dashboard`·`1-workflow-list`·`10-auth-flow`·`11-error-empty-states`·`15-system-status`)와
   구조적으로 동일함을 실측 확인(`## 1. …` 로 시작, `## Rationale` 로 종료). `_product-overview.md §3.15` 신설 위치도
   기존 `§3.1`~`§3.14` 넘버링과 충돌 없이 순차 이어짐. anchor slug(`#315-execution-history-실행-내역`,
   `#24-테이블` 등) 전부 실제 heading 과 일치 확인. 위 WARNING/INFO 를 제외하면 위반 없음.
4. **API 문서 규약** — 해당 변경 범위 밖(OpenAPI/DTO 데코레이터 무관). 해당 없음.
5. **금지 항목** — `spec-impl-evidence.md` 의 frontmatter 스키마(§2) 대로 `11-error-empty-states.md` 의 신규
   `code:` 항목(`workspace-slug-gate.tsx`, `resolve-fallback.ts`) 실존 확인, `status: implemented` 유지 조건(≥1
   code 매치) 충족. `_product-overview.md`(`_`-prefix) 는 `spec-impl-evidence.md §1` 제외 대상이라 frontmatter
   불필요 — 그대로 없음 확인. `spec-area-index` 가드 대상 index 문서(`_product-overview.md`)가 여전히
   `14-execution-history.md` 를 링크 중임을 확인(가드 통과 유지). 금지 패턴 재도입 없음.

## 요약

이번 spec-draft 는 `project-planner` SKILL 의 "다중 spec 파일 영역의 Overview 는 `_product-overview.md` 로 통합" 규약을
정확히 겨냥한 재정렬로, 명명·frontmatter·문서구조·area-index 가드 전반에서 실제 파일 상태를 대조 확인한 결과 규약
위반이 없다. 유일한 실질 이슈는 EH-DETAIL-12 매트릭스 이관 시 `conventions/conversation-thread.md` 의 실제 링크
하나를 "bare ID 라 불변" 으로 잘못 분류해 갱신 대상에서 누락한 것 — 이는 build 가드(anchor 없는 링크라 파일 존재만
검사)는 통과하지만, 이번 cleanup 이 고치려던 "dangling 위임" 패턴을 다른 파일에서 재현하는 결과라 WARNING 으로
분류한다. 두 번째 발견(INFO)은 근거 서술의 과잉 일반화로, spec 변경 자체의 타당성에는 영향이 없다.

## 위험도

LOW
