# 변경 범위(Scope) 리뷰 — `removeMember` 인가 순서 재배치

## 발견사항

- **[INFO]** `throwNotAMember()`/`throwAdminRequired()` 추출이 `removeMember` 밖의 기존 메서드(`assertMembership`·`assertAdmin`)도 건드린다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `throwNotAMember()`·`throwAdminRequired()` 정의부(게이트 913~926) 및 `assertMembership`(게이트 928~934)·`assertAdmin`(게이트 936~942) 본문
  - 상세: 이번 작업의 직접 목표는 `removeMember()` 한 메서드의 판정 순서 재배치다. 그런데 그 과정에서 두 예외 리터럴을 헬퍼로 뽑고, `removeMember` 뿐 아니라 다른 호출자(`addMemberByEmail`·`updateMemberRole`·`leaveWorkspace`·`switch` 등)가 쓰는 기존 `assertMembership`/`assertAdmin` 내부도 `throw new ForbiddenException({...})` → `this.throwXxx()` 호출로 바꿔, "이 PR" 의 diff 범위가 `removeMember` 바깥으로 한 칸 넓어졌다. 다만 이 리팩터는 (a) plan(`plan/in-progress/member-auth-order.md` §B)이 착수 전에 "같은 코드가 다른 메시지를 내는 것을 막는다" 는 근거로 명시적으로 예고한 것이고, (b) 페이로드(`code`·`message`)를 한 글자도 바꾸지 않는 동일 리터럴의 순수 추출이라 동작 변화가 없으며, (c) `removeMember` 안에서 `assertMembership`/`assertAdmin` 을 그대로 호출하지 못하는 이유(같은 `getMemberRole` 쿼리가 두 번 도는 것 방지)와 직접 연결돼 있어 "무관한 정리" 로 보기는 어렵다. 리스크는 낮지만 diff 범위가 `removeMember` 단일 메서드보다 넓어졌다는 사실 자체는 기록해 둔다.
  - 제안: 조치 불요 — 이미 plan 문서에 근거가 남아 있고 동작 변화가 없다. 후속 리뷰에서 이 두 헬퍼의 시그니처·리터럴이 바뀌면 그때는 "동일 리터럴 순수 추출" 전제가 깨지므로 재검토가 필요하다는 점만 주의.

## 점검 관점별 확인

1. **의도 이상의 변경**: 없음. `git diff origin/main...HEAD` 27개 파일 전량이 (a) `removeMember` 인가 순서 재배치 코드·테스트, (b) 그 변경을 기록하는 CHANGELOG/plan 문서, (c) 이 작업 과정에서 프로젝트 표준 워크플로(`--impl-prep` consistency-check, `/ai-review` 1라운드 + RESOLUTION)가 산출한 `review/consistency/**`·`review/code/**` 산출물이다. CLAUDE.md 가 이 산출물들의 위치·필수성을 명시하므로 "요청 밖 추가 수정" 이 아니다.
2. **불필요한 리팩토링**: 위 INFO 항목 외 없음. `member.role === 'owner'` 검사·DELETE 원자성·`leaveWorkspace` 위임 등 기존 로직은 그대로다.
3. **기능 확장(over-engineering)**: 없음. 새 엔드포인트·새 옵션·새 설정 플래그 없음. plan §E 가 "13개 라우트 구조적 갭" 을 명시적으로 별도 항목으로 갈라 **이번 PR 에서 손대지 않겠다**고 선언한 것은 오히려 스코프를 좁게 유지하려는 규율이다.
4. **무관한 수정**: 없음. `workspaces.controller.ts`·가드·다른 모듈 파일은 diff 에 없다(`git diff --stat` 확인). `spec/` 문서 자체도 이번 diff 에 없음 — stale 서술 3건(`3-error-handling.md`·`1-auth.md`)은 코드를 고치지 않고 planner 백로그로만 등재했다(developer 쓰기 권한 경계를 지킴).
5. **포맷팅 변경**: 실질 변경과 섞인 의미 없는 공백/줄바꿈 변경 없음. `git diff` 전체가 컨텍스트 포함 논리적 변경 라인뿐이다.
6. **주석 변경**: 주석 추가·교체가 있으나 전부 이번 판정 순서 변경을 설명하는 것(§`removeMember` JSDoc, 이른 가드 주석 갱신)이거나 stale 이었던 예고 주석의 정정(테스트 파일 docstring)이다 — 리팩터와 무관한 주석 손질은 없음.
7. **임포트 변경**: 없음. 신규/삭제 import 라인이 diff 어디에도 없다.
8. **설정 변경**: 없음. `package.json`·tsconfig·CI 워크플로 등 설정 파일은 diff 에 포함되지 않았다.

## 요약

`removeMember()` 의 인가 순서 재배치라는 단일 목적에 코드·테스트·문서가 타이트하게 수렴한다. 유일하게 주목할 점은 예외 리터럴을 `throwNotAMember()`/`throwAdminRequired()` 로 추출하면서 `removeMember` 바깥의 기존 `assertMembership`/`assertAdmin` 본문도 함께 바뀐 것인데, 이는 착수 전 plan 에 근거가 명시돼 있고 동일 리터럴의 순수 추출이라 동작 변화가 없어 스코프 이탈로 보기 어렵다. `review/`·`plan/` 산출물은 CLAUDE.md 가 규정한 표준 워크플로(consistency-check → 구현 → ai-review → RESOLUTION)의 필수 산출물이며, 13-라우트 구조적 갭·spec stale 서술 3건은 코드로 고치지 않고 명시적으로 백로그 분리했다 — 오히려 스코프 규율이 잘 지켜진 사례다. 포맷팅·임포트·설정 변경, 무관한 파일 수정은 발견되지 않았다.

## 위험도

NONE
