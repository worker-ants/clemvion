# 정식 규약 준수 검토 — `spec/5-system` (impl-prep)

검토 범위: prompt 번들에 전문이 포함된 `spec/5-system/1-auth.md` · `2-api-convention.md` ·
`3-error-handling.md` 3편을 `spec/conventions/**`(특히 `error-codes.md` · `swagger.md` ·
`audit-actions.md` · `node-output.md`) 대비 전수 대조했다. 나머지 14개 파일
(`4-execution-engine.md` 등)과 `_product-overview.md` 는 컨텍스트 예산 초과로 프롬프트에
본문이 없어 **이 리포트는 그 파일들에 대해서는 판정하지 않는다** — 공란을 "위반 없음" 으로
읽지 말 것.

## 발견사항

- **[WARNING]** `CANNOT_REMOVE_OWNER` 에러 코드가 에러 카탈로그(§1)에 미등재
  - target 위치: `spec/5-system/1-auth.md` §3.2 각주(`> **† Admin 멤버 삭제의 대상 제약**...`,
    366~391행 부근) 및 Rationale `§3.2 "멤버 관리" 행의 Admin 열 정정`(547~565행)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3` "도메인 세부 사유를 어디에 싣는가" —
    "어느 쪽을 택하든 **[에러 처리 §1 카탈로그]에 등재**한다. 등재되지 않은 코드는 소비자가
    존재를 알 방법이 없다." (`3-error-handling.md` 자신도 §1.9 서두에서 동일 원칙을 반복한다.)
  - 상세: `WorkspacesService.removeMember()` 가 대상이 owner 일 때 던지는
    `403 { code: 'CANNOT_REMOVE_OWNER' }` (`codebase/backend/src/modules/workspaces/
    workspaces.service.ts:809-814`)는 `1-auth.md` 본문(§3.2 각주·Rationale)에는 등장하지만,
    중앙 카탈로그인 `3-error-handling.md` §1(§1.2 인증/인가 에러, 혹은 §1.9 와 나란한 신규 절)
    어디에도 실려 있지 않다. 정확히 반대 방향 동작인 `CANNOT_ASSIGN_OWNER`(직접 추가 시
    owner 부여 금지, `workspaces.service.ts:260`)는 §1.9 에 status·설명·도메인 SoT 까지 갖춰
    정식 등재돼 있어, 같은 서비스·같은 리소스의 자매 코드 한쪽만 카탈로그 누락 상태다.
    `error-codes.md` 의 적용 범위("인라인 문자열 리터럴로 발행되는 코드도 포함")에도 해당하는
    코드이므로 명명 규율의 대상이면서 동시에 카탈로그 등재 의무의 대상이다.
  - 제안: 이번 PR(`member-owner-toctou`, `spec_impact: none`)은 동작을 바꾸지 않고 기존
    코드 값을 그대로 쓰므로 이 갭 자체는 이 PR 이 만든 것이 아니다 — 이 PR 범위에서 새로
    spec 을 쓰는 것은 불필요(spec_impact: none 과 상충). 다만 `removeMember()` 를 직접 만지는
    작업이 착수되는 시점이므로, 후속(또는 별도 planner 턴)으로 `3-error-handling.md` 에
    `CANNOT_REMOVE_OWNER`(403, 도메인 SoT `1-auth.md §3.2`) 한 행을 §1.2 또는 §1.9 인접에
    추가하는 것을 권한다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    가 같은 코드 주변의 다른 결함(권한 검사 순서 오라클, TOCTOU)을 추적 중이므로 그 트래커에
    "카탈로그 미등재" 항목으로 병기하는 것도 방법이다.

- **[WARNING]** RBAC 권한 매트릭스 표가 각주 삽입으로 GFM 테이블이 두 조각으로 쪼개져
  렌더링이 깨진다
  - target 위치: `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" (366~391행)
  - 위반 규약: 명시적 `spec/conventions/*` 항목은 없으나, CLAUDE.md 의 "문서 구조 규약"
    취지(spec 문서가 신뢰 가능한 단일 진실로 읽혀야 한다)와 충돌하는 렌더링 결함이라 여기
    적는다 — 규약 신설/갱신이 필요하면 그 점을 별도로 판단해 달라.
  - 상세: 표는 366~375행(헤더 + 8행)까지 정상 이어지다 376행 빈 줄 뒤 377~381행에
    `> **† Admin 멤버 삭제의 대상 제약**...` 각주 blockquote 가 끼어들고, 382행부터
    `| Integration (Org) | ... |` 이 헤더 구분자(`|---|...|`) 없이 이어진다. GFM 테이블
    파서는 헤더 다음 줄이 구분자(`---`)여야 표로 인식하므로, 382~391행(`Integration (Org)`
    ~ `Audit Log` 8행)은 **표가 아니라 파이프 문자가 그대로 노출되는 일반 텍스트로
    렌더링**된다. 실제로 `python3` 로 원본 라인을 덤프해 366~391행이 header→8행→빈 줄→
    blockquote 5행→구분자 없는 8행 순임을 확인했다. 이 표는 바로 이번 plan
    (`member-owner-toctou`)이 다루는 owner 보호 규칙(각주 자체가 `CANNOT_REMOVE_OWNER` 설명)
    바로 옆이라 가독성 저하의 실질 영향이 크다 — Integration/KB/Auth Config/Model Config/
    Audit Log 등 8개 리소스의 권한 행이 렌더링에서 표 형태를 잃는다.
  - 제안: 각주(†)를 표 **뒤**로 옮기거나(표 366~391행을 먼저 끝내고 그 다음에 blockquote),
    표를 두 개로 완전히 분리하려면 382행 앞에 새 헤더+구분자 행을 추가한다. 표 안에 각주가
    필요하면 마크다운 테이블 셀 안에서 각주 텍스트를 담거나 문서 하단 각주 목록으로 옮기는
    것이 더 안전하다.

