# Plan 정합성 검토

## 조사 방법
- target scope(`spec/5-system/**`)의 브랜치 대비 델타를 `git diff origin/main...HEAD --stat -- spec/` 로 실측 — **0개 파일**. 이 브랜치는 `spec/` 을 전혀 건드리지 않았다(developer 역할 경계 준수, `codebase/**` + `plan/in-progress/spec-draft-nullable-notation-followups.md` 만 변경).
- 실제 변경 파일 목록(`git diff origin/main...HEAD --stat -- codebase/ spec/ plan/`)과 브랜치 커밋 로그(`dfb2664af`~`09403fc53`, 12개)를 대조해 각 커밋이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 어느 항목에 대응하는지 실측 확인.
- 위 plan 문서(933줄) 전문을 직접 Read 하고(bundle 은 예산 절단으로 일부만 실려 있어 디스크 원본을 사용), 열려 있는(`[ ]`) 항목 전부와 target(`spec/5-system/2-api-convention.md §5.4`, `frontmatter code:`)의 현재 상태를 대조.

## 발견사항

이번 브랜치가 만든 CRITICAL/WARNING 급 plan 정합성 위반은 찾지 못했다. 상세:

- **§5.4 관련 6개 미해결 결정 항목**(User 엔티티 컬럼 방어 · 트리거 비밀 스트립 declarative SoT 전환 · 열린 `config` 맵 e2e 규약화 · Flyway `mixed=true` · `CanvasSaveResultDto` 타입 미선언 · §5.4 스윕 2차 e2e 신규) 중 어느 것도 이 브랜치가 우회·선취하지 않았다. `git diff --stat -- spec/` 0건이 이를 직접 뒷받침한다 — spec 쓰기 권한이 없는 developer 브랜치가 실제로 spec 을 건드리지 않았다.
- 브랜치의 각 커밋(`dfb2664af` 스윕 1차, `cb17f0870`/`a6f582680` 래칫 정정, `67881bbd4`/`7e85da873`/`66a2510fd`/`48704becd`/`30b0f60b6` 목록·PATCH 확장과 3중 자매 누락 수정)은 모두 plan 문서 안에 **같은 세션에서** 등재·추적됐다(`plan/in-progress/spec-draft-nullable-notation-followups.md` 는 이 브랜치에서 +193줄로 갱신됨). 예: `IntegrationDto.consecutiveNetworkFailures` 는 plan 이 "선언만 하고 노출 중단은 별도 결정" 이라 적은 그대로 코드가 선언만 했다(`dfb2664af`, `IntegrationDto` 확장 필드 diff 확인) — 제거 여부 결정은 열어 뒀다.
- `notificationSecretV2`/`chatChannelTokenV2` 유출 수정은 plan 이 명시적으로 금지한 "DTO 선언으로 RED 해소" 경로를 **밟지 않고** 응답 스트립으로만 해소했다 — plan 의 사전 지침(`secret-store.md §1.1` 저장 예외 ≠ 노출 예외)과 일치.

## 남은 낮은-신뢰도 관찰 (INFO)

- **[INFO]** plan `spec_impact` frontmatter 가 plan 본문의 열린 후속 항목 footprint 보다 좁다
  - target 위치: 해당 없음 (target `spec/5-system/**` 자체는 무관 — plan 문서 자체의 내부 정합성 문제)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` frontmatter `spec_impact: [spec/1-data-model.md, spec/data-flow/10-triggers.md, spec/5-system/2-api-convention.md, spec/conventions/swagger.md]`
  - 상세: 같은 문서 본문의 여전히 열린(`[ ]`) 항목들이 `spec/2-navigation/4-integration.md §9.1`(줄 768) · `spec/2-navigation/3-schedule.md §4`/`2-trigger-list.md`(줄 807-817) · `spec/conventions/secret-store.md §1`(줄 797) · `spec/conventions/migrations.md`(Flyway `mixed=true`, 줄 691) 편집을 요구하는데, 이 파일들은 frontmatter `spec_impact` 목록에 없다. 다음에 이 plan 을 여는 세션이 `--spec` 번들을 돌리면(consistency `--spec` 는 `spec_impact` 로 대상을 좁히는 관행이 있음 — 메모리 `feedback_consistency_spec_mode_budget.md`) 이 파일들이 누락될 위험이 있다.
  - 제안: 다음에 이 plan 항목들을 착수하는 planner 턴이 `spec_impact` 를 그 시점 실제 footprint 로 갱신한다(지금 당장 이 PR 이 손댈 필요는 없음 — spec 미변경 브랜치이므로).
- **[INFO]** §5.4 래칫 canary fixture 는 여전히 `code:` 미등재 (기존 추적 항목, 신규 아님)
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:`
  - 관련 plan: 같은 plan 문서, "§5.4 래칫 canary fixture 를 `code:` 에 등재" 항목(줄 781, 아직 `[ ]`)
  - 상세: 이 브랜치가 `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` 를 실측으로 확인(`a6f582680`)했으나, target frontmatter `code:` 는 `repo-guards/__tests__/fixtures/**` 를 여전히 포함하지 않는다 — plan 이 이미 알고 있는 gap 이며 이 브랜치가 새로 만든 것은 아니다.
  - 제안: 이미 등재됨 — 별도 조치 불요, 참고로만 기록.

## 요약

브랜치 `sweep-response-contract-5ba0ad` 는 `spec/5-system/**` 를 전혀 수정하지 않았고(`git diff --stat` 로 실측), `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 추적 중인 §5.4 응답-계약 스윕 작업의 developer 몫(deny-list 스트립 확장, 계약 대조 배선, 3중 자매 버그 수정)만 수행했다. 이 plan 문서가 남겨 둔 6개 이상의 "결정 필요" 항목(User 엔티티 방어, 비밀 스트립 declarative 전환, 열린 config 맵 규약화, Flyway mixed 모드 등) 중 어느 것도 이 브랜치가 우회·선취하지 않았으며, 각 커밋은 같은 세션 안에서 plan 문서에 등재·인용됐다. 유일한 관찰은 plan 자신의 `spec_impact` frontmatter 가 본문의 열린 후속 항목이 요구하는 spec 경로보다 좁다는 것인데, 이는 이 브랜치가 만든 결함이 아니라 향후 그 항목을 여는 세션이 처리할 plan-내부 청소 항목이다.

## 위험도
LOW
