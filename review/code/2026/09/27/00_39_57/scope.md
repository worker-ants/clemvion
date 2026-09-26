# 변경 범위(Scope) 리뷰

검토 대상: `workflow-version-creator` 브랜치, 코드 5 · CHANGELOG 1 · plan 2 · 이전 리뷰/consistency-check 산출물 19(전체 30 파일). 이번 세션은 직전 1R 코드 리뷰(`review/code/2026/09/27/00_20_58`, 위험도 LOW)와 그 RESOLUTION 커밋(`69b1afca0`, `ea3130bc0`)까지 포함한 누적 diff를 재확인하는 2R 스코프 점검이다.

## 발견사항

- **[INFO]** DTO §5.4 계약 정정과 `select` 중복 제거 리팩터가 한 커밋(`f35fedaac`)에 번들링됨 — 1R scope 리뷰(`review/code/2026/09/27/00_20_58/scope.md`)가 이미 지적한 항목과 동일.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:103-116`(`VERSION_METADATA_SELECT` 신설), `:158`(`findByWorkflow` 적용), `:174-180`(`findOne` 적용) / `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:36-40, 46-50, 70-74, 84-88`(`creator`·`changeSummary` 선언 정정)
  - 상세: "요청된 변경"(트래커 원 항목)은 `WorkflowVersion*Dto.creator`/`changeSummary` 의 §5.4 금지 조합 정정인데, 같은 커밋에 두 조회(`findByWorkflow`/`findOne`)의 6키 `select` 리터럴을 상수로 뽑는 별개 성격의 내부 리팩터가 함께 들어갔다. 다만 `plan/in-progress/workflow-version-creator.md`(전체 파일 컨텍스트 없음, diff 헤더 문서 자체)가 "트래커의 인접한 두 항목을 한 PR 로 닫는다"고 본문에 사전 고지했고, 두 항목 모두 같은 두 메서드·같은 파일을 대상으로 하며, 대칭 검증 단위 테스트(`workflow-versions.service.spec.ts` 신규 `it('목록과 상세의 select 는 snapshot 하나만 다르다')`)로 뮤턴트(M4)까지 KILLED 확인됐다. 재확인 결과도 blast radius 가 작고 의도가 투명해 범위 위반이라기보다 "고지된 번들링"이라는 1R 판단에 동의한다.
  - 제안: 이번 PR 은 그대로 두되, 향후 계약 정정과 내부 리팩터는 가능하면 별도 커밋으로 분리 권장(1R 과 동일 제안, 변경 없음).

- **[INFO]** planner 인계 항목이 트래커에 새로 추가됨 — 정상 위임 절차
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(diff 헤더 기준 원본 줄 1053 뒤에 8줄 삽입)
  - 상세: `--impl-prep` consistency-check(`review/consistency/2026/09/26/23_55_27` W1·W2)가 발견한 "이 PR 과 무관한 기존 spec 이격"(`5-version-history.md` §7.2 응답 타입명 · `## Rationale` 부재)을 developer 가 직접 고치지 않고 트래커에 planner 항목으로만 등재했다. `spec/` 은 이번 diff 어디에도 포함돼 있지 않다 — `CLAUDE.md` "developer 는 멈추고 project-planner 위임" 규약을 정확히 따른 처리이며 스코프 확장이 아니다.
  - 제안: 없음(정상 처리 확인용 기재).

- **[INFO]** 리뷰/consistency-check 산출물 19개 파일(신규)이 diff 에 포함됨 — harness 정상 라이프사이클
  - 위치: `review/code/2026/09/27/00_20_58/{RESOLUTION.md,SUMMARY.md,_retry_state.json,api_contract.md,documentation.md,maintainability.md,meta.json,requirement.md,scope.md,security.md,side_effect.md,testing.md,user_guide_sync.md}`(13개), `review/consistency/2026/09/26/23_55_27/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md}`(7개, 프롬프트 목록상 6개로 집계됐던 것과 달리 실제로는 7개)
  - 상세: `CLAUDE.md` 정보 저장 위치표상 "코드 리뷰 산출물 → `review/code/**`", "일관성 검토 산출물 → `review/consistency/**`" 이며 `review/` 는 gitignore 대상이 아니다(메모리 교훈과 일치). 이번 diff 가 담고 있는 것은 이 PR 자신의 `--impl-prep`/1R `/ai-review` 실행 결과물이므로 코드 스코프와 무관해 보이지만 실제로는 이 저장소의 정상 워크플로 산출물이다. 무관한 다른 작업의 산출물이 섞여 들어온 흔적은 없다(전부 `workflow-version-creator` 타임스탬프·경로와 대응).
  - 제안: 없음.

- **[INFO]** import 정리는 실질 변경에 직접 종속됨(스코프 외 정리 아님)
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:1`
  - 상세: `ApiPropertyOptional` import 제거는 해당 데코레이터를 더 이상 쓰지 않게 된 직접 결과다. `codebase/backend/test/workflow-crud.e2e-spec.ts` 의 `WorkflowVersionListItemDto` 추가 import(게이트 18-21행)도 새로 추가된 목록 계약 대조 코드(게이트 574-580행)가 실제로 쓴다 — 미사용 임포트 없음.
  - 제안: 없음.

- **[INFO]** W1 조치 커밋(`69b1afca0`)도 1R WARNING(`changeSummary` null 값 wire 검증 갭)에 정확히 대응하는 범위로 국한됨
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:632-646`(테스트 I 의 `changeSummary` 타입 좁힘 + `toBeNull()` 양성 단언 + `assertMatchesContract`), `:574-580`(테스트 H 목록 계약 대조 신설)
  - 상세: RESOLUTION.md(`review/code/2026/09/27/00_20_58/RESOLUTION.md`)가 명시한 조치 항목(W1, INFO 13, INFO 14)과 실제 diff 변경분이 1:1 대응한다. 조치 과정에서 무관한 코드가 추가로 손대진 것은 확인되지 않았다.
  - 제안: 없음.

포맷팅/주석/공백만의 무관한 변경, 요청 외 기능 확장, 관련 없는 파일·설정 변경은 발견되지 않았다. `swagger-dto-contract.spec.ts` 의 래칫 감소(`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 4행 제거, 게이트 없는 삭제 줄 — 원본 파일 426-429행 부근)는 DTO 선언 변경의 직접적 필수 동반 변경이다.

## 요약

누적 diff(1R 코드 리뷰 + W1 조치 + RESOLUTION 커밋 포함)를 재확인한 결과, 핵심 코드 변경은 plan(`plan/in-progress/workflow-version-creator.md`)이 명시한 두 목표 — DTO §5.4 금지 조합 정정과 공유 `select` 리터럴 상수화 — 와 그에 대한 1R WARNING(W1) 조치에 정확히 국한된다. 계약 정정과 내부 리팩터가 한 커밋에 번들링된 점은 1R scope 리뷰가 이미 짚었고 이번 재확인에서도 결론이 바뀌지 않는다(plan 사전 고지 + 대칭 테스트로 방어됨, 비블로킹). 새로 diff 에 편입된 19개 파일은 전부 이 PR 자신의 `--impl-prep`/`/ai-review` 실행이 남긴 harness 정상 산출물이며, 발견된 기존 spec 이격은 developer 가 직접 고치지 않고 규약대로 planner 트래커에 인계했다. 무관한 포맷팅·주석·임포트·설정 변경, 의도 밖 기능 확장은 없다.

## 위험도

LOW
