# 신규 식별자 충돌 검토 — `impl-details-code-wiring` (impl-done, scope=`spec/5-system/`)

## 전제 확인

- `spec/5-system/` 델타는 0개 파일 — 이 브랜치는 spec 을 바꾸지 않는다(코드 전용 PR). 신규
  요구사항 ID·API 계약 텍스트는 이번 target 에 없다.
- 실제 신규 식별자는 `git diff origin/main...HEAD -- codebase`(10 files, 829 lines, 워킹트리
  `impl-details-code-c8f31a` 절대경로 기준 직접 조회)에서 나온다. 아래는 그 diff 를 전수
  대조한 결과다.

## 발견사항

이번 target 이 도입한 신규 식별자는 다음 4가지뿐이며, 전수 grep 대조 결과 **기존 사용처와
충돌하는 항목은 없었다**:

1. `CHAT_CHANNEL_BLOCKED_FIELDS` (`const`, 배열) — `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:27`
2. `ChatChannelBlockedField` (타입) — 같은 파일 `:35`
3. `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` (`const`, `Record`) — 같은 파일 `:42`
4. 파일 경로 `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규 파일)

`grep -rn "BlockedField|BLOCKED_FIELD" codebase --include=*.ts --include=*.tsx`(트리거
모듈 제외) 결과 0건 — 다른 영역에서 이 이름을 다른 의미로 쓰는 곳이 없다. 이 세 식별자는
`triggers.service.ts`·`chat-channel-config.dto.ts`·두 spec 파일에서만 소비되고, 전부 "PATCH 로
쓰기 금지된 5필드" 라는 하나의 의미로 일관되게 쓰인다.

- **[INFO]** 파일 경로 명명 컨벤션 — 정합
  - target 신규 식별자: `chat-channel-rejection-messages.const.ts`
  - 기존 사용처: `codebase/backend/src/modules/audit-logs/audit-action.const.ts`, `codebase/backend/src/modules/knowledge-base/embedding/embedding-dimensions.const.ts` (동일 kebab-case + `.const.ts` 접미사 컨벤션)
  - 상세: 저장소 전체에 `.const.ts` 파일이 이 신규 파일 포함 3개뿐이나, 명명 패턴·배치(해당 도메인 모듈 루트)가 기존 두 선례와 일치한다. 충돌·컨벤션 위반 없음.
  - 제안: 없음 (현행 유지).

- **[INFO]** `details[].code` 값 `'INVALID_FIELD'` — 신규 도입 아님, 기존 canonical 값 재사용 확인
  - target 신규 식별자: 아님. `triggers.service.ts` 13곳 + `password.util.ts` 2곳에 `code: ErrorCode.INVALID_FIELD` / `'INVALID_FIELD'` 를 채워 넣음.
  - 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts:116`(`INVALID_FIELD: 'INVALID_FIELD'`), `codebase/backend/src/common/pipes/validation.pipe.ts:58`, `codebase/backend/src/modules/execution-engine/workflow-errors.ts:300`, `spec/5-system/2-api-convention.md:185,194,229`, `spec/5-system/3-error-handling.md:257,262,270`.
  - 상세: target 이 채운 값은 spec 이 이미 `details[].code` 의 기본값으로 카탈로그화한 값과 문자 그대로 동일하다. 새 의미를 부여하지 않았고 기존 의미(generic 필드 검증 실패 표지)를 그대로 재사용했다 — 충돌 없음, 오히려 정합.
  - 제안: 없음.

- **[INFO]** `authConfigId` 자리의 top-level `code`(`AUTH_CONFIG_NOT_FOUND`)와 `details[].code`(`INVALID_FIELD`) 공존
  - target 신규 식별자: 아님(`AUTH_CONFIG_NOT_FOUND` 는 `origin/main` 에 이미 존재, `details[].code` 만 이번에 추가됨).
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:1023` 부근. `spec/5-system/2-api-convention.md` §5.3 은 "top-level `code` 교체" 와 "`details[].code`" 를 "겹쳐 쓰지 않는다" 고 적는다.
  - 상세: 이 자리는 같은 응답에 두 개의 `code` 필드(하나는 도메인 특화, 하나는 generic)가 서로 다른 경로(top-level vs `details[]`)에 공존한다. 두 값이 문자 그대로 충돌하는 것은 아니고(다른 필드), 개발자 스스로 §5.3 위반 여부가 "판정 사안" 이라고 주석·plan(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 명시적으로 남겨 planner 결정으로 이관해 두었다. 신규 식별자 충돌은 아니나, "같은 응답 봉투 안에 사유의 소재가 두 곳(top-level/details)" 이라는 관점에서 인접 관점 검토자(예: 필드-형태 검토자)가 이미 다루고 있을 사안이라 본 검토 범위에서는 정보성으로만 남긴다.
  - 제안: 이미 트래킹 중이므로 추가 조치 불요. §5.3 정정 PR 에서 함께 처리.

- **[INFO]** `CHANGELOG.md` 의 중복 `## Unreleased` 헤딩
  - target 신규 식별자: 새 `## Unreleased — 거부 사유가 사람만 읽을 수 있었다 …` H2 섹션 (`CHANGELOG.md:3`)
  - 기존 사용처: 같은 파일에 동일 문자열 `## Unreleased` 로 시작하는 헤딩이 이미 18개 이상 존재(`CHANGELOG.md:46,110,232,280,456,576,617,...`).
  - 상세: 이 저장소의 확립된 컨벤션은 "엔트리마다 별도의 `## Unreleased — <설명>` H2" 이며, 단일 `## Unreleased` 절 아래 항목을 누적하는 표준 Keep-a-Changelog 방식이 아니다. target 은 이 기존 컨벤션을 그대로 따랐을 뿐이며 새로운 충돌이 아니다.
  - 제안: 없음 (기존 컨벤션 준수).

## 비대상 확인 (grep 전수, 발견 없음)

- 신규 API endpoint(method+path): diff 에 `@Get/@Post/@Patch/@Delete` 신규 데코레이터 없음 — 이번 PR 은 기존 엔드포인트(`PATCH /api/triggers/:id`, `POST /api/triggers`)의 에러 payload 필드만 확장한다.
- 신규 webhook/queue/SSE 이벤트명: diff 에 이벤트 emit/구독 코드 없음.
- 신규 ENV var/config key: `process.env`/`ConfigService.get` 신규 호출 0건(전수 grep 확인).
- 신규 요구사항 ID: `spec/5-system/` 델타 0, 신규 ID 부여 없음.

## 요약

이번 target(`impl-details-code-wiring`, `spec/5-system` 델타 0·코드 diff 10파일/829줄)은
새 requirement ID·API endpoint·webhook 이벤트·ENV var 를 전혀 도입하지 않는다. 유일한 신규
식별자는 트리거 chat-channel 5필드 차단 메시지를 공유 상수로 뽑아낸
`CHAT_CHANNEL_BLOCKED_FIELDS`/`ChatChannelBlockedField`/`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
및 파일 `chat-channel-rejection-messages.const.ts` 이며, 저장소 전체 grep 대조 결과 기존
사용처와 이름·의미 모두 충돌하지 않는다. 재사용된 `'INVALID_FIELD'` 값도 spec 카탈로그의
canonical 값과 정확히 일치해 오히려 정합성을 높인다. `authConfigId` 자리의 top-level/details
`code` 공존은 개발자가 이미 별도 plan 항목으로 이관해 둔 미해결 정책 판단이라 신규 식별자
충돌로 보지 않는다.

## 위험도
NONE
