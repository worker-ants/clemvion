# Cross-Spec 일관성 검토 — `spec/5-system` (--impl-prep, 재실행)

## 검토 전제

이번 target 은 신규/수정 draft 가 아니라 `spec/5-system` 디렉터리 전체(기존 merge 된 SoT)다.
연결된 작업(`plan/in-progress/race-helper-guard-tests.md`)은 `spec_impact: none` — `raceUnderHeldLock`
의 순수 동기 분기 둘(`fires.length < 2` 가드·`KNOWN_LOCK_TIMEOUTS_MS` 검사)을 순수 함수로 뽑아
`codebase/backend/src/shared/testing/overlap-preconditions.ts` + self-spec 으로 옮기고
`test/helpers/concurrency.ts` 는 호출만 하도록 바꾸는 test-harness 전용 작업이다.

**본 호출은 동일 세션의 직전 `--impl-prep` 실행(`review/consistency/2026/09/21/22_25_20/cross_spec.md`)의
재실행이다.** 그 라운드는 `plan_coherence` 가 Critical 로 BLOCK 했고(선례 오판), cross-spec 관점
자체는 이미 NONE 으로 수렴했다. 재실행 전 `git diff --stat origin/main...HEAD -- spec/ codebase/`
로 확인한 결과 두 라운드 사이 `spec/**`·`codebase/**` 변경은 **0줄**이다(달라진 것은
`plan/in-progress/race-helper-guard-tests.md` 신설과 리뷰 산출물뿐). 즉 cross-spec 이 판단할 대상
문서 자체가 이전 라운드와 바이트 단위로 동일하므로, 이전 결론을 재사용할 근거가 있다 — 다만
근거 없이 복사하지 않고 핵심 교차 참조 1건(`REAUTH_NOT_AVAILABLE` 에러 코드 카탈로그, `1-auth.md`
↔ `3-error-handling.md`)을 재조회해 문구가 여전히 일치함을 재확인했다.

## 검토 범위와 한계

prompt 번들은 이번에도 컨텍스트 예산 초과로 `spec/5-system/1-auth.md`·`2-api-convention.md`·
`3-error-handling.md` 세 파일만 전문을 포함했고, 나머지 15개 파일(4-execution-engine·
6-websocket-protocol·14-external-interaction-api 등)과 `spec/1-data-model.md` 를 포함한 대다수
"관련 spec" 도 절단됐다(이미 알려진 반복 이슈, `feedback_consistency_spec_mode_budget` 계열).
절단 사실을 "충돌 없음" 의 근거로 쓰지 않았다 — 전문이 확보된 3개 파일과, 그 파일이 실제로
참조하는 교차 지점(에러 코드 카탈로그·RBAC·감사 액션)만 확인 범위로 좁혔다.

## 확인한 교차 참조

- **에러 코드 카탈로그** — `1-auth.md` 가 사용하는 `REAUTH_NOT_AVAILABLE`(403)·`REAUTH_REQUIRED`
  (400)·`PASSWORD_INVALID`(401)·`TOTP_INVALID`(401) 는 `3-error-handling.md:63` 의 공용 카탈로그
  항목과 코드·status·발행 조건·역참조 링크가 일치함을 grep 으로 재확인.
- **테스트 하네스 배치 계층 책임** — 착수 예정 변경은 `codebase/backend/src/shared/testing/*.ts`
  (순수 함수 + self-spec)와 `codebase/backend/test/helpers/concurrency.ts` 호출부뿐이다.
  `spec/conventions/**` 에는 테스트 러너·헬퍼 배치를 규율하는 문서가 없고(선례는 5쌍 모두 코드
  트래커·`PROJECT.md` 관례로만 관리), `spec/5-system/2-api-convention.md` 의 `code:` frontmatter
  도 `shared/testing/response-contract*.ts`·`swagger-probe*.ts`·`user-secret-absence*.ts` 세
  패턴만 열거하고 `overlap-preconditions*.ts` 는 어느 spec 문서의 `code:` glob 에도 명시적으로
  걸리지 않는다. 이는 spec 계층 간 책임 충돌이 아니라 **애초에 spec 소관 밖의 순수 테스트
  유틸리티**라는 뜻이며, 새 파일이 기존 어떤 spec 의 code-frontmatter 서술과도 모순되지 않는다.
