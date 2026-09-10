# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 조사 방법 메모

- 검토 모드는 `--impl-done`(scope=`spec/2-navigation/`)이나 **scope 내 spec 델타는 0개** —
  이 브랜치는 `spec/2-navigation/` 문서를 바꾸지 않았다. 따라서 spec 레벨의 신규 요구사항
  ID·API endpoint·엔티티/DTO·이벤트명·env var 는 이 PR 에서 새로 도입된 것이 없다.
- 실제 구현 diff(3개 파일 / origin/main 대비)는 `codebase/backend/src/shared/testing/
  trigger-workflow-ref.{ts,spec.ts}` + `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`
  뿐이며, `TriggerDto.workflow` 응답 필드 유무를 고정하는 **테스트 전용 캐너리/헬퍼** 추가다.
  API endpoint·엔티티·이벤트·config key 신설은 없다 — 순수 회귀 가드 코드다.
- 프롬프트에 번들된 `git diff origin/main...HEAD` 스냅샷은 세션 시작 시점의 것이며, 현재
  워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-workflow-ref-canary-96ae33`)
  에는 그 이후 추가 커밋되지 않은 수정이 더 있다(`git status`상 3개 파일 모두 `M`). 프롬프트의
  안내대로 **워킹트리를 절대경로로 직접 재확인**하여 이 최신 상태 기준으로 검토했다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌
해당 없음 — 신규 요구사항 ID 도입 없음(spec 델타 0).

### 2. 엔티티/타입명 충돌
새로 내보내는(export) 심볼은 `expectTriggerWorkflowRef` 함수 하나뿐이다(`codebase/backend/src/shared/testing/trigger-workflow-ref.ts`). 저장소 전체에서 이 이름은 이 3개 신규 파일 밖에서 쓰이지 않는다(`git grep -n "expectTriggerWorkflowRef"` 확인) — 충돌 없음.

파일-scope 전용(비-export) 상수 3개(`TRIGGER_SECRET_COLUMNS`, `WORKFLOW_REF_KEYS`)도 다른 모듈과 이름이 겹치지 않거나, 겹치더라도 module-private 이라 실제 충돌은 없다:

- `TRIGGER_SECRET_COLUMNS` 는 자매 파일 `schedule-trigger-ref.ts` 에도 **동일 이름·동일 값**(`notificationSecretV2`, `chatChannelTokenV2`)으로 이미 존재한다(이번 PR 이전부터 있던 기존 패턴). 두 파일 모두 module-private 상수라 컴파일/런타임 충돌은 없고, 값도 프로덕션 SoT인 `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 와 실측 일치한다. 신규 파일의 JSDoc 자체가 "정본의 세 번째 독립 사본 — 드리프트 위험, repo-guard 후속 등재됨"이라고 이미 명시하고 있어, 새로 발견할 결함이 아니라 **이미 인지·추적 중인 항목**이다. (INFO 로만 기록, 조치 불요)
- `UUID_PATTERN`(신규 헬퍼가 처음 도입했던 로컬 정규식 상수)이 `codebase/backend/src/common/utils/uuid.ts` 의 기존 `UUID_PATTERN`(RFC v1–v5 variant/version nibble까지 검증하는 **더 엄격한** 정규식)과 **동일 이름·다른 의미**로 정의됐던 이력이 있다 — 두 상수 모두 module-private 이라 실제 컴파일 충돌은 없지만, 신규 쪽은 실제로는 `common/utils/uuid.ts` 의 `isUuidShaped`(canonical shape만 검사, version/variant 불문)와 동일한 의미였다. **현재 워킹트리에서는 이미 해소됨** — 로컬 `UUID_PATTERN` 정의를 제거하고 `import { isUuidShaped } from '../../common/utils/uuid'` 로 정본을 재사용하도록 고쳐져 있다(코드 주석: "손으로 적은 정규식 대신 정본을 실행한다"). 신규 발견 사항 없음, 과거 위험이 이미 자체 해소됐음을 확인차 기록.
- `TriggerWorkflowRefDto` / `ScheduleTriggerWorkflowRefDto` — 신규 헬퍼의 JSDoc 이 언급하는 두 DTO는 이번 PR 신설이 아니라 기존 파일(`modules/triggers/dto/responses/trigger-response.dto.ts`, `modules/schedules/dto/responses/schedule-response.dto.ts`)에 이미 존재하는 타입이다. 헬퍼는 이 이름을 참고만 할 뿐 재정의하지 않는다 — 충돌 없음.

### 3. API endpoint 충돌
신규 endpoint 없음. 구현 diff 는 기존 `POST/GET/PATCH /api/triggers[...]` 를 호출하는 e2e 테스트일 뿐, 라우트를 추가·변경하지 않는다.

### 4. 이벤트/메시지명 충돌
신규 webhook·queue·SSE 이벤트명 없음.

### 5. 환경변수·설정키 충돌
신규 e2e 파일이 참조하는 `process.env.E2E_BASE_URL` 은 기존 e2e 스위트 전반(`app.e2e-spec.ts` 등 다수)이 이미 쓰는 기존 컨벤션을 그대로 재사용한 것이며, 새로 도입된 env var 가 아니다. 새 config key 도입 없음.

