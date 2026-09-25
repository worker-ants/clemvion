# 신규 식별자 충돌 검토 — `spec-draft-workspace-path-guard-role-census.md`

## 검토 개요

target 문서는 같은 PR 의 spec 커밋(`e2e257707`)이 `spec/data-flow/12-workspace.md` §Rationale
«가드 거부의 오류 코드» 에 적은 `@Roles()` 라우트 수(`editor` 66 · `admin` 9 · `owner` 7 · `viewer`
5)를 실측으로 재검증하고 정정하는 **순수 수치 정정 plan** 이다. 실제 spec 파일을 확인한 결과
(`spec/data-flow/12-workspace.md:415, 420`) target 이 인용한 전/후 문구는 현재 본문과 정확히 일치한다.

target 이 손대는 대상은 다음 두 자리뿐이다:
- 415행 `(2026-09-25 실측: editor 66 · admin 9 · owner 7 · viewer 5)` → 취소선 + 정정 수치(63/9/3/4, 합 79 → 88)
- 420행 `editor 라우트 66곳` → 취소선 + `63곳`

두 편집 모두 **기존 문장에 이미 존재하는 숫자를 고치는 것**이며, 새 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수·설정키를 전혀 도입하지 않는다. `EDITOR_REQUIRED`/`ADMIN_REQUIRED`/
`OWNER_REQUIRED` 오류 코드도 target 이 새로 만드는 것이 아니라 같은 절 410행에 이미 정의돼 있는
기존 식별자를 그대로 인용할 뿐이다.

## 관점별 점검

1. **요구사항 ID 충돌** — target 은 새 ID를 부여하지 않는다(해당 없음).
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 없음(해당 없음).
3. **API endpoint 충돌** — 새 endpoint 없음. 인용된 `POST /api/workspaces/:id/transfer-ownership` 등은
   기존 spec 표(140행)에 이미 정의된 것을 그대로 참조한다(해당 없음).
4. **이벤트/메시지명 충돌** — 없음(해당 없음).
5. **환경변수·설정키 충돌** — 없음(해당 없음).
6. **파일 경로 충돌** — target plan 파일 경로는
   `plan/in-progress/spec-draft-workspace-path-guard-role-census.md` 다. 같은 PR 계열의 기존 산출물
   (`plan/complete/spec-draft-workspace-path-guard.md`, `plan/complete/spec-draft-workspace-path-guard-followup.md`,
   `plan/complete/spec-draft-workspace-path-guard-oracle-census.md`)과 이름이 겹치지 않으며,
   `<slug>-<census 종류>` 명명 패턴(`oracle-census` ↔ `role-census`)을 그대로 따른다. `oracle-census`
   문서는 §Rationale «경로 파라미터 워크스페이스도 가드가 본다» (존재·유형 오라클 메서드 수)를 다루고,
   target 은 §Rationale «가드 거부의 오류 코드» (라우트 수)를 다뤄 대상 섹션이 서로 다르다 — 파일명
   유사성이 내용 혼동으로 이어지지 않는다. 신규 spec 파일 생성도 없다(기존 `spec/data-flow/12-workspace.md`
   수정뿐).

## 발견사항

없음. target 은 신규 식별자를 도입하지 않는 순수 수치 정정이며, 위 6개 관점 모두에서 충돌 후보가
발견되지 않았다.

## 요약

target 문서는 기존 spec 문장 속 숫자(66/9/7/5 → 63/9/3/4, 66곳 → 63곳)만 취소선+정정 방식으로
고치는 정정 plan 으로, 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키를
전혀 도입하지 않는다. 유일한 신규 산출물인 plan 파일 경로도 같은 PR 계열의 기존 명명 컨벤션
(`spec-draft-workspace-path-guard-<census 종류>.md`)을 그대로 따르며 기존 파일과 경로가 겹치지
않는다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도

NONE
