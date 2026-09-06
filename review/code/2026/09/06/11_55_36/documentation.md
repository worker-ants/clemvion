# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** JSDoc 블록이 엉뚱한 함수 앞에 붙어 있고, 정작 그 내용이 설명하는 함수는 무주석이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `findEagerUserRelations` 함수 선언 직전(연속된 두 개의 JSDoc 블록 중 첫 번째) vs `collectUserRelationNames` 함수 선언(그 자리에는 JSDoc 없음)
  - 상세: 파일을 직접 열어 확인한 결과, `findEagerUserRelations` 바로 위에 JSDoc 블록이 **두 개 연속**으로 있다. 첫 번째 블록은 `` `*.entity.ts` 에서 **타입이 `User` 인 관계 속성 이름**을 전부 모은다 ``·`이 함수가 거기서 파생시킨다`·`판정 축은 **속성의 타입 주석**이다` 등 명백히 "엔티티에서 `User` 타입 관계 이름을 수집하는 함수"(즉 `collectUserRelationNames`)를 설명한다. 두 번째 블록(`` `@ManyToOne(() => User, { eager: true })` 처럼... ``)이 실제로 `findEagerUserRelations` 를 설명하는 올바른 문서다. 코드 순서상 함수를 정의할 때 `collectUserRelationNames` 를 나중에(같은 파일 아래쪽, 약 90줄 뒤) 선언했는데, 그 함수 선언 위에는 JSDoc 이 **전혀 없다**. `git diff origin/main...HEAD` 로 이 파일이 이번 PR 에서 신설된 파일임을 확인했으므로, 이 어긋남은 이번 diff 안에서 발생한 것이다(아마 `findEagerUserRelations`/`collectUserRelationNames` 를 여러 리뷰 라운드(`review/code/2026/09/06/10_13_22` → `11_27_53`)에 걸쳐 순차로 추가하면서 문서 블록을 옮기지 못한 것으로 보인다). `collectUserRelationNames` 는 이 PR 의 핵심 설계 결정("관계 이름 목록을 손으로 늘리지 않고 엔티티 타입 주석에서 파생시킨다")을 구현하는 보안 관련 공개 함수라서, 정작 여기에 설명이 없고 무관한 함수 위에 그 설명이 얹혀 있는 것은 다음에 이 파일을 읽는 사람을 오도할 수 있다.
  - 제안: 첫 번째 JSDoc 블록을 `collectUserRelationNames` 선언 바로 위로 옮긴다.

- **[INFO]** 신규 검출 가드 2쌍의 spec `code:` 미등재는 이미 plan 에 후속 항목으로 등재되어 있어 조치 불요
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `- [ ] **신규 검출 2축을 §5.4 「검증 층」과 code: 에 등재**` 항목
  - 상세: 직전 리뷰 라운드(`review/code/2026/09/06/10_13_22/documentation.md`)가 `user-entity-exposure-guard.ts`/`user-secret-absence.ts` 가 어떤 spec `code:` glob 에도 걸리지 않아 향후 무르게 고쳐져도 `--impl-done` 게이트가 안 문다고 지적했다. 이번 diff 를 보면 그 지적이 무시된 것이 아니라, CLAUDE.md 규약대로(`spec/` 쓰기는 developer 권한 밖) `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 명시 등재됐고, `RESOLUTION.md`(WARNING 3)에도 처분 근거가 남아 있다. 새로 지적할 결함이 아니라, 이전 지적이 올바른 경로로 처리됐음을 확인차 기록한다.
  - 제안: 조치 불요 — 후속 planner 턴에서 진행.

## 요약

이번 diff(`User` 엔티티 컬럼 노출 방어 2축 신설 + `WorkflowVersionsService.findOne` 실유출 수정)의 문서화 품질은 전반적으로 높다. CHANGELOG 신규 절, plan 완료 노트, `CREATOR_PROJECTION`/`ProjectedCreator`/`USER_SECRET_KEYS`/각 fixture 위반 케이스의 JSDoc 이 "왜 이 방법을 택했는가"·"왜 다른 대안을 기각했는가"를 실측치와 함께 촘촘히 남기고 있고, 직접 검증한 수치(`select: false`/`@Exclude`/`@Expose` 0건, `workspace_member.joinedAt` 을 채우는 4자리 전부 `new Date()`, `CREATOR_PROJECTION` ↔ `WorkflowVersionCreatorDto` OpenAPI 스키마 일치 테스트 존재)가 서술과 정확히 일치했다. 이전 리뷰 라운드가 지적한 e2e 레터 중복(`F.`)도 이미 `J.` 로 수정되어 현재는 재발하지 않는다. 유일하게 발견한 실결함은 `user-entity-exposure-guard.ts` 에서 JSDoc 블록 하나가 잘못된 함수(`findEagerUserRelations`) 앞에 남아 있고, 정작 그 내용이 설명하는 `collectUserRelationNames` 는 무주석이라는 점이다 — 기능에는 영향이 없지만 이 함수가 담당하는 보안 설계 근거(이름 열거 대신 엔티티 타입에서 파생)를 다음 독자가 엉뚱한 자리에서 찾게 만든다.

## 위험도
LOW
