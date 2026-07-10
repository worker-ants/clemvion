# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/workspace-membership-codes.md` (draft — `spec/5-system/3-error-handling.md` §1 에 §1.9 신설)

## 발견사항

- **[WARNING]** 신설 §1.9 note 의 `USER_NOT_FOUND` 섹션 참조(`§1.1`)가 실제로 그 코드를 포함하지 않음
  - target 위치: target 문서 "변경 — `spec/5-system/3-error-handling.md`" §2) 삽입문, 마지막 문장 "미가입 이메일은 generic `USER_NOT_FOUND`(404, **§1.1**)."
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.1 "시스템 에러" (실제 내용: `INTERNAL_ERROR`·`SERVICE_UNAVAILABLE`·`DATABASE_ERROR`·`RATE_LIMITED` 4행뿐, `USER_NOT_FOUND` 없음)
  - 상세: 같은 문장 안에서 `NOT_A_MEMBER`(403)는 "§1.2"로 정확히 가리키는데(§1.2 는 실제로 `NOT_A_MEMBER` 를 포함), `USER_NOT_FOUND`는 "§1.1"로 가리킨다. 그러나 `spec/5-system/3-error-handling.md` 전체를 grep 해도 `USER_NOT_FOUND` 문자열은 어디에도 없다(카탈로그 미등재 — 의도적으로 "generic 이라 등재 대상 아님"이라는 게 target 의 취지). 즉 "§1.1" 은 실재하지 않는 근거 링크이며, `error-handling.md` 를 처음 읽는 사람에게 "USER_NOT_FOUND 는 §1.1 시스템 에러 표에 있다"는 잘못된 인상을 준다. anchor(`#1-1-...`) 자체는 존재하므로 단순 dead-link 검사로는 걸러지지 않고, 내용 검증에서만 드러나는 오류다.
  - 제안: "(404, §1.1)" 부분을 제거하거나, "generic `USER_NOT_FOUND`(404, auth/users 전역 — 본 카탈로그 미등재)" 처럼 섹션 번호를 특정하지 않는 서술로 교체. 등재하지 않기로 한 코드에 존재하지 않는 섹션 번호를 붙이지 않는다.

- **[WARNING]** "전수 코드검증" 표에서 동일 핸들러가 던지는 `WORKSPACE_NOT_FOUND`(404) 가 누락되고, 유일하게 예외 처리된 `USER_NOT_FOUND` 와 달리 배제 사유 각주가 없음
  - target 위치: target 문서 "코드 ground truth (직접-추가 경로 `addMemberByEmail`, 전수 코드검증)" 표 + 신설 §1.9 표/note
  - 충돌 대상: `codebase/backend/src/modules/workspaces/workspaces.service.ts:748-767` (`assertWorkspaceType`, `addMemberByEmail:234` 에서 최초 호출) + `workspaces.controller.ts:299-313`(`@ApiNotFoundResponse({ description: '해당 워크스페이스를 찾을 수 없음' })`, 같은 `POST /:id/members` 엔드포인트) + `spec/conventions/error-codes.md §3` 의 `workspace_not_found`·`user_not_found` 행("**초대 모듈 한정** — `workspace_not_found`·`user_not_found` 는 직접 추가·관리 경로(**§1.9**, `workspaces.service.ts`)의 UPPER_SNAKE `WORKSPACE_NOT_FOUND`·`USER_NOT_FOUND` 와 별개 코드다")
  - 상세: `addMemberByEmail` 은 `assertWorkspaceType(workspaceId, 'team')` 을 **가장 먼저** 호출하고, 워크스페이스 row 가 없으면 `404 WORKSPACE_NOT_FOUND` 를 던진다(코드 실측). 같은 엔드포인트의 컨트롤러 Swagger 데코레이터도 이 404 를 명시적으로 문서화한다. 즉 target 이 "전수 코드검증" 이라 표방한 표는 실제로는 4개 중 3개만 나열한다. `USER_NOT_FOUND` 는 "generic(auth·users 전역 공용)이라 제외" 라는 명시적 각주가 있는 반면, `WORKSPACE_NOT_FOUND` 는 아무 언급 없이 빠졌다 — 더구나 `error-codes.md §3`(target 이 수정하지 않는 기존 convention 문서)는 이미 `WORKSPACE_NOT_FOUND` 를 "§1.9, `workspaces.service.ts`" 의 UPPER_SNAKE 코드로 명시적으로 지목하고 있어, 그 §1.9 (data-flow 든 error-handling 이든) 어디에도 `WORKSPACE_NOT_FOUND` 가 등장하지 않는 현재 상태와 어긋난다.
  - 참고: `WORKSPACE_NOT_FOUND` 는 `workspaces.service.ts` 안에서 `addMemberByEmail` 외에도 `renameWorkspace`·`updateWorkspaceSettings`·`deleteWorkspace`·`transferOwnership` 등 다수 메서드가 공유하는 모듈-공통 404 다(`grep` 확인, 7개소). 따라서 "직접-추가 경로에 distinctive 한 코드만 등재"라는 target 의 스코프 결정 자체는 방어 가능하나, 그렇다면 `USER_NOT_FOUND` 와 동일한 방식으로 명시적 배제 각주가 있어야 대칭적이고, 독자가 "전수 코드검증"의 완결성을 오해하지 않는다.
  - 제안: 신설 §1.9 note 에 "`WORKSPACE_NOT_FOUND`(404)는 `workspaces.service.ts` 전역에서 공유되는 워크스페이스 CRUD 공통 404 로, 직접-추가 경로에 distinctive 하지 않아 본 등재 범위 밖" 같은 한 문장을 `USER_NOT_FOUND` 각주와 대칭되게 추가. 또는 `error-codes.md §3` 의 해당 행에서 "§1.9" 언급을 재검토(그 행은 lowercase `workspace_not_found`/`user_not_found` 의 대응 코드를 설명하는 것이 목적이라, §1.9 라는 특정 절 번호 대신 "workspaces.service.ts 전역"으로 완화하는 편이 실제 카탈로그 상태와 더 잘 맞음 — 단, 이 편집은 이 draft 의 직접 대상 파일이 아니므로 별도 후속 검토 권고).

