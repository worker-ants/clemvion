# 신규 식별자 충돌 검토 — `cafe24-call-401-retry-after-spec`

검토 모드: `--impl-prep` (구현 착수 전)
대상 범위: `plan/in-progress/cafe24-call-401-retry.md` (worktree `cafe24-401-refresh-a3f2c1`)

---

## 검토 배경

orchestrator 가 제공한 target 문서 본문이 `(없음)` 으로, 이 scope 는 별도의 신규 spec 파일이 아니라 기존 `cafe24-call-401-retry.md` plan 에 기술된 구현 작업이다. 분석은 plan 문서 + spec §6.1 + 코드 파일(`cafe24-api.client.ts`, `cafe24-token-refresh.constants.ts`) 을 직접 참조해 수행했다.

도입될 식별자는 다음으로 압축된다.

| 종류 | 식별자 후보 | 도입 위치 |
|------|------------|-----------|
| 코드 메서드/파라미터 | `tryRefreshAndRetry` (또는 inline), `triedAuthRetry` | `cafe24-api.client.ts` 내부 |
| 테스트 레이블 | T-1 ~ T-5 | `cafe24-api.client.spec.ts` 신규 it 블록 |
| source 레이블 | `'proactive'` (기존 값 재사용) | `refreshViaQueue` 호출 |

---

## 발견사항

충돌이 확인된 항목이 없다. 각 검토 관점별 결과는 아래와 같다.

### 1. 요구사항 ID 충돌

해당 없음. 이 작업은 기존 spec §6.1 에 이미 기록된 "401 reactive refresh" 정책의 구현이며 새 요구사항 ID 를 신규 발급하지 않는다. 기존 REQ-C2 / REQ-C3 / HIGH-2 는 다른 이슈(transport 3회 실패, 403 scope 분기, refresh 실패 status 통일)를 가리키므로 간섭 없다.

### 2. 엔티티/타입명 충돌

해당 없음. `tryRefreshAndRetry` 와 `triedAuthRetry` 는 `cafe24-api.client.ts` 의 private scope 에만 존재하며 export 되지 않는다. 코드베이스 전체 검색(`codebase/`, `spec/`)에서 동일 이름 사용처가 0건이다.

### 3. API endpoint 충돌

해당 없음. 새 endpoint 를 정의하지 않는다.

### 4. 이벤트/메시지명 충돌

해당 없음. `refreshViaQueue` 호출 시 source 레이블을 기존 `'proactive'` 로 재사용한다. plan 에 "새 source label 추가 금지" 가 명시되어 있으며, 기존 `'proactive' | 'background'` union 타입이 유지된다(`cafe24-token-refresh.constants.ts` `Cafe24RefreshJobData.source` 참조).

### 5. 환경변수·설정키 충돌

해당 없음. 새 ENV var 또는 config key 를 도입하지 않는다.

### 6. 파일 경로 충돌

해당 없음. 신규 파일을 추가하지 않으며, 기존 `cafe24-api.client.ts` 및 `cafe24-api.client.spec.ts` 를 수정한다.

---

## 요약

`cafe24-call-401-retry` 구현은 `cafe24-api.client.ts` 내부에서 `executeWithRateLimit` 의 401 분기를 수정하는 것에 그치며, 외부에 노출되는 새 식별자(API endpoint, 이벤트, ENV var, export 타입/인터페이스, 요구사항 ID)를 도입하지 않는다. 후보 식별자인 `tryRefreshAndRetry` / `triedAuthRetry` 는 private 내부 구현 단위이며, 코드베이스 전체 및 spec 에서 동일 이름의 기존 사용처가 발견되지 않았다. source 레이블 `'proactive'` 는 기존 값을 재사용하므로 union 타입 변경이 없다. 식별자 충돌 관점에서 차단 사유가 없다.

---

## 위험도

NONE