### 6. 파일 경로 충돌
신규 파일 3개의 경로·명명 모두 기존 컨벤션과 일치하고 기존 파일과 겹치지 않는다:

- `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` / `.spec.ts` — 같은 디렉터리의 기존 자매 파일(`schedule-trigger-ref.ts`, `response-contract.ts`, `swagger-probe.ts`, `user-secret-absence.ts` 등)과 동일한 `<domain>-ref.ts` + self-spec 명명 패턴을 따른다. `tsconfig.build.json` 이 `src/shared/testing/**` 를 이미 exclude 목록에 갖고 있어(기존 항목) production 빌드 오염 경로에도 새로 편입되지 않는다(단, exclude 는 root 후보만 거른다는 한계는 헬퍼 자신의 JSDoc 이 이미 명시).
- `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` — `codebase/backend/test/` 내 기존 트리거 관련 e2e 파일들(`webhook-trigger.e2e-spec.ts`, `schedule-trigger.e2e-spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`, `manual-trigger-default-param.e2e-spec.ts`, `trigger-expression.e2e-spec.ts`)과 이름이 겹치지 않으며 `<domain>.e2e-spec.ts` 컨벤션도 그대로 따른다.
- jest 러너 설정(`jest.config.ts` rootDir=`src`/testRegex=`.*\.spec\.ts$`, `test/jest-e2e.json` testRegex=`.e2e-spec.ts$`)을 직접 확인한 결과 신규 두 파일이 각각 unit/e2e 러너에 정확히 걸리는 것을 확인했다(헬퍼 JSDoc의 주장과 일치).

### 기타 — 값 수준 확인 (참고)
- e2e 테스트가 쓰는 fixture 값(`botToken: '111:e2eWfRefBotToken'`)은 기존 `chat-channel-trigger-create.e2e-spec.ts` 의 `111:e2eTelegramBotToken` / `111:e2eToken` 과 이름이 다르며 겹치지 않는다.
- `describe('TriggerDto.workflow 응답 경로 (e2e)', ...)` 등 describe/it 문자열은 파일 scope 라 잡음 없음.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다.

- **[INFO]** `TRIGGER_SECRET_COLUMNS` 3중 독립 사본 (신규 아님, 이미 추적 중)
  - target 신규 식별자: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 의 `TRIGGER_SECRET_COLUMNS`
  - 기존 사용처: `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:24`(동일 이름·동일 값) + `codebase/backend/src/modules/triggers/triggers.service.ts:99`(`TRIGGER_RESPONSE_STRIP_COLUMNS`, 정본)
  - 상세: 이름 자체는 충돌하지 않는다(module-private, 값도 일치). 다만 같은 비밀 컬럼 목록의 세 번째 독립 리터럴 사본이 생겨 향후 정본 변경 시 드리프트 위험이 있다.
  - 제안: 이미 파일 내 JSDoc 에 "repo-guard 로 세 목록 동일성 강제"가 후속 과제로 등재돼 있다 — 별도 조치 불요, 해당 후속 트래킹만 유지.

- **[INFO]** `UUID_PATTERN` 동명이의 — 이미 해소됨
  - target 신규 식별자: (과거) `trigger-workflow-ref.ts` 로컬 `UUID_PATTERN`
  - 기존 사용처: `codebase/backend/src/common/utils/uuid.ts:9`(`UUID_PATTERN`, RFC v1–v5 엄격 검증 — 의미가 다름)
  - 상세: 동일 이름·다른 의미(엄격 버전검증 vs 느슨한 shape 검증)로 잠재적 혼동 소지가 있었으나, 현재 워킹트리에서는 로컬 정의가 제거되고 `common/utils/uuid.ts` 의 `isUuidShaped` 를 import 해 재사용하도록 이미 수정돼 있다. 조치 불요, 확인 기록만 남긴다.

## 요약

target 검토 대상인 `spec/2-navigation/` 은 이 브랜치에서 실제로 변경되지 않았고(scope 델타 0), 유일한 구현 변경은 `TriggerDto.workflow` 응답 필드 유무를 고정하는 테스트 전용 헬퍼(`expectTriggerWorkflowRef`)와 그 self-spec·e2e 캐너리 3개 파일 추가뿐이다. 이 헬퍼가 새로 내보내는 유일한 공개 심볼(`expectTriggerWorkflowRef`)과 신규 파일 경로 2곳은 저장소 전체에서 유일하며 기존 컨벤션(자매 `schedule-trigger-ref.ts`, jest rootDir/testRegex 분리, `tsconfig.build.json` exclude)과 정합적으로 배치돼 있다. API endpoint·엔티티/DTO·이벤트명·env var 신설은 없다. 검토 중 발견한 두 건(비밀 컬럼 목록의 3중 사본, `UUID_PATTERN` 동명이의)은 모두 module-private 스코프라 실제 충돌은 아니며, 전자는 이미 후속 과제로 등재돼 있고 후자는 현재 워킹트리에서 이미 자체 해소된 상태다. 신규 식별자 충돌 관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
