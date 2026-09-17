# 정식 규약 준수 검토 — `spec/5-system/` (--impl-done)

## 점검 개요

- **검토 모드**: 구현 완료 후 검토(`--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`).
- **scope(`spec/5-system/`) 델타**: 0개 파일 — 이 PR 은 spec 을 바꾸지 않았다(코드 전용 PR, 정상).
- **실제 구현 diff**: `codebase/` 5개 파일 · 346줄. prompt 번들의 `<git diff origin/main...HEAD -- code_areas>` 항목은 예산 절단으로 본문이 생략돼 있어, `git -C <워킹트리> diff origin/main...HEAD -- codebase/` 를 직접 실행해 전문을 확보하고 그것을 1차 근거로 썼다.
  - `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (핵심 변경)
  - `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts`
  - `codebase/backend/src/modules/triggers/triggers.service.ts` (`findByIdForUpdate` → `findByIdForPatchValidation` rename)
  - `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
  - `codebase/backend/src/modules/schedules/schedules.service.spec.ts`
- 부수적으로 `CHANGELOG.md`·`plan/in-progress/trigger-lock-followups.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`·`review/**` 산출물도 diff 에 포함되나, 정식 규약(`spec/conventions/**`) 적용 대상은 코드 5개 파일이다.

## 확인 절차

1. `review-citations.md` — diff 안의 모든 리뷰 인용(`` `/ai-review` `review/code/2026/09/15/01_42_04` ... ``, `` `--impl-done` `review/consistency/2026/09/15/01_44_29` naming_collision W4 `` 등 8건)을 전수 확인. 전부 **전체 경로 + 날짜** 형태(§2 "권장" 등급)이고 bare `hh_mm_ss` 는 0건. 인용된 세션 디렉터리(`review/code/2026/09/15/01_42_04`, `review/consistency/2026/09/15/01_44_29`, `review/code/2026/09/14/21_18_21`, `review/code/2026/09/14/20_49_15`, `review/code/2026/09/14/20_17_16`, `review/code/2026/09/15/09_30_03`)가 워킹트리에 실재하는지 `find`/`ls` 로 대조 — 전부 존재.
2. `redis-keys.md` §1·§4 — 신규 상수 `TRIGGER_CONFIG_LOCK_PREFIX = 'trigger-config'`(`triggerConfigLockKey`)가 `{도메인}:{식별자}` 꼴이라 Redis 키와 겉모양이 같은지 확인. `trigger-config-lock.ts` 자신의 JSDoc(L6-17)이 이미 "이 문자열은 Redis 키가 아니다 — Postgres `pg_advisory_xact_lock(hashtext(...))` 의 입력 문자열이고 §4(인접 네임스페이스)가 막으려는 혼동과 정확히 같다" 고 명시하고, §4 미등재 상태(이 계열 + 자매 `exec-cap:<workspaceId>`)를 `--impl-prep review/consistency/2026/09/14/17_10_16 naming_collision WARNING#2` 로 이미 지목해 planner 항목으로 넘겼음을 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4463행 부근, planner 표 #2)에서 교차 확인.
3. `naming_collision W4`(`review/consistency/2026/09/15/01_44_29`) 이 지목한 `findByIdForUpdate` → `findByIdForPatchValidation` rename 이 실제로 반영됐는지, 그리고 새 이름이 저장소 다른 곳과 충돌하지 않는지 `git grep -n "findByIdForPatchValidation"` 로 확인 — `triggers.service.ts` 1곳뿐, 충돌 없음.
4. `*ForUpdate`/`FOR UPDATE` 관용구가 이 저장소에서 정말 "행 잠금"을 뜻하는지 `git grep -ln "ForUpdate\|FOR UPDATE" codebase/backend/src` 로 재검증 — `webauthn.service.ts`·`ai-turn-orchestrator.service.ts`(+spec)·`engine-driver.interface.ts`·`execution-engine.service.ts`(+spec)·`integration-oauth.service.ts` 등 실제 행 잠금 문맥에서만 쓰임을 확인, JSDoc 의 "7개 파일" 서술과 부합.
5. `Precheck` 어휘가 정말 Cafe24/MakeShop mall-id 사전검증 전용인지 `git grep -ln "Precheck" codebase/` 로 확인 — `integrations/**`·`use-cafe24-mall-id-precheck.ts`·`use-makeshop-shop-uid-precheck.ts` 등에서만 쓰여 JSDoc 주장과 일치, 근거 없는 rationale 아님.
6. 이 diff 가 `error-codes.md`·`swagger.md`·`audit-actions.md`·`migrations.md`·`secret-store.md` 가 규율하는 표면(신규 에러 코드·DTO·감사 액션·마이그레이션·secret 저장 코드)을 새로 만들거나 바꾸는지 확인 — 5개 파일 모두 내부 lock/조회 함수·테스트뿐이라 해당 없음.
7. `spec-impl-evidence.md` R-8(Gate C) — `plan/in-progress/trigger-lock-followups.md` frontmatter `spec_impact: none` 이 유효한 sentinel 값인지 확인 — 규약이 정의한 허용값(`none`/`없음`/`n/a`/`na`) 중 하나로 정합.