- **[INFO]** `plan/in-progress/error-codes-catalog-sot.md` 가 동일 파일(`spec/5-system/3-error-handling.md`) §1 계열을 이미 완결 처리했고, 그 Rationale(§482)이 정확히 이 draft 의 범위를 "별도 완결성 pass" 로 예약해 둔 상태 — 두 plan 사이에 실질 충돌은 없으나, 상호 참조(back-link)가 없어 계보 추적이 어렵다
  - target 위치: target 문서 "배경" 섹션
  - 충돌 대상: `spec/5-system/3-error-handling.md` 기존 Rationale "§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재" bullet의 "**범위 한정**: workspace 직접-추가 경로 코드(...)는 #882/#887 deferred 목록 밖이라 본 pass 범위 아님(별도 완결성 pass)." + `plan/in-progress/error-codes-catalog-sot.md`
  - 상세: 실제 충돌은 없음(검증 결과 완전히 정합) — 다만 `error-codes-catalog-sot.md` 는 아직 `plan/in-progress/`에 남아 있고 이 draft 는 그 문서를 언급하지 않는다. 계보상 이 draft 가 "그 plan 이 예약해 둔 별도 pass" 임을 명시하면 plan 이력 추적에 도움이 된다.
  - 제안: target 배경 섹션에 `error-codes-catalog-sot.md`(및 그 plan 이 남긴 "별도 완결성 pass" 예약)를 한 줄 cross-ref. 선택 사항(비차단).

검증 완료(충돌 없음, 참고용): 데이터 모델(`WorkspaceMember.role` enum, `spec/1-data-model.md §2.3`) 충돌 없음 · API 계약(`POST /api/workspaces/:id/members`, `spec/2-navigation/9-user-profile.md:353` "이메일로 기존 가입자 즉시 추가 (Admin+)") 완전 일치 · RBAC(admin+) 일치 · 요구사항 ID 신규 부여 없음(에러 코드 카탈로그 등재만) · 세 코드(`CANNOT_ASSIGN_OWNER`/`ALREADY_A_MEMBER`/`WORKSPACE_TYPE_MISMATCH`)의 status(403/409/403)는 `workspaces.service.ts:238,254,763` 실측과 정확히 일치 · UPPER_SNAKE vs lowercase 동명 코드 구분 note 는 `error-codes.md §3`·`data-flow/12-workspace.md §1.2/§1.9` 와 완전 정합(신규 모순 없음) · 앵커 `#19-멤버-직접-추가-기가입-사용자` 실재 확인.

## 요약

target 이 등재하려는 3개 UPPER_SNAKE 코드(`CANNOT_ASSIGN_OWNER`/`ALREADY_A_MEMBER`/`WORKSPACE_TYPE_MISMATCH`)의 status·트리거·모듈 구분(lowercase 초대 흐름과의 근접명명 구분 포함)은 코드 실측·`error-codes.md`·`data-flow/12-workspace.md §1.9`와 완전히 정합하며 새로운 spec-대-spec 모순은 없다. 다만 target 이 새로 삽입하는 문장 안에 두 가지 정확성 결함이 있다 — (1) `USER_NOT_FOUND` 를 존재하지 않는 "§1.1" 로 잘못 가리키는 dead 각주, (2) 같은 `addMemberByEmail` 핸들러가 실제로 던지는 4번째 코드 `WORKSPACE_NOT_FOUND`(404, 코드·Swagger 양쪽에서 확인)가 "전수 코드검증"을 표방한 표에서 아무 설명 없이 누락되어 `error-codes.md §3` 의 기존 서술("§1.9, workspaces.service.ts 의 WORKSPACE_NOT_FOUND")과 비대칭. 두 건 모두 merge 를 막을 CRITICAL 은 아니지만, spec 반영 전에 정정하는 것을 권고한다.

## 위험도

MEDIUM
