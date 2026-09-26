# 변경 범위(Scope) 리뷰

검토 대상: `dbeba518a`(docs plan) · `b39ddd802`(feat api) · `1fe801ff7`(docs plan) — 총 14개 파일, `git diff HEAD~3 HEAD --stat` 로 실측 대조하여 프롬프트에 실린 목록과 **정확히 일치**함을 확인(추가/누락 파일 없음).

## 발견사항

- **[INFO]** planner 소유 트래커 파일에 developer 가 항목을 추가/보강함
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (frontmatter `owner: planner`)
  - 상세: 이번 diff 가 이 파일에 두 군데를 건드린다 — (1) 새 항목 "프런트엔드 export 타입이 `null` 을 적지 않는다" 추가, (2) 기존 §9.4 항목에 "같은 §9.4 의 실패 응답 형식도 틀렸다" 보강 문단 추가. 둘 다 `--impl-prep` consistency-check(`review/consistency/2026/09/26/22_52_28`)가 표면화한 INFO/WARNING 을 등재만 하는 것이고 실제 spec 수정은 하지 않았으며, `plan/in-progress/export-workflow-typed.md` 자체가 이 등재를 "canvas-save-typed 선례와 동일 패턴" 이라고 명시적으로 근거를 남겼다. CLAUDE.md 표는 developer 의 쓰기 범위에 `plan/**` 을 포함하므로 권한 위반은 아니고, spec 문서(`spec/**`)를 직접 고치지도 않았다 — planner 경계를 넘지 않았다. 다만 소유자가 다른 파일에 내용을 추가하는 것이므로 리뷰 스코프 관점에서 한 번 짚어 둔다.
  - 제안: 조치 불요 — 이미 plan 문서 안에 근거(선례·검토 세션 ID)가 남아 있어 추적 가능하다.

- **[INFO]** `review/consistency/2026/09/26/22_52_28/**` 8개 파일 신규 추가는 이번 diff 의 대부분(14개 중 8개)을 차지하지만 전부 `--impl-prep` 의무 게이트의 표준 산출물
  - 위치: `review/consistency/2026/09/26/22_52_28/*.md`, `meta.json`, `_retry_state.json`
  - 상세: developer 워크플로 §REVIEW WORKFLOW 가 구현 착수 전 `consistency-check --impl-prep` 실행을 강제하고, 그 산출물은 `review/**`(developer 쓰기 범위)에 남는다. 내용도 이번 plan(`ExportedNodeDto`/`ExportedEdgeDto` 신설) 과 직접 관련된 검토 결과이며 무관한 파일을 건드리지 않는다.
  - 제안: 조치 불요 — 스코프 위반 아님, 정상 절차 산출물.

## 파일별 스코프 적합성

| 파일 | 판정 | 근거 |
|---|---|---|
| `CHANGELOG.md` | 적합 | 새 `Unreleased` 항목 1개만 삽입, 기존 항목 미변경 |
| `workflow-response.dto.ts` | 적합 | `ExportedNodeDto`/`ExportedEdgeDto` 신설 + `ExportWorkflowDto.nodes/edges` 타입 교체. 추가된 `EdgeType`/`NodeCategory` import 는 신설 DTO 안에서 실사용됨(미사용 import 없음). 기존 `WorkflowDto`/`CanvasSaveResultDto` 등 다른 클래스는 건드리지 않음 |
| `workflow-response.dto.spec.ts` | 적합 | `it.each` 배열 파라미터화 리팩터는 새 DTO 케이스 2건을 기존 2건과 같은 표에 넣기 위한 **필수 확장**이지 무관한 정리가 아님. `describe` 제목 변경도 범위 확장(Canvas 전용 → 워크플로우 응답 DTO 전반)을 반영한 것으로 실질 변경과 결합됨 |
| `workflow-crud.e2e-spec.ts` | 적합 | 기존 C 케이스 중간에 `assertMatchesContract` 단언 1블록만 삽입. 다른 케이스(A/B/D~I)나 fixture 는 무변경 |
| `plan/in-progress/export-workflow-typed.md` | 적합 | 신규 plan 문서, 이번 작업 전용 |
| `plan/in-progress/spec-draft-nullable-notation-followups.md` | 적합(INFO 참고) | 위 발견사항 참고 |
| `review/consistency/2026/09/26/22_52_28/**` (8개) | 적합(INFO 참고) | 위 발견사항 참고 |

## 요약

14개 변경 파일이 "워크플로우 export 응답의 `nodes`/`edges` 를 응답 전용 DTO 로 타입화한다" 는 단일 목적에 빈틈없이 수렴한다. DTO 신설과 기존 필드 타입 교체, 그에 필요한 최소 임포트 추가, 계약을 고정하는 단위 테스트 확장(리팩터는 새 케이스 수용을 위한 필연적 변경), e2e 원소 대조 1블록 추가, CHANGELOG 1항목, plan 문서(신규 + 필수 게이트인 impl-prep 산출물 + 그 산출물이 표면화한 항목의 트래커 등재)로 구성되며, 무관한 파일 수정·기능 확장·불필요한 리팩터링·포맷팅 소음·미사용 임포트·설정 변경은 발견되지 않았다. `git diff --stat` 실측으로 프롬프트에 실린 파일 목록과 실제 diff 가 정확히 일치함을 확인했다.

## 위험도
NONE
