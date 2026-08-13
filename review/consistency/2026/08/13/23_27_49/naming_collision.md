# 신규 식별자 충돌 검토 — naming_collision

## 검토 불가 판정 (BYPASS)

target 으로 지정된 `spec/5-system/` 영역에 대해 `git diff origin/main...HEAD` 를 절대경로 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`) 기준으로 직접
재실행한 결과, **spec/ 이하 어떤 파일에도 변경이 없다**:

```
$ git diff origin/main...HEAD --stat -- spec/
(빈 출력)
$ git status --porcelain -- spec/
(빈 출력)
```

실제로 `origin/main` 대비 변경된 파일은 전부 `codebase/backend/src/...` 구현 코드와
`plan/in-progress/*.md` 뿐이다:

- `codebase/backend/src/common/utils/assert-row-array.spec.ts`
- `codebase/backend/src/common/utils/update-returning-rows.{ts,spec.ts}` (신규)
- `codebase/backend/src/modules/auth/auth-oauth.service.{ts,spec.ts}`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.{ts,spec.ts}`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.{ts,spec.ts}`
- `plan/in-progress/ie-resume-turn-boundary-cancel.md`
- `plan/in-progress/retry-turn-terminal-guard.md`
- `plan/in-progress/update-returning-tuple-shape.md` (신규)

즉 이번 변경분(`git log origin/main..HEAD`: `76203ad63`, `f56334c10`, `443dd91a6`, `6d3de271d`,
`08d3c7fa3`, `8c0d66e08`, `8332d9a20`)은 **UPDATE 쿼리 튜플 반환 형태 정정 + auth-oauth 회귀 수정
+ 관련 plan 기록**이며, `spec/5-system/` 문서를 전혀 건드리지 않는다. 신규 식별자 충돌 검토의
대상인 "target 문서가 새로 도입하는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV
var·spec 파일 경로"가 이번 변경분에는 **존재하지 않는다**.

이는 과거 관측된 "impl-done spec 번들 버그" 패턴(prompt 상 target 스코프와 실제 diff 가
불일치 — prompt grep 0건)과 동일 유형이다. 프롬프트 헤더는 `eia-r8-cache-scope-4ae434`
워크트리·`spec/5-system/` 스코프를 지목하지만, 해당 워크트리의 실제 체크아웃 브랜치는
`claude/raw-query-audit-followups`이고 이번 세션의 실 변경분은 DB 리턴 타입 버그 수정이다.
새 spec 식별자가 도입되지 않았으므로 본 관점(요구사항 ID/엔티티/endpoint/이벤트/ENV/파일
경로 충돌)에서 점검할 대상 자체가 없다.

### 참고 — 실제 코드 변경의 식별자는 spec 문서 개념이 아님

새로 추가된 `update-returning-rows.ts` 의 export(`assertUpdateReturningRows` 류 헬퍼,
정확한 이름은 파일 참조)는 backend 내부 유틸리티이며 spec 문서가 정의하는 요구사항
ID·엔티티·DTO·endpoint·이벤트·ENV var·spec 파일 경로 네임스페이스와 겹치지 않는다.
이 관점의 점검 대상(spec 이 새로 부여하는 식별자)에 해당하지 않으므로 별도 등급 부여
없음.

## 발견사항

없음 — target 문서(spec/5-system/)에 신규 식별자를 도입하는 변경이 없어 점검 대상이 없다.

## 요약

이번 검토 세션의 target 으로 지정된 `spec/5-system/`은 `origin/main` 대비 실제로는 아무
변경도 없다(diff 0건). 실제 diff 는 backend 구현 코드(UPDATE 쿼리 튜플 반환 형태 버그
수정, auth-oauth 회귀 수정, execution-engine/knowledge-base 갱신)와 plan 문서에 국한되며,
spec 문서가 새로 부여하는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV
var·설정키·spec 파일 경로가 전혀 없다. 따라서 신규 식별자 충돌 관점에서 보고할 발견사항이
없으며, 이는 결함이 아니라 orchestrator 의 target 스코프/워크트리 지정과 실제 세션 diff
가 불일치하는 번들링 문제로 보인다(BYPASS).

## 위험도

NONE
