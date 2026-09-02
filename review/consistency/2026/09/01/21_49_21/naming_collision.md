# 신규 식별자 충돌 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 개요

target 은 `spec/conventions/error-codes.md` §Overview 에 이미 코드로 존재하는
`EngineErrorCode`(같은 파일의 `ErrorCode` 자매 const, `codebase/backend/src/nodes/core/error-codes.ts:147`)를
**문서로만 병기**한다. 새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·파일 경로를
전혀 신설하지 않는다 — 6개 관점 전부를 아래와 같이 실측했다.

## 실측한 관점별 확인

| 관점 | 확인 내용 | 결과 |
|---|---|---|
| 요구사항 ID | target 이 새 ID(§번호·R-접두 등)를 부여하는가 | 부여하지 않음. 기존 `ErrorCode`/`EngineErrorCode` 값을 재인용할 뿐 |
| 엔티티/타입명 | `EngineErrorCode` 가 다른 의미로 이미 쓰이는가 | `grep -rn "EngineErrorCode" codebase/` → `error-codes.ts`/`error-codes.spec.ts`/`engine-error-code-anchor(-guard).ts`/`execution-engine.service.ts`/`shutdown-state.service.ts` 뿐, 전부 같은 정의를 가리킴. spec 쪽엔 기존 참조가 0건(target 이 첫 spec 인용) — 그림자 정의 없음 |
| API endpoint | 새 method+path 도입 여부 | 없음 |
| 이벤트/메시지명 | webhook·queue·sse 이벤트명 신설 여부 | 없음 |
| ENV var·설정키 | 새 env/config key 신설 여부 | 없음 |
| 파일 경로 | `plan/in-progress/spec-draft-error-code-two-surfaces.md` 자신의 파일명이 기존 컨벤션·기존 파일과 겹치는가 | `find plan -iname "*spec-draft*"` 로 전수 확인 — `spec-draft-*` prefix 는 기존 관례(90+ 건, 예: `spec-draft-error-codes.md`)와 일치하고 슬러그 `error-code-two-surfaces` 는 중복 없음. `spec_impact: spec/conventions/error-codes.md` 도 기존 파일 — 신규 파일 경로 자체가 없음 |

target 이 인용하는 리터럴 코드값(`EXECUTION_QUEUE_WAIT_TIMEOUT`·`SERVER_INTERRUPTED`·
`WORKER_HEARTBEAT_TIMEOUT`·`EXECUTION_TIME_LIMIT_EXCEEDED`)도 전부 `error-codes.ts` 에 이미
존재하는 값을 그대로 재인용한 것이며(`grep -oE` 로 target 전문에서 추출해 4건 전수 대조),
신규 코드값 발행이 아니다.

## 발견사항

### [INFO] "층(layer)" 신규 병기 표현이 같은 파일군의 기존 "레이어" 와 다른 단어다

- target 신규 식별자: target 이 §Overview 개정안에 쓰려는 표현 — *"`ErrorCode` — **노드 핸들러
  층**의 대표 surface"* / *"`EngineErrorCode` — **엔진 층**의 대표 surface"*
- 기존 사용처:
  - `spec/conventions/error-codes.md:109`(`**레이어 주의** — EXECUTION_TIMEOUT 동명 코드`),
    `:114`(`본 절의 내부 분류 문자열과 레이어가 다르다`), `:69`, `:73` — 같은 문서가 이미
    "레이어" 를 이 개념(코드 분류 축 구분)에 4회 쓰고 있다.
  - `codebase/backend/src/nodes/core/error-codes.ts:116`(`EngineErrorCode` JSDoc 첫 줄:
    `"**엔진 레이어** 에러 코드 — 노드 핸들러가 아니라 엔진 자신이 …"`), `:125`
    (`레이어는 타입에 드러나고 SoT 는 하나로 남는다`).
  - `error-codes.spec.ts:57`(`"레이어를 타입으로 가른다" 는 주장`) — target 이 §Overview 의
    근거로 인용하는 바로 그 테스트 파일도 "레이어" 를 쓴다.
- 상세: target 이 새로 도입하려는 "층" 은 정확히 이 `ErrorCode`/`EngineErrorCode` 구분을
  가리키는데, 그 **정의를 담고 있는 소스(JSDoc)와 그 정의를 검증하는 테스트, 그리고 병기
  대상 문서 자신**이 이미 동일 개념에 "레이어" 라는 용어를 정착시켜 두었다. "층" 은 repo
  전역에서는 흔한 동의어(다른 여러 spec 문서가 "두 층"/"다층" 등으로 범용 사용)이므로
  전면적 충돌은 아니나, **바로 이 문서·이 코드·이 테스트 안에서는** "레이어" 가 이미
  이 정확한 구분(node-handler vs engine)의 명명자다. 같은 개념에 두 단어가 한 문서
  안에서 병존하면 독자가 "층" 과 "레이어" 가 다른 축을 가리키는지 헷갈릴 수 있다(순수
  identifier 충돌은 아니고 prose 용어 중복이라 이 checker 의 6개 관점 중 어디에도
  정확히 들어맞지는 않지만, "엔티티/개념명" 근접 사례로 기록한다).
- 제안: §Overview 개정 시 "노드 핸들러 층"/"엔진 층" 대신 **"노드 핸들러 레이어"/"엔진
  레이어"** 로 쓰거나, 최소한 `EngineErrorCode` JSDoc 이 이미 쓴 "엔진 레이어" 표현을
  그대로 재사용할 것. 이렇게 하면 규약 문서·코드 JSDoc·테스트 세 아티팩트가 같은 용어를
  공유해 "SoT 는 하나" 라는 target 스스로의 논지(§변경 제안 "파일은 하나, const 는 둘")와도
  더 정합한다.

## 요약

target 은 이미 존재하는 코드 const(`EngineErrorCode`)를 spec 문서에 처음으로 병기하는
문서 전용 변경으로, 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·spec 파일 경로
6개 관점 전부에서 **새 식별자를 신설하지 않는다** — 전수 grep 대조 결과 그림자 정의나
기존 사용처와의 실질 충돌은 발견되지 않았다. 유일하게 걸리는 것은 identifier 급은 아닌
prose 수준 이슈로, target 이 쓰려는 "층" 표현이 같은 문서·같은 코드 JSDoc·같은 테스트가
이미 정착시킨 "레이어" 라는 동의어와 한 문서 안에서 병존하게 된다는 점뿐이다(INFO, 수정
비용 낮음).

## 위험도

NONE
