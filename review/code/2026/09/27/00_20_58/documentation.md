# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `workflow-crud.e2e-spec.ts` 최상단 모듈 JSDoc의 "핵심:" 요약 목록이 이번에 확장된 목록 응답 계약 대조(H 케이스)를 반영하지 않는다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — 파일 상단 `describe` 앞 모듈 JSDoc (게이트 24~38행 부근, 이 diff 에서 변경되지 않은 블록)
  - 상세: 이번 diff 는 H 케이스(`GET .../versions` 목록)에 `expectNoUserSecrets` + `WorkflowVersionListItemDto` 계약 대조 루프를 추가했다(게이트 573~579행). 그런데 파일 최상단의 "핵심:" bullet 목록은 A~I 중 duplicate·delete·동시 PATCH·저장/복원 계약만 언급하고 버전 조회(H)의 `creator` 유출·계약 검증은 애초에 언급하지 않는다. H 자체는 이번 PR 이전부터 있던 테스트라 이 gap 은 이번 diff 가 만든 것은 아니지만, 이번 변경으로 그 테스트의 검증 축이 하나 더 늘면서 요약과 실제 커버리지 사이 괴리가 더 커졌다.
  - 제안: 급하지 않음(pre-existing, 이번 PR 스코프 밖). 다음에 이 파일을 만질 때 "핵심:" 목록에 H(목록·상세 모두 `creator` 계약/비밀 유출 검증) 한 줄을 추가하면 좋다.

- **[INFO]** CHANGELOG 항목 제목이 `creator` 만 언급하고 같은 항목 본문이 함께 다루는 `changeSummary` 변경은 제목에서 빠져 있다
  - 위치: `CHANGELOG.md` — 게이트 26행 `## Unreleased — OpenAPI 가 워크플로 버전 응답의 \`creator\` 를 항상 실리는 필드로 광고한다`
  - 상세: 본문(게이트 28~31행)은 `creator` 와 `changeSummary` 두 필드의 §5.4 금지 조합 정정을 모두 설명하는데 제목은 `creator` 만 명시한다. 두 필드가 같은 DTO의 같은 종류의 수정(옵셔널+nullable → 기본형)이라 한 항목으로 묶은 판단 자체는 CHANGELOG 상단 기준과 맞고, 내용도 정확하다 — 제목 범위만 본문보다 좁다.
  - 제안: 사소함. "creator · changeSummary 를 광고한다" 식으로 제목을 넓히면 스캔할 때 더 명확하다. 블로킹 아님.

## 전반 평가

이번 diff 는 문서화 관점에서 전반적으로 모범적이다: DTO 데코레이터 변경마다 "왜"(§5.4 기본형, FK NOT NULL 이라 항상 존재, `type: String` 명시 이유)를 인라인 주석으로 정확히 남겼고, `workflow-version-response.dto.spec.ts` 신규 캐너리 테스트는 래칫·e2e 만으로 부족한 이유를 JSDoc 으로 상세히 설명하며, `VERSION_METADATA_SELECT` 상수 도입 주석도 왜 상수화가 필요한지(자매 메서드 중 하나만 옳았던 과거 결함)를 근거 문서(`review/code/...`)까지 링크해 정확히 서술한다. `workflow-versions.service.ts` 의 `WorkflowVersionDetailProjection` JSDoc 에 추가된 문단은 프런트엔드 미러를 좁히지 않기로 한 근거를 정확히 담고 있고, 실제 `version-history-panel.tsx` 의 `creatorLabel` 방어 분기 및 관련 테스트(`creator: null`)로 교차 검증된다 — 오래된 주석이나 불일치는 발견되지 않았다. CHANGELOG 항목도 `CHANGELOG.md` 상단 기준(§API 계약 변화)에 정확히 부합하는 신규 Unreleased 항목으로 추가됐고, `swagger-dto-contract.spec.ts` 래칫 배열에서 4행을 제거한 것도 실제 DTO 변경과 정합한다. `plan/in-progress/workflow-version-creator.md` 는 실측·방향·뮤턴트 검증표·`--impl-prep` 처분까지 근거를 갖춰 기록했고, 이번 PR 스코프 밖에서 발견된 기존 spec 이격(§7.2 타입명·`## Rationale` 부재)은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 planner 몫으로 정확히 위임했다. 위 두 INFO 는 모두 비블로킹 사소 사항이다.

## 위험도

NONE
