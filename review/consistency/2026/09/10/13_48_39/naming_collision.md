# 신규 식별자 충돌 검토 — `trigger-workflow-ref` 캐너리 (--impl-prep)

대상: `plan/in-progress/trigger-workflow-ref-canary.md` 가 도입하는 세 파일 + `expectTriggerWorkflowRef` 함수.

## 실측 방법

- `codebase/backend/src/shared/testing/` 실제 디렉터리 목록 대조 (세 경로 모두 부재 확인).
- 자매 헬퍼 `schedule-trigger-ref.ts` / `.spec.ts` 전문 열람.
- `TriggerWorkflowRefDto` (`modules/triggers/dto/responses/trigger-response.dto.ts`) ·
  `ScheduleTriggerWorkflowRefDto` (`modules/schedules/dto/responses/schedule-response.dto.ts`) 전문 열람.
- `tsconfig.build.json` · `jest.config.ts` · `test/jest-e2e.json` · `package.json`(`test:e2e` 스크립트) 열람.
- `codebase/backend/test/*.e2e-spec.ts` 파일명 전수 목록 + 관련 `describe(` 라벨 grep.
- `spec/2-navigation/3-schedule.md` `code:` frontmatter 대조 (자매 축의 등록 선례).
- 저장소 전체에서 `expectTriggerWorkflowRef` 리터럴 grep (0건, 신규 확인).

## 발견사항