- **감사·RBAC 등 도메인 서술** — 이번 변경은 `raceUnderHeldLock` 오케스트레이션의 내부 검증
  로직만 리팩터링하며 동시성 결과(예: `user.2fa_disabled` 중복 기록 방지)의 스펙 서술 자체는
  건드리지 않는다. `spec/**` 전수 grep 에서 "동시 삭제 시 중복 가능" 류의 상충 서술은 이번에도
  0건 — `spec_impact: none` 판단과 부합.

## 발견사항

없음. CRITICAL/WARNING 급 cross-spec 모순을 찾지 못했다.

- **[INFO]** 컨텍스트 예산 절단으로 인한 부분 커버리지 (직전 라운드와 동일 사항, 재기재)
  - target 위치: 번들 조립 메타(`### ⚠️ 컨텍스트 예산 초과로 생략된 파일 15개`)
  - 충돌 대상: 해당 없음 (충돌이 아니라 검토 커버리지 한계)
  - 상세: `spec/5-system` 18개 파일 중 15개와 `spec/1-data-model.md` 를 포함한 다수 "관련 spec" 이
    본 프롬프트에서 절단되어, 이번 호출만으로는 그 파일들 간 상호 모순까지 전수 확인하지 못했다.
    이번 작업(`race-helper-guard-tests`)은 `codebase/backend/src/shared/testing/**` +
    `codebase/backend/test/helpers/concurrency.ts` 만 건드리는 순수 test-harness 리팩터링이라
    실질 위험은 낮지만, 라우팅된 스코프 자체가 `spec/5-system` 전체이므로 갭을 다시 기록한다.
  - 제안: 이번 작업에 대한 조치는 불요(spec_impact: none, 코드 변경도 프로덕션 런타임 0줄).
    다만 절단이 반복되는 대형 파일(execution-engine·external-interaction-api 등)을 대상으로
    한 향후 `--spec`/`--impl-prep` 호출에서는 청크 분할 재실행을 계속 권고.
- **[INFO]** `overlap-preconditions*.ts` 가 어느 spec 의 `code:` frontmatter 에도 미등재
  - target 위치: `spec/5-system/2-api-convention.md` frontmatter `code:` (L4-19)
  - 충돌 대상: 신설 예정 `codebase/backend/src/shared/testing/overlap-preconditions.ts`
  - 상세: `shared/testing/` 의 기존 5쌍 중 3쌍(`response-contract`·`swagger-probe`·
    `user-secret-absence`)은 `2-api-convention.md` 의 `code:` 에 명시 등재되어 있고, 나머지
    2쌍(`schedule-trigger-ref`·`trigger-workflow-ref`)은 각각 `2-navigation/3-schedule.md`·
    `2-navigation/2-trigger-list.md` 에 등재되어 있다. 신설되는 `overlap-preconditions.ts` 는
    특정 도메인 spec 을 검증하는 게 아니라 test 오케스트레이션 자체의 전제(락 타임아웃·fire 수)를
    검증하는 순수 유틸리티라 어느 도메인 spec 의 `code:` 에도 자연스럽게 속하지 않는다 — 이는
    모순이 아니라 카테고리 부재(신규 유형)다.
  - 제안: CRITICAL/WARNING 아님, 조치 불요. 다만 향후 `spec-coverage` standing audit 에서
    "code: 미등재 파일" 로 잡힐 수 있으니, 필요하면 `PROJECT.md` 예외 목록(§B-2 에서 갱신 예정)에
    "spec code: 미등재 — 테스트 오케스트레이션 자체의 순수 전제 검증, 도메인 spec 무관" 이라는
    한 줄 메모를 남겨 향후 audit 오탐을 예방할 수 있다(강제 아님).

## 요약

이번 target 은 draft 가 아니라 `spec/5-system` 기존 SoT 전체이며, 연결된 작업은 프로덕션
런타임 변경이 없는 test-harness 전용 리팩터링(`spec_impact: none`)이다. 직전 라운드
(`22_25_20`) 이후 `spec/**`·`codebase/**` 에 변경이 전혀 없음을 `git diff --stat` 로 확인했고,
전문이 확보된 3개 핵심 파일(인증·API 규약·에러 처리)의 핵심 교차 참조(에러 코드 카탈로그)를
재조회해 여전히 일치함을 확인했다. CRITICAL/WARNING 급 cross-spec 모순은 없다. 기록해 둘
사항은 컨텍스트 예산으로 인한 부분 커버리지(INFO, 반복)와 신설 테스트 유틸리티가 어느
도메인 spec 의 `code:` frontmatter 에도 속하지 않는다는 카테고리 관찰(INFO, 신규) 두 건뿐이다.

## 위험도

NONE
