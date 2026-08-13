# 신규 식별자 충돌 검토 — naming_collision

## 검토 전제 확인 (impl-done, scope=`spec/5-system/`, diff-base=`origin/main`)

실측 결과, `spec/5-system/` 는 `origin/main`(598dca9ab)과 현재 HEAD(6416d5bb9, 이 세션이 작업한
`update-returning-tuple-shape`/`retry-turn-terminal-guard` 브랜치) 사이에 **변경분이 0**이다
(`git diff origin/main..HEAD --stat -- spec/5-system/` 출력 없음, 파일 목록도 완전히 동일).

이 PR 은 `codebase/backend/src/common/utils/{assert-row-array,update-returning-rows}.ts`,
`auth-oauth.service.ts`, `execution-engine.service.ts`, `knowledge-base.service.ts`,
`__test-utils__/source-scan.ts` 등 **코드 전용 변경**이며 spec/ 을 전혀 건드리지 않는다.
prompt 에 실린 `spec/5-system/1-auth.md`·`3-error-handling.md` 등의 전문은 이 PR 이 새로
도입한 내용이 아니라 기존(=`origin/main`과 동일한) spec 본문이다.

**주의(과거 오탐 재발 방지)**: 같은 워크트리(`eia-r8-cache-scope-4ae434`)가 이미 이전 작업에서
다른 브랜치(`claude/raw-query-audit-followups`)로 재사용된 것이 `plan/in-progress/update-returning-tuple-shape.md`
에 기록돼 있다 — 워크트리 절대경로에서 "EIA r8 캐시 스코프" 작업을 추론해 "target 델타 0 =
검토 전제 무효" 로 CRITICAL 을 내는 것은 4라운드 중 2회 발생한 **확인된 오탐 패턴**이다. 코드
전용 PR 에서 spec 델타 0은 당연한 사실이므로 본 리포트는 이를 CRITICAL 로 취급하지 않는다.

## 발견사항

target(`spec/5-system/`)이 이번 PR 에서 새로 도입한 요구사항 ID·엔티티/DTO/인터페이스명·API
endpoint·이벤트/메시지명·환경변수/설정키·spec 파일 경로가 **없다** — 따라서 위 6개 점검 관점
모두 "신규 식별자" 자체가 존재하지 않아 충돌 여지가 없다.

참고 삼아 이번 PR 이 실제로 새로 도입한 코드 레벨 식별자(`assertRowArray`(기존 확장) /
`updateReturningRows`(신규 export, `codebase/backend/src/common/utils/update-returning-rows.ts`))
를 spec/plan 코퍼스에서 교차 확인했으나, 두 이름 모두 `spec/**` 에는 전혀 등장하지 않고
`plan/in-progress/update-returning-tuple-shape.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md`
에서만 참조된다. 이들은 내부 유틸리티 헬퍼 함수명으로 spec 표면(요구사항 ID·엔티티명·API
endpoint·이벤트명·env var·spec 파일 경로) 어디에도 해당하지 않아 본 checker 의 점검 대상이
아니다. 충돌 없음.

- **[INFO]** target 델타 0 — 코드 전용 PR
  - target 신규 식별자: 없음 (`spec/5-system/` 는 `origin/main` 대비 무변경)
  - 기존 사용처: N/A
  - 상세: 이 PR 은 raw `UPDATE`/`DELETE RETURNING` 튜플 처리 버그 수정(`update-returning-rows.ts`
    신설, `auth-oauth.service.ts`/`execution-engine.service.ts`/`knowledge-base.service.ts` 소비부
    정정)과 테스트 유틸(`source-scan.ts`) 정리로 구성된 코드 전용 변경이다. `spec/5-system/` 를
    스코프로 하는 naming_collision 점검은 신규 식별자가 없어 원천적으로 발견할 것이 없다.
  - 제안: 없음. (참고: 이 워크트리 이름이 stale 하다는 사실이 이미 `plan/in-progress/update-returning-tuple-shape.md`
    에 harness 후속 항목으로 기록되어 있다 — orchestrator 측 조치 대상이며 본 리뷰의 범위 밖이다.)

## 요약

이번 impl-done 검토 대상 스코프(`spec/5-system/`)는 `origin/main` 대비 실제 diff 가 없는 코드
전용 PR이며, target 문서가 새로 도입한 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·
spec 파일 경로가 전혀 없으므로 신규 식별자 충돌 관점에서 발견할 사항이 없다. PR 이 코드
레벨에서 새로 export 한 `updateReturningRows` 등의 헬퍼명도 spec 표면과 무관하며 기존 사용처와
겹치지 않는다.

## 위험도
NONE
