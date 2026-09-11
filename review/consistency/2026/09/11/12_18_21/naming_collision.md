# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done)

## 전제

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- **`spec/5-system/` 델타는 0개 파일** — 이 PR 은 그 spec 영역의 문서를 바꾸지 않았다. 신규
  식별자는 spec 텍스트가 아니라 **구현 diff**(10개 파일 / 813줄 중, `codebase/`+`CHANGELOG.md`
  기준 11개 파일 / 444줄)가 도입한 것들이다. 아래는 그 구현 diff를 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/impl-details-code-c8f31a`)에서
  직접 `git diff`/`grep` 으로 확인한 결과다.
- 변경 내용 요약: `2-api-convention.md` §5.3 이 이미 규약화한 *「`details` 항목이 `field` 를
  실으면 `code` 도 싣는다」* 를 `triggers.service.ts`(객체 13곳) + `password.util.ts`(배열
  2곳)에 배선하고, `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 을 추가했다. 신규 파일
  `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 가
  기존에 DTO/서비스 양쪽에 흩어져 있던 거부 메시지 리터럴을 하나로 추출한다.

## 점검한 신규 식별자와 결과

| 신규 식별자 | 종류 | 충돌 검사 결과 |
|---|---|---|
| `CHAT_CHANNEL_BLOCKED_FIELDS` | 상수(배열) | 저장소 전체에서 신규 파일 및 그 직접 사용처(`triggers.service.ts`, `triggers.service.spec.ts`, `dto/trigger-dto-validation.spec.ts`) 외 매치 없음. 충돌 없음 |
| `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` | 상수(Record) | 동일 — 신규, 기존 사용처 없음. 충돌 없음 |
| `ChatChannelBlockedField` | 타입 | 동일 — 신규, 기존 사용처 없음. 충돌 없음 |
| `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` | 파일 경로 | `modules/triggers/` 에 동명 파일 없음. `*.const.ts` 명명 컨벤션은 기존 `modules/audit-logs/audit-action.const.ts`, `modules/knowledge-base/embedding/embedding-dimensions.const.ts` 와 일치 — 컨벤션 위반 없음 |
| `ErrorCode.INVALID_FIELD` (신규 import: `triggers.service.ts` → `../../nodes/core/error-codes`) | 기존 enum 값의 신규 참조처 | `INVALID_FIELD` 는 `nodes/core/error-codes.ts` 에 이미 정의돼 있고 `common/pipes/validation.pipe.ts`·`modules/execution-engine/workflow-errors.ts` 가 이미 같은 의미(`VALIDATION_ERROR` 응답의 `details[].code`)로 써 왔다. 신규 도입이 아니라 **기존 canonical 값의 배선 확장**이며 값(`'INVALID_FIELD'`)도 리터럴·enum 양쪽 모두 동일 — 의미 충돌 없음. `triggers.service.ts` 에 `ErrorCode` 라는 이름의 기존 import 도 없어 지역 이름 충돌도 없음 |
| `code: 'INVALID_FIELD'` (문자열 리터럴, `password.util.ts`) | 기존 값의 신규 발행 지점 | 위와 동일 값. `common/` 계층이 `nodes/` 의 `ErrorCode` 를 import 하지 않는 기존 선례(0건)를 지키기 위해 의도적으로 리터럴을 유지한다고 diff 자체 주석에 근거가 명시돼 있음 — layer 간 값 표현 방식 차이이지 의미 충돌 아님 |
| `@MinLength(1)` (신규 데코레이터 사용, `ChatChannelConfigDto.botToken`) | 검증 규칙 추가 | `MinLength` 는 같은 파일 상단에서 이미 import 되어 있던 데코레이터(신규 import 아님). 다른 필드에 `@MinLength(1)` 이 이미 쓰이고 있어도 의미는 "최소 길이 1" 로 전 필드 공통이라 충돌 없음 |
| CHANGELOG.md `## Unreleased — …` 신규 섹션 | 문서 섹션 헤더 | 이 저장소의 확립된 컨벤션(동일 `## Unreleased` 접두 + 고유 부제)과 일치 — 80여 개 기존 `## Unreleased` 헤더와 같은 패턴, 제목 텍스트도 고유해 중복 없음 |
| API endpoint / 이벤트명 / 환경변수 | — | 이번 diff 는 신규 endpoint·webhook/queue/SSE 이벤트명·ENV var·config key 를 하나도 추가하지 않는다(순수 검증 로직·에러 payload 필드 배선 + 상수 추출) |

## 발견사항

없음 — 이번 diff 가 도입한 식별자(상수 3개, 신규 파일 1개, 기존 enum 값의 신규 참조)는
모두 저장소 전역에서 유일하며, 기존 명명 컨벤션(`*.const.ts`)·기존 canonical 값
(`ErrorCode.INVALID_FIELD`)과 의미·형태 양쪽에서 일치한다. `spec/5-system/15-chat-channel.md`
§5.4.1 은 이 배선을 사전에 *"배선 전 관측값"* 대 *"배선 뒤"* 로 이미 서술해 두었고
(`R-CC-21` 각주, 2026-09-11 갱신), 이번 구현이 그 예고를 실현한 것으로 확인된다 — 새 의미의
충돌이 아니라 예고된 배선의 실행이다.

## 요약

target(`spec/5-system/`) 자체는 이번 PR 에서 변경되지 않았고(델타 0), 실제 변경은 그 spec
§5.3/§5.4.1 이 이미 규정·예고한 `details[].code` 규칙을 15개 발행 지점에 배선하는
구현 diff 다. 이 diff 가 신규로 도입하는 식별자(상수 3개 + 신규 상수 파일 1개)는 저장소
전역을 검색해도 기존 사용처와 겹치지 않으며, 재사용한 기존 식별자(`ErrorCode.INVALID_FIELD`)
도 이미 확립된 의미 그대로 쓰인다. 신규 API endpoint·이벤트명·ENV var·config key 도입은
없다. 신규 식별자 충돌 관점에서 이번 변경은 안전하다.

## 위험도

NONE
