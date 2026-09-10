# 정식 규약 준수 검토 — `trigger-workflow-ref-canary` (--impl-done)

target: `spec/2-navigation/` (scope 델타 0개 파일 — 정상. 코드 전용 PR)
구현 diff (working tree, origin/main 대비): `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` ·
`trigger-workflow-ref.spec.ts` · `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (3파일, 순수
테스트/harness 코드 — DTO·컨트롤러·API endpoint 신설 없음).

이 diff 는 이미 같은 세션에서 두 차례 검토됐다 (`review/consistency/2026/09/10/13_48_39`
`--impl-prep`, `review/code/2026/09/10/14_34_18` `/ai-review`). 본 라운드는 그 두 라운드가 남긴
지적이 이번 `--impl-done` 시점에 정식 규약 관점에서 여전히 유효한지, 그리고 그사이 반영된 수정이
새 규약 위반을 만들지 않았는지를 확인한다.

## 발견사항

### [WARNING] `spec-impl-evidence.md` 의 `code:` 완결성 선례 — `2-trigger-list.md` 가 신규 캐너리를 아직 등재하지 않았다

- **target 위치**: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록 (파일 상단
  8개 항목 + repo-guard 2개, 총 10개) — `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` /
  `codebase/backend/src/shared/testing/trigger-workflow-ref*.ts` 미포함.
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의 (*"본 spec 이 약속한
  surface 의 구현 경로"*) + 같은 저장소 안 자매 spec `spec/2-navigation/3-schedule.md` 가 세운
  선례. 그 spec 은 `schedule-trigger.e2e-spec.ts` 를 `code:` 에 등재하며 사유를 명시한다:
  > *"응답 형태 시행 — §4 註가 주장하는 네 응답 형태를 양성 3 + 생성 음성 대조 1 로 고정한다.
  > 註에 'e2e 가 고정한다' 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가다."*
- **상세**: `2-trigger-list.md §3` 은 정확히 같은 형태의 註를 갖고 있다 — *"`TriggerDto.workflow`
  는 키 생략형이다 … 자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다"*. 이번 diff 가 바로 그
  캐너리(`trigger-workflow-ref.e2e-spec.ts` 5→6 케이스)를 신설했으므로, `3-schedule.md` 가 세운
  "e2e 가 고정한다고 적으면 그 파일을 등재한다" 규율을 그대로 적용하면 `2-trigger-list.md` 의
  `code:` 도 같은 갱신이 필요하다. 지금은 없다 — 신규 보장의 근거가 spec frontmatter 에서
  추적되지 않는다.
- **왜 CRITICAL 이 아닌가**: 이 gap 은 이번 developer PR 이 새로 만든 위반이 아니다. `spec/`
  은 developer 쓰기 금지 대상이고(§자기-반증형 소정정의 좁은 예외는 이 자리에 적용되지 않음 —
  대상 문장을 developer 가 쓰지 않았다), plan(`plan/complete/trigger-workflow-ref-canary.md`)이
  이미 `spec_impact: none` 으로 이번 PR 을 스코프하고 이 항목을 **"후속으로 넘기는 것" 목록
  2번**(`naming_collision` INFO 인용)으로 project-planner 턴에 정확히 이관해 두었다. 즉 이
  프로세스는 이미 규약대로 처리 중이다.
- **제안**: 코드 변경 불필요. 후속 project-planner 턴(`--spec` 게이트)에서 `2-trigger-list.md`
  §3 문장 정정과 함께 `code:` 에 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (+ 필요시
  `src/shared/testing/trigger-workflow-ref*.ts`) 를 추가한다. 이 PR 을 이 사유로 막을 필요는 없다.

### [WARNING] `PROJECT.md` e2e 헬퍼 배치 규약 문면이 실제 jest 구조와 어긋난다 — 문서 갱신이 아직 반영 전이나, 코드 측 대응은 완료

- **target 위치**: `PROJECT.md` §e2e 테스트 작성 가이드 §파일 위치·명명 — *"신규 헬퍼:
  `codebase/backend/test/helpers/<name>.ts`"* (313행 부근, 314행 확인).
- **관련 규약**: `spec/conventions/**` 자체에는 이 규칙이 없으나, 본 checker 의 §3(문서 구조 규약)
  이 CLAUDE.md/PROJECT.md 계열 명명 컨벤션도 대상으로 포함하고, 직전 라운드
  (`review/consistency/2026/09/10/13_48_39/convention_compliance.md` WARNING)가 이미 같은 지점을
  지적했다.
- **상세**: `trigger-workflow-ref.ts` 는 `PROJECT.md` 문면이 가리키는 `test/helpers/` 가 아니라
  `codebase/backend/src/shared/testing/`에 배치됐다. 실측(`jest.config.ts` `rootDir: 'src'`,
  `test/jest-e2e.json` `testRegex: '.e2e-spec.ts$'`)에 따르면 이 선택이 **유일하게 옳다** —
  `test/helpers/` 에 두면 T-2 self-spec(`trigger-workflow-ref.spec.ts`)이 어느 jest 설정에도
  걸리지 않아 영구히 안 도는 죽은 테스트가 된다. 즉 코드 배치 자체는 문제가 없고, **문서
  (`PROJECT.md`)가 실제 강제 메커니즘보다 좁게 쓰여 있는 상태**가 남아 있다.
- **진행 상황**: 직전 라운드 제안 (a)는 반영됨 — 현재 `trigger-workflow-ref.ts` 상단 JSDoc 에
  "## 왜 `test/helpers/` 가 아니라 여기인가" 절이 실제로 추가되어 root Cause 를 코드 자리에서
  설명한다. 제안 (b)(`PROJECT.md` 본문 갱신)는 plan 의 "후속으로 넘기는 것" 목록 3번으로 project-
  planner 턴에 명시적으로 이관돼 있다 — `PROJECT.md` 도 거버넌스 문서라 developer 가 직접 쓸 수
  없는 경계와 맞물린다(CLAUDE.md §Skill 체계 — 거버넌스 문서는 project-planner 전담).
- **제안**: 이 PR 은 그대로 두어도 무방하다(코드 근거 문서화 완료). `PROJECT.md` 본문 갱신은
  project-planner 턴에서 §2 항목과 함께 일괄 처리 권고.

## 확인했으나 위반 없음

- **`spec/conventions/review-citations.md` 준수**: 신규 세 파일의 리뷰 인용 (`review/code/2026/09/06/
  01_13_50` W4·W6, `review/code/2026/09/10/14_34_18` testing W1~W3 · maintainability W1~W2 ·
  side_effect W1) 은 전부 §2 가 요구하는 **전체 경로 + 지적 번호** 형태다. bare `hh_mm_ss` 형태
  없음. 인용 대상 세션·해당 지적 번호가 실제로 존재하는지 실측 대조했고 (`review/code/2026/09/10/
  14_34_18/RESOLUTION.md`, `SUMMARY.md`) 전부 일치 — 근거 날조 없음. §3 적용 범위 표 상 이
  코드는 "codebase/** 의 코드·테스트 주석" 범주라 규약 적용 대상이 맞고, DTO/컨트롤러 JSDoc 이
  아니므로 swagger.md §3 과의 경계 문제도 없다.
- **비밀 컬럼 명명·값 일치**: `TRIGGER_SECRET_COLUMNS = ['notificationSecretV2', 'chatChannelTokenV2']`
  는 정본 `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 및 자매 헬퍼
  `schedule-trigger-ref.ts` 의 동명 상수와 값·순서가 일치한다 (`trigger.entity.ts` 실제 컬럼명과도
  일치, grep 대조 완료). 3중 하드코딩 자체의 drift 위험은 이미 이전 코드리뷰(maintainability W1
  · security W1)가 잡아 repo-guard 처방을 트래커에 등재했고, 이는 명명 규약 위반이 아니라
  유지보수성 이슈로 올바르게 분류돼 있다.
- **`TriggerWorkflowRefDto` 참조 정확성**: 헬퍼가 언급하는 필드 구성(`id`, `name`)이
  `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 실제 선언과
  일치 — 신규 DTO 신설이 아니라 기존 것을 정확히 인용.
- **에러 코드 어휘**: 테스트 주석이 인용하는 `VALIDATION_ERROR`(prefix-less 공용 코드,
  `error-codes.md §1` 명시 예외 범주와 일치) · `RESOURCE_CONFLICT` · `TRIGGER_ENDPOINT_PATH_CONFLICT`
  (도메인 prefix 원칙 준수) 는 모두 기존 정의를 그대로 참조할 뿐 신규 코드를 발행하지 않는다 —
  위반 여지 없음.
- **swagger.md / API 문서 규약**: 이번 diff 는 DTO·컨트롤러·`@ApiProperty` 데코레이터를 일절
  건드리지 않는다 (순수 `src/shared/testing/**` + `test/**` 테스트 코드). §4 검토 관점(API 문서
  규약)이 적용될 표면 자체가 없음.
- **`spec-impl-evidence.md` frontmatter 스키마 자체**: 이번 PR 은 `spec/2-navigation/` 을 전혀
  건드리지 않았으므로 (scope 델타 0), frontmatter 스키마 위반(§2 필드 누락, `pending_plans` 미존재
  등) 은 애초에 해당 사항이 없다. `plan/complete/trigger-workflow-ref-canary.md` frontmatter 는
  `spec_impact: none` (bare literal, YAML 리스트 아님 — Gate C 허용 형태와 일치)으로 올바르게
  선언돼 있다.
- **§자기-반증형 소정정 CRITICAL (직전 라운드 지적) 는 이번 시점에 해소됨**: `13_48_39` 라운드가
  지적한 조건 1 오판정("대상 문장을 developer 가 썼다")은 이번 라운드 시점 plan 문서에서
  이미 "처분 — 두 PR 로 가른다" 절로 정정돼 있다 — 이 PR 은 `spec_impact: none` 으로 코드만
  착지시키고, spec 문장 정정은 project-planner 턴으로 명시 이관됐다. 재발 없음.

## 요약

이번 diff 는 spec·DTO·API 표면을 건드리지 않는 순수 테스트/harness 코드(단언 헬퍼 + self-spec +
e2e 캐너리)이며, 명명·인용·비밀 컬럼 값·에러 코드 어휘 등 실측 가능한 모든 축에서 `spec/
conventions/**` 위반은 발견되지 않았다. 남은 두 항목 — (1) `spec-impl-evidence.md` 의 `code:`
완결성 선례(`3-schedule.md` 대비 `2-trigger-list.md` 미등재), (2) `PROJECT.md` e2e 헬퍼 배치
문면과 실제 jest 구조의 불일치 — 은 둘 다 **spec/거버넌스 문서 쓰기 권한이 developer 에게 없어
이번 PR 이 직접 고칠 수 없는 성격**이고, plan(`plan/complete/trigger-workflow-ref-canary.md`)의
"후속으로 넘기는 것" 목록에 이미 정확히 등재돼 project-planner 턴으로 이관돼 있다. 즉 두 항목
모두 **새로운 위반이 아니라 이미 올바른 절차로 큐잉된 기지(既知) 갭**이며, 이번 PR 을 이 사유로
차단할 근거는 없다.

## 위험도

LOW — CRITICAL 없음. WARNING 2건은 모두 이번 PR 범위 밖(spec/거버넌스 문서 쓰기 권한 경계) 이고
plan 에 이미 올바르게 후속 이관돼 있어 이번 `--impl-done` 게이트를 차단할 사안이 아니다. 후속
project-planner 턴에서 두 WARNING 을 함께 해소할 것을 권고한다.

STATUS: success
