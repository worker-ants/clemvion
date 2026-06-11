# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: code.handler.spec.ts

- **[INFO]** 임포트 확장 — `classifyError` 추가 임포트
  - 위치: 라인 1
  - 상세: `classifyError` 를 `export` 로 공개한 것과 직접 연관된 변경. 테스트 대상 추가이므로 범위 내 정상.
  - 제안: 해당 없음.

- **[INFO]** 기존 테스트에 설명 주석 추가 (W10 flakiness note)
  - 위치: memory limit 테스트 내 `// W10:` 블록 (5줄)
  - 상세: CI 에서 `CODE_MEMORY_LIMIT` 대신 `CODE_TIMEOUT` 이 발생할 수 있는 경쟁 조건에 대한 설명. 기능 변경은 아니며 주석만 추가되었다. 작업 범위(isolate 전환 + 에러 분류 개선)와 직접 관련된 관찰 내용이므로 적절하다.
  - 제안: 해당 없음.

- **[INFO]** 기존 테스트에 인라인 주석 추가 (`timeout: 30, // seconds` 및 `}, 30_000); // Jest timeout`)
  - 위치: 동일 memory limit 테스트 2곳
  - 상세: 단위를 명확히 하는 맥락 주석. `timeout` 이 ms 가 아닌 초 단위임을 개발자에게 전달하는 것은 이 작업(isolated-vm 전환) 에서 값이 변경된 이유를 설명한다. 범위 내.
  - 제안: 해당 없음.

- **[INFO]** `classifyError (unit)` describe 블록 신규 추가 (7개 테스트)
  - 위치: 라인 63–115 (diff)
  - 상세: `classifyError` 함수가 이번 작업에서 signature 변경(`isolate?` 파라미터 추가) 및 `export` 공개가 이루어졌으므로, 이 함수를 직접 단위 테스트하는 것은 범위 내 필수 커버리지이다. W9 주석도 "isolated-vm 버전 업그레이드 시 에러 메시지 변경 대응" 을 명시해 목적이 분명하다.
  - 제안: 해당 없음.

### 파일 2: code.handler.ts

- **[INFO]** `ISOLATE_MEMORY_LIMIT_MB` 주석 한→영 변경 + W15 future note 추가
  - 위치: 라인 786–792 (diff)
  - 상세: 한국어 단일 줄 주석을 JSDoc 블록으로 확장하고 W15 노트(env var 추출 가능성)를 추가했다. 실질 기능 변경 없음. 영어로의 일관화는 현재 파일 전반 영어 주석 관행과 일치한다. W15 메모는 over-engineering 이 아닌 단순 TODO 메모로 범위 내 허용 수준.
  - 제안: 해당 없음.

- **[INFO]** `BOOTSTRAP_SOURCE` JSDoc에 W13 실행 순서 경고 추가
  - 위치: 라인 800–804 (diff)
  - 상세: 기존 클로저 캡처 → delete 순서에 대한 유지보수 경고 주석. isolate 전환 과정에서 이 순서가 중요해진 것을 문서화한 것이므로 범위 내.
  - 제안: 해당 없음.

- **[INFO]** `wrapUserCode` JSDoc에 W14 라인 번호 오프셋 주석 추가
  - 위치: 라인 812–816 (diff)
  - 상세: isolated-vm 으로 전환하면서 에러 라인 번호 오프셋이 실질적으로 영향받는 항목이다. 이를 문서화한 것은 범위 내.
  - 제안: 해당 없음.

- **[INFO]** `syntaxCheck` JSDoc 추가
  - 위치: 라인 824–830 (diff)
  - 상세: 기존에 주석이 없던 함수에 JSDoc 추가. 현재 작업과의 직접 연관성은 낮지만, 바로 아래에서 `syntaxIsolate.isDisposed` 체크를 추가하는 실질 변경이 이루어지므로 함께 문서화한 것으로 볼 수 있다. 경계선이지만 허용 수준.
  - 제안: 해당 없음.

- **[INFO]** `syntaxIsolate` OOM 후 재생성 처리 추가 (`syntaxIsolate.isDisposed` 체크)
  - 위치: 라인 833–834 (diff)
  - 상세: `!syntaxIsolate` 조건에 `|| syntaxIsolate.isDisposed` 추가. isolated-vm 환경에서 syntax check isolate 도 OOM 으로 dispose 될 수 있으므로 이 방어 코드는 이번 작업의 직접 산물이다. 범위 내.
  - 제안: 해당 없음.

