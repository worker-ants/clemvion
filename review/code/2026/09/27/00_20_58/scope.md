# 변경 범위(Scope) 리뷰

검토 대상: `workflow-version-creator` 브랜치, `origin/main` 대비 17개 파일(코드 5 · 테스트/e2e 3 · CHANGELOG 1 · plan 2 · consistency-check 산출물 6).

## 발견사항

- **[INFO]** DTO §5.4 계약 정정과 `select` 중복 제거 리팩터가 한 커밋(`f35fedaac`)에 함께 들어감
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:103-116`(`VERSION_METADATA_SELECT` 신설), `:158`(`findByWorkflow` 적용), `:176-180`(`findOne` 적용) / `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:36-40, 46-50, 70-74, 84-88`(`creator`·`changeSummary` 선언 정정)
  - 상세: "요청된 변경"은 `WorkflowVersion*Dto.creator`/`changeSummary` 의 §5.4 금지 조합(optional+nullable) 정정인데, 같은 커밋에 `findByWorkflow`/`findOne` 의 중복된 6키 `select` 리터럴을 `VERSION_METADATA_SELECT` 상수로 뽑는 별개 성격의 내부 리팩터가 섞여 있다. 다만 이는 우발적 확장이 아니라 `plan/in-progress/workflow-version-creator.md` 본문("트래커의 인접한 두 항목을 한 PR 로 닫는다")에 사전 고지되어 있고, 두 항목 모두 같은 두 조회 메서드·같은 파일을 대상으로 하며, 대칭 검증 단위 테스트(`workflow-versions.service.spec.ts:169-190`)로 별도 뮤턴트(M4)까지 확인됐다. blast radius 가 작고 의도가 투명하므로 범위 위반이라기보다 "고지된 번들링"에 가깝다.
  - 제안: 이번 PR 은 그대로 두되, 앞으로 계약 정정과 내부 리팩터를 섞을 때는 가능하면 별도 커밋(같은 PR 내)으로 분리해 diff 리뷰 단위를 좁히는 것을 권장.

- **[INFO]** planner 인계 항목이 developer 산출물(plan)에 새로 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1056-1062`
  - 상세: `--impl-prep` consistency check(WARNING 1·2, `review/consistency/2026/09/26/23_55_27`)가 발견한 "이 PR 과 무관한 기존 spec 이격"(§7.2 엔티티-동명 표기, `## Rationale` 부재)을 developer 가 직접 고치지 않고 트래커에 planner 항목으로 등재만 했다. `spec/` 은 손대지 않았고 `CLAUDE.md` 규약("developer 는 멈추고 project-planner 위임")을 정확히 따른 처리이므로 이 자체는 문제가 아니라 오히려 올바른 스코프 경계 준수의 증거다.
  - 제안: 없음 (정상 처리 확인용 기재).

- **[INFO]** `review/consistency/2026/09/26/23_55_27/**` 6개 파일과 `plan/in-progress/workflow-version-creator.md` 는 코드 변경이 아니라 harness 가 생성한 프로세스 산출물
  - 위치: `review/consistency/2026/09/26/23_55_27/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,naming_collision.md,plan_coherence.md,rationale_continuity.md}`, `plan/in-progress/workflow-version-creator.md`
  - 상세: `CLAUDE.md` 규약상 `--impl-prep` 실행 산출물과 작업 plan 은 커밋에 포함되는 것이 표준 라이프사이클(`review/` 는 gitignore 대상 아님)이다. 코드 스코프와 무관해 보이지만 실제로는 이 저장소의 정상 워크플로 요구사항이다.
  - 제안: 없음.

- **[INFO]** import 정리는 실질 변경에 직접 종속됨
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:1`
  - 상세: `ApiPropertyOptional` import 제거는 해당 데코레이터를 더 이상 쓰지 않게 된 직접 결과이며 별도의 "정리성" 임포트 변경이 아니다.
  - 제안: 없음.

포맷팅/주석/공백만의 무관한 변경, 요청 외 기능 확장, 관련 없는 파일·설정 변경은 발견되지 않았다. `swagger-dto-contract.spec.ts` 의 래칫 감소(`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 4행 제거)와 `workflow-crud.e2e-spec.ts` 의 e2e 계약 대조 추가는 모두 DTO 선언 변경의 직접적 필수 동반 변경이다. `codebase/backend/test/workflow-crud.e2e-spec.ts` 의 `expectNoUserSecrets` 는 기존 import 를 재사용한 것으로 신규 import 추가가 아니다.

## 요약

변경은 plan(`plan/in-progress/workflow-version-creator.md`)에 명시된 목표 — 워크플로 버전 응답 DTO 의 §5.4 금지 조합(optional+nullable) 정정과 두 조회가 공유하는 `select` 리터럴의 상수화 — 에 정확히 대응한다. 두 성격이 다른 변경(계약 정정 + 내부 리팩터)이 한 커밋에 번들링된 점이 있으나 plan 문서에 사전 고지되고 같은 대상 코드에 국한되어 있어 은닉된 스코프 확장으로 보기 어렵다. 발견된 기존 spec 이격은 developer 가 직접 고치지 않고 규약대로 planner 트래커에 인계했으며, 나머지 신규 파일은 모두 이 저장소의 정상 프로세스 산출물(plan, consistency-check 리포트)이다. 무관한 포맷팅·주석·임포트·설정 변경은 없다.

## 위험도

LOW
