# 보안(Security) Review — masking-gate-consolidation

## 검토 범위

`inputData`/`outputData`/`error` egress 마스킹 게이트 4곳(`toExecutionDto` ·
`toResponseExecution` · `findById` 의 `nodeExecutions[]` 루프 · `background-runs.service.ts`)을
`redact-stored-error.ts` 의 헬퍼 2개(`redactStoredFieldsForResponse` / `redactNodeExecutionRow`)로
통합한 순수 리팩터. 관련 소스(`redact-stored-error.ts`, `executions.service.ts`,
`background-runs.service.ts`, `redact-stored-error.spec.ts`)를 `Read` 로 전체 대조했다.

## 검증 절차

1. `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 가 내부적으로 종전과 동일한
   `redactStoredDataForResponse`/`redactStoredErrorForResponse` 를 그대로 호출하는지 확인 —
   `deepRedactSecrets` 호출 경로가 한 겹 래핑됐을 뿐 마스킹 로직 자체(패턴·copy-on-change)는
   무변경.
2. 4개 호출부 전부에서 마스킹 스프레드가 **리터럴/`...rest` 뒤**에 위치해 원문 값을 덮어쓰는
   순서가 유지되는지 확인:
   - `toExecutionDto`(`executions.service.ts:1005`) — 리터럴 필드 뒤에 스프레드.
   - `toResponseExecution`(`executions.service.ts:1069`) — `...rest`(엔티티 전체 스프레드) **뒤**에
     `...redactStoredFieldsForResponse(rest)` — 순서가 바뀌면 원문 `error`/`inputData` 가 새어
     나가는 회귀인데, 순서 보존 확인.
   - `findById` 의 `nodeExecutions[]` 루프(`executions.service.ts:704`) — `redactNodeExecutionRow(ne)` 로
     대체, 세 컬럼 모두 마스킹 대상에 포함(종전 `error` 만 가리던 조건을 3컬럼으로 넓힌 상태 유지).
   - `background-runs.service.ts:302` (`toNodeExecutionDto`) — 동일 패턴.
3. `redactNodeExecutionRow` 의 제네릭이 `row` 를 통째로 `{...row, inputData, outputData, error}` 로
   재구성할 때 마스킹된 세 필드가 항상 원본 필드를 덮어쓰는 순서(스프레드 뒤 명시 키)인지 확인 —
   원문 유출 가능성 없음.
4. `redact-stored-error.spec.ts` 신규 스위트(`redactStoredFieldsForResponse`/
   `redactNodeExecutionRow`)가 자격증명 패턴(연결 문자열의 `user:pw@`, `Bearer sk-live-…`)을
   실제로 마스킹하는지, 그리고 3컬럼 각각을 독립적으로 단언(`it.each`)해 "한 컬럼만 확인하고
   나머지는 누락" 하는 형태의 회귀를 막는지 확인 — 판별력 있음.
5. `spec/conventions/egress-masking.md` §3 수정은 좌표계(마스커 vs 호출부) 정정 산문일 뿐,
   표에 나열된 마스커 목록·연산자·경계 자체는 무변경 — 보안 계약 약화 없음.

## 발견사항

- **[INFO]** 테스트 픽스처에 자격증명 형태의 리터럴 문자열 사용
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (`redactStoredFieldsForResponse`/`redactNodeExecutionRow` describe 블록의 `CRED` 상수 — `'connect failed: postgres://u:pw@db.internal/prod'`, `'Bearer sk-live-abc123def456'`)
  - 상세: 마스킹 정규식이 실제로 매치하는지 검증하기 위한 의도적 가짜(fake) 자격증명 픽스처다. `sk-live-…` 는 Stripe 라이브 키와 형태가 유사하지만 실제 키 스페이스에 존재하지 않는 임의 문자열이며, `postgres://u:pw@…` 도 명백한 플레이스홀더다. 실제 시크릿 유출이 아니다.
  - 제안: 조치 불요 — 마스킹 단위 테스트의 일반적인 패턴.

- **[INFO]** 인가 게이트 부재는 이 diff 의 변경 범위 밖
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `toNodeExecutionDto` 메서드 위 주석 — "이 컨트롤러도 `@Roles` 게이트 없이 워크스페이스 멤버 전원에게 열려 있고"
  - 상세: 주석이 명시하듯 이 컨트롤러의 인가 수준은 기존 설계이며 이번 마스킹 통합과 무관하다. 이번 diff 는 `@Roles`/워크스페이스 멤버십 체크를 건드리지 않는다.
  - 제안: 조치 불요(별건) — 이미 코드 주석에 알려진 설계로 기록돼 있음.

- **[INFO]** 마스킹 게이트 통합은 기능적으로 완전히 동등 — 신규 취약점 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (`redactStoredFieldsForResponse:97`, `redactNodeExecutionRow:144`), 호출부 4곳(`executions.service.ts:1005,1069,704`, `background-runs.service.ts:302`)
  - 상세: 위 "검증 절차" 1~3 에서 확인한 대로, 마스킹 로직(`deepRedactSecrets` 패턴 매칭)·스프레드 순서(원문을 항상 마스킹값이 덮음)·copy-on-change 계약 모두 종전과 동일하게 보존된다. 신규 헬퍼는 순수 데이터 변환이며 SQL 파라미터 바인딩·인증/인가 로직·사용자 입력 처리 경로를 전혀 건드리지 않는다.
  - 제안: 조치 불요(양성 확인).

## 요약

이번 changeset 은 `inputData`/`outputData`/`error` 세 컬럼의 응답 직전(egress) 마스킹을 4곳의 손으로 반복된 호출에서 공유 헬퍼 2개(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)로 통합한 순수 리팩터다. 직접 소스를 대조한 결과 마스킹 알고리즘(`deepRedactSecrets`) 자체는 무변경이며, 4개 호출부 모두 마스킹 스프레드가 원문 필드 뒤에 위치해 원문이 새어 나갈 여지가 없다. 새로 추가된 co-located 유닛 테스트(`it.each` 로 3컬럼 개별 단언 + 동시 단언 + 부재 정규화 + identity 보존)는 이 통합이 만들 수 있는 회귀(컬럼 누락·copy-on-change 파기·두 헬퍼 뭉개짐)를 직접 겨눈다. 인젝션·하드코딩된 실제 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보 에러 노출·신규 의존성 문제는 발견되지 않았다.

## 위험도

NONE
