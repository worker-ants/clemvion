# 신규 식별자 충돌 검토 결과

## 검토 범위 확인

`--impl-prep` 검토 모드로 `spec/5-system/` 폴더가 target 으로 지정되었으나, payload 에 번들된 두 파일(`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`) 중 실제로 이번 세션에서 변경된 것은 `1-auth.md` 뿐이었다(`10-graph-rag.md` 는 cross-reference 용 corpus 로만 포함되어 diff 없음, status 도 이미 `implemented`). `git diff HEAD~5 -- spec/5-system/1-auth.md`로 실제 신규 도입분을 특정한 결과, 이번 변경은 다음 3가지뿐이다.

1. frontmatter `code:` 목록에 3개 파일 경로 추가:
   - `codebase/frontend/src/app/(main)/invitations/accept/**`
   - `codebase/frontend/src/components/auth/register-form.tsx`
   - `codebase/frontend/src/lib/api/invitations.ts`
2. §1.5.3 말미에 안내 문단 1개 추가 — 수락 페이지 경로 `/invitations/accept?token=<초대토큰>` 와 초대 메일 링크 `/auth/register?invitationToken=` 사이의 리다이렉트 관계 설명.

새로 부여되는 요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, 이벤트명, 환경변수는 **없다**. 추가된 것은 모두 기존에 이미 구현·문서화되어 있던 식별자에 대한 포인터/설명 보강이다.

## 충돌 관점별 확인

### 1. 요구사항 ID
신규 ID 부여 없음 (해당 없음).

### 2. 엔티티/타입명
신규 엔티티·DTO 없음. `graph-rag.md` 의 `Entity`/`Relation`/`ChunkEntity` 등은 이번 diff 대상이 아니며 기존 spec 그대로다.

### 3. API endpoint
신규 endpoint 없음. 언급된 `POST /api/workspaces/invitations/accept` 는 `spec/2-navigation/9-user-profile.md:350`, `spec/data-flow/12-workspace.md:19,84` 에 이미 정의된 기존 endpoint 를 그대로 재인용한 것이며, 의미도 동일(로그인 필수, 본인 이메일=토큰 이메일 강제)하다 — 충돌 없음.

### 4. 이벤트/메시지명
관련 없음(이번 diff 에 이벤트 추가 없음).

### 5. 환경변수·설정키
관련 없음.

### 6. 파일 경로 / 프론트엔드 라우트

- **target 신규 참조**: `/invitations/accept?token=<초대토큰>` (프론트엔드 페이지 라우트, §1.5.3 신규 문단)
- **기존 사용처**:
  - 코드: `codebase/frontend/src/app/(main)/invitations/accept/page.tsx`, `accept-invitation-content.tsx`, `__tests__/accept-invitation-content.test.tsx` — 이미 구현·테스트 완료된 라우트
  - 코드 호출부: `codebase/frontend/src/components/auth/register-form.tsx:121` (`` `/invitations/accept?token=${encodeURIComponent(invitationToken)}` ``)
  - spec: `spec/2-navigation/10-auth-flow.md:131` 에 동일 라우트·리다이렉트 조건(`has_session` 힌트 쿠키 판정 포함)이 이미 문서화되어 있음
- **상세**: `1-auth.md` §1.5.3 에 추가된 신규 문단은 `10-auth-flow.md` 가 이미 소유한 동일 사실(라우트 경로, 리다이렉트 조건, `/auth/register?invitationToken=` 관계)을 다시 서술한다. 식별자 자체는 완전히 일치하며 의미 충돌은 없다. 다만 동일 사실이 두 spec 문서(`5-system/1-auth.md` §1.5.3, `2-navigation/10-auth-flow.md` §해당 구간)에 병렬 서술되는 형태라, 추후 한쪽만 갱신되면 미러 stale 위험이 있다(과거 "spec banner flip 시 본문 미러 stale" 패턴과 유사 구조).
- **제안**: 현시점은 두 문단의 서술이 상호 모순 없이 정합하므로 CRITICAL/WARNING 은 아니다. 다만 `1-auth.md` §1.5.3 신규 문단이 `10-auth-flow.md` §7 인근 서술을 가리키는 명시적 상호 포인터(예: "라우트 가드·`has_session` 판정의 SoT 는 auth-flow §7" 식)를 추가하면, 향후 한쪽만 수정되는 drift 를 줄일 수 있다. (강제 조치 아님, INFO 성격)

`code:` frontmatter 에 추가된 3개 경로는 모두 실재 파일이며(확인됨), 다른 spec 문서의 `code:` 목록과 경로가 겹치지 않는다(`invitations.ts`, `register-form.tsx`, `invitations/accept/**` 는 auth 도메인 전용 파일).

## 요약

이번 `spec/5-system/1-auth.md` 변경분은 이미 구현·문서화된 라우트(`/invitations/accept`)와 endpoint(`/api/workspaces/invitations/accept`)에 대한 포인터·설명을 보강한 것으로, 새로 도입되는 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·신규 파일 경로가 전혀 없다. 유일하게 주목할 점은 동일한 라우트/리다이렉트 사실이 `2-navigation/10-auth-flow.md` 와 `5-system/1-auth.md` 두 문서에 병렬 서술된다는 점인데, 현재는 내용이 서로 정합하여 즉각적인 충돌은 아니며 향후 유지보수 시 미러 동기화 누락 위험만 존재한다. 신규 식별자 충돌 관점에서는 이번 변경에 CRITICAL/WARNING 항목이 없다.

## 위험도

NONE