## 발견사항

이번 패스에서 CRITICAL/WARNING 급 위반은 발견하지 못했다.

- **[INFO]** advisory lock 키 접두어의 `redis-keys.md §4` 미등재 — 이 PR 이 만든 갭 아님, 조치 불요
  - target 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` L6-17 (`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 위반 규약: `spec/conventions/redis-keys.md` §4 (Redis 키가 아닌데 형태가 비슷한 것 — 인벤토리 등재 의무는 §5)
  - 상세: `trigger-config:<id>` 는 Redis 키가 아니라 Postgres advisory lock 입력 문자열이라 §4 "인접 네임스페이스"에 해당하지만, 현재 §4 표에는 등재돼 있지 않다(자매 사례 `exec-cap:<workspaceId>` 도 마찬가지). 다만 이 갭은 이 PR 이전부터 있었고, 이 PR 은 그 갭을 **스스로 지목**해 코드 주석에 남기고 `--impl-prep review/consistency/2026/09/14/17_10_16 naming_collision WARNING#2` 인용과 함께 planner 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재했다. `spec/` 은 developer 쓰기 범위 밖(CLAUDE.md Skill 체계)이라 이 PR 자신이 §4 를 갱신하는 것은 오히려 경계 위반이 된다.
  - 제안: 조치 불요 — 이미 올바른 경로(planner 턴)로 넘겨졌다. project-planner 세션에서 `redis-keys.md §4` 에 `trigger-config:<id>`·`exec-cap:<workspaceId>` 두 계열을 함께 등재할 때 참고.

- **[INFO]** 리뷰 인용 형식 정합 (positive finding)
  - target 위치: `trigger-config-lock.ts`·`trigger-config-lock.spec.ts`·`triggers.service.ts`·`trigger-transaction-mock.ts` 전반의 `` `/ai-review` ``·`` `--impl-done` ``·`` `--impl-prep` `` 인용 8건
  - 위반 규약: 없음 — `spec/conventions/review-citations.md` §1~§3 정합 확인
  - 상세: 전부 "전체 경로"(`review/code/2026/09/15/01_42_04` 등) 형태로 §2 표의 **권장** 등급을 만족하고, 지적 번호(`W4`·`INFO#2`·`INFO#16`·`INFO#17`·`INFO#19`·`WARNING#2`·`WARNING#5`·`WARNING#6`)까지 함께 적어 §3 "적용 범위"가 요구하는 수준(맥락 없이 읽혀도 스스로 해소)을 넘어선다. `codebase/**` 는 §3 표에서 "적용" 대상이므로 이 관례를 지키는 것이 의무인데, bare `hh_mm_ss` 형태는 0건이었다.
  - 제안: 조치 불요.

- **[INFO]** rename 이 만든 새 식별자 충돌 부재 (positive finding)
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`findByIdForUpdate` → `findByIdForPatchValidation`)
  - 위반 규약: 없음 — 명명 규약 위반 없음을 확인
  - 상세: 새 이름은 저장소 전체에서 이 1곳에서만 쓰이고(`git grep` 0건 추가 충돌), `*ForUpdate`/`FOR UPDATE` 가 실제 행 잠금을 뜻하는 7개 파일과의 혼동(`--impl-done review/consistency/2026/09/15/01_44_29 naming_collision W4`)을 해소한다. 제안됐던 `…ForPatchPrecheck` 대신 `…ForPatchValidation` 을 택한 근거(`Precheck` 은 Cafe24/MakeShop mall-id 사전검증 전용 어휘)도 실측(`git grep -ln "Precheck"`)과 일치해 근거 없는 rationale 이 아니다.
  - 제안: 조치 불요.

## 요약

이번 diff(`codebase/` 5개 파일·346줄)는 트리거 config advisory lock 의 내부 함수·테스트만 다루는 backend 전용 리팩터링이며, 신규 API 엔드포인트·DTO·에러 코드·감사 액션·Redis 키·마이그레이션을 만들지 않아 `error-codes.md`·`swagger.md`·`audit-actions.md`·`redis-keys.md`(직접 등재 축)·`migrations.md`·`secret-store.md` 의 적용 표면과 접점이 없다. 유일하게 접점이 있는 `redis-keys.md §4`(인접 네임스페이스 등재 의무)는 이 PR 이전부터 있던 갭이고, 이 PR 은 그것을 스스로 지목해 developer 쓰기 범위(`codebase/**`)를 넘지 않는 방식으로 planner 백로그에 정확히 위임했다. `review-citations.md` 는 코드 주석 8곳 전부 전체 경로+날짜 형태로 정합했고, 실제 세션 디렉터리 존재까지 대조했다. 명명(`findByIdForPatchValidation`) rename 은 저장소 전수 확인 결과 신규 충돌이 없고 rationale 도 실측과 일치한다. `spec_impact: none` frontmatter 도 `spec-impl-evidence.md` R-8 이 정의한 유효 sentinel 이다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
