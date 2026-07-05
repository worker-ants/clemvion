# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/1-auth.md` (diff-base `origin/main` 대비 실제 변경분), 참고로 `spec/5-system/10-graph-rag.md` 및 `spec/conventions/audit-actions.md`·`spec/conventions/cafe24-api-catalog/**` 도 payload 에 동봉됨.

**실제 diff** (`git -C <worktree> diff origin/main -- spec/5-system/`):
- `spec/5-system/1-auth.md` frontmatter `code:` 에 3개 경로 추가: `codebase/frontend/src/app/(main)/invitations/accept/**` · `codebase/frontend/src/components/auth/register-form.tsx` · `codebase/frontend/src/lib/api/invitations.ts`
- §1.5.3 에 blockquote 1개 추가 — `/invitations/accept?token=` 경로·`/auth/register?invitationToken=` 링크 클릭 시 로그인 상태 사용자 리다이렉트 설명

이 diff 범위에서는 정식 규약 위반을 찾지 못했다. frontmatter 에 추가된 3개 코드 경로는 모두 워킹트리에 실존하며 (`Read`/`find` 로 확인), 신규 blockquote 의 리다이렉트 서술은 `register-form.tsx` L106-114 의 실제 로직과 정확히 일치한다 (`invitationToken && useAuthStore.getState().isAuthenticated` → `/invitations/accept?token=` 리다이렉트). `spec-impl-evidence.md` §2.1 의 frontmatter 스키마(`status: partial` + `code:` 배열 + `pending_plans:`)도 그대로 준수한다.

## 발견사항

- **[INFO]** 초대 에러 코드 상수명 스펙-코드 불일치(`INVITATION_ERROR` vs `INVITATION_ERROR_CODES`) — 기존 drift, 본 PR 범위 밖
  - target 위치: `spec/5-system/1-auth.md` §1.5.4 하단 "명명 — historical-artifact 예외" 문단 (프롬프트 L324) 및 `spec/conventions/error-codes.md` §3 레지스트리 표
  - 위반 규약: 엄밀히는 규약 위반이 아니라 문서-코드 명명 정합 문제. `spec/conventions/spec-impl-evidence.md` 의 evidence 원칙(spec 이 code 를 정확히 가리켜야 한다) 취지에 인접
  - 상세: 두 spec 문서 모두 프론트엔드 식별자를 `INVITATION_ERROR_CODES` 로 인용하지만, 실제 `codebase/frontend/src/lib/api/invitations.ts` 의 export 는 `INVITATION_ERROR` (`_CODES` 접미사 없음, `register-form.tsx`·`register-form.test.tsx` 도 동일하게 `INVITATION_ERROR` 사용). `git log -p origin/main` 확인 결과 이 이름은 이번 PR 이전부터 `INVITATION_ERROR` 였다 — 이번 PR 이 새로 만든 drift 가 아니라 기존 drift다. 다만 이번 PR 이 바로 이 파일(`invitations.ts`)을 `1-auth.md` frontmatter `code:` 에 처음 연결했기 때문에, 이 파일을 spec 증거로 공식 링크하는 시점에 부수적으로 노출된 것.
  - 제안: 본 PR 범위에서 수정 불요(diff 무관). 차기 spec 편집 시 `INVITATION_ERROR_CODES` → `INVITATION_ERROR` 로 두 문서(§1.5.4, `error-codes.md` §3)의 인용 표기만 정정 권장. 코드 rename 은 불필요(현재 코드가 맞고 문서가 틀림).

- **[INFO]** `spec/2-navigation/10-auth-flow.md §2.6` 이 신규 blockquote 의 리다이렉트 분기를 아직 반영하지 않음
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 신규 blockquote
  - 위반 규약: 직접적인 conventions 위반은 아님(정보 저장 위치 원칙 — CLAUDE.md "정보 저장 위치" 표 — 과 인접). `1-auth.md` 가 §1.5 초대 흐름의 SoT 이므로 이 자체는 정당한 위치
  - 상세: `spec/2-navigation/10-auth-flow.md §2.6` 은 "미가입자가 메일 링크를 클릭" 케이스만 다루고, "이미 로그인한 사용자가 같은 링크로 진입 시 수락 페이지로 리다이렉트" 케이스는 언급이 없다. 두 문서가 같은 사용자 흐름(가입 페이지 진입)의 다른 조각을 각각 소유하는 구조라 모순은 아니지만, `10-auth-flow.md` 를 읽는 사람은 이 분기를 놓칠 수 있다.
  - 제안: convention-compliance 범위 밖이라 이 checker 는 판단을 유보. consistency-checker(spec 정합성) 트랙에서 cross-link 보강 여부를 판단 권장.

- **[INFO]** `spec/5-system/10-graph-rag.md` 의 이중 섹션 번호 체계 (구조상 사전 존재, 본 PR 무관)
  - target 위치: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 아래 `### 1~8` (PRD 요구사항) 과, 그 뒤 별도 `## 1. 개요` ~ `## 8. 비-목표` (기술 스펙 본문) 이 섹션 번호를 공유
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장과 완전히 어긋나진 않음 — 파일 끝에 `## Rationale` 이 실존함(L587, 직접 확인)을 확인했다. 다만 "Overview 밑에 축약 PRD, 그 아래 본문에 동일 번호 체계 반복"은 다른 spec 문서(예: `1-auth.md`)의 단순 Overview→번호 매김 본문→Rationale 패턴과 대비된다
  - 상세: 이 구조는 이번 PR 의 diff 대상이 아니며(diff 는 `1-auth.md` 만 변경) 기존 파일 그대로다. 명백한 위반이라기보다 문서마다 구조 밀도가 다른 기존 상태를 재확인한 것
  - 제안: 조치 불필요(본 PR 무관). 문서 구조 표준화가 향후 의제라면 별도 project-planner 트랙에서 검토.

## 요약

이번 검토의 실제 diff(`spec/5-system/1-auth.md` 의 frontmatter code: 경로 3건 추가 + §1.5.3 blockquote 1건 추가)는 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반이 없다. 추가된 `code:` 경로는 모두 워킹트리에 실존해 `spec-impl-evidence.md` 의 evidence 원칙을 충족하고, 신규 서술(로그인 상태 사용자의 register→accept 리다이렉트)은 실제 구현(`register-form.tsx`)과 정확히 일치한다. 발견된 사항은 모두 INFO 급으로, (1) 이번 PR 이전부터 존재하던 `INVITATION_ERROR_CODES`(spec) vs `INVITATION_ERROR`(코드) 표기 불일치가 이번에 `code:` 링크로 처음 노출된 점, (2) `10-auth-flow.md` 와의 cross-link 보강 여지, (3) `10-graph-rag.md` 의 사전 존재하는 이중 섹션 번호 구조— 모두 이번 PR 의 diff 범위 밖이거나 정식 규약의 직접 위반이 아니다.

## 위험도

NONE
