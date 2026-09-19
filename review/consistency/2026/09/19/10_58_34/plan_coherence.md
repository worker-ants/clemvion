# Plan 정합성 검토 — target `spec/2-navigation/` (--impl-prep)

## 발견사항

- **[WARNING]** `entity-column-declaration-drift.md` 의 impl-prep/impl-done 스코프가 `spec/1-data-model.md` 를 빠뜨린다
  - target 위치: (target 자체엔 결함 없음) — 진행 중 plan `plan/in-progress/entity-column-declaration-drift.md` 하단 `## 체크리스트`
    1행 `- [ ] --impl-prep spec/2-navigation/` (지금 이 리뷰가 그 항목을 수행 중) 및 5행
    `- [ ] --impl-done — spec/2-navigation/ · spec/3-workflow-editor/`
  - 관련 plan: `plan/in-progress/entity-column-declaration-drift.md` 자신 + `spec/1-data-model.md` frontmatter
  - 상세: `spec/1-data-model.md` 의 `code:` 는 `codebase/backend/src/modules/**/entities/*.entity.ts` 라는
    전-엔티티 와일드카드 하나로 되어 있어, 이번에 고친 여덟 파일(`alert-rule.entity.ts` ·
    `workspace-invitation.entity.ts` · `integration-usage-log.entity.ts` · `llm-usage-log.entity.ts` ·
    `model-config.entity.ts` · `node.entity.ts` · `edge.entity.ts` · `workflow-assistant-session.entity.ts`)
    전부를 **직접** 문다 — 이 문서가 엔티티 선언의 단일 SoT 다. 그런데 plan 의 impl-prep/impl-done
    체크리스트는 `spec/2-navigation/`(일부 엔티티만 `modules/alerts/**`·`modules/workspaces/**`·
    `modules/integrations/**`·`modules/model-config/**` 글롭으로 커버) 과 `spec/3-workflow-editor/`
    (`node.entity.ts`/`edge.entity.ts`/`workflow-assistant-session.entity.ts` 커버) 만 나열하고
    `spec/1-data-model.md` 는 어느 쪽에도 없다. 두 feature spec 모두 커버하는 파일들은 우연히 중복
    보호되지만, **data-model.md 자체가 걸려야 할 이유**(엔티티 선언·DB 대조 가드
    `entity-schema-declarations.e2e-spec.ts` 를 이번에 컬럼 층으로 확장하는 작업의 SoT 문서이기도
    하다)가 스코프에서 빠져 있다.
  - 제안: plan 체크리스트의 `--impl-prep`/`--impl-done` 스코프에 `spec/1-data-model.md` 를 추가한다.
    (`--impl-prep` 는 `spec/3-workflow-editor/` 도 함께 빠져 있어 같은 이유로 추가 필요.)

- **[INFO]** 같은 트래커의 인접 열린 결정(`spec/1-data-model.md` 자신의 `code:` 에 e2e 가드를 넣을지)이
  이번 가드 확장으로 결정 비용이 커진다
  - target 위치: 해당 없음 (참고용 교차 참조)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4698-4702`
    (planner, 낮음, 2026-09-19 등재 — "`spec/1-data-model.md` frontmatter `code:` 에 이 문서를 지키는
    e2e 가드를 넣을지 — 게이트 범위 결정". 후보 셋 중 하나가 바로 `entity-schema-declarations`)
  - 상세: 이 항목은 "결정 필요" 로 열려 있고, `entity-column-declaration-drift.md` 는 그 파일을 건드리지
    않으므로 **충돌은 없다** — 다만 이번 PR 이 그 가드를 컬럼 층까지 넓히면서 그 가드의 무게가 늘어,
    다음에 이 결정을 내릴 때 "셋 다 넣을지" 판단에 영향을 줄 수 있다는 점만 기록해 둔다.
  - 제안: 조치 불필요. 트래커 항목에 이번 확장 사실이 자동으로 반영되지는 않으니, 이 plan 이
    `complete/` 로 이동할 때 트래커 반영 단계에서 그 항목 본문에 "컬럼 층까지 확장됨" 한 줄을 덧붙이는
    것을 권장.

- **[INFO]** 상위 트래커 항목(엔티티 컬럼 선언 아홉 곳)의 두 "결정할 것" 은 이 plan 이 정합적으로 닫는다 —
  충돌 없음, 확인 목적으로 기록
  - target 위치: 해당 없음
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4649-4658`
  - 상세: 트래커는 "① 고칠지 ② 가드를 컬럼 층으로 넓힐지 ③ 넓히면 «선언 생략» 과 «거짓 선언» 을 가르는
    기준" 셋을 미결로 남겼다. `entity-column-declaration-drift.md` 는 ①②를 "고치고 가드 확장" 으로
    명시적으로 결정했고, ③은 "블랭킷 스키마-diff(모든 컬럼 층 upQueries=0) + 완전 미매핑 컬럼만 명명
    예외 목록" 이라는, 트래커가 우려한 "타입은 생략해도 추론값이 선언이 된다" 문제를 회피하는 방식으로
    답한다. target(spec/2-navigation) 이나 다른 plan 의 미해결 결정과 충돌하지 않는다.
  - 제안: 없음 (정합).

## 요약

target `spec/2-navigation/`(1-workflow-list · 2-trigger-list · 3-schedule, 나머지 15개 파일은 예산 절단)
자체의 서술은 `plan/in-progress/` 의 관련 항목(마켓플레이스 미착수, 트리거/스케줄 대형 트래커의 열린
항목들, 최근 종결된 FK/유일 키 정정)과 충돌하지 않는다. 실제 코드 변경(엔티티 아홉 컬럼 선언 정정)은
`spec_impact: none` 이 타당하고, 그 정정이 닫으려는 트래커 항목의 두 "결정할 것" 도 plan 이 명시적으로
해소한다 — CRITICAL 급 미해결-결정 우회는 없다. 다만 plan 자신의 검증 체크리스트가 스코프를 잡을 때
`spec/1-data-model.md`(변경된 엔티티 파일 여덟 개 전부를 직접 무는 유일한 전체-엔티티 SoT) 를 빠뜨린
것은 실질적인 게이트 커버리지 공백이라 WARNING 으로 남긴다 — `--impl-done` 실행 전에 스코프에
추가해야 한다.

## 위험도
MEDIUM
