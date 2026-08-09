# 신규 식별자 충돌 검토 — spec-draft-canary-count-relation

## 검토 범위 참고

프롬프트 번들에는 컨텍스트 예산 초과로 `spec/5-system/1-auth.md`·`spec/data-flow/12-workspace.md`
(target 이 직접 수정하는 두 파일)가 **생략**돼 있었다. "여기 없다는 사실을 '해당 내용이 없다'의
근거로 삼지 말라"는 번들 자체 경고에 따라 두 파일을 저장소에서 직접 `Read`로 열어 대조했다
(`spec/5-system/1-auth.md:773-812` §부트 캐너리, `spec/data-flow/12-workspace.md:313-348`
§멤버십 검증은 가드 1곳에서).

## 발견사항

없음.

target(`plan/in-progress/spec-draft-canary-count-relation.md`)은 **새 식별자를 하나도 도입하지
않는다** — `1-auth.md` §부트 캐너리 (a) 안, 기존 문장("단언 대상은 라우트 목록이 아니라 '0건이
아님'") 뒤·"알려진 한계" 앞에 **설명 문단(blockquote) 하나를 삽입**할 뿐이다. 6개 점검 관점을
모두 대조했다:

1. **요구사항 ID** — 신규 ID 없음(예: `AUTH-*` 류 부여 없음).
2. **엔티티/타입명** — 신규 타입·DTO·인터페이스 없음. 문단이 언급하는 `handlerConsumesWorkspaceId`
   (`1-auth.md:781,793`)와 `73건`(`data-flow/12-workspace.md:319` 최초 정의)은 **기존에 이미
   정의된 용어를 재인용**할 뿐이며, target 문서 자신이 "구체 수치는 여기 적지 않는다"고 명시해
   새 숫자(예: 142건)를 spec 에 박지 않는다.
3. **API endpoint** — 없음.
4. **이벤트/메시지명** — 없음. 인용한 로그 문자열 `` `@WorkspaceId() 소비 라우트 N건 인식` `` 은
   실제 구현(`codebase/backend/src/common/decorators/workspace-reflection-canary.ts:119-120`,
   `` `@WorkspaceId() 소비 라우트 ${count}건 인식 — RolesGuard 멤버십 검증 대상 판별 정상.` ``)과
   일치하며 새 메시지를 만들지 않는다.
5. **환경변수·설정키** — 없음.
6. **파일 경로** — plan 파일 경로 `plan/in-progress/spec-draft-canary-count-relation.md` 는
   기존 `spec-draft-<slug>.md` 명명 컨벤션(`plan/complete/spec-draft-*.md` 49건, `plan/in-progress/`
   1건 기존)과 일치하고 겹치는 파일명도 없다. target 이 편집하는 대상도 새 파일이 아니라
   기존 `spec/5-system/1-auth.md` 의 기존 섹션이다.

"부트 캐너리"·"73건" 두 용어를 `spec/`·`plan/in-progress/` 전체에서 grep 했을 때도 전부 같은
의미(부트 시점 `@WorkspaceId()` reflection 자가검증 / `@Roles()` 부재 라우트 부분집합 크기)로만
쓰이고 있어 의미 충돌이 없다.

## 요약

target 은 새 요구사항 ID·엔티티·엔드포인트·이벤트·환경변수·파일을 전혀 도입하지 않고, 기존
`1-auth.md` §부트 캐너리 섹션에 이미 정의돼 있는 용어(`handlerConsumesWorkspaceId`, `73건`)를
그대로 재인용하며 포함관계를 설명하는 문단 하나만 추가한다. 신규 식별자 충돌 관점에서는 검토
대상이 사실상 없으며, 실제 코드 로그 문자열·plan 파일 명명 컨벤션과도 정확히 일치한다.

## 위험도

NONE
