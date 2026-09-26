# 변경 범위(Scope) 리뷰 — canvas-save-typed

## 검토 대상

`04f603996`(feat) + `ce7d36183`(docs: plan 갱신) + `8e5cc85e8`(docs: plan 생성), origin/main `e20756844` 대비.
`git show --stat` 로 커밋 전체 변경 파일을 대조해 프롬프트에 실린 14개 파일이 diff 전수임을 확인했다.

## 발견사항

- **[INFO]** 사전 존재하던 import 3분할 패턴이 이번 변경으로 한 줄 더 늘었다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:13`(게이트 기준, 신규 `import { CanvasSaveResultDto, ExportWorkflowDto, } from ...` 블록) — 바로 다음 줄(`import { WorkflowDto } from ...`)이 같은 모듈을 또 import 한다.
  - 상세: 같은 모듈(`workflow-response.dto.ts`)에서 오는 import 가 두 문장으로 나뉘어 있다. 다만 이 분리는 이번 diff 가 만든 것이 아니라 기존에 이미 그렇게 돼 있었다(`WorkflowDto` 줄은 diff 의 문맥 줄 그대로, 수정되지 않았다) — 이번 변경은 첫 번째 import 문에 `CanvasSaveResultDto` 하나만 추가했을 뿐이다.
  - 제안: 이번 PR 의 책임 범위 밖이므로 조치 불요. 언급하는 이유는 "임포트 변경" 점검 관점에서 눈에 띄는 형태이나 이번 diff 가 유발한 문제가 아님을 명시하기 위함.

- **[INFO]** 트래커 문서(`plan/in-progress/spec-draft-nullable-notation-followups.md`)의 원 항목이 아직 미체크
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1307` (`- [ ] **\`CanvasSaveResultDto.nodes\`/\`.edges\` 가 타입 없는 객체 배열**`)
  - 상세: `canvas-save-typed.md` 의 "방향-5" 는 "이 항목을 닫고" 라고 적었지만, 이번 diff 는 트래커에 새 후속 항목(`ExportWorkflowDto.nodes/.edges`)만 추가했고 원 항목 체크박스는 그대로 미체크다. 다만 `canvas-save-typed.md` 자체의 체크리스트에도 `- [ ] 트래커 항목 닫기` 가 마지막 미완료 항목으로 명시돼 있어, 이는 "아직 하지 않은 일을 한 것처럼 감춘" 불일치가 아니라 `--impl-done` 이후로 의도적으로 미룬 단계다.
  - 제안: 조치 불요 — 스코프 이탈이 아니라 plan 이 스스로 남겨둔 잔여 단계. `--impl-done` 전에 트래커 원 항목 체크박스도 함께 닫히는지만 후속 확인.

## 요약

이번 변경은 `CanvasSaveResultDto.nodes`/`.edges` 를 `NodeDto[]`/`EdgeDto[]` 로 광고하는 단일 목적에 정확히 수렴한다. DTO 파일은 import 2줄 + 프로퍼티 데코레이터 2곳 + 근거 주석 2줄만 건드렸고(`ExportWorkflowDto` 는 같은 결함을 가졌음에도 의도적으로 범위 밖으로 남겨 별도 트래커 항목으로 등재했다 — over-reach 의 반대), e2e 는 기존 C 케이스에 계약 대조 3줄을 더하고 새 I 케이스 하나를 순수 추가했을 뿐 기존 테스트를 건드리지 않았다. CHANGELOG 항목은 컨벤션이 요구하는 위치(맨 위)에 정확히 삽입됐고 다른 항목은 손대지 않았다. `plan/in-progress/` 두 파일과 `review/consistency/**` 8개 파일은 이 작업 자신의 `--impl-prep` 단계 산출물로, 프로젝트 컨벤션이 요구하는 필수 과정 아티팩트이지 스코프 크립이 아니다. 포맷팅·주석·임포트·설정 파일에 대한 무관한 변경, 요청 이상의 기능 확장, 관련 없는 리팩토링은 발견되지 않았다.

## 위험도
NONE
