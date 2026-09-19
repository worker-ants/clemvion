# 정식 규약 준수 검토

## 검토 범위 정정 (예산 절단 보정 반영)

프롬프트가 지목한 target(`spec/3-workflow-editor/`)은 이 브랜치의 실제 델타와 무관하다(scope 델타 0개 파일). 프롬프트 말미의
"예산 절단 보정" 지시에 따라, 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/entity-column-drift-b83f15`)를
절대경로로 직접 읽어 실제 검토 대상을 다음으로 재설정했다:

- 구현 diff: `git diff origin/main...HEAD -- codebase` (엔티티 8파일 9곳 + `entity-schema-declarations.e2e-spec.ts`)
- 대조 spec: `spec/1-data-model.md` (이번 브랜치에서는 미변경 — 대조만 수행)
- plan: `plan/in-progress/entity-column-declaration-drift.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`

## 발견사항

- **[INFO]** e2e 테스트 주석의 `plan/complete/...` 선참조가 현재는 존재하지 않는 경로를 가리킴
  - target 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 헤더 docstring, 신규 추가된 "**컬럼 층은 양방향이다**" 문단의 마지막 줄 (`근거·실측: plan/complete/entity-column-declaration-drift.md.`)
  - 위반 규약: 이를 직접 강제하는 `spec/conventions/*` 항목은 없음(`spec/conventions/review-citations.md` 는 `review/**` 산출물 인용 형식만 규제하고 `plan/**` 인용은 명시적으로 "대상 아님"으로 제외). 근접 규범은 CLAUDE.md "정보 저장 위치" 표의 `plan/in-progress/` ↔ `plan/complete/` 구분이다.
  - 상세: 실제 파일은 `plan/in-progress/entity-column-declaration-drift.md`(frontmatter `status: in-progress`)이며 `plan/complete/entity-column-declaration-drift.md` 는 이 워크트리에 존재하지 않는다(`find plan -iname` 로 확인). 같은 plan 문서 자체의 체크리스트에도 "트래커 반영 · 이 plan `complete/` 이동" 항목이 아직 미체크다. 즉 이 코드 주석의 경로 인용은 그 이동 커밋이 실제로 일어나야 비로소 참이 된다 — 지금 시점에는 깨진 링크다. (바로 위 줄의 기존 인용 `plan/complete/entity-schema-declaration-drift.md` 는 대조군으로, 그 파일은 실제로 `plan/complete/`에 있어 참이다 — 두 인용의 시제가 서로 다르다.)
  - 제안: plan 이동 전까지는 `plan/in-progress/entity-column-declaration-drift.md` 로 인용하거나, "이 plan `complete/` 이동" 체크리스트 항목을 처리하는 마무리 커밋에서 이 경로 문자열도 함께 갱신한다. `spec/conventions/review-citations.md` 가 `plan/**` 인용을 규제 대상에서 제외한 근거("인용하는 라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을 담는다")는 `plan/**` 문서 간 상호 인용에는 맞지만, `codebase/**` 코드 주석이 아직 완료되지 않은 `plan/**` 문서를 "complete" 경로로 선인용하는 이번 사례까지는 덮지 않는다 — CRITICAL/WARNING 사유는 아니고 문서 위생 차원의 제안이다.

## 준수 확인 (참고 — 위반 아님)

- **명명 규약**: 신규로 붙인 `type: 'uuid'`(alert_rule·workspace_invitation·llm_usage_log·integration_usage_log) · `enumName: 'node_category'`/`'edge_type'` · `default: 'chat'`/`default: () => 'now()'` 는 전부 기존 DB 사실(`V001__initial_schema.sql`, `V088__model_config_rename_kind.sql`, `V019__workflow_assistant.sql`)과 일치하며, 코드베이스 내 기존 패턴(관계(`@ManyToOne`+`@JoinColumn`)로 타입이 추론되는 FK 컬럼은 `type` 생략, 관계 객체가 없는 FK 컬럼은 `type: 'uuid'` 명시)과도 정확히 들어맞는다. `enumName` 값도 저장소에서 실제 Postgres ENUM 타입인 두 컬럼(`node_category`, `edge_type`)에만 붙었고 값도 DB 타입명과 일치한다 — 새로운 명명 패턴을 만든 것이 아니라 기존 패턴에 맞춘 정정이다.
- **문서 구조/spec-impl-evidence 규약**: 수정된 8개 엔티티 파일 모두 `spec/1-data-model.md` frontmatter `code: codebase/backend/src/modules/**/entities/*.entity.ts` 글롭에 포섭되어 있고, 확장된 e2e 파일(`entity-schema-declarations.e2e-spec.ts`)도 이미 같은 frontmatter `code:` 나열에 있어 신규 `code:` 등재가 불필요하다.
- **plan frontmatter (Gate C)**: `plan/in-progress/entity-column-declaration-drift.md` 의 `spec_impact: none` 은 bare `none` 형식으로, 이번 브랜치가 `spec/**` 파일을 실제로 건드리지 않은 사실과 일치한다(`git diff origin/main...HEAD --stat -- spec/` 결과 0).
- **migrations.md**: 이번 변경은 TypeScript 엔티티 선언만 정정할 뿐 DB 스키마 자체는 바꾸지 않으므로(선언이 실제 DB 사실을 뒤늦게 반영) 신규 `V<N>` 마이그레이션 파일이 필요 없다 — append-only 원칙과 충돌 없음.
- **출력 포맷 규약 / API 문서 규약**: 이번 diff 는 컨트롤러·DTO·API 응답·이벤트 페이로드·에러 코드를 건드리지 않아 해당 사항 없음.
- **금지 항목**: `spec/conventions/**` 에 열거된 금지 패턴(예: `error-codes.md` 소문자 코드, `migrations.md` V번호 재사용/gap, `secret-store.md` 위반 등) 중 이번 diff 가 답습하는 것은 없음.

## 요약

이번 브랜치(엔티티 컬럼 선언 9곳 정정 + 컬럼 층 스키마 비교기 가드 확장)는 정식 규약(`spec/conventions/**`) 관점에서 실질적 위반이 없다. 신규로 추가한 타입/enumName/기본값 선언은 저장소의 기존 TypeORM 관례와 실제 DB 사실 양쪽에 정확히 부합하고, migrations.md·spec-impl-evidence 관련 frontmatter·plan Gate C 형식도 모두 규약대로다. 유일하게 짚을 만한 것은 e2e 테스트 주석이 아직 `plan/in-progress/` 에 있는 문서를 `plan/complete/` 경로로 선인용한 점인데, 이는 어떤 conventions 문서도 명시적으로 규제하지 않는 사소한 문서 위생 이슈이며 plan 자신의 미체크 항목("complete/ 이동")이 처리되면 자연히 해소된다.

## 위험도

LOW