- **[INFO]** 세 파일 경로 모두 미점유 — 충돌 없음
  - target 신규 식별자: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`,
    `trigger-workflow-ref.spec.ts`, `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`
  - 기존 사용처: 없음 — `ls codebase/backend/src/shared/testing/`(9개 파일) ·
    `ls codebase/backend/test/*.e2e-spec.ts`(48개) 어디에도 동일 이름 없음
  - 상세: 파일명은 저장소 관례(kebab-case, `<도메인>-<보조개념>-ref[.spec|.e2e-spec].ts`)를 그대로 따르고,
    자매 파일 `schedule-trigger-ref.ts`/`.spec.ts`, 인접 파일 `trigger-expression.e2e-spec.ts` 와 명명 축이 같다.
  - 제안: 없음(문제 없음).

- **[INFO]** 빌드/테스트 러너 배선 — 새 파일이 두 config 모두 "이름 명시 없이" 자동 상속받는다(실측)
  - target 신규 식별자: `trigger-workflow-ref.ts` (프로덕션 제외 대상), `trigger-workflow-ref.spec.ts` (유닛 러너 대상), `trigger-workflow-ref.e2e-spec.ts` (e2e 러너 대상)
  - 기존 사용처:
    - `codebase/backend/tsconfig.build.json` — `exclude` 배열에 `"src/shared/testing/**"` 가 **디렉터리 전체** 패턴으로 이미 있다(2026-08-27 자 주석: `*spec.ts` 패턴에 안 걸리는 파일이 devDependency(`@nestjs/testing`)를 끌고 dist 로 나가는 사고를 막기 위해 디렉터리째 막았다).
    - `codebase/backend/jest.config.ts` — `testRegex: '.*\\.spec\\.ts$'`, `rootDir: 'src'` (파일 위치 무관하게 `src/**/*.spec.ts` 전부 매칭).
    - `codebase/backend/test/jest-e2e.json` — `testRegex: ".e2e-spec.ts$"`, `rootDir: "."` 이며 `package.json`의 `test:e2e` 스크립트가 `--config ./test/jest-e2e.json` 로 호출하므로 `rootDir` 는 `codebase/backend/test/` 로 해석된다.
  - 상세: 세 config 모두 **파일명을 개별 열거하지 않는 디렉터리/확장자 단위 패턴**이라, 신규 파일이 어떤 config 도 건드리지 않고 그대로 상속받는다 — plan 본문의 "배선은 불필요하다(실측)" 주장과 일치한다. 특히 `tsconfig.build.json` 의 exclude 가 파일 패턴(`**/*spec.ts`)이 아니라 **디렉터리** 패턴(`src/shared/testing/**`)인 것이 핵심 — `trigger-workflow-ref.ts` 자체는 `*spec.ts` 에 안 걸리는 이름이지만(자매 `schedule-trigger-ref.ts` 와 동형) 디렉터리째 막혀 있어 dist 유출 사고(#반복 2·3번째 자리와 같은 클래스)가 재발하지 않는다.
  - 제안: 없음 — 이 축은 사전에 안전하게 설계돼 있다. 다만 구현 시 `expectTriggerWorkflowRef` 가 (자매처럼) 별도 `import { expect } from '@jest/globals'` 없이 앰비언트 `expect` 를 쓴다면 `tsc --noEmit`(ratchet) 대상에서도 `@types/jest` 앰비언트가 있어야 타입체크가 통과한다 — 자매 파일이 이미 같은 패턴이므로 위험은 낮다.

- **[WARNING]** 함수명 `expectTriggerWorkflowRef` — 현재는 안전하지만, DTO 가 경고하는 "접두어 하나 차이" 패턴이 헬퍼명에도 잠재한다
  - target 신규 식별자: `expectTriggerWorkflowRef(dto, { present })`
  - 기존 사용처: `shared/testing/schedule-trigger-ref.ts` 의 `expectNarrowedScheduleTriggerRef(trigger, { withWorkflow })`
  - 상세: 두 헬퍼가 단언하는 대상 깊이가 다르다 — `expectNarrowedScheduleTriggerRef` 는 `ScheduleDto.trigger`(=`ScheduleTriggerRefDto`, 상위 참조 객체) 의 **키셋 전체**를 등가 비교하고, `workflow` 서브키의 존재 유무만 보되 **그 서브키 값(`ScheduleTriggerWorkflowRefDto`)의 shape 은 검증하지 않는다**(`Object.keys(record)` 비교는 최상위 1단계만 본다 — 실측: `schedule-trigger-ref.ts:48`). 반면 `expectTriggerWorkflowRef` 는 `TriggerDto.workflow`(=`TriggerWorkflowRefDto`, 하위 참조 객체) 자체의 존재와 **정확한 shape**(`['id','name']`)을 문다. 즉 오늘은 두 헬퍼가 서로 다른 나열형(하나는 상위 객체, 하나는 하위 필드)을 향해 있어 같은 자리에서 오호출될 여지가 낮고, 오호출돼도 키셋 불일치로 즉시 실패한다(조용히 통과하는 경로 없음 — fail-loud).
    그러나 함수명 자체는 `TriggerWorkflowRefDto` 타입명을 그대로 딴 것이라(`expect` + PascalCase(타입명 - `Dto`)), 만약 향후 "`ScheduleTriggerWorkflowRefDto`(스케줄 쪽 nested workflow ref) 의 shape 자체"를 문제 삼는 헬퍼가 필요해져 같은 명명 관례로 추가된다면 그 이름은 자연스럽게 `expectScheduleTriggerWorkflowRef` 가 될 것이고, 이는 `expectTriggerWorkflowRef` 와 **접두어 "Schedule" 하나만 다른** 이름이 된다 — 정확히 두 DTO 자신의 JSDoc 이 "한쪽을 다른 쪽으로 갈아 끼우지 말 것"이라 경고하는 그 패턴이 함수명 레벨로 전이된다. (현재는 `expectNarrowedScheduleTriggerRef` 가 그 nested shape 을 검증하지 않으므로 이 이름 충돌은 아직 발생하지 않았다 — 미래 리스크로만 존재.)
  - 제안: 지금 당장 이름을 바꿀 필요는 없다(현재 유일한 자매와는 검증 깊이가 달라 혼동 확률이 낮고, 오호출은 fail-loud). 다만 T-1 헬퍼의 JSDoc(플랜이 이미 "자매와 성격이 다르다"를 적기로 함)에 **"만약 스케줄 쪽에도 nested workflow shape 검증 헬퍼가 필요해지면 `expectScheduleTriggerWorkflowRef` 가 아니라 `expectNarrowedScheduleTriggerWorkflowRef` 처럼 `Narrowed` 를 유지해 접두어-only 충돌을 피하라"는 한 줄을 남겨 두는 것을 권장 — 다음 사람이 이 함정을 다시 밟지 않도록 미리 명명 규칙을 못박는 것.

- **[INFO]** `opts.present` vs `opts.withWorkflow` — 위험이 아니라 유용한 신호이며, 기존 어휘와도 일치
  - target 신규 식별자: `opts.present: boolean`
  - 기존 사용처: `shared/testing/schedule-trigger-ref.ts` 의 `opts.withWorkflow: boolean`; 그리고 `shared/testing/response-contract.ts:242` 의 지역 변수 `const present = Object.hasOwn(body, name)` (§5.4 키 생략형 "키 존재 여부" 판정에 이미 `present` 라는 어휘를 쓰고 있다).
  - 상세: 두 옵션 이름이 다른 것은 두 헬퍼가 서로 다른 것을 확인한다는 사실과 정합한다 — `withWorkflow` 는 "이 응답 경로가 관계를 채우는가"라는 **도메인 조건**을 말하고, `present` 는 "그 필드 키가 있는가"라는 **§5.4 키 생략형 판정 그 자체**를 말한다. 후자는 이미 `response-contract.ts` 내부에서 같은 의미로 쓰이는 확립된 어휘라, 오히려 두 헬퍼가 같은 옵션명(`withWorkflow`)을 썼다면 "같은 것을 다른 깊이에서 확인한다"는 착각을 유발했을 것이다. 또한 TypeScript 구조적 타이핑상 `{ present: boolean }` 과 `{ withWorkflow: boolean }` 은 서로 대입 불가능해 호출부에서 옵션명을 착각하면 컴파일 단계에서 즉시 잡힌다.
  - 제안: 없음 — 현재 명명이 유지할 가치가 있는 구분이다.

- **[INFO]** `describe`/파일명 — 기존 e2e 스위트와 중복 없음
  - target 신규 식별자: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (파일명), 예상 `describe('Trigger workflow ref (e2e)', …)` 류의 최상위 타이틀
  - 기존 사용처: 48개 기존 `*.e2e-spec.ts` 파일명 전수 확인 — 동일/근접 이름 없음. `describe(` 타이틀 grep 결과 `'Schedule trigger (e2e)'`(schedule-trigger) · `'Webhook trigger (e2e)'`(webhook-trigger) · `'POST /api/triggers — chat-channel multi-provider (e2e)'`(chat-channel-trigger-create) 세 개가 트리거 관련 최상위 타이틀의 전부이며, "workflow" 를 포함한 최상위 `describe` 는 `workflow-*.e2e-spec.ts` 네 파일(전혀 다른 관심사: assistant/crud/execution/test-dataset)뿐이다.
  - 상세: 신규 파일이 `chat-channel-trigger-create.e2e-spec.ts` 의 telegram 생성 경로를 재사용한다고 plan 이 밝히고 있어(T-3 #5), 두 파일이 같은 임포트를 공유할 가능성이 있지만 `describe` 최상위 타이틀은 서로 다른 관심사를 반영해 자연히 갈릴 것으로 판단된다.
  - 제안: 없음 — 실제 구현 시 최상위 `describe` 타이틀에 "(e2e)" 접미사와 파일 목적("workflow ref 존재/부재")을 명시하면 기존 컨벤션과 일치한다.

- **[INFO]** `spec/2-navigation/2-trigger-list.md` 의 `code:` frontmatter 미등록 — 자매 축과의 등록 관례 차이
  - target 신규 식별자: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`
  - 기존 사용처: `spec/2-navigation/3-schedule.md` 의 `code:` frontmatter 는 자신의 캐너리 파일 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 를 **명시적으로 등재**하고 있다(주석: "응답 형태 시행 — §4 註가 주장하는 네 응답 형태를 양성 3 + 생성 음성 대조 1 로 고정한다. 註에 'e2e 가 고정한다' 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가다"). 반면 현재 `2-trigger-list.md` 의 `code:` 목록(§bundle 확인)에는 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 가 없다.
  - 상세: 이것은 identifier 충돌은 아니지만, plan 의 T-4(spec 문장 정정)가 §3 캐너리 有無 문장만 고치고 `code:` frontmatter 등록은 언급하지 않아, 자매 spec 이 세운 선례("e2e 가 고정한다고 적었으면 그 파일을 code: 에 올려 추적 가능하게 한다")를 따르지 않을 위험이 있다.
  - 제안: T-4 작업 시 `2-trigger-list.md` frontmatter `code:` 목록에 신규 e2e 파일 경로를 `3-schedule.md` 와 같은 형식의 주석과 함께 추가할 것을 권장.

- **[INFO]** (스코프 밖, 기존 결함) `shared/testing/` 내부 동사 접두어 비일관 — `assert*` vs `expect*`
  - target 신규 식별자: 해당 없음 (이번 변경은 `expect*` 관례를 그대로 따름)
  - 기존 사용처: `response-contract.ts:374` 의 `assertMatchesContract` 는 `assert` 접두어를 쓰는 반면, `schedule-trigger-ref.ts` 의 `expectNarrowedScheduleTriggerRef`, `user-secret-absence.ts` 의 `expectNoUserSecrets`, 그리고 이번 신규 `expectTriggerWorkflowRef` 는 모두 `expect` 접두어를 쓴다.
  - 상세: 같은 디렉터리에서 같은 역할(테스트 단언 헬퍼)에 두 개의 동사 접두어(`assert`/`expect`)가 공존한다. 신규 변경이 만든 문제는 아니고(오히려 다수파인 `expect` 관례를 따름), 이번 PR 의 책임 범위도 아니다.
  - 제안: 이번 작업에서 손대지 말 것 — 향후 `shared/testing/` 전체를 건드릴 기회가 생기면 하나로 통일을 고려. 지금 리네이밍하면 스코프 밖 diff 만 커진다.

## 요약

세 신규 파일 경로(`trigger-workflow-ref.ts`/`.spec.ts`/`.e2e-spec.ts`)는 모두 미점유이며, 유닛 러너(`jest.config.ts`)·e2e 러너(`test/jest-e2e.json`)·프로덕션 빌드 제외(`tsconfig.build.json` 의 `src/shared/testing/**` 디렉터리 단위 exclude) 세 config 모두 파일명을 열거하지 않는 패턴이라 신규 파일이 자동으로 올바르게 상속된다 — plan 의 "배선 불필요" 주장이 실측과 일치한다. `expectTriggerWorkflowRef` 함수명은 저장소 관례(타입명을 그대로 딴 `expect+PascalCase`)를 따르고 현재 유일한 자매 `expectNarrowedScheduleTriggerRef` 와는 검증 대상 깊이가 달라 즉각적인 오호출 위험은 낮으며 오호출 시에도 fail-loud 다. 다만 두 DTO(`TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto`) 자신이 "접두어 하나 차이" 갈아치우기 위험을 명시적으로 경고하고 있고, 그 패턴이 헬퍼명 레벨에서도 향후(스케줄 쪽에 nested workflow shape 검증이 추가되는 시점) 재현될 소지가 있어 WARNING 하나로 선제 기록한다. `opts.present`/`opts.withWorkflow` 어휘 차이는 위험이 아니라 두 헬퍼가 다른 것을 확인한다는 유용한 신호이며 기존 내부 어휘(`response-contract.ts`)와도 일치한다. `describe`/파일명 레벨 충돌은 없다. 이번 변경 자체를 막을 CRITICAL 은 없다.

## 위험도

LOW
