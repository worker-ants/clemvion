# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 검토 범위 요약

target 은 `spec/2-navigation/1-workflow-list.md` 에 대한 **소정정(patch)** 두 건만 제안한다:

1. frontmatter `pending_plans:` 에 `plan/in-progress/cross-workspace-refs.md` 항목 추가
2. `## Rationale` §3 정정 단락의 마지막 문장을 완료형 → 현재형으로, 인용 경로를
   `plan/complete/cross-workspace-refs.md` → `plan/in-progress/cross-workspace-refs.md` 로 교체

새 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·이벤트/메시지명·ENV/설정키를 **전혀 신설하지 않는다** — 기존
문서·경로를 가리키는 인용만 고친다. 아래는 6개 관점 각각에 대해 실측한 결과다.

## 발견사항

없음. 관점별 실측 근거는 다음과 같다.

- **요구사항 ID 충돌** — target 텍스트에 새 ID 부여 없음(`NAV-WF-*`·`EH-DETAIL-*` 류 패턴 미등장). 해당 없음.
- **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 명 없음. 인용된 "데이터 모델 §1.1" 은 이미 `spec/1-data-model.md:57`
  `### 1.1 참조의 소속` 로 존재하는 기존 섹션이며 앵커(`#11-참조의-소속`)도 일치한다. target 이 새로 만드는 개념이 아니다.
- **API endpoint 충돌** — 새 endpoint 없음. 기존 `POST /api/workflows`·`POST/PATCH /api/folders` 문구는 그대로 두고 건드리지 않는다.
- **이벤트/메시지명 충돌** — 해당 서술 없음.
- **환경변수·설정키 충돌** — 해당 서술 없음.
- **파일 경로 충돌** — 두 경로를 실측 확인했다(`find plan -iname '*cross-workspace-refs*'`):
  - `plan/in-progress/cross-workspace-refs.md` (구현 plan, 실존, `status: in-progress`)
  - `plan/complete/spec-draft-cross-workspace-refs.md` (별도 파일 — 앞선 planner 턴의 spec draft, 이미 이동됨)
  - `plan/complete/cross-workspace-refs.md` 는 **존재하지 않는다** — 이는 현재 `1-workflow-list.md:200` 이 잘못 인용 중인
    깨진 경로이고, target 이 정정하려는 바로 그 대상이다. 따라서 이 변경은 충돌을 만드는 게 아니라 이미 있던(구현보다 먼저 착지한)
    깨진 참조 하나를 없앤다.
  - `pending_plans:` 필드에 plan 경로를 추가하는 패턴은 `spec/conventions/spec-impl-evidence.md` §2.1·R-5, 그리고
    같은 문서가 이미 쓰고 있는 `plan/in-progress/marketplace-and-plugin-sdk.md` 항목과 형식이 동일하다 — 새 컨벤션을
    만들지 않는다.

## 요약

target 은 새 식별자를 도입하지 않는 순수 소정정이다 — frontmatter `pending_plans` 항목 추가와 Rationale 문장의 시제·인용 경로
교정뿐이며, 인용 대상(`spec/1-data-model.md` §1.1, `plan/in-progress/cross-workspace-refs.md`)은 모두 이미 실존하는
문서/섹션이다. 오히려 현재 `1-workflow-list.md` 가 인용하는 `plan/complete/cross-workspace-refs.md` 는 실존하지 않는 깨진
경로이며, target 은 이를 실존 경로로 바로잡는다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
