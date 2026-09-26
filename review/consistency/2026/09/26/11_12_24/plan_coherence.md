# Plan 정합성 검토 — swagger.md §5-4 (403 설명 ↔ 가드 거부 코드)

## 검토 대상

- target: `spec/conventions/swagger.md`(+ 번들된 `spec/data-flow/12-workspace.md`) 현재 상태
- 지배 plan: `plan/in-progress/forbidden-desc-codes.md`(구현, developer) ·
  `plan/in-progress/spec-draft-swagger-forbidden-codes.md`(spec draft, project-planner)
- 모드: `--impl-prep`

## 발견사항

- **[WARNING] integrations 4개 엔드포인트의 `@Roles('editor')` 자체가 다른 plan 에서 결정 대기 중**
  - target 위치: `spec/conventions/swagger.md` §5-4 (via `forbidden-desc-codes.md` "129곳 문구" 표 — "integrations «editor … 또는
    Organization 통합의 변경에 Admin …» 4" 행)
  - 관련 plan: `plan/in-progress/integration-personal-owner-followup.md` §항목 3 "**Viewer 가 자기 personal 을 만들고 · 이름을
    바꾸고 · rotate · 삭제하지 못한다** (planner 결정 → developer)"
  - 상세: `forbidden-desc-codes.md` 는 `integrations.controller.ts` 의 `create`·`update`·`rotate`·`remove` 4곳(현재
    `@Roles('editor')` + `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 상수, 실측 확인됨)의 403 설명을 **지금의 `@Roles('editor')` 를
    전제로** `forbiddenForRole('editor')` 헬퍼로 고정하려 한다. 그런데 정확히 같은 4개 메서드에 대해
    `integration-personal-owner-followup.md` 가 "RBAC §3.2/§8 표는 Viewer 도 자기 personal 통합을 관리할 수 있다고 하는데
    라우트 가드가 `@Roles('editor')` 로 막고 있다 — 가드를 내리거나 표를 정정해야 한다" 는 **미해결 결정**을 열어 두고 있다.
    이 결정이 "가드를 내린다" 쪽으로 나면 동일 4곳의 `@Roles()` 자체가 바뀌어, `forbidden-desc-codes.md` 가 방금 고정한
    설명 문구(EDITOR_REQUIRED 포함)가 다시 gap 이 된다. reflection 가드(`forbidden-response-codes`)가 그 drift 를 다음
    커밋에서 자동으로 잡아내므로 **정합성이 조용히 깨지지는 않지만**, 같은 4줄을 두 plan 이 순서 없이 번갈아 건드리게 돼
    불필요한 rework 라운드가 생긴다.
  - 제안: 둘 중 하나. (a) `forbidden-desc-codes.md` 의 "129곳 교체" 단계에서 이 4곳에 "`integration-personal-owner-followup.md`
    의 Viewer 역할 결정이 나면 재검토" 각주를 남긴다. (b) 순서를 바꿔 `integration-personal-owner-followup.md` 의 Viewer 결정을
    먼저 planner 턴으로 매듭짓고 그 뒤에 이 4곳의 설명 문구를 고정한다. 어느 쪽이든 두 plan 사이에 상호 참조가 없으면 다음 세션이
    "왜 방금 고친 문구가 또 어긋났나"를 처음부터 재조사하게 된다.

- **[INFO] `forbidden-desc-codes.md` 내부에서 spec draft 적용 시점이 두 절에서 다르게 읽힌다**
  - target 위치: 해당 없음(target 자체가 아니라 target 을 지배하는 plan 문서 내부)
  - 관련 plan: `plan/in-progress/forbidden-desc-codes.md` `## 요구`(6번 "spec draft → `--spec` → 반영(planner 커밋)" 을 코드
    변경 4단계 뒤에 배치) vs `## 체크리스트`(1번째 항목이 "spec draft `--spec` · 반영", 2번째가 `--impl-prep` — 코드 구현보다도
    먼저)
  - 상세: 두 절이 "spec 을 언제 적용하는가"를 다르게 서술한다. 직접 선례인
    `plan/complete/workspace-path-guard-impl.md` 는 `--impl-prep` 바로 다음에 planner 턴(spec draft·`--spec`)을 두고 코드
    구현은 그 다음이었고, 같은 문서가 "spec 과 구현을 분리한 PR 로 가려다 `--spec` BLOCK 을 맞아 한 PR 로 합쳤다"는 교훈을 남겼다.
    `forbidden-desc-codes.md` 의 "요구" 절대로면(spec 을 코드·CHANGELOG 뒤 마지막에 씀) 같은 교훈과 무관하게 진행되고,
    "체크리스트" 대로면 선례와 유사하게 이른 시점에 spec 을 적용한다. 두 절이 다른 순서를 말하는 채로 남아 있으면 실행자가
    임의로 하나를 택하게 된다.
  - 제안: 코드 저자 쪽에서 "요구"(작업 목록) 순서를 "체크리스트"(실행 순서)에 맞춰 정리하거나, 두 절이 순서를 나타내지 않는
    별개 목록임을 한 줄로 명시.

- **[INFO] 트래커 항목의 2026-09-25 집계와 이번 plan 의 2026-09-26 재실측이 다른 숫자를 남긴다**
  - target 위치: 해당 없음(집계는 target 문서가 아니라 두 plan 문서에만 있음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L5052-5059 (트래커 항목 "기존
    `@ApiForbiddenResponse` 설명 ~120곳…") vs `plan/in-progress/forbidden-desc-codes.md` §실측
  - 상세: 트래커 항목은 2026-09-25 집계로 "«워크스페이스 멤버가 아님» 63 · «editor 이상 권한 필요» 54 · «viewer 이상 권한
    필요» 4 · «owner 이상 권한 필요» 2 · 기타 20여"(합 ~143)를 적고 있는데, `forbidden-desc-codes.md` 의 2026-09-26
    재실측은 "54 · 53 · 4 · (owner 항목 없음) · 14"(합 129)로 다르다. 방향(대량 미달)은 같지만 절대값이 다르다 — 그 사이
    `#1399`/`#1400`류 커밋이 일부를 이미 닫았을 수 있어 자연스러운 차이일 수 있으나, 두 수치가 같은 현상을 가리키는 것으로
    읽히므로 이 plan 이 "트래커 항목 닫기"(체크리스트 마지막 항목)를 수행할 때 두 수치의 차이(63→54 등)를 한 줄로 설명해 두지
    않으면 다음 사람이 "어느 쪽이 맞았나"를 재조사해야 한다.
  - 제안: 트래커 항목을 닫는 커밋 메시지·plan 각주에 "2026-09-25(63/54/4/2/20여) → 2026-09-26 재실측(54/53/4/…/14) — 차이는
    [원인]" 한 줄을 남긴다.

## 요약

target(`swagger.md` §5-4 + `12-workspace.md` 「가드 거부의 오류 코드」)과 이를 구현하는
`forbidden-desc-codes.md`/`spec-draft-swagger-forbidden-codes.md` 사이의 핵심 결정(비멤버는 항상 `NOT_A_MEMBER`, `viewer` 는
코드 하나, reflection 가드가 `lowestRequiredRole` 을 가드와 공유)은 `spec/data-flow/12-workspace.md` §"가드 거부의 오류
코드"의 기존 채택안과 정확히 일치하고, 서비스-계층 403 은 의도적으로 범위 밖으로 남겨 tracker 항목과도 부합한다. CRITICAL 급
충돌(미해결 결정의 일방적 우회)은 발견되지 않았다. 다만 이 plan 이 손대는 4개 integrations 엔드포인트의 `@Roles('editor')`
자체가 `integration-personal-owner-followup.md` 에서 아직 열려 있는 결정 대상이라 순서 없이 진행하면 같은 줄을 두 번
고치게 될 위험이 있고(WARNING), plan 문서 내부의 절 간 순서 불일치와 트래커 수치 drift 는 실행 혼선을 줄이기 위해 정리해
두는 편이 좋다(INFO 2건).

## 위험도

LOW
