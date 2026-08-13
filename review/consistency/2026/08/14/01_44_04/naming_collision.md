# 신규 식별자 충돌 검토 — naming_collision

## 전제 재검증 (impl-done)

prompt_file 이 지목한 target 은 `spec/5-system/`(EIA r8 캐시 스코프 작업을 암시하는 워크트리 경로
`eia-r8-cache-scope-4ae434` 기준)이었으나, 실측 결과 **이 워크트리의 실제 diff 에는
`spec/` 하위 변경이 전혀 없다.**

```
$ git branch --show-current
claude/raw-query-audit-followups

$ git diff origin/main...HEAD --name-only | grep -c '^spec/'
0

$ git diff origin/main...HEAD --stat -- spec/5-system/
(빈 출력)
```

즉 워크트리 디렉터리명(`eia-r8-cache-scope-4ae434`)은 stale 이며, 실제 체크아웃은
`claude/raw-query-audit-followups` 브랜치다(재사용된 워크트리의 이름이 갱신되지 않음).
이 PR 의 실제 diff 는 backend 코드 전용이다:

```
codebase/backend/src/common/utils/{source-scan,assert-row-array,update-returning-rows}.ts(.spec.ts)
codebase/backend/src/modules/auth/auth-oauth.service.ts(.spec.ts)
codebase/backend/src/modules/execution-engine/execution-engine.service.ts(.spec.ts)
codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts(.spec.ts)
codebase/backend/test/auth-oauth-callback.e2e-spec.ts
codebase/backend/tsconfig.build.json
```

이는 `UPDATE … RETURNING` 튜플 형태 결함(raw query 결과가 `[rows, rowCount]` 튜플인데
`rows.length` 로 오판정하던 버그) 수정 + 공용 검증 유틸 신설 + auth-oauth 리팩터로,
**spec 문서의 신규 식별자 도입과 무관한 코드 전용 변경**이다. 실제로 같은 세션에서
`plan/in-progress/update-returning-tuple-shape.md`(2026-08-14 커밋 `103dee234`)에
이 정확한 상황 — "체커가 워크트리 경로에서 EIA r8 캐시 스코프 작업을 추론하고 델타 0 을
보고 검토 전제 자체가 무효라며 CRITICAL 을 낸다" — 이 이미 harness 오탐으로 문서화되어
있다. 코드 전용 PR 에서 spec 델타 0 은 당연한 사실이며 CRITICAL 사유가 아니다.

## 신규 식별자 충돌 분석

target(`spec/5-system/`)에 diff 가 없으므로 **spec 이 새로 도입하는 요구사항 ID·엔티티/
타입명·API endpoint·이벤트명·환경변수·spec 파일 경로가 존재하지 않는다.** 본 checker
의 점검 관점(①~⑥)은 모두 "target 문서가 새로 도입하는 식별자"를 전제로 하므로, 전제가
공집합인 이번 라운드에는 적용할 대상이 없다.

참고로 실제 코드 diff 에서 신규로 등장한 식별자(`source-scan.ts` 의 헬퍼, `assertUpdateReturningRows`
류 `update-returning-rows.ts` export)는 spec 문서가 선언하는 명명 대상이 아니라 backend
내부 유틸리티이며, 기존 spec(`spec/5-system/4-execution-engine.md`, `1-auth.md` 등)의
어떤 기존 식별자와도 이름이 겹치지 않는다(둘 다 신규 파일이며 재사용된 이름 없음).

## 발견사항

없음 — target 스코프(spec/5-system/)에 신규 식별자 도입 자체가 없다.

## 요약

이번 라운드의 target 으로 지목된 `spec/5-system/` 에는 `origin/main` 대비 실제 diff 가
0건이다(워크트리 디렉터리명이 stale 하여 EIA r8 캐시 스코프 작업을 암시하지만, 실제
체크아웃은 무관한 `claude/raw-query-audit-followups` 브랜치이고 PR 은 backend 의
`UPDATE … RETURNING` 튜플 형태 버그 수정 전용 코드 PR 이다). 신규 식별자 충돌 관점에서
검토할 "새로 도입된 식별자"가 존재하지 않으므로 충돌도 없다. 이는 harness 의 stale
워크트리 이름 문제(`plan/in-progress/update-returning-tuple-shape.md` 에 이미 기록됨)로
인한 전제 오염이지, spec 실체의 결함이 아니다.

## 위험도

NONE
