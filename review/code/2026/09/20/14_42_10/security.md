# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(2라운드, `14_42_10`)은 이전 라운드(`14_22_46`) 이후 다음이 더해진 것이다:

1. `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 유일한 실행 코드 변경. `SchedulesService.update()`
   재계산 게이트의 세 번째 분기("cron·timezone 둘 다 안 바꾸면 재계산 안 한다")를 고정하는 대조군 단위 테스트 1건 추가,
   `scheduleRow()` 팩토리 위치 조정. 프로덕션 로직(`schedules.service.ts`)은 이번 diff 에 없다.
2. `plan/in-progress/sched-recalc-unit.md` — 체크리스트 갱신.
3. `review/code/2026/09/20/14_22_46/**`(1라운드 리뷰 산출물 — SUMMARY/RESOLUTION/각 리뷰어 리포트/meta/retry-state) 및
   `review/consistency/2026/09/20/14_01_01/**`(선행 `--impl-prep` consistency-check 산출물) — 순수 문서/메타데이터.

1은 실제 실행되는 유일한 코드지만 **테스트 파일**이며, mock/spy 로만 구성돼 있어 인젝션·인증·암호화·의존성 표면 자체가 없다.
2·3 은 산문·JSON 메타데이터로 실행되지 않는다.

실제 파일(`codebase/backend/src/modules/schedules/schedules.service.spec.ts`)을 직접 `Read` 로 열어 게이트 번호(372-527행)와
diff 를 대조 확인했다. 저장소 뮤테이션 없이 정적 검토만 수행했으며 `git status --short` 로 리뷰 시작 시점 저장소가 clean
함을 확인했다(변경 없음, 원복 불요).

## 발견사항

- **[INFO]** 신규 대조군 테스트도 하드코딩된 자격증명 없음, 전부 mock/fixture 값
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `it('cron · timezone 을 안 바꾸면 재계산하지
    않는다...')` (502행), 공유 팩토리 `scheduleRow()` (373행)
  - 상세: `id: 'sch-1'`, `workspaceId: 'ws-1'`, `cronExpression: '0 9 * * *'`, `name: '이름만 바꾼다'` 등은 전부 테스트
    fixture 리터럴이며 실제 시크릿·API 키·토큰 패턴과 무관하다. 1라운드 security 리뷰(`review/code/2026/09/20/14_22_46/security.md`)의
    동일 결론이 이번 diff 로도 뒤집히지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트가 인증/인가 우회 경로를 만들지 않음
  - 위치: `schedules.service.spec.ts:517`-`522` (`service.update('sch-1', 'ws-1', { name: '이름만 바꾼다' }, 'u-upd')`)
  - 상세: `workspaceId`(`'ws-1'`)가 이전 두 테스트와 동일하게 그대로 전달되고, mock 은 `scheduleRepo.findOne` 반환값을 그대로
    쓴다. 재계산 게이트 자체(`dto.cronExpression || dto.timezone`)의 프로덕션 구현은 이번 diff 에 없으므로, 이 테스트가 해당
    게이트나 workspace 스코프 검증 로직을 변경/우회하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 문서(`RESOLUTION.md`, plan 체크리스트) 및 1라운드 리뷰/consistency 산출물에 시크릿·자격증명 노출 없음
  - 위치: `review/code/2026/09/20/14_22_46/RESOLUTION.md`, `plan/in-progress/sched-recalc-unit.md`,
    `review/consistency/2026/09/20/14_01_01/*`
  - 상세: `password|secret|api[_-]?key|token|bearer|BEGIN|credential` 패턴으로 전수 검색한 결과, 매치는 전부
    "secret-store 노출 정책이 준수됐다"·"감사 액션 명명에 `secret_rotated`/`bot_token_rotated` 토큰이 있다" 류의
    **규약 서술/확인 기록**이었고 실제 비밀 값은 없었다. `_retry_state.json`/`meta.json` 에 노출되는 것은 로컬 워크트리
    절대경로(`/Volumes/project/private/clemvion/...`)뿐이며 이는 시크릿이 아니고 이 저장소의 기존 관례(`review/**` 산출물
    커밋)와 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** 프로덕션 코드·API 표면 변경 없음 — 8개 점검 관점 대부분이 해당 없음
  - 위치: 전체 diff (5개 파일, `codebase/**` 는 spec 파일 1건뿐)
  - 상세: SQL/커맨드/경로 탐색 등 인젝션 표면, 암호화 알고리즘, 에러 메시지 노출, 의존성 변경이 이번 diff 에 전혀 없다.
    `spec_impact: none` 이 plan 에 명시돼 있고 실제로 일치한다.
  - 제안: 조치 불필요.

## 요약

이번 2라운드 diff 는 1라운드 리뷰(WARNING 2건 — 게이트 무력화 뮤턴트 미검출·팩토리 미적용 중복)를 반영해 대조군 단위 테스트
1건과 리팩터링(`scheduleRow()` 위치 조정)만 추가한 것으로, 보안 관점에서 새로 열리는 표면이 없다. 실행되는 유일한 변경은
Jest mock 기반 단위 테스트이며 fixture 값·API 표면·인증/인가 로직·암호화·의존성 어디에도 실질적 변경이 없다. 동봉된
문서(plan, 1라운드 리뷰 산출물, consistency-check 산출물)에도 하드코딩된 시크릿이나 민감정보 노출은 없다(로컬 절대경로
노출은 이 저장소의 알려진 관례이며 시크릿이 아님). 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 입력 검증 미비, 안전하지
않은 암호화, 에러 메시지 정보 노출, 취약 의존성 등 8개 점검 관점 전반에서 보안 결함을 발견하지 못했다.

## 위험도

NONE
