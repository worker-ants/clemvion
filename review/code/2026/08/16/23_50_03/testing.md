# 테스트(Testing) 코드 리뷰 — EIA fanout + 내부 REST `inputData`/`outputData` 값-패턴 마스킹

## 검토 방법

diff 크기 제한으로 프롬프트에서 생략된 파일(`executions.service.spec.ts`, `executions.service.ts`,
`websocket.service.ts`, `sanitize-error-message.ts` 등)은 `Read`/`Bash(grep)` 로 원본을 직접 열어
대조했다. 이 라운드(`23_50_03`)는 직전 라운드(`23_08_19`)의 testing WARNING 2건
(`redactStoredDataForResponse` 전용 유닛 테스트 부재, `findById` 3-컬럼 copy-on-change 의 참조
동일성 미검증)이 실제로 해소됐는지를 우선 검증하고, 그 위에서 이번 diff 가 새로 도입한 테스트의
갭을 찾았다.

## 발견사항

- **[WARNING]** `emitExecutionEvent` 값-마스킹 신규 테스트(③·④)가 `emitNodeEvent`(①·②) 짝과 달리
  마스킹 성공을 뜻하는 양성 단언(`toContain('***')`)을 빼먹어, "마스킹됨"과 "필드가 통째로
  비었거나 사라짐"을 구분하지 못한다 — 같은 PR·같은 describe 블록 안의 비대칭.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1014-1021`(③
    `emitExecutionEvent` fanout), `:1023-1032`(④ `emitExecutionEvent` wire). 대조:
    같은 파일 `:989-1000`(① `emitNodeEvent` fanout)·`:1002-1012`(② `emitNodeEvent` wire)는 각각
    `expect(fanout.payload.error).not.toContain('eyJhbGciOiJIUzI1NiJ9')` 다음 줄에
    `expect(fanout.payload.error).toContain('***')` 을 반드시 붙인다.
  - 상세: ③·④ 는 `expect(fanout.payload.message).not.toContain('eyJhbGciOiJIUzI1NiJ9')` /
    `expect(wire.message).not.toContain('eyJhbGciOiJIUzI1NiJ9')` 딱 한 줄만 단언한다. 이 부정
    단언은 "원문 토큰이 없다"만 보므로, `message` 필드가 `***` 로 정상 마스킹된 경우뿐 아니라
    `undefined`/빈 문자열로 날아가거나 필드 자체가 통째로 사라지는 회귀에도 **똑같이 GREEN**이다
    (`.not.toContain` 은 값이 사라져도 참). 즉 `emitExecutionEvent` 경로만 마스킹 호출이 조용히
    빠지거나 엉뚱한 값으로 대체돼도 이 두 테스트는 잡지 못한다 — 이 저장소가 이 PR 안에서도 계속
    경계하는 "형제 표면 중 하나만 얕게 검증됨" 패턴의 축소판이다. 프로덕션 코드 자체는 정상으로
    보인다(`maskWireEnvelope` 가 두 emit 에 동일하게 걸림, `grep` 확인) — 지금 당장의 결함이
    아니라 회귀에 대한 방어력이 형제 테스트보다 약하다는 지적이다.
  - 제안: ①·②와 동형으로 `expect(fanout.payload.message).toContain('***')` /
    `expect(wire.message).toContain('***')` 한 줄씩만 추가하면 닫힌다.

- **[WARNING]** `BackgroundRunsService` 의 `inputData`/`outputData` 마스킹 신규 테스트에
  `[REDACTED]` 마커 보존 캐너리가 없다 — 같은 함수(`redactStoredDataForResponse`)를 쓰는 자매
  표면(`ExecutionsService`)과 유닛 테스트(`redact-stored-error.spec.ts`)에는 있는 테스트다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:223-262`
    (신규 `it('body nodeExecutions[] 의 inputData/outputData 도 마스킹한다', …)` — leaky 값
    두 케이스만 다루고 `[REDACTED]` 케이스 없음). 대조: `codebase/backend/src/modules/executions/executions.service.spec.ts`
    의 `⑥ ingestion 의 [REDACTED] 헤더 마커를 덮지 않는다 (12-webhook §5.3 계약)` 테스트,
    그리고 `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` 의
    `[캐너리] webhook ingestion 의 [REDACTED] 마커를 보존한다` 테스트.
  - 상세: `background-runs.service.ts` 의 `toNodeExecutionDto` 는 CHANGELOG/§R17 카탈로그가 명시하는
    "여섯 표면" 중 하나로 이번 라운드에 처음 마스킹이 걸렸다(`redactStoredDataForResponse` 호출부
    신설). `redactStoredDataForResponse` 자체는 마커 보존을 유닛 테스트로 이미 보장하지만, 이
    저장소는 바로 이 PR 안에서 "공유 로직이 안전해도 **호출부**가 실제로 그 함수를 쓰는지는
    표면마다 따로 확인해야 한다"는 원칙을 반복 명시한다(`executions.service.spec.ts` ⑥의 주석,
    `redact-stored-error.spec.ts` 신규 describe 블록 주석 등). `BackgroundRunsService` 만 이
    캐너리가 없어, 향후 이 호출부가 `redactStoredDataForResponse` 대신 다른 마스킹 함수로
    바뀌거나 파라미터가 뒤바뀌는 식의 회귀가 나도 이 표면에서는 잡히지 않는다(다른 다섯 표면
    중 최소 한 곳은 이미 이 캐너리로 잡을 수 있는 것과 비대칭).
  - 제안: `makeBodyNodeExec({ inputData: { headers: { authorization: '[REDACTED]', ... } } })`
    형태로 `⑥`과 동형인 테스트 한 건을 추가한다. 낮은 비용(기존 fixture 헬퍼 재사용)으로 닫힌다.

- **[INFO]** `BackgroundRunsService` 의 `inputData`/`outputData` 는 "정상 데이터 무손상 + null
  그대로 통과" 조합 테스트가 없다 — `error` 필드에는 있는 대칭 테스트(`18_14_50` testing INFO 로
  이미 한 번 지적·해소된 패턴)가 이번에 확장된 두 컬럼에는 재현되지 않았다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:269-` 의
    `it('error 가 null 이면 null 그대로 통과시킨다 …')` 바로 다음 자리 — `inputData`/`outputData`
    버전이 없음. 대조: `executions.service.spec.ts` 의 `⑦ 정상 데이터는 손상되지 않는다 + DB
    원문 불변` 테스트.
  - 상세: 실질 위험은 낮다 — `redactStoredDataForResponse` 자체의 null 정규화·무손상 보장은
    `redact-stored-error.spec.ts` 유닛 테스트가 이미 고정하고 있고, `makeBodyNodeExec` 디폴트
    fixture 가 `inputData: null, outputData: null` 이라 기존 성공 케이스 테스트들이 이 경로를
    간접적으로 크래시 없이 통과시키고 있다. 다만 값 자체를 명시적으로 단언하는 테스트는 없다.
  - 제안: 필수는 아님. 위 WARNING(마커 보존 캐너리) 추가 시 같은 자리에 정상 데이터
    무손상 케이스를 곁들이면 낮은 추가비용으로 대칭을 맞출 수 있다.