- **[INFO]** `3-error-handling.md` 296~298행에 구분선(`---`)이 중복 삽입돼 있다
  - target 위치: `spec/5-system/3-error-handling.md` 296~298행 (§1 "에러 분류" 끝 ~ §2
    "에러 응답 형식" 시작 사이)
  - 위반 규약: 없음 — 순수 형식 일관성 제안
  - 상세: `---` 가 연속 두 번(296행, 298행 — 사이 297행은 빈 줄) 등장한다. 다른 섹션
    경계는 `---` 한 번만 쓴다.
  - 제안: 296행 또는 298행 중 하나만 남긴다. 렌더링에는 실질 영향이 없어 우선순위는 낮다.

## 준수가 확인된 항목 (참고)

- `1-auth.md` · `2-api-convention.md` · `3-error-handling.md` 세 문서 모두 Overview / 본문 /
  Rationale 3섹션 구조를 지킨다.
- 에러 코드 `lower_snake_case` historical-artifact(`invitation_*`, `already_a_member` 등)는
  `error-codes.md §3` 레지스트리에 정확히 등재돼 있고, `1-auth.md §1.5.4` 도 그 레지스트리를
  명시적으로 인용해 신규 코드가 이를 선례로 삼지 않도록 방어하고 있다.
- 감사 액션(`workspace.transfer_ownership`, `member.invited/role_changed/removed` 등)은
  `audit-actions.md` 의 `<resource>.<verb>` 구조·시제 3분류(§2.1~§2.3) 규약과 정확히
  합치한다.
- `CANNOT_ASSIGN_OWNER` · `ALREADY_A_MEMBER` · `WORKSPACE_TYPE_MISMATCH` 등 §1.9 워크스페이스
  멤버 직접 추가 카탈로그는 `error-codes.md` 의 `UPPER_SNAKE_CASE` + 카탈로그 등재 요구를
  모범적으로 따르고 있다 (위 발견사항의 대조군).
- `swagger.md` 의 DTO/Controller 패턴(§1~§6)에 대해 `2-api-convention.md` 가 참조하는
  `TransformInterceptor` pass-through·`{data:{items}}` 비-페이징 컬렉션 서술은 두 문서가
  서로 정합하게 교차 인용한다.

## 요약

감사한 세 문서(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)는 명명·출력 포맷·
문서 구조 규약을 대체로 모범적으로 준수하며, 기존 historical-artifact 예외들도 SoT
레지스트리에 정확히 등재돼 있다. 다만 이번 plan 이 직접 다루는 `CANNOT_REMOVE_OWNER`
경로 주변에서 두 가지 흠을 찾았다 — ① 그 코드 자체가 중앙 에러 카탈로그(§1)에 등재돼 있지
않아 "카탈로그 미등재 코드는 존재를 알 수 없다"는 자기 규약을 어기고 있고, ② 바로 그 각주가
꽂혀 있는 RBAC 권한 매트릭스 표가 GFM 렌더링 관점에서 두 조각으로 쪼개져 있다. 둘 다 이번
PR(`spec_impact: none`)이 만든 결함은 아니며 구현 자체를 막을 사유는 아니지만, 이 plan 이
바로 그 코드·그 표를 다루는 시점이라 언급해 둔다. 나머지 14개 `spec/5-system` 파일은
컨텍스트 예산으로 이번 검토에 포함되지 못했다.

## 위험도

LOW
