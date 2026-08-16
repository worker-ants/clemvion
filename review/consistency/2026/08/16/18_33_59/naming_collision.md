# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 검토 범위 확인

`diff-base=origin/main` 대비 실제 변경분은 2개 spec 파일뿐이었다 (bundle 에 포함된 프롬프트 본문은
`spec/5-system/` 전체 + 광범위한 관련 spec/conventions 코퍼스이며, 그 중 실제 target diff 는
`git diff origin/main...HEAD -- spec/5-system/` 로 직접 확인):

- `spec/5-system/14-external-interaction-api.md` — §7.1 캐비엇 정정 1곳, §R17 마스킹 카탈로그에
  "내부 읽기 경로도 같은 마스킹을 적용한다" 불릿 신설, frontmatter `code:` 리스트에 2개 파일 추가
- `spec/5-system/6-websocket-protocol.md` — §4.1 `execution.snapshot` 행에 마스킹 상속 캐비엇 1문장 추가

target 이 도입하는 신규 식별자는 다음 2개로 좁혀진다:

1. 신규 파일 `codebase/backend/src/shared/utils/redact-stored-error.ts`
2. 신규 함수 `redactStoredErrorForResponse`

각각을 기존 사용처와 대조했다.

## 발견사항

### 신규 식별자 자체는 충돌 없음 — 이전 라운드에서 이미 검출·수정됨

- **[INFO]** `redactStoredErrorForResponse` 명명 충돌 회피가 이미 문서화되어 있고 잔존 오염 없음
  - target 신규 식별자: `redactStoredErrorForResponse` (`codebase/backend/src/shared/utils/redact-stored-error.ts:57`)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` 의 예외 클래스 `ExecutionError`
  - 상세: 초안 이름 `redactExecutionErrorValue` 가 기존 `ExecutionError` 예외 클래스명을 온전한
    부분 문자열로 포함해 "제어흐름 타입 예외 계층"과 "DB 컬럼 값 마스킹 유틸"을 혼동시킬 여지가
    있었다. 이는 이전 리뷰 라운드(`16_03_57` naming checker, W1)에서 이미 지적되어 현재 이름으로
    바뀌었고, 소스 docstring(`redact-stored-error.ts:9-12`)에 그 배경이 명시돼 있다.
    `spec/5-system/14-external-interaction-api.md`·`CHANGELOG.md`·
    `plan/in-progress/eia-internal-rest-error-masking.md` 전수 grep 결과 폐기된 이름
    `redactExecutionErrorValue` 의 잔존 참조는 0건이다 (앞선 `review/code/2026/08/16/17_35_49/documentation.md`
    가 지적했던 stale 참조도 현재 target 상태에는 남아있지 않음).
  - 제안: 없음 — 이미 해소됨. 추가 조치 불필요.

- **[INFO]** 신규 파일 경로는 기존 명명 컨벤션과 일치
  - target 신규 식별자: `codebase/backend/src/shared/utils/redact-stored-error.ts`
  - 기존 사용처: 같은 디렉토리의 자매 파일 `terminal-error-payload.ts`·`strip-external-only-fields.ts`·
    `sanitize-error-message.ts` (모두 kebab-case 동사-목적어 패턴)
  - 상세: 새 파일명이 디렉토리 명명 컨벤션(동사+대상, kebab-case)을 따르고, 기존 파일과 이름이
    겹치거나 혼동될 소지가 없다. `redact.ts`(`workflow-assistant/tools/redact.ts`, export
    `redactConfig`)라는 유사 어휘("redact")의 파일이 별도 모듈에 존재하지만 정확한 파일명·함수명이
    다르고 스코프도 분리돼 있어 충돌이 아니다.
  - 제안: 없음.

### 검토한 그 외 항목 — 신규 식별자 부재

- **요구사항 ID**: 이번 diff 는 새 `EIA-*`/`R*` ID 를 발급하지 않는다. §R17 은 기존 ID 에 불릿만
  추가했다 (기존 카탈로그 확장, 신규 ID 아님).
- **엔티티/타입명**: spec 본문에 새로 노출된 타입명 없음. 코드 쪽에 `ResponseExecution` 타입이
  이번 PR 에서 좁혀졌으나(`Execution` → `ResponseExecution`), 이 타입명 자체는 target spec 본문에
  등장하지 않아 신규 식별자 충돌 스코프 밖이다 (spec 은 메서드명 `findById`/`toExecutionDto`/
  `getChain`/`stop` 만 언급하며, 넷 모두 diff 이전부터 존재하던 기존 메서드다).
- **API endpoint**: 신규 endpoint 없음. 언급된 `POST /executions/:id/re-run`, WS `execution.snapshot`
  은 기존 endpoint/이벤트를 재인용했을 뿐이다.
- **이벤트/메시지명**: 신규 이벤트명 없음. `execution.snapshot` 캐비엇 추가는 기존 이벤트 행 설명
  보강이다.
- **환경변수·설정키**: 신규 ENV/config key 없음.
- **파일 경로(spec)**: 이번 diff 는 기존 spec 파일 2개의 본문·frontmatter 만 수정했고 신규 spec
  파일을 만들지 않았다.

## 요약

이번 target diff(`spec/5-system/14-external-interaction-api.md` §7.1·§R17, `6-websocket-protocol.md`
§4.1)가 실제로 도입하는 신규 식별자는 함수 `redactStoredErrorForResponse` 와 파일
`redact-stored-error.ts` 둘뿐이며, 둘 다 기존 사용처와 충돌하지 않는다. 특히 `ExecutionError`
예외 클래스와의 잠재적 명명 혼동은 이미 이전 리뷰 라운드에서 검출되어 현재 이름으로 정정된 상태이고,
정정 배경이 소스 docstring 에 남아 재발을 막고 있다. 요구사항 ID·API endpoint·이벤트명·ENV
변수·spec 파일 경로 축에서는 신규 식별자 자체가 발급되지 않아 해당 축의 충돌 위험도 없다.

## 위험도
NONE
