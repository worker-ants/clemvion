### 발견사항

---

**[INFO] `execute()` 메서드 길이 및 복잡도 — 기존 이슈의 지속**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts`, `execute()` 메서드 전체
- 상세: 이번 변경은 메서드를 실질적으로 더 길게 만들지 않았으나, `execute()` 는 이미 140줄 이상의 단일 메서드로 다음 책임들을 동시에 수행한다: (1) 스냅샷/기본 isolate 생성 분기, (2) 컨텍스트 데이터 주입, (3) host 콜백 주입, (4) dayjs 로드 분기, (5) 부트스트랩 실행, (6) 사용자 코드 컴파일·실행·타임아웃 경쟁, (7) `$vars` 원자적 반환 처리, (8) 에러 분류 및 응답 생성. plan(`W4`)에 `_buildIsolateContext()`/`_runWithTimeout()` 분리가 예정되어 있으나 미완료.
- 제안: 이번 PR이 dayjs 스냅샷 로직을 추가하면서 분기가 한 단계 더 늘었다. `W4` 리팩터를 조기에 진행하여 이 메서드를 최소 2-3개의 private 헬퍼로 분리할 것을 권장한다.

---

**[INFO] 스냅샷 생성 IIFE의 오류 무음(silent failure) 패턴**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts`, `DAYJS_SNAPSHOT` 상수 초기화 블록
- 상세: `createSnapshot` 실패 시 `catch { return undefined; }` 로 silently fallback하는데, 실패 이유가 어디에도 로깅되지 않는다. 플랫폼 호환성 문제나 환경 이슈로 스냅샷 경로가 비활성화되어도 운영자가 이를 인지할 방법이 없다.
- 제안: 최소한 `console.warn('[CodeHandler] dayjs snapshot creation failed, falling back to per-exec compile:', err)` 수준의 경고 로그를 남기거나, 스냅샷 활성 여부를 확인할 수 있는 진단 수단을 제공하는 것이 좋다. catch 블록 파라미터가 현재 완전히 무시되고 있다.

---

**[INFO] 테스트 루프 내 불완전한 검증 — `stays consistent across many sequential executions`**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts`, `stays consistent across many sequential executions (snapshot reuse)` 테스트
- 상세: 루프 25회(`i = 0..24`) 중 각 반복에서는 `result.meta.success`만 확인하고 실제 날짜 값 정확성은 검증하지 않는다. 루프가 끝난 뒤 마지막 값(`i=24`)만 별도로 `expect(last.output).toBe('2020-01-25')`로 검증한다. 이 구조는 i=0..23 구간의 실제 날짜 계산 정확성을 검증하지 않는다.
- 제안: 루프 내에서 `expect(result.output).toBe(expectedDate)` 까지 함께 확인하거나, 대표 케이스 3-4개만 명시적으로 검증하는 방식으로 테스트 신뢰도를 높일 것을 권장한다.

---

**[INFO] 테스트 코드 내 인라인 코드 문자열 가독성**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts`, `runs dayjs correctly via the snapshot-restored global (parity)` 테스트
- 상세: code 문자열로 전달되는 사용자 코드 스니펫이 한 줄에 111자가 넘는다: `'const d = $helpers.date("2021-06-15"); return { y: d.year(), m: d.month(), f: d.add(1, "day").format("YYYY-MM-DD") };'`. 인접한 다른 테스트들은 동일 패턴을 template literal 여러 줄로 분리하거나 짧게 유지하는데, 이 케이스만 유독 길다.
- 제안: 파일 내 다른 테스트와의 일관성을 위해 template literal로 분리하거나, 의미 단위로 줄 바꿈을 적용할 것.

---

**[INFO] `describe` 블록 주석 중복 — 리뷰어 혼란 유발**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts`, diff 추가 라인 35-42와 전체 파일 라인 786-793
- 상세: `describe('execute — dayjs snapshot path (perf follow-up)')` 블록 직전의 7줄짜리 블록 주석이 diff에 추가된 내용과 전체 파일의 동일 위치에 완전히 동일하게 존재한다. diff 위치는 `execute — $helpers` 블록 직후이고 전체 파일에도 같은 위치에 이미 존재하는 것으로 보여 중복 없음으로 해석되나, diff를 읽는 리뷰어에게 같은 내용이 두 번 보이는 구조는 혼란을 준다.
- 제안: 최종 파일에 `describe` 블록이 하나만 존재하는지 재확인할 것. 5개 테스트가 중복 실행되면 CI 시간이 배로 증가한다.

---

**[WARNING] `isolate` 생성 분기에서 옵션 객체 중복**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts`, `execute()` 내 isolate 생성 분기
- 상세: 두 분기 모두 `new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_LIMIT_MB })` 를 공통으로 가지며, 차이는 `snapshot` 필드의 유무뿐이다. `memoryLimit`이 향후 변경될 경우 두 군데를 동시에 수정해야 하며, 이후 다른 공통 옵션(예: v8Flags)이 추가될 때마다 동기화 실패 리스크가 커진다.
- 제안: 공통 옵션 객체를 먼저 구성하고 조건부로 `snapshot`을 추가하는 방식으로 중복을 제거하라:
  ```typescript
  const isolateOptions: ivm.IsolateOptions = { memoryLimit: ISOLATE_MEMORY_LIMIT_MB };
  if (DAYJS_SNAPSHOT) isolateOptions.snapshot = DAYJS_SNAPSHOT;
  const isolate = new ivm.Isolate(isolateOptions);
  ```

---

### 요약

이번 변경은 dayjs UMD의 per-exec 재컴파일을 제거하기 위해 `ivm.Isolate.createSnapshot`을 모듈 로드 시점에 한 번만 실행하는 성능 최적화다. 구조적으로는 기존 아키텍처(per-exec fresh isolate, per-exec bootstrap, W13 순서 불변)를 그대로 유지하면서 스냅샷 path와 fallback path를 명확하게 분기한 점은 양호하다. 다만 isolate 생성 분기에서 옵션 객체의 중복이 유지보수 시 동기화 실패 리스크를 가지며, 스냅샷 생성 실패가 완전히 무음 처리되어 운영 환경에서 원인 파악이 어렵다는 점이 주요 개선 포인트다. `execute()` 메서드의 길이·복잡도 문제는 이번 변경으로 악화되지는 않았으나 plan에 등록된 `W4` 분리 작업이 계속 밀리고 있는 상황이다. 테스트 케이스는 의도한 계약(parity, 상태 격리, 로그 격리, §7.3 하드닝)을 충분히 커버하나 루프 내 값 검증 누락이 있다.

### 위험도
LOW