- **[INFO]** `$vars` copy-out catch 블록 주석 교체 (기존 주석 → INFO#14/INFO#15 주석)
  - 위치: 라인 843–851 (diff)
  - 상세: 동작 코드(`context.variables = varsClone`)는 변경되지 않고 주석만 교체. "mutated clone" 표현이 잘못됐다는 것을 수정. 범위 내 정확도 개선.
  - 제안: 해당 없음.

- **[INFO]** `classifyError` 호출에 `isolate` 인자 전달
  - 위치: 라인 858–859 (diff)
  - 상세: 핵심 변경 — `classifyError(err)` → `classifyError(err, isolate)`. priority-2 (isDisposed 기반 메모리 OOM 감지) 를 활성화하는 직접적인 범위 내 변경.
  - 제안: 해당 없음.

- **[INFO]** 삼항 체인 → `LEGACY_TO_NORMALIZED` 테이블 대체 (W8)
  - 위치: 라인 864–877 (diff)
  - 상세: 기존 삼항 체인을 lookup 테이블로 교체. 동작은 동일하고 새 코드 `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 추가가 가능하도록 한 것. `CODE_MEMORY_LIMIT` 추가가 이번 작업의 핵심 요구이므로 테이블 방식 도입은 해당 요구 해결을 위한 최소 리팩토링 범위로 볼 수 있다. WARNING 수준에 경계하지만 동작 등가성이 보장되고 W8 참조로 의도가 명시됨.
  - 제안: 해당 없음.

- **[INFO]** 모듈 레벨 regex 상수 추출 (`RE_TIMED_OUT`, `RE_MEMORY_LIMIT`, `RE_ISOLATE_DISPOSED`)
  - 위치: 라인 885–888 (diff)
  - 상세: `classifyError` 내부의 인라인 regex 를 모듈 레벨로 이동. per-call GC 압박 회피를 이유로 명시. `classifyError` signature 변경과 함께 이루어진 소규모 최적화로 동작 등가성 유지. 엄밀히 는 현재 작업과 직접 관련 없는 최적화이나 변경된 함수 내에 위치하고 규모가 매우 작아 MEDIUM 미만으로 판단.
  - 제안: 해당 없음.

- **[INFO]** `LEGACY_TO_NORMALIZED` 상수 추가 (모듈 레벨)
  - 위치: 라인 892–897 (diff)
  - 상세: W8 삼항 체인 교체와 한 쌍. `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 를 포함하여 이번 작업 범위 내 필수.
  - 제안: 해당 없음.

- **[INFO]** `classifyError` signature 변경 — `export` 추가 + `isolate?: ivm.Isolate` 파라미터 추가 + JSDoc 교체
  - 위치: 라인 898–929 (diff)
  - 상세: 핵심 변경. `export` 는 spec 테스트 단위 검증을 위한 것이고 `isolate?` 파라미터는 priority-2 (isDisposed) 추가를 위한 것. JSDoc 확장은 3-priority 분류 체계를 문서화. 모두 이번 작업의 직접 산물.
  - 제안: 해당 없음.

### 파일 3: backend-labels.ts (frontend)

- **[INFO]** `ERROR_KO` 에 `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT` 3개 항목 추가
  - 위치: 라인 579–585 (diff)
  - 상세: isolated-vm 전환으로 신규 에러 코드들이 사용자에게 노출될 수 있으므로 i18n 매핑 추가는 범위 내 필수 작업. `CODE_MEMORY_LIMIT` 는 이번 작업에서 신규 추가된 코드이고, `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` 는 기존 코드이지만 한국어 매핑이 없었던 것을 함께 추가. 후자가 엄밀히 "이번 변경의 직접 산물" 은 아니나, 동일 에러 그룹의 매핑 누락이므로 함께 추가하는 것이 합리적이다. 범위 내.
  - 제안: 해당 없음.

### 파일 4: spec/4-nodes/5-data/2-code.md

- **[INFO]** 에러 코드 표에 `CODE_MEMORY_LIMIT` / `EXECUTION_MEMORY_EXCEEDED` 추가
  - 위치: 라인 295–295 (diff, output.error.code / output.error.details.legacyCode 행)
  - 상세: 이번 작업에서 신규 추가된 에러 경로의 spec 갱신. 범위 내 필수.
  - 제안: 해당 없음.

- **[INFO]** 차단 API 목록에 `queueMicrotask` 추가
  - 위치: 라인 374–374, 386–386 (diff)
  - 상세: `code.handler.ts` 의 `BOOTSTRAP_SOURCE` 에서 실제로 `queueMicrotask` 를 delete 하고 있으므로 spec 과 구현의 일치를 맞춘 갱신. 범위 내.
  - 제안: 해당 없음.

---

## 요약

총 4개 파일의 변경은 모두 `isolated-vm` 전환 + `classifyError` priority-2 개선(isDisposed 기반 OOM 감지) + `CODE_MEMORY_LIMIT` 에러 경로 추가라는 단일 작업 범위 안에 속한다. 주석 확장(W10, W13, W14, W15)과 `classifyError` JSDoc 교체는 분량이 많지만 신규 기능·외부 인터페이스 변경이 없으며, `LEGACY_TO_NORMALIZED` 테이블 도입과 regex 상수 추출은 동작 등가 소규모 정리로 명확히 이번 수정과 묶여 있다. `syntaxCheck` JSDoc 추가만 현재 작업과의 직접 연관이 다소 낮지만 바로 아래 `isDisposed` 방어 코드와 함께 있어 범위 일탈로 볼 수 없다. 범위를 크게 벗어난 항목은 발견되지 않았다.

## 위험도

NONE
