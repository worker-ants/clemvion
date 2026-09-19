# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `plan/complete/entity-schema-declaration-drift.md` 를 가리키는 두 참조가 현재 시점엔 존재하지 않는 경로다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:14` (JSDoc `* 근거·실측: \`plan/complete/entity-schema-declaration-drift.md\`.`), `plan/in-progress/spec-draft-nullable-notation-followups.md:4668` (`... plan/complete/entity-schema-declaration-drift.md).`)
  - 상세: 실측 — `plan/complete/entity-schema-declaration-drift.md` 는 `ls` 결과 없음(No such file or directory). 실제 plan 은 `plan/in-progress/entity-schema-declaration-drift.md` 에 `status: in-progress` 로 존재하고, 그 plan 체크리스트의 **마지막 미체크 항목**이 정확히 "트래커 반영 · 이 plan `complete/` 이동" 이다 — 즉 아직 이동 전 상태에서 이동 후 경로를 앞서 적어 둔 것이다. `git show ffd58da4e:...`로 확인하면 이 JSDoc 문구는 plan 이 여전히 `in-progress/` 에 있던 그 커밋에서 이미 이렇게 커밋됐다. 다만 이 저장소는 이 패턴(코드/트래커 주석이 완료 후 최종 경로 `plan/complete/<name>.md` 를 미리 적어 두고, PR 마무리 단계에서 plan 을 실제로 옮기는 것)을 광범위하게 써 왔다 — `deletion-cascade-indexes.e2e-spec.ts`·`trigger-endpoint-path-dedupe.e2e-spec.ts`·`nullable-type-lie-cast.spec.ts` 등 최소 8곳이 같은 관례고, 그 plan 들은 실제로 지금 `plan/complete/` 에 존재함(확인 완료). 즉 이 PR 도 마무리 커밋에서 plan 을 이동하면 두 참조 모두 유효해진다 — **아직 그 이동이 실행되지 않은, 이 세션의 미완료 체크리스트 항목**일 뿐 새로운 결함은 아니다.
  - 제안: 체크리스트 마지막 항목("트래커 반영 + `complete/` 이동")을 반드시 이 PR 의 마무리 커밋(`--impl-done` 이후, push 전)에서 실행할 것 — 지금 이 시점에 리뷰가 걸리면 두 참조가 깨진 링크로 남는다는 점만 재확인.

- **[INFO]** "선언은 실재하는 것만, 실재하면 그대로" 규칙이 `spec/conventions/` 가 아니라 in-progress plan 에만 적혀 있다
  - 위치: `plan/in-progress/entity-schema-declaration-drift.md` "## 규칙" 절
  - 상세: 이 규칙은 이번이 처음이 아니라 이미 두 개의 실재 선례(`node`/`workspace` 의 `@Unique` 제거, `llm_config_workspace_default_unique`)를 일반화한 것이고, 이번 PR 로 세 번째 사람이 손으로 여덟 곳을 고쳤다(plan 본문 자체가 "산문 규율로는 못 막는다" 고 적음). 규칙 자체는 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)가 기계적으로 강제하므로 재발 방지는 이미 되어 있다. 다만 "왜 이런 선언 규율이 필요한가"의 서술은 plan 이 `complete/` 로 이동하면 discover 하기 어려워진다(같은 클래스의 다음 사람이 `spec/conventions/`를 먼저 찾을 가능성이 높다).
  - 제안: 이 PR 스코프 밖(developer 가 `spec/conventions/` 를 쓸 권한이 없음)이라 강제하지 않는다. 다음 planner 턴에서 `spec/conventions/`에 짧은 절로 승격할지 검토 후보로만 남겨 둔다.

- **[INFO]** CHANGELOG.md 미갱신 — 최근 선례와 일치해 문제 아님
  - 위치: `CHANGELOG.md` (루트)
  - 상세: 이 저장소의 `CHANGELOG.md`는 사용자 가시 동작 변경뿐 아니라 문서/가이드 정정("가이드가 «코드» 로 부르던 두 이름이 코드가 아니었다")까지도 등재하는 활성 관례다. 그러나 이번 PR 과 같은 클래스인 최근 커밋 `1cc089343`(FK 인덱스 31개 처분, V121~V130)·`6f97cb619`(그래프 RAG FK 인덱스 4개, V117~V120) — 둘 다 `synchronize: false` 하의 순수 선언/성능 정정 — 은 CHANGELOG 에 항목이 없다(grep 0건). 이번 PR 도 `spec_impact: none`·"동작은 바뀌지 않는다"(plan 본문 명시)인 같은 클래스라 CHANGELOG 미갱신이 선례에서 벗어나지 않는다.
  - 제안: 조치 불요.

## 확인된 양호 사항 (참고)

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 상단 JSDoc 이 가드의 목적·방향성(선언→DB 단방향만 검증)·한계(컬럼 정의·인덱스 방향 `DESC` 는 밖)·정규화 비교 방식을 정확하고 상세하게 서술한다. 헬퍼 함수(`inRolledBackTx`·`attempt`·`normalizedPredicate`·`normalizedCheck`·`sameColumns`)에도 각각 목적과 함정("`pg` 가 `name[]` 을 배열로 안 푼다" 등)을 적은 인라인 주석이 있어 인라인 주석 항목은 충족한다.
- 정정된 여섯 엔티티 파일의 주석이 전부 실제 마이그레이션(V001·V009·V019·V095·V109) 및 코드(`claimThreshold`·`entity.entity.ts` 의 `DESC` 관례 등)와 대조했을 때 정확했다 — 오래된 주석(stale comment)은 발견되지 않았다.
- `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 키 표 diff(같은 브랜치의 선행 planner 커밋 `ff530fc8a`)를 실제 `dict/{ko,en}/assistant.ts` 값과 전수 대조한 결과 완전히 일치했다(신규 키 `assistant.autoResumedHintShort` 포함) — 표-사전 drift 가 실제로 해소됐다.
- 새 API 엔드포인트·환경변수·설정 옵션 추가가 이번 diff 에 없어 API 문서·설정 문서 항목은 해당 없음. README 갱신이 필요한 신규 기능도 없음.

## 요약
이번 변경(엔티티 인덱스·제약·CHECK·FK 선언 8곳 정정 + 회귀 e2e 가드 신설, `synchronize: false`라 동작 불변)은 문서화 관점에서 전반적으로 우수하다 — e2e 가드의 JSDoc·인라인 주석이 목적과 한계를 정확히 서술하고, 정정된 엔티티 주석들이 전부 실측(마이그레이션·코드)과 일치하며, 같은 브랜치의 spec §13 i18n 표 drift 도 사전 값과 정확히 재동기화됐다. 유일한 지적은 e2e 스펙과 트래커가 아직 `plan/in-progress/`에 있는 계획 파일을 `plan/complete/...md`로 앞서 인용하는 점인데, 이는 이 저장소가 8곳 이상에서 써 온 확립된 관례(완료 시 plan 이동)이고 해당 plan 자신의 체크리스트 마지막 항목이 그 이동을 이미 명시적으로 예정하고 있어 — PR 마무리(이동 실행) 전까지만 유효한 임시 상태다. CHANGELOG 미갱신도 같은 클래스의 최근 두 선례(V117~V130 FK 인덱스 정정)와 일치해 결함이 아니다.

## 위험도
LOW
