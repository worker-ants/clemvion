# 정식 규약 준수 검토 — spec/5-system/ (impl-done)

## 사전 메모 — 입력 재구성

`prompt_file` 은 컨텍스트 예산 초과로 `<git diff origin/main...HEAD -- code_areas>` 블록 자체와
`spec/5-system/**` 19개 파일, `spec/conventions/**` 상당수가 절단되어 있었다(각 항목에 "⚠️ 본문
생략됨 — 컨텍스트 예산 초과" 마커). 실제 변경분을 보기 위해 워킹트리(HEAD, 절대경로
`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 직접
재구성했다:

- `git diff origin/main...HEAD --stat` / `-- codebase` — 실 diff. `merge-base(HEAD, origin/main)
  == origin/main` 이라 branch 고유 diff 는 5개 코드/테스트 파일 + review 산출물뿐이고
  **`spec/**` 변경은 0건**이다.
- `git log --format='%h %ad %s'` 로 각 커밋의 실제 내용을 확인 — 이 브랜치는
  `4fcc1b43a`(테스트 3건 추가) → `c31c96529`(코드 리뷰 `14_01_46` WARNING 3건 fix) →
  `258b7691d`(consistency `--impl-done` 이 spec/5-system/ 선재 CRITICAL 을 등재) →
  `6570ca3bb`(그 CRITICAL 을 PR #1166 이 이미 집행했다는 사실을 plan 에 반영, 종결)로 이어지는
  회고적 커밋 체인이다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` L743-785 — 등재됐던 CRITICAL
  ("EIA outbound notification payload 가 spec 계약과 근본적으로 다르다")의 등재·종결 서술 전문.
- `spec/5-system/14-external-interaction-api.md` §6 도입부(L552-618), `spec/5-system/
  6-websocket-protocol.md` §4.1(L168-206) — 그 CRITICAL 을 해소한 실제 spec 서술을 직접 대조.
- `spec/conventions/redis-keys.md`(번들 포함), `spec/conventions/node-cancellation.md`(번들
  포함), `spec/conventions/secret-store.md`(번들 포함) 전문.

## 검토 대상 diff 요약

`origin/main` 대비 이 브랜치의 diff 는 **spec 문서 변경이 0건**이고, 코드도 이미 직전
코드 리뷰(`14_01_46`)에서 검증된 것과 동일 표면이다:

1. `execution-engine.service.ts` — `admitExecutionOrDefer` 트랜잭션 내부 `Array.isArray(rows)`
   방어 가드. 최초엔 `return false`(defer)로 삼켰다가, 같은 브랜치 안에서 `throw`(트랜잭션
   롤백 보존)로 정정됐다 — 최종 상태만 origin/main 대비 diff 에 남는다.
2. `executions.service.ts` — `SNAPSHOT_CACHE_MAX_ENTRIES` 를 테스트에서 참조 가능하도록 `export`.
3. 나머지는 `.spec.ts` 테스트 파일(harness 공통화 `makeDispatcherHarness`, 신규 케이스) +
   `review/**` 산출물 + `plan/in-progress/backend-lint-gate-broken-on-main.md` 갱신(코드 리뷰
   RESOLUTION 반영, consistency 등재/종결 기록).

이 diff 자체는 REST/WS/webhook payload, Swagger 데코레이터, Redis 키, secret ref, 에러 코드
봉투 등 정식 규약이 규율하는 표면을 전혀 만들지 않는다 — 내부 admission 트랜잭션의 방어적
가드와 테스트 전용 export 뿐이다.

## 검토 대상 — plan 이 등재했던 CRITICAL 의 현재 상태

이번 브랜치의 `258b7691d`/`6570ca3bb` 커밋은 코드를 바꾸지 않고, 이전 라운드에서 등재된
`spec/5-system/14-external-interaction-api.md` §6.3~§6.5 / `6-websocket-protocol.md` §4.1 의
CRITICAL drift(문서가 실제 emit 하지 않는 `result.outputs`/`finalNodeId`/`finalPort`/
`durationMs` 를 약속)가 **이미 `origin/main` 에 병합된 PR #1166 로 해소돼 있다**는 사실을
plan 에 반영한 것뿐이다. 실측으로 재확인했다:

- `14-external-interaction-api.md` §6 도입부(L554-560)가 "이 절이 outbound 이벤트 계약의
  SoT" 라고 명시하고, 종결 이벤트 필드 표(L562-578)가 구현 상태(`구현됨` / `미구현 (Planned)` /
  `삭제된 약속`)를 정확히 라벨링한다 — `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 는
  "엔진에 개념 자체가 없다" 고 명시적으로 삭제.
- `6-websocket-protocol.md` §4.1(L195-199)은 필드를 재나열하지 않고 EIA §6 앵커로 포인터만
  건다 — `redis-keys.md` 가 이미 정립한 "표 하나가 두 번째 SoT 가 되는 것을 막는다" 원칙
  (L462-465)과 동형의 구조.

이는 정식 규약(`spec/conventions/redis-keys.md` 의 SoT/포인터 원칙)이 다른 영역(EIA/WS)에
확장 적용된 사례로, **위반이 아니라 규약 준수의 근거**로 확인했다.

## 발견사항

CRITICAL/WARNING 급 위반 없음.

- **[INFO] 신규 내부 guard 에러 메시지의 스타일이 파일 내 기존 관례와 완전히 통일되어 있지
  않음** (이전 라운드 `14_18_42` 리뷰에서도 동일 지적 — 재확인만 함, 신규 아님)
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`admitExecutionOrDefer` 내부 `throw new Error(\`admission: UPDATE ... RETURNING 이
    배열이 아님 …\`)`) — 이번 브랜치에서 `return false` → `throw` 로 바뀌며 메시지 문구도
    갱신됐으나 스타일 성격은 그대로다.
  - 위반 규약: 해당 없음 — `spec/conventions/error-codes.md` 는 `error.code`(REST 응답 봉투
    코드)의 명명만 규율한다. 이 `throw` 는 `error.code` 를 만들지 않는 내부 `Error`(트랜잭션
    콜백 내부에서 즉시 catch·로그되는 진단용, REST 로 노출되지 않음)라 적용 범위 밖이다.
  - 상세: 같은 파일에 영어 전용 메시지(`Sub-workflow recursion depth …`), `TOKEN_NAME:`
    대문자 접두(`CONTAINER_CYCLE:` 등), 한국어 설명이 섞인 선례(`INVALID_SUB_WORKFLOW_TRIGGER:`)
    가 혼재한다. 이번 변경이 새 패턴을 만들지는 않는다.
  - 제안: 규율할 근거 규약이 없어 수정 불요. 내부 진단 `Error` 문자열 스타일을 통일하고 싶다면
    `spec/conventions/error-codes.md` 에 "내부 전용 진단 Error" 절을 신설하는 편이 향후 유사
    지적의 판정 기준을 명확히 한다.

- **검토했으나 위반 아님 — frontmatter `code:` 커버리지**
  - `spec/5-system/4-execution-engine.md` frontmatter `code:` 는
    `codebase/backend/src/modules/execution-engine/**` 글로브를 포함해 변경 파일
    (`execution-engine.service.ts`) 을 이미 커버한다(실측: `code:` 블록 L4-8). `executions.
    service.ts`/`chat-channel.dispatcher.spec.ts` 는 이번 diff 로 새 계약이 생기지 않아
    (테스트 전용 + export 만) `spec-impl-evidence.md` §3 의 frontmatter 갱신 의무를 트리거하지
    않는다.

- **검토했으나 위반 아님 — 상수 export 네이밍**
  - `export const SNAPSHOT_CACHE_MAX_ENTRIES = 256;` 는 같은 파일에 이미 export 돼 있던
    `MAX_EXECUTION_PATH_ROWS` 와 동일한 `UPPER_SNAKE_CASE` 상수 export 패턴이라 신규 불일치 없음.

- **검토했으나 위반 아님 — API/문서 구조/출력 포맷**
  - diff 가 controller·DTO·Swagger 데코레이터·WS/REST/webhook payload 를 전혀 건드리지 않아
    `swagger.md`·`error-codes.md`(응답 봉투 축)·`redis-keys.md`·`secret-store.md` 등 출력
    포맷·API 문서 규약이 적용될 표면이 이번 diff 에 없다.
  - `spec/5-system/4-execution-engine.md`·`14-external-interaction-api.md`·
    `6-websocket-protocol.md` 는 모두 `## Overview` / 본문(번호 절) / `## Rationale` 3섹션
    구조를 유지한다(실측: 각 문서 헤더 목록 grep). CLAUDE.md 문서 구조 컨벤션과 일치.

- **검토했으나 위반 아님 — plan 문서 갱신(`backend-lint-gate-broken-on-main.md`)**
  - `6570ca3bb` 은 이미 실행된 결정(PR #1166)을 plan 에 사후 반영하는 것으로, 등재 당시
    서술을 `<details>` 로 보존하고 종결 사유를 이어붙이는 형태다 — plan 라이프사이클/
    체크박스=실제상태 규약과 상충하지 않는다. (plan 구조 자체는 본 checker 의 1차 관점인
    `spec/conventions/**` 대상은 아니나, 인접 검토 관점에서 참고용으로 확인했다.)

## 요약

이번 브랜치가 `origin/main` 대비 만드는 diff 는 spec 문서 변경이 0건이고, 코드도 execution-engine
admission 게이트의 방어적 가드 1건(코드 리뷰 라운드에서 defer→throw 로 정정 완료) + 테스트용 상수
export 1건 + 테스트 리팩터/신규 케이스로만 구성돼 API 표면·이벤트 payload·에러 코드 봉투·Redis
키·secret ref·문서 구조·명명 규약 어디에도 실질적으로 부딪히지 않는다. 이 브랜치의 plan 갱신
커밋들은 이전 라운드가 등재했던 EIA CRITICAL(§6.3~§6.5 필드 drift)이 이미 `origin/main` 에 병합된
PR #1166 로 해소됐음을 사후 기록하는 것이며, 실측 결과 그 해소는 `redis-keys.md` 의 SoT/포인터
원칙과 동형으로 구현돼 있어 규약 위반이 아니라 규약 준수의 확장 사례로 확인됐다. 유일한 관찰은
이전 라운드와 동일한 INFO(내부 진단 Error 문자열 스타일 미통일이나 규율 규약 부재)뿐이다.

## 위험도
NONE
