STATUS=success Rationale 연속성 검토 완료 — CRITICAL 0 / WARNING 0 / INFO 2

===REPORT_MARKDOWN_BELOW===

# Rationale 연속성 검토 — spec-data-flow-structural-followups

## 검토 범위 및 방법

target(`plan/in-progress/spec-data-flow-structural-followups.md`)의 체크리스트 §1~§3 는
"이미 적용 완료"로 표시돼 있어, 실제 spec 변경 여부를 `git diff`로 확인했다. 워크트리
`spec-structural`에 다음 3개 파일의 실제 uncommitted 변경이 존재함을 확인:

- `spec/data-flow/0-overview.md`
- `spec/data-flow/12-workspace.md`
- `spec/data-flow/3-execution.md`

각 변경분을 관련 spec(`spec/5-system/1-auth.md`, `spec/2-navigation/6-config.md`,
`spec/data-flow/7-llm-usage.md`, `spec/conventions/node-cancellation.md`,
`spec/5-system/4-execution-engine.md`)의 `## Rationale` 및 본문과 대조하고, 참조된 두 plan
(`spec-update-node-cancellation-shutdown-classification.md`,
`node-cancellation-residual-signal-propagation.md`)의 현재 상태도 함께 확인했다.

## 발견사항

- **[INFO]** RBAC 섹션(§3.6) 신설 근거가 `## Rationale` 절이 아닌 본문(§3)에 산재
  - target 위치: `spec/data-flow/0-overview.md` 신설 `### 3.6 권한 요약 (선택)` (본문 §3, `## Rationale`
    절 아님)
  - 과거 결정 출처: 동일 문서의 `## Rationale` 절 도입 관례 — 예시로 이미 존재하는
    "Inline Alert 의 위치를 `0-overview.md` cross-cutting 자리로 (§3.4)" 항목(같은 파일의
    `## Rationale`). 이 프로젝트는 "본문 = latest-only 사실, 왜 이 선택인가/기각 대안 = `## Rationale`"
    분리를 spec 3섹션 관례로 일관되게 유지한다(`CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서 끝의
    `## Rationale`").
  - 상세: 신설된 §3.6 은 "§3.4(상태 전이) 아래에 두지 않는다 — 그 섹션은 엔티티 status enum 전이
    전용이라 권한 매트릭스가 들어가면 의미가 어긋난다"는 **배치 이유(rationale)**를 본문에 직접
    서술한다. 이는 사실 기술이 아니라 설계 결정의 근거이므로, 이 문서 자신의 관례(및 다른 15개
    data-flow 문서·수십 개 spec 문서가 따르는 동일 패턴)상 `## Rationale` 절에 있어야 할 내용이
    본문에 남아 있다. 위반이라기보다 관례 이탈이며, 정확히 이번 target 이 §1 에서 "RBAC 매트릭스가
    템플릿과 다른 자리에 있다"고 지적한 것과 같은 종류의 구조 이슈가 새 섹션에서 소규모로 재발한
    형태다.
  - 제안: `0-overview.md`의 `## Rationale`에 "### 권한 요약 섹션(§3.6)을 선택 요소로 신설한 이유"
    항목을 추가하고, §3.6 본문은 사실 서술("선택 요소이며 현재 `12-workspace.md §4`만 보유")만
    남긴 뒤 그 항목으로 링크. 크지 않은 정리이므로 CRITICAL/WARNING 은 아니다.

- **[INFO]** `spec_impact` 프런트매터가 실제 변경 파일 중 `0-overview.md` 를 누락
  - target 위치: `plan/in-progress/spec-data-flow-structural-followups.md` frontmatter
    `spec_impact` (현재 `spec/data-flow/12-workspace.md`, `spec/data-flow/3-execution.md` 2건만
    나열)
  - 과거 결정 출처: 해당 없음(신규 plan 자체의 목록 정합성 문제). 다만 Rationale 연속성 관점에서
    `spec_impact` 는 "이번에 Rationale/본문이 바뀐 spec 문서" 지도 역할을 하므로 완전성이
    후속 감사의 신뢰도에 직결된다.
  - 상세: `git diff` 로 확인한 실제 변경 파일은 3개(`0-overview.md` 포함)인데 frontmatter 목록은
    2개뿐이다. `0-overview.md` 자체도 도메인 인덱스 명칭(`LLM Config`→`Model Config`)과 §3.6 신설을
    포함하는 실질 변경이라 이 문서를 필요로 하는 향후 `--spec` 재검토·spec-coverage 감사가 이 파일을
    놓칠 수 있다.
  - 제안: push 전 `spec_impact` 에 `spec/data-flow/0-overview.md` 추가.

## 검증했으나 문제 없음으로 판단한 항목 (참고)

- **§1 RBAC 섹션 승격**: 옛 `### 3.2 RBAC 매트릭스 (요약)` 가 `## 3. 상태 전이` 아래 있던 배치를
  정당화하는 기존 Rationale 은 어디에도 없었다(2026-06-10 `data-flow 재구성` 이후의 단순 누락으로
  보임). 따라서 이번 승격은 "기각된 대안의 재도입"도 "합의 원칙 위반"도 아니다. 인바운드 앵커
  (`12-workspace.md#32-…`, `#4-외부-의존`)도 `spec/`·`plan/`·`codebase/*/src` 전수 grep 결과 0건이라
  체크리스트의 "안전했다" 주장과 실측이 일치했고, 자기참조 `§4`(workspace.deleted 감사 각주)도
  `§5` 로 정정돼 내부 정합이 깨지지 않았다.
- **§2 SIGTERM 각주**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
  최상단이 "미결은 이 문서의 (a)/(b) 택일 결정뿐이며 여전히 사용자 몫"이라고 명시하고,
  `node-cancellation-residual-signal-propagation.md` 도 `assertExecutionNotCancelled` 가
  `FAILED`/`SERVER_INTERRUPTED` 를 관측 못 하는 갭을 여전히 열린 항목으로 추적 중임을 확인했다.
  target 의 각주는 어느 쪽도 선점하지 않는 중립 서술을 실제로 지키고 있고, 이는 결정을 뒤집는
  것이 아니라 아직 열려 있는 결정에 상호참조를 추가하는 것이므로 새 Rationale 이 불필요하다.
  `4-execution-engine.md §11`·`conventions/node-cancellation.md` 어디에도 이 분류가 "최종 확정"
  됐다고 선언하는 Rationale 은 없었다.
- **§3 명칭 통일**: `#1040`(직전 커밋들)이 명시적으로 "표 헤더의 기존 표기를 유지한다"고 적어 둔
  구간을 이번 diff 가 실제로 뒤집지만, 동시에 `12-workspace.md` `## Rationale`에 "명칭 통일 범위"
  항목을 새로 작성해 (a) 왜 지금 통일하는지, (b) 왜 `data-flow/` 범위로 한정하는지, (c) 코드
  식별자(`ASSISTANT_NO_LLM_CONFIG`, `llm-config-selector`, `ED-AI-06~08`)는 왜 제외하는지를
  명문화했다 — 이는 criterion 3("결정의 무근거 번복")이 요구하는 바로 그 패턴(번복 + 새 Rationale)
  이다. 인용된 코드 식별자·라인 번호(`4-ai-assistant.md:620`·`:651`, `1-node-common.md` 등)도 모두
  실제로 존재해 scope 축소 근거가 사실에 기반했다. `spec/2-navigation/6-config.md:286`(API alias
  제거)·`spec/data-flow/7-llm-usage.md`(이미 Model Config)·`spec/5-system/1-auth.md §3.2`(정본
  명칭) 인용도 모두 현재 파일 상태와 일치했다. `unified-model-management`/
  `models-rename-docs-unify-followup.md` 이력에도 "data-flow 는 명칭 통일 대상에서 제외한다"는
  반대 결정은 없어 이번 확장과 충돌하지 않는다.

## 요약

target 이 실제로 적용한 세 변경(RBAC 섹션 승격, SIGTERM 분류 미결 각주, `data-flow/` 범위
명칭 통일) 모두 기존 spec 의 `## Rationale` 에서 명시적으로 기각된 대안을 재도입하거나 합의
원칙을 위반하지 않는다. 오히려 명칭 통일 건은 직전 커밋(#1040)이 "표기를 유지한다"고 적어 둔
결정을 뒤집으면서 그 자리에 새 Rationale("명칭 통일 범위")을 정확히 작성해 이 checker 의
핵심 기준(번복 시 새 근거 동반)을 모범적으로 충족했고, SIGTERM 각주는 실제로 아직 열려 있는
결정(사용자 몫으로 명시된 (a)/(b) 택일)에 대해 어느 쪽도 선점하지 않는 중립적 상호참조만
추가했다. RBAC 섹션 재배치는 애초에 그 자리를 정당화하는 Rationale 이 존재한 적이 없어
"번복"의 대상 자체가 아니다. 다만 §1 이 지적한 것과 같은 종류의 경미한 구조 이슈(설계 근거가
`## Rationale` 절이 아닌 본문에 산재)가 새로 신설된 §3.6 자체에서 소규모로 재발했고,
`spec_impact` 프런트매터가 실제 변경 파일 하나(`0-overview.md`)를 누락해 향후 Rationale
추적성을 약화시킬 수 있다는 점만 INFO 로 남긴다.

## 위험도

LOW