## 양호한 지점 (직전 라운드 WARNING 해소 확인)

- `redact-stored-error.spec.ts` 에 `redactStoredDataForResponse` 전용 `describe` 8건이 추가돼
  자매 함수(`redactStoredErrorForResponse`)와 동등한 커버리지(null/undefined 정규화·중첩 키·비변이·
  copy-on-change 참조 동일성·마커 보존·잔여 갭 캐너리·무손상)를 확보했다 — 직전 WARNING 1 해소 확인.
- `executions.service.spec.ts` 의 신규 `⑥-b` 테스트(`inputData`/`outputData`/`error` 중 **한
  필드만** leaky 한 세 행을 섞어 각각 참조 동일성을 개별 단언)는 3필드 AND 비교의 각 항을
  독립적으로 가르는 잘 설계된 뮤테이션-저항 테스트다 — `inputData === ne.inputData` 항이 빠지거나
  뒤바뀌어도 이 테스트가 단독으로 RED 가 된다. 직전 WARNING 2 해소 확인.
- `websocket.service.spec.ts` 신규 describe 블록은 두 emit(`emitNodeEvent`/`emitExecutionEvent`)
  × 두 표면(wire/fanout) 4개 조합을 각각 독립 테스트로 겨누고, `llmCalls` 보존 예외·기존 마커
  비-재마스킹·평범한 값 무손상까지 캐너리로 고정해 이 저장소가 반복 겪은 "자매 넷 중 하나만"
  패턴을 의식적으로 차단하고 있다(단 위 WARNING 1 은 그중 두 테스트의 단언 강도 문제).
- `beforeEach` 가 매 테스트 새 mock/service 인스턴스를 만들고(`websocket.service.spec.ts:51-57`,
  `executions.service.spec.ts:120-171`), `background-runs.service.spec.ts`/`redact-stored-error.spec.ts`
  의 신규 테스트는 로컬 const fixture 만 쓰므로 테스트 간 격리는 전반적으로 양호하다 — 공유 가변
  상태로 인한 오염 위험은 발견되지 않았다.
- `maskIfPresent`(executions.service.ts, private 헬퍼)는 직접 유닛 테스트는 없으나 `⑤`/`⑤-c`/`⑥`/`⑥-b`
  서비스 레벨 테스트로 모든 분기(값 있음/없음, null 보존, copy-on-change)가 간접 커버된다 — 헬퍼
  자체가 1줄짜리 삼항이라 별도 유닛 테스트 요구는 과함.

## 요약

이번 diff 는 직전 라운드(`23_08_19`)의 testing WARNING 2건 — `redactStoredDataForResponse` 유닛
테스트 부재, `findById` 3-컬럼 copy-on-change 의 참조 동일성 미검증 — 을 정확히 자매 함수/기존
패턴을 복제-치환하는 방식으로 잘 닫았고, 신규 뮤테이션-저항 테스트(`⑥-b`)의 설계 품질이 특히
높다. 다만 이번 라운드가 새로 추가한 테스트 안에서도 같은 클래스의 비대칭이 두 곳 재발했다 —
(1) `websocket.service.spec.ts` 의 `emitExecutionEvent` 마스킹 테스트 2건이 형제
`emitNodeEvent` 테스트와 달리 양성 단언(`toContain('***')`)을 빼먹어 부정 단언만으로는 걸러지지
않는 회귀(필드 소실 등)에 취약하고, (2) `BackgroundRunsService` 의 `inputData`/`outputData`
마스킹 테스트에 다른 다섯 표면 중 하나(`executions.service.spec.ts` ⑥) 및 유닛 레벨에는 있는
`[REDACTED]` 마커 보존 캐너리가 없다. 둘 다 기존 형제 테스트를 그대로 복제-치환하면 낮은 비용으로
닫히는 WARNING 이며, CRITICAL 급 결함은 발견되지 않았다.

## 위험도

MEDIUM
