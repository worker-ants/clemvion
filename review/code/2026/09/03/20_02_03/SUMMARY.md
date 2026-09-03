# Code Review 통합 보고서

## 전체 위험도
**LOW** — `WorkspaceInvitationDto.invitedBy` nullable 정정은 실제 런타임 동작(FK `ON DELETE SET NULL`)에 문서/타입을 맞춘 정합화 변경이며 Critical 은 없다. 9명 reviewer(forced 7 전원 포함) 모두 결과를 확보했고 누락 없음 — 강제 화이트리스트 미이행 없음. WARNING 3건은 전부 프로세스성(테스트 커버리지 완성도, CHANGELOG 누락, plan 문서 내부 모순)이며 코드 정확성 결함은 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 `listInvitations` 테스트 2건이 결과값만 검증하고 `invitations.listPending` 호출 인자(`'ws-1', user.sub`)를 검증하지 않음 — 파일 내 다른 5개 describe 블록(`update`/`remove`/`leave`/`transferOwnership`)은 전부 `toHaveBeenCalledWith` 로 인자를 검증하는 것과 스타일이 다름. 이 핸들러의 첫 테스트라 인자 순서 회귀를 못 잡음 | `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:71-85, 88-102` | 두 테스트 중 하나에 `expect(invitations.listPending).toHaveBeenCalledWith('ws-1', user.sub);` 추가 |
| 2 | documentation | `invitedBy` nullable 전환은 OpenAPI 계약 변경(`required` 해제, `nullable` 추가)인데 CHANGELOG 항목이 없음 — 같은 plan 의 직전 커밋(`af1651264`, `AuthConfigDto.ipWhitelist` 정정)이 "OpenAPI 계약이 바뀌면 CHANGELOG 를 단다"는 규칙을 스스로 세우고 실제로 항목을 추가했는데, 이번 커밋만 그 규칙을 따르지 않음(자기모순) | `CHANGELOG.md` (해당 diff 에 파일 부재 — `grep invitedBy CHANGELOG.md` 0건) | `ipWhitelist` 항목과 같은 형식(종전/지금 표 + 영향 문단)으로 `invitedBy` 항목 추가 |
| 3 | documentation | plan 문서 안에서 "48건" 축에 대해 신·구 두 절의 결론이 모순됨 — 갱신된 체크리스트 절은 "48건은 계측 도구 산물, 실결함 1건"으로 종결했지만, 예전에 그 절이 가리키던 `### 새로 드러난 축` 절은 그대로 남아 "48건이 아직 미해결 작업 항목", "가드가 없다"는 옛 서술을 계속 유지함. 처음부터 읽으면 오독 가능 | `plan/in-progress/entity-nullable-column-type-mismatch.md:195-231`(갱신됨) vs `:333-359`(미갱신, 모순 서술 잔존) | `:333-359` 절 도입부에 "이 판단은 갱신됨 — §할 일 체크리스트(:195) 참조, 48건은 계측 도구 산물로 반증됨" 전방 포인터 추가, 또는 중복 서술 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / maintainability / testing | `invitedBy?:`(optional key) 선언이 실제 응답(키 항상 존재, 값만 null)과 어긋나며, 같은 파일의 `InvitationMetaDto.invitedByName: string \| null`(non-optional)과 표기 컨벤션이 다름. api_contract 리뷰어는 이를 WARNING 으로 표시했으나, maintainability·testing·requirement 리뷰어는 이미 plan 문서(`entity-nullable-column-type-mismatch.md` §후속 INFO#1)에 planner 턴 결정 사항으로 명시 추적 중임을 확인해 "이번 PR 범위 조치 불요"로 판단함 — 다수 의견을 따라 INFO 로 통합 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:109-110` (대조: `:154-155`) | 규약(§5.4) `field?:` 표기 확정 시 `InvitationMetaDto.invitedByName` 과 형태 통일 고려 — 이미 planner 턴 위임됨, 재-flag 불요 |
| 2 | requirement / testing | `listInvitations` 컨트롤러 테스트에 예외 전파(에러 경로, 예: 비-admin `ForbiddenException`) 테스트가 없음 — 파일 내 다른 모든 describe 블록은 happy-path + 예외 전파 짝을 이루는 것과 스타일 불일치. 이번 diff 의 스코프(§5.4 nullable canary)는 아니며 선재 공백 | `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:60-103` | 필요 시 후속으로 `assertAdmin` 실패 시 `ForbiddenException` 전파 테스트 추가 (이번 PR 스코프 아님) |
| 3 | scope | plan 문서에 "버그 수정"과 "축 전체 재검증(라이브 스키마 424 컬럼 감사)" 두 관심사가 함께 묶임 — 애플리케이션 코드는 건드리지 않고 문서에만 존재하며 저자가 "부수"로 명시해 은폐성 스코프 확장은 아님 | `plan/in-progress/entity-nullable-column-type-mismatch.md:249-280` | 조치 불요. 향후 유사 세션에서 "버그 수정"과 "선행 배치 정본 재검증"은 커밋 분리 고려 |
| 4 | side_effect / api_contract | `invitedBy` required→optional/nullable 완화는 wire 응답 바이트를 바꾸지 않는 하위 호환 방향(widening) 변경 — 레포 내 유일 소비처(`listInvitations`)와 FE 타입(`frontend/src/lib/api/workspaces.ts:154`)은 이미 nullable 전제. 레포 밖 수동 SDK 클라이언트가 있다면 `required` 해제가 정적 타입 가정을 깰 가능성만 인지 필요 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110` | 조치 불요 |
| 5 | side_effect | 리뷰 도중 `workspaces.controller.ts:402` 에서 plan 이 기술한 뮤테이션(`invitedBy: i.invitedBy ?? ''`)과 정확히 일치하는 미커밋 변경이 일시 관측됨 — reviewer 본인이 만든 것이 아니고 재확인 시점엔 이미 원복·클린 상태였음(동시 검증 프로세스로 추정) | `codebase/backend/src/modules/workspaces/workspaces.controller.ts:402` | 조치 불요(이미 해소됨). push 직전 `git status --short` 재확인 권장 |
| 6 | testing | FK `ON DELETE SET NULL` cascade 를 실제 DB 로 관통하는 e2e/통합 테스트 없음 — 유닛 테스트는 `invitedBy: null` 을 mock 으로 주입해 컨트롤러 통과 동작만 고정. Swagger 메타데이터는 런타임에 영향 없음을 확인해 비용 대비 낮은 우선순위 | `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:70-85` (대응 e2e 부재) | 필수 아님. 추후 워크스페이스 초대 e2e 스위트에 "초대자 계정 삭제 후 목록 조회" 시나리오 고려 |
| 7 | security / requirement / api_contract / user_guide_sync | 실질 결함 없음 확인 — (a) `invitedBy` 노출 대상 엔드포인트는 Admin+ 권한 가드 유지(diff 밖, 변경 없음), 신규 정보 노출 없음. (b) DTO 변경이 spec §5.4·DB 스키마(V017)·엔티티·핸들러·FE 계약과 line-level 일치(뮤테이션 재현으로 실증: `?? ''` 삽입 시 정확히 1 failed/13 passed, plan 기술과 일치). (c) OpenAPI widening 은 breaking change 아님. (d) 매트릭스 매칭 trigger(`backend-api-change`)의 동반 갱신 요구 모두 충족 — 이 필드는 어떤 `.tsx` 에도 렌더링되지 않아(grep 0건) user-guide 갱신 불요 | 각 리포트 참조 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 정보 노출·인젝션·인증 우회 없음. 순수 계약/타입 정정 |
| requirement | NONE | spec §5.4·DB·엔티티·핸들러·FE 계약 line-level 일치 실증(뮤테이션 재현). Critical/Warning 없음 |
| scope | LOW | plan 문서에 버그 수정 + 별도 축 재검증(424컬럼 감사) 혼재(문서만, 은폐성 아님) |
| side_effect | LOW | 계약 widening(비파괴), 리뷰 중 일시 뮤테이션 관측(자체 원복, reviewer 무관) |
| maintainability | LOW | optional 표기 불일치(기존 다수 패턴 따름, 이미 추적 중) |
| testing | LOW | 신규 테스트 인자 검증 누락(WARNING), 에러 경로·e2e 미비(INFO). vacuous 아님(뮤테이션 재현으로 실증) |
| documentation | LOW | CHANGELOG 누락(자기모순), plan 문서 내 신·구 절 모순 |
| api_contract | LOW | optional 표기 불일치(WARNING, 이미 추적 중), widening 은 비파괴 |
| user_guide_sync | NONE | 매칭 trigger 1건, 요구사항 모두 충족·영향 없음 실측 확인 |

## 발견 없는 에이전트

- security — 위험도 NONE, INFO 3건 전부 "조치 불요" 확인성 서술
- requirement — 위험도 NONE, INFO 6건 전부 정합성 실증(spec fidelity PASS)
- user_guide_sync — 위험도 NONE, 매칭 trigger 요구사항 완전 충족

## 권장 조치사항

1. `CHANGELOG.md` 상단에 `invitedBy` OpenAPI 계약 변경 항목 추가 — 직전 커밋(`af1651264`)이 세운 자기 규칙과의 일관성 확보 (WARNING #2)
2. `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 `:333-359` 절(구 서술)에 갱신된 결론(`:195-231`)으로의 전방 포인터 추가 또는 중복 서술 정리 — 다음 독자의 오독 방지 (WARNING #3)
3. `workspaces.controller.spec.ts` 의 신규 `listInvitations` 테스트에 `invitations.listPending` 호출 인자 검증(`toHaveBeenCalledWith`) 추가 — 파일 내 기존 관례와 통일 (WARNING #1)
4. (선택, 이번 PR 스코프 아님) `listInvitations` 에 대한 예외 전파 테스트 추가, DTO `invitedBy?:` 표기를 `invitedByName` 과 통일하는 문제는 이미 planner 턴으로 추적 중이므로 별도 세션에서 처리

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 표 참조 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 강제 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(DTO nullable 정정 + 단위 테스트 추가)와 무관 |
  | architecture | 아키텍처 변경 없음 (단일 필드 타입 정정) |
  | dependency | 의존성 변경 없음 |
  | database | 스키마/마이그레이션 변경 없음(기존 V017 참조만) |
  | concurrency | 동시성 로직 변경 없음 |