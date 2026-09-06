# Plan 정합성 검토

## 발견사항

- **[WARNING] §5.4 래칫의 신규 canary fixture 가 어느 spec `code:` 에도 안 걸린다**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` (이 브랜치가 신설, `swagger-dto-contract.spec.ts` 의 `RATCHET_FIXTURE` 가 참조하는 "일부러 §5.4 를 어기는" 양성 대조군)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "스윕 1차의 자기 반박" 절 및 자매 plan `plan/in-progress/spec-draft-api-convention-verifier-registration.md`(§5.4 시행 코드를 `code:` 에 등재해야 하는 이유를 다룬 바로 그 draft)
  - 상세: `spec/conventions/swagger.md`·`spec/5-system/2-api-convention.md` 의 `code:` 는 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts` 를 등재하지만, `review_guard._glob_to_regex`(`.claude/hooks/_lib/review_guard.py:549`)의 `*` 는 디렉터리 경계(`/`)를 넘지 않는다. 신규 fixture 는 `__tests__/fixtures/dto/responses/` 아래 있고 파일명도 `swagger-dto-contract` 로 시작하지 않아 이 glob 에 안 걸린다(실측: `git ls-tree origin/main` 에 이 경로가 아예 없었다 — 이 브랜치가 새로 만든 파일). `spec/` 어디에도 `repo-guards/__tests__/fixtures/**` 류 등재가 없다(전수 grep). 이 fixture 는 단순 테스트 데이터가 아니라 **가드의 자기검증용 양성 대조군**이고, 바로 이 PR 이 "직전 래칫의 양성 대조군이 vacuous 했다"(`a6f582680`)를 고친 자리다 — 즉 이 파일이 조용히 약화되면 같은 결함이 재발해도 `--impl-done` 게이트가 `swagger.md`/`2-api-convention.md` 재검토를 트리거하지 않는다. `spec-draft-api-convention-verifier-registration.md` 가 `response-contract.ts`/`swagger-probe.ts` 에 대해 정확히 이 논리로 등재를 정당화했는데("시행 코드가 바뀌면 판정 근거가 바뀌므로 함께 등재"), 이 PR 이 그 자매격 아티팩트를 새로 만들면서 같은 처리를 안 했고 어느 plan 에도 후속 항목으로 등재돼 있지 않다.
  - 제안: `swagger.md`(또는 `2-api-convention.md`) frontmatter `code:` 에 `codebase/backend/src/repo-guards/__tests__/fixtures/**` (또는 `optional-nullable.fixture*.ts`)를 추가하거나, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이 등재를 후속 planner 항목으로 명시 등재한다.

- **[INFO] "메모이제이션을 헬퍼 작업 때 같이 검토" 라는 열린 항목의 전제가 같은 문서 안에서 이미 반증됐다**
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:266-278` (체크박스 "스윕 착수 시 `find → toBeDefined → assert` 3문장을 헬퍼로 접기", `[ ]` 미완)
  - 관련 plan: 같은 파일의 새로 추가된 "스윕 1차 (2026-09-05)" 절(약 384~388줄)
  - 상세: 미완 체크박스의 부속 메모(276~278줄, 이번 PR 에서 미수정)는 "`contractForDto` 는 DTO 마다 in-process Nest 앱을 부트스트랩한다 … 헬퍼를 만들 때 DTO 이름 키 메모이제이션을 같이 검토한다"고 적어, 메모이제이션이 아직 **미착수**인 것처럼 읽힌다. 그러나 같은 파일에 이번 PR 이 추가한 "스윕 1차" 절은 "배선은 `contractForDto` 에 메모이제이션을 넣어 한 줄이 됐다"고 적어 **이미 완료**를 보고한다(실측: `response-contract.ts` diff 에 `contractCache`/`buildContractForDto` 도입 확인). 두 서술이 같은 문서 안에서 충돌한다 — 후속 독자가 266번 항목을 보고 메모이제이션을 미해결로 오인할 수 있다.
  - 제안: 266~278줄의 "함께 볼 것" 메모를 "메모이제이션은 이 PR(`response-contract.ts`)에서 이미 완료 — 남은 것은 `find→toBeDefined→assert` 헬퍼 추출뿐" 으로 정정.

## 요약

이번 브랜치(`claude/sweep-response-contract-5ba0ad`)는 §5.4 응답-계약 스윕 1차(4→18개 DTO 배선, 트리거/스케줄 secret 유출 차단, 23필드 선언 정합화, `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫 신설)를 수행했고, 그 진행상황·근거·잔여 항목을 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 정확히 반영했다 — CHANGELOG·코드 diff·플랜 서술 세 축이 상호 일치했고, 자매 브랜치(`spec-draft-notification-secret-storage`, #1290)와의 의존 관계도 이 머지 시점 기준으로 정확히 마감됐다(체크박스 완료 처리 확인). 미해결 결정(User 엔티티 컬럼 수준 방어, Flyway mixed=true 등)은 이번 PR 이 건드리지 않아 충돌이 없다. 다만 이번 PR 이 새로 만든 §5.4 시행-관련 canary fixture 하나가 `code:` glob 커버리지 밖에 있어, 같은 프로젝트가 방금 자매 draft(`spec-draft-api-convention-verifier-registration.md`)에서 명문화한 "시행 코드는 등재해야 재검토가 걸린다"는 원칙을 그 신규 아티팩트에는 아직 적용하지 못했다. 이는 결정 충돌이 아니라 등재 누락(WARNING)이며, 부수적으로 같은 문서 내 진술 하나가 자기모순(INFO) 상태다.

## 위험도

LOW
