# 신규 식별자 충돌 검토 — naming_collision

## 검토 불가 판정 (BYPASS)

target 으로 지정된 `spec/5-system/` 영역에 대해 `git diff origin/main...HEAD` 를 (절대경로
워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`
자체가 곧 현재 CWD 이므로 그 기준으로) 직접 재실행한 결과, **`spec/` 이하 어떤 파일에도
변경이 없다**:

```
$ git diff origin/main...HEAD --stat -- spec/
(빈 출력)
$ git diff origin/main...HEAD --stat -- spec/5-system/
(빈 출력)
```

`origin/main` 대비 실제로 변경된 전체 파일 목록(`git diff origin/main...HEAD --name-only`,
review 산출물 제외)은 다음뿐이다:

- `codebase/backend/src/common/utils/assert-row-array.spec.ts`
- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` / `.spec.ts`
- `plan/in-progress/ie-resume-turn-boundary-cancel.md` (소급 정정 배너 추가)
- `plan/in-progress/retry-turn-terminal-guard.md` (소급 정정 배너 + 재검증 항목 추가)
- `plan/in-progress/update-returning-tuple-shape.md` (신규 plan)

`git log origin/main..HEAD --oneline` (9 커밋: `8332d9a20`, `8c0d66e08`, `08d3c7fa3`,
`6d3de271d`, `443dd91a6`, `f56334c10`, `76203ad63`, `739272702`, `d8ac4cb07`)은 **UPDATE/DELETE
쿼리의 `[rows, rowCount]` 튜플 반환 shape 정정 + 그로 인한 auth-oauth 소셜 로그인 상시 실패
회귀 수정 + 관련 plan 소급 정정 기록**이며, `spec/5-system/` 문서를 전혀 건드리지 않는다.
신규 식별자 충돌 검토의 대상인 "target 문서가 새로 도입하는 요구사항 ID·엔티티명·API
endpoint·이벤트명·ENV var·config key·spec 파일 경로"가 이번 변경분에는 **존재하지 않는다**
(spec 자체가 안 바뀌었으므로).

이는 과거 관측된 "impl-done spec 번들 버그" 패턴(prompt 상 target 스코프와 실제 diff 가
불일치)과 동일 유형이다. 프롬프트 헤더는 `eia-r8-cache-scope-4ae434` 워크트리·`spec/5-system/`
스코프를 지목하지만, 해당 워크트리의 실제 체크아웃 브랜치는 `claude/raw-query-audit-followups`
이고 이번 세션의 실 변경분은 DB 리턴 타입 버그 수정(코드) + plan 기록이다. 새 spec 식별자가
도입되지 않았으므로 본 관점(요구사항 ID/엔티티/endpoint/이벤트/ENV/파일 경로 충돌)에서
점검할 대상 자체가 없다.

### 참고 1 — 실제 코드 변경의 식별자는 spec 문서 개념과 겹치지 않음

새로 추가된 헬퍼 `updateReturningRows<T>()` (`codebase/backend/src/common/utils/
update-returning-rows.ts`)와 그 자매 헬퍼 `assertRowArray` (기존)는 이름·용도가 backend
내부 유틸리티 레벨에 한정된다. 직접 확인 결과:

- `git grep -n "updateReturningRows"` — 정의 1곳(`update-returning-rows.ts:36`), 소비
  6곳(`auth-oauth.service.ts`, `execution-engine.service.ts` 2곳, `knowledge-base.service.ts`
  4곳), 나머지는 스펙/주석. 기존 이름과 충돌 없음(신규 심볼).
- `codebase/backend/src/common/utils/` 디렉터리 전체 목록에 동명 파일 없음
  (`update-returning-rows.ts` 는 신규 유일 파일).
- 이 헬퍼가 대체하는 것으로 언급되는 `EXECUTION_ADMISSION_RETRY_DELAY_MS` ENV/상수는
  `origin/main` 시점 커밋(`598dca9ab`)에 이미 존재하던 기존 식별자이며 이번 PR 이 새로
  도입한 것이 아니다(재사용, 충돌 아님).

이들은 spec 문서가 정의하는 요구사항 ID·엔티티·DTO·API endpoint·이벤트·ENV var·spec
파일 경로 네임스페이스에 해당하지 않으므로, 이 관점의 점검 대상(spec 이 새로 부여하는
식별자)이 아니다. 별도 등급 부여 없음.

### 참고 2 — 신규 plan 파일 경로 `update-returning-tuple-shape.md`

`plan/in-progress/update-returning-tuple-shape.md` (신규)는 `plan/in-progress/` 의 기존
kebab-case 명명 컨벤션을 따르며, 기존 파일과 이름이 겹치지 않는다(`ls plan/in-progress/`
확인). frontmatter `spec_impact` 는 5개 기존 spec 파일 경로(`spec/5-system/
4-execution-engine.md` 등)를 **참조**만 할 뿐 새 경로를 만들지 않으므로 파일 경로 충돌
관점에서도 문제없다.

## 발견사항

없음 — target 문서(`spec/5-system/`)에 신규 식별자를 도입하는 변경이 없어 점검 대상이
없다. 코드 레벨 신규 식별자(`updateReturningRows`, 신규 유틸 파일 1개, 신규 plan 파일 1개)
도 기존 사용처와 이름이 겹치지 않는다.

## 요약

이번 검토 세션의 target 으로 지정된 `spec/5-system/`은 `origin/main` 대비 실제로는 아무
변경도 없다(diff 0건, `spec/` 전체 기준으로도 0건). 실제 diff 는 backend 구현 코드(UPDATE/
DELETE 쿼리 튜플 반환 shape 버그 수정 7곳, 그로 인한 auth-oauth 소셜 로그인 상시 실패
회귀 수정 1곳)와 plan 문서(소급 정정 배너 2건 + 신규 조사 plan 1건)에 국한되며, spec 문서가
새로 부여하는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·설정키·spec 파일
경로가 전혀 없다. 신규 코드 식별자(`updateReturningRows` 헬퍼, 신규 유틸 파일, 신규 plan
파일)도 grep 으로 직접 확인한 결과 기존 사용처와 이름이 겹치지 않는다. 따라서 신규 식별자
충돌 관점에서 보고할 CRITICAL/WARNING/INFO 급 발견사항이 없으며, 이는 결함이 아니라
orchestrator 의 target 스코프 지정과 실제 세션 diff 가 불일치하는 번들링 특성으로 보인다
(BYPASS, 직전 세션 `23_27_49` 판정과 일치).

## 위험도

NONE
