# 신규 식별자 충돌 검토 — `spec/5-system/` (`--impl-done`, `trigger-lock-followups`)

## 스코프에 대한 메모

`--impl-done` scope(`spec/5-system/`)의 diff 델타는 **0개 파일** — 이 브랜치는 spec 을 바꾸지
않았다(정상, 코드 전용 PR). 실제 구현 diff 는 `codebase/backend/src/modules/triggers/**` ·
`codebase/backend/src/modules/schedules/schedules.service.spec.ts` 5개 파일 346줄이며,
target 프롬프트에서 예산 절단되어 있어 워킹트리를 절대경로로 직접 열어(`git diff
origin/main...HEAD -- codebase/backend/...`) 재확인했다.

이번 PR 이 도입하는 신규 식별자는 다음 넷뿐이다 — 나머지는 기존 코드의 동작 수정/주석
정정이며 새 이름을 만들지 않는다.

1. `MIN_LOCK_TIMEOUT_MS` / `MAX_LOCK_TIMEOUT_MS` (모듈 상수, `trigger-config-lock.ts`)
2. `toLockTimeoutMs()` (모듈 함수, 동일 파일)
3. `findByIdForPatchValidation` (private 메서드, `triggers.service.ts` — `findByIdForUpdate`
   에서 개명)

이 개명은 직전 `--impl-prep` 검토(`review/consistency/2026/09/15/08_58_18/naming_collision.md`
WARNING)가 지적한 항목의 후속 조치다 — 아래에서 그 지적이 실제로 어떻게 해소됐는지 검증한다.

## 발견사항

- **[없음]** 직전 WARNING(`findByIdForUpdate` 개명 대상 미확정)은 해소됨 — 재확인 결과 신규 충돌 없음
  - target 신규 식별자: `findByIdForPatchValidation` (`codebase/backend/src/modules/triggers/triggers.service.ts:542`)
  - 기존 사용처 재검증:
    - `grep -rn "findByIdForPatchValidation" codebase/backend/src` → 선언 1건 + 호출 1건 +
      JSDoc 언급 1건, 전부 이 파일 안. 다른 클래스·모듈에 동명 식별자 없음.
    - `grep -rn "ForUpdate\b" codebase/backend/src --include="*.ts"` → 잔존 0건(개명 완료,
      옛 이름은 JSDoc 본문의 역사적 언급으로만 1곳 남음).
    - 직전 리뷰가 경계했던 "Lock/Locked/Unlocked 계열 어휘로 재발" 함정 — 채택된 이름에
      `Lock` 계열 토큰 없음. 확인.
    - 직전 리뷰가 예시로 제안했던 `findByIdForPatchPrecheck` 는 **채택되지 않았다**. plan
      문서(`plan/in-progress/trigger-lock-followups.md` §"명명 결정")가 그 이유를 실측으로
      남겼다 — `Precheck` 은 이 저장소에서 Cafe24/MakeShop mall-id 사전검증 전용 어휘
      (`PrecheckResultDto`·`MallIdPrecheck`·`MakeshopPrecheckQueryDto`)이고, 독립 검증
      결과도 일치한다: `grep -rln "Precheck" codebase/backend/src` → 5개 파일
      (`triggers.service.ts` 자신 제외 4개는 전부 `integrations/**`). 채택 이름
      `findByIdForPatchValidation` 은 grep 0건으로 특정 도메인 계열과 겹치지 않음.
    - 접미 패턴 선례 `AuthConfigsService.findByIdForResponse` (`auth-configs.service.ts:144`)
      와는 목적어가 다르므로(`Response` vs `PatchValidation`) 의미 재사용 없이 관용구만
      공유 — 혼동 아님.
  - 상세: 개명이 원 결함(잠금 어휘를 흉내 내지만 잠그지 않는 이름)을 해소했고, 대체 이름이
    새로운 충돌(진짜 advisory lock 함수군·SQL `FOR UPDATE` 7파일·`Precheck` 계열)을 만들지
    않음을 grep 전수로 확인했다.
  - 제안: 없음(현행 유지).

