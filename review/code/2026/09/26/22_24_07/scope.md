# 변경 범위(Scope) 리뷰 — canvas-save-typed (머지 후 최종 대조)

## 검토 대상

`origin/main` (`e20756844`) 대비 `04f603996`(feat) · `8e5cc85e8`/`ce7d36183`(docs: plan) · `2ca8a7767`(test: 1R W1 조치) ·
`ba88b7318`(docs: 1R RESOLUTION), 총 5커밋 26파일. `git diff --stat origin/main...HEAD`로 커밋 전체 diff와 프롬프트에
실린 26개 파일이 정확히 일치함을 직접 확인했다(저장소 파일 뮤테이션 없음, 읽기만 수행).

## 발견사항

- **[INFO]** `codebase/` 변경은 목적에 정확히 수렴한다 — 3파일뿐
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(13줄), `…/workflow-response.dto.spec.ts`(신규 30줄), `codebase/backend/test/workflow-crud.e2e-spec.ts`(67줄)
  - 상세: `git diff --stat`으로 `codebase/` 하위 변경분을 별도 확인했다 — 정확히 이 3파일. `workflow-response.dto.ts`는 import 2줄 추가 + 근거 주석 2줄(76-77행) + 프로퍼티 데코레이터 2곳(80·84행)만 건드렸고, `WorkflowDto`·`ExecuteAcceptedDto`·`ExportWorkflowDto` 등 인접 클래스는 무변경임을 파일을 직접 열어 확인했다(`ExportWorkflowDto`는 여전히 `Record<string, unknown>[]` + `items: { type: 'object' }` 그대로). 요청 범위(트래커 항목 «`CanvasSaveResultDto.nodes`/`.edges` 가 타입 없는 객체 배열») 를 벗어나는 로직 변경, 무관한 리팩토링, 기능 확장은 없다.
  - 제안: 조치 불요.

