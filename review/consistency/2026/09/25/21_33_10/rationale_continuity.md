# Rationale 연속성 검토 — spec-draft-integration-personal-owner

대상: `plan/in-progress/spec-draft-integration-personal-owner.md` (spec draft, `spec/2-navigation/4-integration.md` 변경안)

## 발견사항

- **[WARNING] Admin-필요 거부를 새로 "403 FORBIDDEN" 으로 명문화 — 같은 날 확립된 "역할 거부는 전용 코드" 원칙과 정합하지 않음**
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner.md` §(B) 판정 규칙 블록,
    `**Organization 통합의 변경은 Admin 이상이다** — … 거부는 \`403 FORBIDDEN\` 이다.`
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` "가드 거부의 오류 코드 (2026-09-25)" —
    바로 직전 PR `#1399`(`5ba95e4b8`, 같은 날 병합)가 "역할·멤버십 거부는 코드 없는 기본
    `FORBIDDEN` 대신 `EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`/`NOT_A_MEMBER` 를 싣는다"로
    **전역** 전환했고, 그 근거로 "새 경로에만 코드를 붙이면 같은 실패가 경로에 따라 다른 본문을 낸다"를
    명시했다. `codebase/backend/src/common/constants/workspace-roles.ts` 가 이미
    `ROLE_REQUIRED.admin = { code: 'ADMIN_REQUIRED', … }` 를 export 하고, 그 파일 자체의 주석이
    "`integrations.service.ts` 의 로컬 `ADMIN_ROLES` 도 뒤이어 이 표로 옮겼다"고 밝혀 **integrations 도메인이
    이미 같은 표를 참조**하고 있음을 못박는다.
  - 상세: 코드 실측 결과 `integrations.service.ts` 의 기존 Admin 체크 두 곳(`requestScopes` L1250,
    `updateScope` L1326)이 이미 `ForbiddenException({ code: 'FORBIDDEN', message: 'Admin role is
    required …' })` 로 **구식(pre-#1399) 패턴**을 쓰고 있다 — `ADMIN_ROLES` 는 새 공유 상수를 쓰면서
    거부 코드 자체는 마이그레이션되지 않은 상태다. target 은 이 기존 갭을 인지하고 정정하는 대신, 새로
    추가하는 4개 지점(별칭 수정 · 삭제 · reauthorize · rotate · request-scopes 강제)에까지 같은 구식
    generic `FORBIDDEN` 을 **명문 spec 결정**으로 확정한다. `#1399` Rationale 의 "전역으로 함께 바꿨다"는
    취지가 `@Roles()` 가드 경로에는 이미 적용됐는데, 같은 역할-부족 축의 서비스-레벨 검사만 옛 패턴에
    머무는 비대칭이 spec 에 새로 고정된다. (B) 블록 어디에도 이 선택이 `ADMIN_REQUIRED` 대신 generic
    `FORBIDDEN` 이어야 하는 이유를 설명하는 새 Rationale 문장이 없다 — "결정의 무근거 번복"이라기보다
    "명시적으로 검토되지 않은 채 구식 패턴을 새 spec 결정으로 승격"에 해당한다.
  - 제안: (B) 블록에 `ADMIN_REQUIRED`(이미 `ROLE_REQUIRED.admin` 로 존재) 채택 여부를 명시적으로
    결정하거나, generic `FORBIDDEN` 유지를 택한다면 그 사유(예: "이 UI 는 role 사유를 구분해 보여줄
    계획이 없다")를 (C) Rationale 에 한 문장 추가할 것. 최소한 기존 `requestScopes`/`updateScope`
    의 구식 코드와 새 4곳의 코드가 **같은 값**이 되도록 명시해 "일부만 새 코드, 일부만 구식 코드"인
    상태가 spec 자체에서 갈리지 않게 할 것.

- **[WARNING] precheck 응답에 소유자 기반 필드 은닉 추가 — "Organization-scope 도입에도 별도 RBAC 처리 불필요" 주장과 상충**
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner.md` §(C) Rationale 초안,
    "받아들인 잔여" 문단 — "충돌 행이 남의 personal 이면 `existingIntegrationId` · `existingName`
    을 싣지 않는다"; §(B) 판정 규칙의 동일 문장.
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` "precheck endpoint — mall_id
    입력 단계 사전 감지 UX" — "노출 범위 격리 … **Organization-scope 도입 후에도** current workspace 의
    정의가 변경되면 본 endpoint 가 자동 추종 (**별도 RBAC 처리 불필요**)." 여기서 "Organization-scope"는
    `spec/0-overview.md` §6.1 행이 쓰는 것과 같은 용어로, 정확히 이번 PR 이 완성하는 personal/organization
    scope 분리를 가리킨다(장래의 §6.3 조직-상위-레벨 공유가 아니다).
  - 상세: 그 Rationale 항목은 "Organization-scope 가 들어와도 precheck 는 워크스페이스 스코프만 따르면
    되고 **추가 RBAC 로직이 필요 없다**"고 예측·명문화했다. target 은 이번 PR 에서 정확히 그 시나리오
    (Organization-scope 강제)에 도달했는데, precheck 응답에 **row 의 personal 소유자 여부에 따른 조건부
    필드 은닉**(row-level RBAC 판단)을 추가한다 — 이는 "별도 RBAC 처리" 그 자체다. target 의 (C) 는 이
    변경을 정당화하는 새 문장("받아들인 잔여")은 쓰지만, 옛 "별도 RBAC 처리 불필요" 문장을 정정하거나
    참조하지 않아 두 Rationale 항목이 문서 안에서 서로 모순된 주장을 남긴다 — 다음 독자가 옛 문장만
    보면 "row-level 은닉 로직은 없다"고 오해할 수 있다.
  - 제안: "precheck endpoint" Rationale 항목의 "별도 RBAC 처리 불필요" 문장에 취소선 또는 각주로
    "(2026-09-25 정정 — personal 행 은닉은 예외)"를 추가하고 새 "받아들인 잔여" 문단을 상호 참조시킬
    것. (프로젝트 관례상 원문은 지우지 않고 정정 표기.)

- **[INFO] 404 채택의 인용 선례가 실제로는 403 을 채택한 선례 — 인용은 부정확하나 결론 자체는 해당 도메인의 기존 관행과 부합**
  - target 위치: `plan/in-progress/spec-draft-integration-personal-owner.md` §사용자 결정 2,
    "경로 파라미터 워크스페이스 가드가 비멤버와 부재를 같은 응답으로 묶은 원칙([data-flow/12-workspace.md]
    Rationale «경로 파라미터 워크스페이스도 가드가 본다»)과 같다."
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` "경로 파라미터 워크스페이스도 가드가
    본다" + "가드 거부의 오류 코드" — 그 절이 실제로 채택한 것은 **403 `NOT_A_MEMBER`**(신설 전용 코드)로
    "존재 확인 없음 + 비멤버"를 통합한 것이지, 404 가 아니다. 오히려 그 문서는 "403 + 새 코드"를 **채택**한
    쪽이고, target 이 기각한 대안 "403 + 새 에러 코드"와 형태상 더 가깝다.
  - 상세: 다만 target 이 실제로 정합하는 선례는 같은 파일 §9.1 의 기존 서술 — cafe24/makeshop 노드가 이미
    "integrationId 가 존재하지 않거나 **타 워크스페이스 소속**"을 `requireEntity` 의 `RESOURCE_NOT_FOUND`
    (404, 전용 코드 없음)로 처리하는 것 — 과 정확히 같은 모양이다. 즉 target 의 결론(404 + 기존 generic
    코드 재사용)은 **Integration 도메인 자신의 기존 cross-workspace 처리 관행**과는 이미 정합하지만,
    인용한 workspace 경로-가드 선례와는 HTTP status·코드 전략이 다르다 — 인용이 다른 결론을 낸 선례를
    "같은 원칙"이라고 부른 것.
  - 제안: 인용을 `spec/2-navigation/4-integration.md §9.1` 의 기존 `RESOURCE_NOT_FOUND` cross-workspace
    처리(§9.1 `INTEGRATION_CALL_FAILED` 행의 "별도 `INTEGRATION_NOT_FOUND` 코드 없음")로 바꾸거나, 두
    선례를 모두 인용하면서 "workspace 는 403 을 택했지만 integration 은 기존에 이미 404 generic 코드를
    써 왔으므로 그 관행을 따른다"고 구분해 적을 것 — 근거가 더 강해지고 오독 위험이 사라진다.

## 요약

target 은 §8 판정 규칙 신설과 `status: partial` 표기 자체는 기존 RBAC §3.2 표·§8 표·§0-overview.md 의
floor 서술과 잘 정합하며, "본인=created_by, 역할 우위 없음" 원칙은 이미 문서화돼 있던 RBAC 매트릭스를
코드에 강제하는 것뿐이라 기각된 대안의 재도입이나 원칙 위반은 없다. 다만 세부 구현 선택 두 곳이 바로
전날·같은 세션에 확립된 인접 Rationale 과 어긋난다 — (1) Admin-필요 거부 코드가 `#1399` 가 전역으로
정리하려 했던 "역할 거부 = 전용 코드" 원칙 대신 구식 generic `FORBIDDEN` 을 새 spec 결정으로 승격시키고,
(2) precheck 의 소유자 기반 필드 은닉 추가가 같은 문서의 "Organization-scope 도입에도 별도 RBAC 불필요"
예측을 정정 없이 뒤집는다. 두 항목 모두 새 Rationale 문장 자체는 있으나(자기 정당화는 됨), 상충하는
**기존** Rationale 문장을 정정·상호참조하지 않아 문서 내부 모순이 남는다. 404 인용 선례는 부정확하지만
결론 자체는 도메인 내 기존 관행과 부합해 실질적 위험은 낮다.

## 위험도

MEDIUM
