# 변경 범위(Scope) 리뷰 — column-guard-gaps

## 발견사항

- **[WARNING]** `--impl-prep` 게이트 세션이 이 작업과 무관한 스코프(`spec/2-navigation/`)를 대상으로 실행됐고, 5개 checker 중 4개가 그 무관함을 자체적으로 지적했는데도 checklist 는 "선례"라는 한 단어로 정당화하고 넘어갔다
  - 위치: `review/consistency/2026/09/20/00_34_58/meta.json:3-4` (`"mode": "...scope=spec/2-navigation/"`, `"target_path": "spec/2-navigation/"`), `plan/in-progress/column-guard-gaps.md` 체크리스트 (`- [x] --impl-prep — ...(scope spec/2-navigation/ + 보정 블록 — 선례) BLOCK: NO` 줄)
  - 상세: 이 plan(`spec_impact: none`, 대상 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`)은 `spec/2-navigation/`와 코드·spec 어느 축으로도 접점이 없다. 이 사실은 위장되지 않았다 — `plan_coherence.md`(INFO #1) · `convention_compliance.md`(검토 범위 메모) · `naming_collision.md`(검토 범위 사전 확인) 세 checker가 스스로 "이번 호출의 target이 실제 작업과 무관하다"고 명시했다. 오직 `rationale_continuity`의 프롬프트에만 "(main 추가)" 리다이렉트 블록이 붙어 실제 관련 spec(`spec/1-data-model.md`)을 검토했고, 나머지 4개 checker는 원 스코프(`spec/2-navigation/`)만 보고 이 작업과 무관한 WARNING 2건(`GET /api/folders`·`GET /api/triggers/:id/history` 응답 포맷 미문서화)을 만들어냈다. 이 WARNING 2건은 `column-guard-gaps` 코드와 아무 관계가 없는데도 이번 커밋(`6949b5a93`)으로 저장소에 영구 기록됐다.
  - 제안: 다음에 같은 "선례"를 쓸 때는 5개 checker 프롬프트 전부에 리다이렉트 블록을 일관되게 붙이거나(현재는 1/5만 받음), 애초에 `--impl-prep`이 다중 spec 폴더가 아닌 단일 관련 spec 파일(`spec/1-data-model.md`)을 target으로 받을 수 있도록 호출 방식을 바꿔 이런 "무관한 스코프 실행 후 사후 disclaim" 패턴 자체를 없애는 편이 낫다.

- **[INFO]** 위 무관 스코프 실행으로 나온 두 WARNING(`GET /api/folders`, `GET /api/triggers/:id/history` 응답 포맷 spec 미기재)이 plan 체크리스트에서 "이 변경과 무관한 기존 spec 공백 — planner 항목으로 트래커 등재"로만 언급되고, 실제로 트래커(`spec-draft-nullable-notation-followups.md`)에 등재됐는지는 이번 diff 범위에서 확인되지 않는다.
  - 위치: `plan/in-progress/column-guard-gaps.md` 체크리스트 (`--impl-prep` 항목의 두 번째 문장)
  - 상세: "등재" 라는 약속이 이번 커밋 diff 안에서 실행됐는지(트래커 파일 수정 포함 여부) 확인할 근거가 없다. 트래커 파일 자체는 이번 리뷰 대상 파일 목록에 없다.
  - 제안: 트래커 등재가 완료됐는지 별도로 확인 — 안 됐다면 후속 작업 유실 위험.

- 실제 코드 변경(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`)은 스코프 이탈이 없다. `plan/in-progress/column-guard-gaps.md`가 스스로 정의한 "할 것" 목록(①읽기 전용 세션 헬퍼 추출 + 회귀 테스트, ②`default` RETURNING 왕복 테스트, ③가독성 — `log`→`sqlMemory` 개명, 표본별 주석, "마지막 테스트" 문구 정정)과 diff 내용이 정확히 1:1로 대응한다. 새 import(`ModelConfig`, `WorkflowAssistantSession`)도 새 테스트가 실제로 쓰는 것뿐이고, drive-by 포매팅·무관 리팩토링·기능 확장은 발견되지 않았다.

## 요약

핵심 코드 변경(entity-schema-declarations.e2e-spec.ts, 커밋 `d8fb708d5`)은 plan이 스스로 선언한 범위를 벗어나지 않아 깨끗하다. 다만 같은 changeset의 두 번째 커밋(`6949b5a93`)이 함께 실어온 `--impl-prep` consistency-check 세션 산출물은 이 작업과 무관한 스코프(`spec/2-navigation/`)로 실행된 것이 자체 checker 출력 4곳에서 확인되며, 그 결과로 나온 무관 WARNING 2건이 이번 changeset에 그대로 편입됐다. 절차 게이트를 통과시키기 위한 "선례" 우회가 5개 하위 checker 중 1개에만 일관되게 적용돼, 검증 노력 낭비와 무관 콘텐츠 혼입이라는 부작용을 남겼다. 코드 자체의 범위 일탈은 없으나, 함께 커밋된 리뷰 산출물의 스코프 불일치는 다음 사람이 이 세션을 "column-guard-gaps 작업의 진짜 impl-prep 근거"로 오독할 여지를 남긴다.

## 위험도

LOW