- **[INFO]** e2e 변경은 신규 케이스 순수 추가 + 기존 케이스에 계약 대조 3줄 추가뿐, 기존 테스트 로직은 불변
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — import 블록(신규 `CanvasSaveResultDto` 추가), C 케이스 뒤 4줄(저장 응답 형태 대조), 파일 말미 신규 `it('I. 버전 복원 …')` 블록
  - 상세: C 케이스의 기존 assertion(`expect(save.status).toBe(200)` 등)은 그대로이고, 그 뒤에 원소 수 고정 + 계약 대조만 추가됐다. I 케이스는 완전히 새로운 `it` 블록으로 기존 케이스를 수정하지 않는다. 라운드 1 리뷰의 WARNING(I가 노드 수를 고정하지 않음)에 대한 조치 커밋(`2ca8a7767`)도 해당 e2e 파일 안에서 `saved.body.data.nodes).toHaveLength(5)` 한 줄만 추가했을 뿐, 다른 범위로 번지지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 트래커 파일에 새 후속 항목을 추가한 것은 스코프 크립이 아니라 스코프 경계를 지키기 위한 문서화
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 항목, `ExportWorkflowDto.nodes`/`.edges`)
  - 상세: `ExportWorkflowDto`가 같은 형태의 문제(타입 없는 배열)를 갖고 있지만 이번 PR은 그것을 **고치지 않고** 별도 트래커 항목으로만 등재했다 — over-reach의 반대 방향(발견했지만 구현 범위를 넓히지 않고 명시적으로 미룸)이다. 실제 `workflow-response.dto.ts`의 `ExportWorkflowDto` 클래스는 무변경으로 확인됨(위 항목).
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/09/26/22_05_52/**`·`review/consistency/2026/09/26/21_38_44/**` 20개 파일은 이번 작업 자신의 필수 프로세스 산출물이며 스코프 이탈이 아니다
  - 위치: `review/code/2026/09/26/22_05_52/{RESOLUTION,SUMMARY,_retry_state,meta,api_contract,documentation,maintainability,requirement,scope,security,side_effect,testing}.{md,json}`, `review/consistency/2026/09/26/21_38_44/{SUMMARY,_retry_state,convention_compliance,cross_spec,meta,naming_collision,plan_coherence,rationale_continuity}.{md,json}`
  - 상세: 프로젝트 컨벤션(CLAUDE.md "정보 저장 위치" 표)이 코드 리뷰 산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, 일관성 검토 산출물은 `review/consistency/…`에 두도록 지정한다. `--impl-prep`(21_38_44)과 `/ai-review` 1R(22_05_52)는 이 작업의 필수 워크플로 단계이고, 그 산출물이 커밋(`ba88b7318`·`8e5cc85e8` 등)으로 저장소에 들어온 것은 관례대로다. 다른 작업의 산출물이 섞여 들어오지 않았다 — 경로(`canvas-save-typed`, `22_05_52`, `21_38_44`)와 내용 전체가 이 PR 자신을 대상으로 한다.
  - 제안: 조치 불요.

- **[INFO]** 사전 존재하던 import 2-문장 분할(`workflow-crud.e2e-spec.ts`)은 이번 diff가 만든 형태가 아니다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — 신규 import 블록(`CanvasSaveResultDto, ExportWorkflowDto`) 바로 다음 줄의 `import { WorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';`
  - 상세: 같은 모듈에서 오는 import가 두 문장으로 나뉘어 있으나, 두 번째 import 문(`WorkflowDto`)은 diff의 문맥(context) 줄로 원래부터 있던 것이고 이번 변경은 첫 번째 import 문에 `CanvasSaveResultDto` 식별자 하나만 추가했다. 새로 만든 비일관은 아니다.
  - 제안: 조치 불요 — 이번 PR 책임 범위 밖.

- **[INFO]** plan 체크리스트의 마지막 세 항목(`/ai-review`·`--impl-done`·트래커 닫기)이 커밋 시점에 미완으로 남아 있다
  - 위치: `plan/in-progress/canvas-save-typed.md` `## 체크리스트` 섹션
  - 상세: "머지했어"라는 사용자 통지 시점에도 plan은 `plan/in-progress/`에 있고 세 체크박스가 `[ ]`다. 이는 이번 review 자체가 그 체크리스트가 요구하는 `/ai-review` 단계 실행 중이므로 정상적인 중간 상태이며, 범위 이탈이 아니다. 다만 병합 마무리 커밋에서 `--impl-done` → 체크리스트 완료 → `plan/complete/` 이동 → 트래커 원 항목(`spec-draft-nullable-notation-followups.md:1307`) `[x]` 처리가 남아 있음을 다음 단계를 위해 기록한다.
  - 제안: 조치 불요(마무리 단계에서 처리).

## 요약

`origin/main` 대비 전체 diff(5커밋 26파일, `git diff --stat`로 직접 대조)는 트래커 항목 «`CanvasSaveResultDto.nodes`/`.edges` 가 타입 없는 객체 배열»을 닫는 단일 목적에 정확히 수렴한다. 실질 코드 변경은 `codebase/` 3파일(DTO 선언 13줄 + 신규 유닛 30줄 + e2e 67줄)뿐이고, 인접 클래스(`WorkflowDto`·`ExportWorkflowDto`)나 다른 엔드포인트는 손대지 않았다 — `ExportWorkflowDto`가 같은 결함을 갖고 있음을 발견하고도 구현을 확장하지 않고 별도 트래커 항목으로만 등재한 점은 오히려 스코프 규율을 지킨 사례다. 나머지 20개 파일(`review/code/22_05_52/**`·`review/consistency/21_38_44/**`)은 이 작업 자신의 `--impl-prep`/`/ai-review` 1R 프로세스 산출물로, 프로젝트 컨벤션이 지정한 저장 위치에 정확히 놓인 필수 아티팩트이지 무관한 파일 혼입이 아니다. 라운드 1 스코프 리뷰(같은 세션 `review/code/2026/09/26/22_05_52/scope.md`)의 판정과 일치하며, 이번 최종 대조에서 새로 드러난 스코프 이탈은 없다. 포맷팅·주석·임포트·설정에 대한 무관한 변경, 요청하지 않은 기능 확장, 관련 없는 리팩토링은 발견되지 않았다.

## 위험도
NONE
