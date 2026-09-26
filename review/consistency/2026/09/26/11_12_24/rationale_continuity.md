# Rationale 연속성 검토 — forbidden-desc-codes (--impl-prep)

대상: `plan/in-progress/forbidden-desc-codes.md` (구현 plan) + `plan/in-progress/spec-draft-swagger-forbidden-codes.md` (spec draft, `spec/conventions/swagger.md` §5-4 개정 예정)이 기존 spec 의 `## Rationale` 과 정합하는지 검토.

## 발견사항

- **[INFO]** 역할 문구 대소문자 표준화 근거가 spec 초안 Rationale 에는 빠져 있다
  - target 위치: `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 변경 (2) — 예시 문장 `"... 또는 Editor 이상 권한 필요(EDITOR_REQUIRED)"` (대문자 `Editor`)
  - 과거 결정 출처: 현재 `spec/conventions/swagger.md` §5-4 본문(변경 전)은 `"editor 이상 권한 필요(EDITOR_REQUIRED)"`(소문자 `editor`)를 예시로 쓰고, `codebase/backend/src/modules/integrations/integrations.controller.ts` 의 `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 도 소문자 `editor 이상 권한 필요`를 쓴다.
  - 상세: 구현 plan(`forbidden-desc-codes.md` §방향)에는 "역할 문구의 대소문자는 `ROLE_REQUIRED` 메시지(`Editor 이상의 권한이 필요합니다.`)에 맞춘다"는 근거가 있지만, 이 표준화 선택 자체는 **spec draft 의 `## Rationale` 변경 (3)** 에는 명시되지 않았다 — 변경 (3)의 "공용 헬퍼로 쓴다" 항목은 문장 *형식*(«Admin 미만 권한» 등)이 갈렸다는 점만 근거로 들고, 대소문자를 어느 쪽(소문자 `editor` vs 대문자 `Editor`)으로 통일할지는 언급하지 않는다. `CLAUDE.md` 원칙상 "결정의 배경·근거"는 spec 문서의 `## Rationale` 이 SoT 이므로, 구현 plan 에만 있는 근거는 spec 문서 자체를 읽는 다음 사람에게 보이지 않는다.
  - 제안: spec draft 변경 (3)에 "역할 문구 대소문자는 `ROLE_REQUIRED` 상수 메시지를 canonical 로 삼는다(기존 컨트롤러의 소문자 표기는 헬퍼 도입으로 흡수)"는 한 문장을 추가.

- **[INFO]** (긍정 확인 — 결함 아님) "기각된 대안" 을 이 draft 자체의 검토로 정직하게 귀속
  - target 위치: `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 하단 `## Rationale (이 draft 의)` — "기각한 대안 — `@Roles()` 를 읽어 설명을 자동으로 만드는 데코레이터(**이 draft 를 쓰며 검토했다**)"
  - 상세: 과거 seesion 교훈(`feedback_rationale_rejected_alternatives_need_history.md`)이 지적하는 "지어낸/소급 부여된 기각 이력"에 해당하지 않는다 — 이 대안은 실제 과거 spec 이력에서 기각된 것으로 잘못 인용되지 않고, "이 draft 작성 중 검토·기각"으로 정확히 귀속돼 있다. 문제 없음, 기록만 남긴다.

## 정합성 확인 (충돌 없음으로 판정한 주요 지점)

1. **§5-4 문구 변경이 "opt-in 모델 전제"를 재도입하지 않는가** — 신 draft 는 종전 §5-4 문구("`@Roles()` 있으면 역할 코드만, 없으면 `NOT_A_MEMBER`만")를 "가드가 낼 수 있는 코드를 **전부** 싣는다"로 고친다. 이는 `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드 (2026-09-25)" 의 채택안 (나)("비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`")를 문서 표현에 그대로 반영한 것이며, 그 결정 자체가 "적용 범위는 전역이다"(같은 절)라고 명시하므로 draft 가 이를 경로 라우트뿐 아니라 모든 `@Roles()` 라우트로 일반화하는 것도 원 결정의 스코프와 일치한다. **번복이 아니라 문서-구현 동기화**(draft 스스로도 그렇게 서술).
2. **"손으로 쓴 표 대신 팩토리/메타데이터"** 원칙(swagger.md §Rationale "§2-4 광고한 성공 코드 ↔ 실제 성공 코드") 과의 정합 — 신설 저장소 가드 `forbidden-response-codes` 는 `RolesGuard` 와 동일 규칙(`@Public`/`@Roles`/워크스페이스 소비)으로 기대 코드를 계산하고 reflection 으로 최종 문자열을 대조한다. 코드→문구 매핑을 손으로 다시 쓰지 않는다는 기존 원칙을 그대로 따른다.
3. **"74번째 라우트 문제는 데코레이터로 안 닫힌다 — 정적 가드가 닫는다"** 패턴(`12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다")과의 정합 — §5-4 를 "새 엔드포인트 체크리스트"로만 두지 않고 저장소 가드로 **기존 라우트 전체**에 강제한다는 설계는 이 선례를 그대로 반복 적용한 것이지 그것과 어긋나지 않는다.
4. **Organization 통합의 Admin 게이팅**(`spec/2-navigation/4-integration.md` §8 "판정 규칙") 과의 정합 — 이 규칙은 "라우트 가드(`@Roles('editor')`)는 그 아래의 첫 번째 선일 뿐"이고 실제 Admin 게이팅은 **서비스 계층**이 `ADMIN_REQUIRED` 를 낸다고 명시한다. forbidden-desc-codes 구현 plan 은 "서비스 거부는 세지 않는다"(정하지 않는 것 절)로 이 경계를 정확히 존중하며, integrations 컨트롤러의 4곳에 대해서도 가드가 요구하는 것은 `NOT_A_MEMBER`+`EDITOR_REQUIRED` 뿐이고 기존 `ADMIN_REQUIRED` 문구(서비스 발행분)는 건드리지 않는다 — 두 계층의 코드 출처를 혼동하지 않는다.
5. **`viewer` = 멤버십과 동일 코드** 취급 — `common/constants/workspace-roles.ts` 의 `ROLE_REQUIRED.viewer === NOT_A_MEMBER` 와 draft·plan 의 "viewer 요구는 추가 코드 없음" 서술이 일치한다.
6. **`lowestRequiredRole` 공유 함수화** — "가드와 검사가 같은 함수를 쓴다"는 설계는 `resolveRequestWorkspaceContext`·`handlerConsumesWorkspaceId` 등 기존에 반복된 "판정 로직 단일화" 패턴과 동형이며 새 원칙을 만드는 것이 아니라 기존 관행의 재적용이다.

## 요약

`forbidden-desc-codes` 구현 plan 과 그에 딸린 `spec-draft-swagger-forbidden-codes.md` 초안은 `spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드 (2026-09-25)"·"멤버십 검증은 가드 1곳에서"와 `spec/conventions/swagger.md` 자체의 §2-4·§5-4 Rationale, 그리고 `spec/2-navigation/4-integration.md` §8 의 서비스-계층 Admin 게이팅 경계를 정확히 인용하고 그 스코프·채택안을 그대로 따르고 있다. 기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회에 해당하는 사례는 발견되지 않았다 — 오히려 draft 는 "opt-in 체크리스트 대신 저장소 가드로 전 라우트 강제"라는 기존 선례를 일관되게 재적용하고 있다. 유일한 지적은 역할 문구 대소문자 표준화의 근거가 구현 plan 에만 있고 spec 초안의 `## Rationale` 자체에는 한 문장으로 명시되지 않았다는 사소한 SoT 배치 문제(INFO)뿐이다.

## 위험도
LOW
