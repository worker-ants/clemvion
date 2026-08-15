# 신규 식별자 충돌 검토 — `spec/5-system/14-external-interaction-api.md` (impl-done)

## 조사 방법

`git diff origin/main...HEAD -- spec/5-system/` 로 실제 target 델타를 확정했다 (bundle 에 포함된
문서 본문 전체는 대부분 기존 확립 spec 이며, 이번 라운드의 실질 변경은 아래 3개 hunk 뿐):

1. `durationMs` 필드 상태를 "미구현 (Planned)" → "구현됨" 으로 전환 (§6 종결 이벤트 필드 집합 표,
   §6.3/§6.4/§6.5 payload 예시에 `"durationMs": 4242` 추가, `EXECUTION_QUEUE_WAIT_TIMEOUT` 경로의
   의미(큐 대기 시간) 명시).
2. §12 호환성 절의 Re-run 참조 URL 오탈자 수정: `POST /api/v1/executions/:id/re-run` →
   `POST /api/executions/:id/re-run`.
3. 연쇄 반영: `spec/3-workflow-editor/3-execution.md`(WS 이벤트 표에 `duration` 필드 추가) ·
   `spec/conventions/chat-channel-adapter.md`(`durationMs` optional 서술 갱신) — 5-system 델타와
   동일 사실을 미러링.

코드 레벨 신규 식별자(`codebase/backend/src/shared/utils/terminal-duration.ts`)도 함께 확인했다
(spec 이 코드 SoT 로 직접 지목하므로).

## 발견사항

없음 — 아래는 점검 관점별 확인 결과.

1. **요구사항 ID 충돌** — 이번 델타는 신규 `EIA-*` ID 를 부여하지 않는다(기존 ID 텍스트만 소폭 갱신).
   충돌 없음.

2. **엔티티/타입명 충돌** — `durationMs` 자체는 **신규 식별자가 아니다**. origin/main 시점부터 이미
   §6 필드 집합 표·§6.2/§6.3/§6.4 주석에 "Planned" 필드명으로 존재했고(`git show
   origin/main:spec/5-system/14-external-interaction-api.md | grep durationMs` 로 확인), 이번
   델타는 상태 플래그만 바꿨다. 또한 `durationMs` 는 `spec/4-nodes/4-integration/0-common.md`
   §6.1("`meta.duration` vs `meta.durationMs` 명명 통일"), `spec/2-navigation/14-execution-history.md`,
   `spec/2-navigation/4-integration.md` 전반에서 이미 "ms 단위 소요 시간" 의미로 통일 사용 중이며,
   본 스펙의 신규 사용도 동일 의미 — 충돌 없음.
   신규 코드 식별자 `resolveTerminalDurationMs` / `toFiniteNumber` / `TERMINAL_DURATION_MS_SQL` /
   `TERMINAL_FINISHED_AT_PARAM` (`terminal-duration.ts`)도 `codebase/backend/src` 전체에서
   grep 했을 때 정의처가 이 파일 하나뿐이며 다른 의미로 재사용되는 동명 식별자가 없다.

3. **API endpoint 충돌** — 유일한 endpoint 관련 변경은 §12 의 참조 URL 수정
   (`/api/v1/executions/:id/re-run` → `/api/executions/:id/re-run`). 이것은 **신규 endpoint 선언이
   아니라 기존 endpoint(이미 [`spec/5-system/13-replay-rerun.md` §8.1](../../../../../../spec/5-system/13-replay-rerun.md)
   과 [`spec/2-navigation/14-execution-history.md`](../../../../../../spec/2-navigation/14-execution-history.md)
   에 정의된 `POST /api/executions/:executionId/re-run`)를 정확히 가리키도록 고친 오탈자 수정**이다.
   수정 전 값(`/api/v1/...`)은 이 코드베이스에서 내부 API 에 쓰인 적이 없는 접두사이고
   (`/api/v1/` 는 MakeShop 외부 3rd-party API 전용 — `spec/4-nodes/4-integration/5-makeshop.md`,
   `spec/conventions/makeshop-api-catalog/**`), 오히려 이번 수정이 잘못된 참조를 제거해 잠재적 혼선을
   줄였다. 신규 endpoint 도입 없음 — 충돌 없음.

4. **이벤트/메시지명 충돌** — `execution.completed`/`execution.failed`/`execution.cancelled` 이벤트
   이름 자체는 불변. 이번 델타는 기존 이벤트의 **payload 필드**(`durationMs`)만 채운다. 신규 이벤트명
   없음 — 충돌 없음.

5. **환경변수·설정키 충돌** — 신규 ENV/설정키 없음. `EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 등은 §6.5 주석이
   참조만 할 뿐 재정의하지 않으며, `spec/5-system/3-error-handling.md`·`4-execution-engine.md` 의
   기존 정의와 의미가 일치한다(큐 대기 5분).

6. **파일 경로 충돌** — 신규 spec 파일 없음(기존 3개 spec 파일 in-place 수정). 신규 코드 파일
   `codebase/backend/src/shared/utils/terminal-duration.ts` 는 동일 디렉토리(`shared/utils/`)의
   기존 helper 명명 컨벤션(`strip-external-only-fields.ts` 등 kebab-case 단일 책임 유틸)과 부합하고
   기존 파일과 경로 중복 없음.

## 참고 — 의도된 명명 분기 (충돌 아님, 이미 문서화됨)

`durationMs`(EIA/Integration 계열) vs `duration`(WS 계열, `spec/3-workflow-editor/3-execution.md`
이벤트 표)는 **같은 값을 가리키는 서로 다른 필드명**이다. 이는 이번 델타가 새로 만든 분기가
아니라 스펙 본문이 명시적으로 인지하고 있는 기존 관례 차이다("WS 계열 문서는 같은 값을
`duration` 으로 적는다 — 표기만 다르고 같은 값이다 (전역 개명은 별건)", §6 필드 집합 표).
신규 식별자 충돌은 아니므로 CRITICAL/WARNING 으로 등재하지 않는다.

## 요약

이번 target 델타(`spec/5-system/14-external-interaction-api.md` 및 연쇄 반영 2개 파일)는
① 이미 문서에 "Planned" 로 예약되어 있던 `durationMs` 필드명의 상태를 구현 완료로 전환하고,
② 실제로는 한 번도 존재한 적 없는 잘못된 `/api/v1/` 접두 URL 을 올바른 기존 endpoint 로 정정한
것이 전부다. 요구사항 ID·엔티티/타입명·endpoint·이벤트명·환경변수·파일 경로 6개 관점 모두에서
신규 도입 식별자가 없거나, 있어도(코드 helper 4개) 기존 사용처와 의미가 겹치지 않는 완전
신규·유일 이름임을 확인했다. 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
