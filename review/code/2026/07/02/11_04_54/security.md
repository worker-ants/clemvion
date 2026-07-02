# Security Review

## 발견사항

### 발견사항 없음 (NONE)

리뷰 대상 diff 에서 보안 취약점을 발견하지 못했다.

---

## 개별 파일 분석

### 파일 3: `utils/to-record.ts` (신규)

- **[INFO]** `isRecord` 타입 가드의 런타임 검증 보안 효과
  - 위치: `to-record.ts:10-11`
  - 상세: `typeof value === 'object' && value !== null && !Array.isArray(value)` 는 표준 plain-object 가드로, prototype 오염(예: `Object.create(null)`)에 대해서도 `typeof` 는 `'object'` 반환해 `isRecord` 통과한다. 하지만 이 함수는 필드 존재 여부가 아닌 *객체 여부*만 확인하므로, 상류에서 `Object.create(null)` 같은 prototype-less 객체가 들어와도 `toRecord` 는 그대로 반환한다. 호출 사이트(cachedMeta)는 이후 `.interactionType` 등 단순 property 접근만 수행하므로 prototype 오염 공격 경로가 성립하지 않는다(prototype 없는 객체라도 own-property 접근은 동일).
  - 판정: 현재 사용 패턴에서 위험 없음.

### 파일 1: `execution-engine.service.ts` (diff)

- **[INFO]** `(cachedOutput?.meta as Record<string, unknown> | undefined) ?? {}` → `toRecord(cachedOutput?.meta)` 대체
  - 위치: `execution-engine.service.ts:1478` (diff +줄)
  - 상세: 기존 코드는 컴파일러만 설득하는 `as` 단언으로 런타임 형태를 검증하지 않았다. 실제 `cachedOutput?.meta` 가 배열·원시값인 경우 downstream property 접근이 `undefined` 로 조용히 수렴하는 것과 `toRecord` 동작이 동일하므로 행위 변경 없이 런타임 검증이 추가된다. 보안 관점에서는 **개선**이다.
  - 판정: 취약점 없음, 긍정적 변경.

### 전체 파일 컨텍스트에서 확인한 기존 보안 통제

아래는 diff 외 기존 코드에서 확인한 보안 관련 구현이다. 이번 변경이 해당 통제를 훼손하지 않음을 확인했다.

- **workspace 격리**: `assertSameWorkspace` — `callerWorkspaceId` 미제공 시 fail-closed (`WorkflowForbiddenWorkspaceError` throw). 이번 변경으로 미영향.
- **재귀 깊이 한도**: `MAX_RECURSION_DEPTH = 10` — 무한 sub-workflow 재귀 방지. 이번 변경으로 미영향.
- **메시지 길이 가드**: `applyContinuation` 의 `ai_message` 최대 길이 검사 — 대용량 페이로드 DoS 방어. 이번 변경으로 미영향.
- **SQL 인젝션**: `cancelParkedExecution` 및 `isNodeExecutionWaiting` 의 TypeORM QueryBuilder `.where('id = :id', { id: executionId })` — 파라미터 바인딩 사용, 인젝션 없음.
- **에러 메시지 노출**: `failFirstSegmentSetup` 이 저장하는 `row.error = { message: errMessage }` 는 내부 DB 저장이며, 외부 노출 경로(WS emit) 에도 동일 `errMessage` 가 포함되나 이는 기존 설계이고 이번 diff 범위 밖이다.

---

## 요약

이번 변경은 `execution-engine.service.ts` 의 `cachedOutput?.meta` 처리에서 무검증 타입 단언(`as Record<string, unknown>`)을 런타임 형태 검증(`toRecord`) 으로 대체하고, 대응 유틸(`to-record.ts`)과 단위테스트(`to-record.spec.ts`)를 신규 추가했다. 모든 변경은 보안적으로 중립적이거나 긍정적(타입 단언 제거로 malformed 값의 silent 오동작 방어)이며, 인젝션·하드코딩 시크릿·인증 우회·입력 검증 누락·암호화 문제·에러 정보 노출 등 OWASP Top 10 범주의 취약점을 신규 도입하지 않는다.

## 위험도

NONE