- **[없음]** `rewriteTriggerConfigLocked` 의 `affected` 판정 추가가 `RESOURCE_NOT_FOUND` 리터럴을 재중복시키지 않음
  - target 신규 식별자: 없음(기존 `throwTriggerNotFound()` 재사용)
  - 재검증: `grep -n "wrote\|throwTriggerNotFound\|RESOURCE_NOT_FOUND" triggers.service.ts` →
    `if (!wrote) this.throwTriggerNotFound();` (1354행), `if (!wroteInteraction)
    this.throwTriggerNotFound();` (1167행) 등 모든 `rewriteTriggerConfigLocked` 호출부가
    기존 헬퍼를 그대로 재사용한다. 인라인 `RESOURCE_NOT_FOUND` 리터럴 신규 추가 0건.
  - 상세: 직전 검토의 INFO 우려("같은 리터럴이 다섯 번째 자리로 재발")가 실제로는 발생하지
    않았음을 diff 로 확인.
  - 제안: 없음.

- **[없음]** `MIN_LOCK_TIMEOUT_MS`/`MAX_LOCK_TIMEOUT_MS`/`toLockTimeoutMs` — 신규 모듈-로컬 식별자, 충돌 없음
  - target 신규 식별자: `MIN_LOCK_TIMEOUT_MS`·`MAX_LOCK_TIMEOUT_MS`·`toLockTimeoutMs`
    (`trigger-config-lock.ts`, 모두 파일 내부 전용·미export)
  - 기존 사용처: `grep -rn "LOCK_TIMEOUT_MS\|toLockTimeoutMs" codebase/backend/src` → 세
    식별자 모두 이 파일에만 존재. 기존 `export const TRIGGER_DELETE_LOCK_TIMEOUT_MS`(다른
    이름, 다른 역할 — 삭제 경로의 대기 상한 vs 이번 항목의 SQL clamp 하/상한)와 접두사
    `LOCK_TIMEOUT`을 공유하지만 별개 토큰이라 혼동 위험 낮음. ENV var 아님(하드코딩 상수) —
    환경변수 축과도 무관.
  - 제안: 없음.

- **[INFO]** 신규 plan 트래커 파일·CHANGELOG 항목 — 파일 경로·이름 충돌 없음
  - target 신규 식별자: `plan/in-progress/trigger-lock-followups.md`
  - 기존 사용처: `find plan -iname "*trigger-lock*"` → 이 파일 하나뿐. `plan/complete/`
    에도 동명 파일 없음(전신 작업은 `trigger-config-lost-update.md` 로 이미 다른 이름).
    frontmatter `spec_impact: none` 도 실제 diff(spec 델타 0)와 일치.
  - 상세: 명명 컨벤션(`plan/in-progress/<name>.md`)을 그대로 따름. 신규 REST endpoint·
    webhook/queue/SSE 이벤트명·요구사항 ID 는 이번 5개 코드 파일 diff 어디에도 없음(재확인:
    `git diff origin/main...HEAD -- codebase/backend/src/modules/triggers codebase/backend/src/modules/schedules`
    전문에 `POST/GET/PATCH/DELETE` 경로 신설, 신규 audit action, 신규 이벤트명 없음).
  - 제안: 없음.

## 요약

이번 target 의 실질 diff(`trigger-config-lock.ts`·`triggers.service.ts`·관련 spec/mock
3파일, 346줄)는 정확히 직전 `--impl-prep` naming_collision 검토가 예방적으로 지적했던
"`findByIdForUpdate` 개명 시 대체 이름이 다시 충돌할 위험"에 대한 후속 조치이며, 그 우려는
해소됐다 — 채택된 `findByIdForPatchValidation` 은 (a) `Lock` 계열 어휘를 피해 진짜 advisory
lock 함수군·SQL `FOR UPDATE` 7파일과 재혼동되지 않고, (b) 리뷰어가 예시로 든
`findByIdForPatchPrecheck` 도 스스로 배제해(저장소 내 `Precheck` 이 Cafe24/MakeShop
mall-id 전용 어휘임을 실측) 그 함정도 피했다. 신규로 추가된 다른 세 식별자
(`MIN_LOCK_TIMEOUT_MS`·`MAX_LOCK_TIMEOUT_MS`·`toLockTimeoutMs`)는 모두 파일-로컬이고
grep 전수 확인 결과 기존 사용처와 겹치지 않는다. `RESOURCE_NOT_FOUND` 리터럴 재중복 우려도
기존 `throwTriggerNotFound()` 재사용으로 실제 발생하지 않았다. 새 spec ID·API endpoint·
이벤트명·ENV var·spec 파일 경로는 이번 PR 에 존재하지 않는다(diff 전수 확인). 확정된 충돌
없음.

## 위험도

NONE
