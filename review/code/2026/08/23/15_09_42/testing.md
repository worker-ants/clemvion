# 테스트(Testing) Review — masking-gate-consolidation (3차 라운드, `15_09_42`)

## 검토 범위 및 방법

이전 두 라운드(`14_23_44`→WARNING 2건, `14_46_46`→재검증 후 WARNING 1건 추가 발견)의 testing
지적사항이 이번 diff 에서 실제로 해소됐는지를 **직접 실행으로 재검증**했다(Read 만이 아니라):

- `npx jest src/shared/utils/redact-stored-error.spec.ts` → **34/34 GREEN** (`14_46_46` 시점 29개에서
  `describe.each(['undefined','null']) × it.each(3열)` = +6 순증분 반영, 34개로 증가한 것과 diff 상
  신규 스위트 라인 수가 일치).
- `npx jest src/modules/executions/executions.service.spec.ts src/modules/executions/background-runs/background-runs.service.spec.ts`
  → **71/71 GREEN** (회귀 없음).
- `maskIfPresent` 의 `value == null` → `value === undefined` 축소 뮤턴트를 실제로
  `redact-stored-error.ts` 에 적용해 위 105개 테스트 전부 재실행 → **105/105 GREEN 유지**,
  `tsc --noEmit` 에러 199건(뮤턴트 적용 전/후 동일 — 기존 baseline, 무관한 `buttons.spec.ts`
  타입 에러). 즉 신규 docstring(게이트 127~145)이 주장하는 "동치 뮤턴트" 결론을 **독립적으로
  재현·확인**했다.
- M1 계열(헬퍼에서 `error` 마스킹 제거) 뮤턴트 → **10 RED** (co-located spec + 두 서비스 spec
  전부에서 검출).
- M3 계열(`maskIfPresent` 가 부재를 항상 `mask()` 결과로 정규화 — "두 헬퍼를 뭉갠 회귀" 재현)
  뮤턴트 → co-located spec 단독 **3 RED** (`describe.each` 6케이스 중 3케이스, `undefined`/`null`
  양쪽 절반씩).
- 모든 뮤턴트는 `cp` 백업 → 적용 → 실행 → `cp` 로 원복, `git status`/`git diff` 로 워크트리
  오염 없음을 매 단계 확인했다.

## 이전 라운드 WARNING 반영 여부 (실행 재확인)

- **`14_23_44` WARNING #1(신설 헬퍼 co-located 테스트 부재)**: 해소 확인.
  `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 각각 전용 `describe` 가
  `redact-stored-error.spec.ts` 에 추가됐고(게이트 183~233, 243~314), 3필드 개별 마스킹
  (`it.each`)·동시 적용·부재 처리 대비(정규화 vs 보존)·copy-on-change 참조 보존을 모두 케이스로
  고정한다. 실행 결과 GREEN.
- **`14_46_46` WARNING(`maskIfPresent` 의 `null` 쪽 방어 절반 미검증)**: 두 갈래로 대응했고 둘 다
  타당하다.
  1. **테스트 보강**: `describe.each([['undefined', undefined], ['null', null]])` ×
     `it.each(3열)` 매트릭스(게이트 296~313)가 `undefined`/`null` 두 부재 형태를 컬럼별로
     **각각** 겨눈다 — 이전 라운드가 지적한 "한쪽만 넣으면 다른 쪽이 조용히 갈린다" 갭과
     그 대칭 갭(같은 라운드 INFO #5, 컬럼별 미분리)을 동시에 닫는다.
  2. **동치 뮤턴트 논증**: 그럼에도 `== null` 가드 자체를 좁히는 뮤턴트(`=== undefined`)는
     어떤 테스트로도 죽지 않는다는 사실은 남는데, 이를 회피(private 함수 export 등)하지 않고
     docstring 에 진리표로 증명해 "테스트 갭이 아니라 동치 뮤턴트"임을 명시했다. 위 방법으로
     **독립 재현**한 결과 이 주장은 정확하다 — `mask(v)` 자신이 이미 null-check 를 하므로
     `mask(value) ?? value` 폴백이 두 부재 형태에 대해 항상 같은 결과를 만든다. 판별하려면
     `maskIfPresent` 를 테스트만을 위해 export 해야 하는데, 그 비용이 방어의 가치보다 크지
     않다는 판단도 문서화돼 있다. **정당한 처분**이다 — "동치 뮤턴트를 갭으로 오인해 억지로
     표면을 넓히지 않는다"는 이 저장소의 관례에 부합한다.

## 발견사항

이번 라운드에서 새로 발견한 CRITICAL/WARNING 급 테스트 결함은 없다.

- **[INFO]** `redactStoredFieldsForResponse` 의 부재 정규화 테스트가 `error: null` 명시 조합을
  직접 겨누지 않는다 — 사소, 위험 낮음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:211`~`225`
    (`'부재 컬럼을 null 로 정규화한다'` 테스트)
  - 상세: 두 단언 중 하나는 `{}`(전부 부재), 다른 하나는
    `{ inputData: undefined, outputData: null, error: undefined }` 조합이라 `error: null` 명시
    케이스는 이 describe 블록에서 직접 나오지 않는다. 다만 `redactStoredFieldsForResponse` 는
    각 필드를 독립적으로 `redactStoredErrorForResponse`/`redactStoredDataForResponse` 에
    위임하는 얇은 pass-through 이고, `redactStoredErrorForResponse` 자신의 describe 블록(게이트
    44~47)이 이미 `error: null` → `null` 정규화를 직접 고정하고 있어 실질 위험은 낮다.
  - 제안: 급하지 않음 — 다음에 이 스위트를 손댈 때 `outputData`/`error` 조합도 `it.each` 로
    돌리면 세 필드 모두 대칭이 된다. 머지 차단 사안 아님.

