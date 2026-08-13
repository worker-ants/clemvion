# 정식 규약 준수 검토 — spec/5-system/ (impl-done)

## 사전 메모 — 입력 재구성

prompt_file 은 컨텍스트 예산 초과로 `<git diff origin/main...HEAD -- code_areas>` 블록 자체와
`spec/conventions/**` 상당수(262개)가 절단되어 있었다(각 항목에 "⚠️ 본문 생략됨 — 컨텍스트 예산
초과" 마커). 이 상태로는 실제 변경분을 볼 수 없어, `spec/5-system/4-execution-engine.md` 만 온전히
포함된 번들 대신 워킹트리에서 **직접** 아래를 재구성해 검토했다:

- `git log --oneline origin/main..HEAD` / `git diff origin/main...HEAD -- codebase` — 실 diff(5 파일,
  +254/-37, 전부 `codebase/backend/src/modules/{execution-engine,executions,chat-channel}/**`).
- `spec/conventions/error-codes.md` · `node-cancellation.md` · `spec-impl-evidence.md` 전문(Read) —
  프롬프트에서 생략됐던 세 문서를 직접 열어 대조.
- `spec/5-system/4-execution-engine.md` — 프롬프트에 포함된 내용으로 §1(상태 머신)·§8(admission gate)
  구조 확인.

## 검토 대상 diff 요약

이번 diff 는 spec 문서 변경이 **없고**(`spec/5-system/**` 무변경), 코드만 변경됐다:

1. `execution-engine.service.ts` — `admitExecutionOrDefer` 트랜잭션 내부에 `Array.isArray(rows)` 방어
   가드 추가(`EntityManager.query` 의 `Promise<any>` 반환 shape 불일치 시 throw, 부분 적용 방지).
2. `executions.service.ts` — `SNAPSHOT_CACHE_MAX_ENTRIES` 상수를 테스트에서 참조 가능하도록 `export`.
3. 나머지는 전부 `.spec.ts` 테스트 파일(harness 리팩터 + 신규 케이스 3건 — LRU 상한/방향, 배열 아님
   가드, 로그 레벨 분기).

## 발견사항

CRITICAL/WARNING 급 위반 없음. 아래는 확인만 하고 위반으로 판정하지 않은 항목이다(근거 명시).

- **[INFO] 신규 내부 guard 에러 메시지의 한국어/prefix 스타일이 파일 내 기존 관례와 완전히 통일돼
  있지는 않음**
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2932-2934`
    (`throw new Error(\`admission: UPDATE ... RETURNING 이 배열이 아님 …\`)`)
  - 위반 규약: 해당 없음 — `spec/conventions/error-codes.md` 는 **`error.code`(응답 봉투 코드)** 의
    명명만 규율하고, 이 throw 는 `error.code` 를 만들지 않는 일반 내부 `Error`(BullMQ job 예외로만
    전파, REST 로 노출되지 않음)라 §1 적용 범위 밖이다. 언어(한국어 vs 영어) 나 접두 표기를 강제하는
    별도 convention 문서도 없다.
  - 상세: 같은 파일의 다른 `throw new Error(...)` 는 영어 전용(`Sub-workflow recursion depth …`),
    `TOKEN_NAME:` 대문자 접두(`CONTAINER_CYCLE:`, `INVALID_SUB_WORKFLOW_TRIGGER:`, `INVALID_NODE_CONFIG:`),
    혹은 접두 없는 영어 문장이 섞여 있다. `INVALID_SUB_WORKFLOW_TRIGGER:` 처럼 한국어 설명이 뒤섞인
    선례도 이미 존재해(`3894-3898`), 이번 추가가 새로운 패턴을 만드는 것은 아니다.
  - 제안: 규약으로 강제할 근거가 없으므로 수정 불요. 팀이 내부 diagnostic Error 문자열의 언어/접두
    표기를 통일하고 싶다면 `spec/conventions/error-codes.md` §4 급의 신설 절(§0 "내부 전용 진단
    Error" 등)로 명문화하는 편이 향후 유사 지적 재발을 막는다.

- **검토했으나 위반 아님 — frontmatter `code:` 커버리지**
  - `spec/5-system/4-execution-engine.md` frontmatter `code:` 는
    `codebase/backend/src/modules/execution-engine/**` 글로브를 포함하므로 변경 파일(`execution-engine.service.ts`)
    은 이미 커버된다. `executions.service.ts`/`chat-channel.dispatcher.spec.ts` 는 각각 다른 spec 영역
    소관이며 이번 diff 로 새 계약이 생기지 않아(테스트 전용 + export 만) frontmatter 갱신 의무
    (`spec-impl-evidence.md` §3) 를 트리거하지 않는다.

- **검토했으나 위반 아님 — 상수 export 네이밍**
  - `export const SNAPSHOT_CACHE_MAX_ENTRIES = 256;` 는 같은 파일에 이미 export 돼 있던
    `MAX_EXECUTION_PATH_ROWS` 와 동일한 `UPPER_SNAKE_CASE` 상수 export 패턴이라 신규 불일치 없음.

- **검토했으나 위반 아님 — API/문서 구조/출력 포맷**
  - diff 가 controller·DTO·Swagger 데코레이터·WS/REST 이벤트 payload 를 전혀 건드리지 않아
    `spec/conventions/swagger.md`, `error-codes.md`(응답 봉투 축), `redis-keys.md` 등 출력 포맷·API
    문서 규약이 적용될 표면이 이번 변경에 없다.
  - `spec/5-system/4-execution-engine.md` 는 `## Overview` / 본문(§1~§11) / `## Rationale` 3섹션
    구조를 유지하고 있어 CLAUDE.md 문서 구조 컨벤션과 일치한다(문서 자체는 이번 diff 로 변경되지 않음).

## 요약

이번 diff 는 spec 문서 변경 없이 `execution-engine`/`executions`/`chat-channel` 모듈에 방어적 가드
1건, 테스트용 상수 export 1건, 테스트 파일 리팩터/신규 케이스로만 구성돼 있다. API 표면·이벤트
payload·에러 코드 봉투·문서 구조·명명 규약에 실질적으로 부딪히는 지점이 없어 정식 규약(`spec/conventions/**`)
위반은 발견되지 않았다. 유일한 관찰은 신규 내부 진단 `Error` 문자열의 언어/접두 스타일이 완전히
통일돼 있지 않다는 INFO 수준 지적이며, 이를 규율할 명시적 규약이 없어 위반으로 판정하지 않았다.
prompt_file 의 예산 절단으로 diff·다수 conventions 원문이 누락돼 있었기 때문에, 본 검토는 워킹트리에서
`git diff`/`Read` 로 직접 재구성한 내용을 근거로 한다.

## 위험도
NONE
