# 보안(Security) 코드 리뷰

## 검토 대상 요약

이번 changeset 은 10개 파일로 구성되며 실질적으로 세 종류다:

1. `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 유일한 코드 변경. `SchedulesService.update()` 의 cron/timezone 재계산 happy-path 를 고정하는 **단위 테스트 2건 추가**(`computeNextRuns` spy + `nextRunAt` 대입 검증). 프로덕션 로직(`schedules.service.ts`) 은 이번 diff 에 포함되지 않았다.
2. `plan/in-progress/sched-recalc-unit.md` — 작업 plan 문서.
3. `review/consistency/2026/09/20/14_01_01/**` — 직전 `--impl-prep` consistency-check 산출물(SUMMARY/개별 checker 리포트/meta/retry-state).

2·3 은 순수 문서/메타데이터이며 실행되는 코드가 아니다.

## 발견사항

- **[INFO]** 테스트 코드에 하드코딩된 자격증명류 없음, 모두 목(mock) 값
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `scheduleRow()` (게이트 427행), `it('cron 을 바꾸면...')` (게이트 440행), `it('timezone 만 바꿔도...')` (게이트 475행)
  - 상세: `cronExpression`, `timezone`, `id: 'sch-1'` 등은 전부 테스트 fixture 상수이며 실제 시크릿·API 키·토큰 패턴과 무관하다. `SecretResolverService.deleteByPrefix` mock(게이트 100~106행, 기존 코드)도 실제 비밀 값을 다루지 않는다. 인젝션·시크릿 노출 관점에서 문제 없음.
  - 제안: 조치 불필요. 기록 목적의 INFO.

- **[INFO]** `computeNextRuns` 재계산 조건(`dto.cronExpression || dto.timezone`)의 서비스 로직 자체는 이번 diff 에 없음 — 리뷰 범위 확인
  - 위치: `plan/in-progress/sched-recalc-unit.md` 게이트 31행("분기 조건이 `dto.cronExpression || dto.timezone`")
  - 상세: 신규 테스트는 이 기존 분기의 **인가되지 않은 우회 경로**를 만들지 않는다 — `schedule.update()` 시그니처에 `workspaceId`(게이트 454~458행, 490~494행)가 그대로 전달되고, mock 은 `scheduleRepo.findOne` 반환값을 그대로 쓰므로 실제 서비스의 workspace 스코프 검증 로직에 영향을 주지 않는다. 프로덕션 인가 로직 변경이 diff 에 없으므로 인증/인가 우회 위험도 없음.
  - 제안: 조치 불필요.

- **[INFO]** consistency-check 산출물에 경로·시각 등 메타데이터만 존재, 민감정보 없음
  - 위치: `review/consistency/2026/09/20/14_01_01/meta.json`, `_retry_state.json`
  - 상세: 워크트리 절대경로(`/Volumes/project/private/clemvion/...`)가 노출되지만 이는 로컬 개발 환경 경로이며 시크릿·자격증명이 아니다. 저장소 관례상(`review/**`) 이런 산출물은 커밋되는 것이 정상이다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `SchedulesService.update()` 의 재계산 happy-path 를 검증하는 순수 단위 테스트 2건 추가와 그에 딸린 plan/consistency-check 문서로 국한되며, 프로덕션 소스 코드·API 표면·인증/인가 로직·의존성·암호화 방식은 전혀 건드리지 않는다. 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 입력 검증 미비, 안전하지 않은 암호화, 에러 메시지 정보 노출, 취약 의존성 등 8개 점검 관점 전반에서 보안상 문제로 볼 사항이 발견되지 않았다. 저장소 뮤테이션 없이 정적 검토만 수행했으며(`git status --short` 확인 불필요 — 파일 쓰기 없음), 재현을 위한 코드 수정도 하지 않았다.

## 위험도

NONE