- **[INFO]** Mock/stub 사용 없음 — 적절 (재확인)
  - 대상이 순수 함수(부작용·외부 의존성 없음)라 mock 이 불필요하고 실제로 쓰이지 않는다.
    `redactStoredDataForResponse`/`redactStoredErrorForResponse` 를 실구현으로 직접 호출해
    통합 동작까지 함께 검증하므로 mock-실동작 괴리 문제도 없다.

- **[INFO]** 테스트 격리 — 문제 없음 (재확인)
  - `row()` 팩토리가 매 테스트마다 새 객체를 생성하고, `beforeEach`/모듈 스코프 `let` 이
    없어 상태 누출이 구조적으로 불가능하다. `it.each`/`describe.each` 케이스도 독립 입력을
    받아 순서 의존성이 없음을 실행으로 확인했다(34/34 GREEN, 서로 다른 실행 순서 영향 없음 —
    Jest 기본 파일 내 순차 실행이지만 각 케이스가 자기 완결적).

## 회귀 테스트 (기존 테스트 유효성)

- `executions.service.spec.ts`/`background-runs.service.spec.ts` 의 표면별
  (findById·findByWorkflow·getChain·stop·toNodeExecutionDto) leaky-value 캐너리와
  copy-on-change 참조 동일성 단언은 헬퍼 추출 이후에도 **직접 실행으로 71/71 GREEN** —
  4개 호출부 교체가 동작을 바꾸지 않았다는 판단이 이번에도 유효하다.
- `redactStoredErrorForResponse`/`redactStoredDataForResponse` 의 기존 describe 블록(레거시
  타입 캐스트 캐너리 포함)은 diff 로 손대지 않았고 그대로 GREEN.

## 테스트 용이성 (구조)

신설 헬퍼 둘 다 순수 함수로 leaf 유틸 모듈에 export 돼 있어 DI·mock 없이 직접 호출
가능하다. `maskIfPresent` 만 비공개로 남겼는데, 이는 회피가 아니라 "판별 불가능한 뮤턴트를
잡기 위해 공개 표면을 넓히는 비용 < 이익" 이라는 명시적 트레이드오프 판단이며 독립
재현으로 그 전제(동치 뮤턴트)가 사실임을 확인했다.

## 요약

이번 라운드는 앞선 두 차례 testing 리뷰(WARNING 총 3건: co-located 테스트 부재, `undefined`만
검증돼 `null` 절반 누락, 그 절반에 대한 재조사)가 모두 실제로 해소됐음을 **직접 테스트
실행과 뮤테이션 재현으로 재확인**했다. `redact-stored-error.spec.ts` 는 34개 케이스로
확장되어 3필드 개별/동시 마스킹, 부재→`null` 정규화(DTO 헬퍼) vs 부재 보존(노드 헬퍼),
`undefined`/`null` 두 부재 형태 × 3컬럼 매트릭스, copy-on-change 참조 보존을 전부 지역적으로
고정한다. 유일하게 남은 관측(`redactStoredFieldsForResponse` 의 `error: null` 명시 조합
미검증)은 하위 함수의 기존 커버리지로 사실상 상쇄되는 사소한 비대칭이라 INFO 로만 남긴다.
Mock 적절성·테스트 격리·회귀·테스트 용이성 전 항목에서 결함을 발견하지 못했다. CRITICAL/
WARNING 없음.

## 위험도

NONE
