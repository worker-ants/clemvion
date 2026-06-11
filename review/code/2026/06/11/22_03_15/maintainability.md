# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `code.handler.spec.ts`

- **[INFO]** 테스트 설명문의 혼재 언어 패턴
  - 위치: `classifyError (unit)` 블록 전체
  - 상세: 기존 테스트 파일의 `it(...)` 설명은 영문으로 일관되어 있다. 신규 추가된 `classifyError` 유닛 테스트 설명들도 영문을 유지하여 일관성을 지키고 있으나, W-번호 접두사 참조 스타일(`// W9 —`, `// W2`, `// W10:` 등)이 소스 내 여러 위치에 산재한다. 현재는 큰 문제가 없지만, W-번호가 어느 문서나 이슈를 가리키는지 파일 내에서 탐색이 어렵다.
  - 제안: W-번호 참조 대상(review session 경로 또는 이슈 번호)을 파일 상단 주석 블록에 한 곳에 정리하거나, 최소한 첫 등장 시 한 번만 해설하고 이후 참조는 간결하게 유지한다.

- **[INFO]** 스포일링 방지 테스트의 단언 의도 모호성
  - 위치: `classifyError (unit)` 블록, `should NOT classify user-thrown "Isolate was disposed"...` 테스트 (line 71–83)
  - 상세: 테스트명은 "NOT classify ... as memory when isolate is alive (spoofing prevention)"라고 명시하지만 실제 단언은 `toBe('EXECUTION_MEMORY_EXCEEDED')`다. 즉 "메모리로 분류되지 않음"이라는 제목과 "메모리로 분류됨"이라는 단언이 충돌한다. 주석이 이를 설명하고 있으나("Regex fallback still maps this"), 다음 유지보수자가 테스트명만 보고 잘못 이해하거나 테스트를 수정할 위험이 있다.
  - 제안: 테스트명을 실제 동작을 반영하도록 수정한다. 예: `"should classify by message regex (not priority-2 flag) when isolate is alive — spoofing does not trigger isDisposed branch"`.

- **[INFO]** `{} as any` 입력 테스트의 설명 정확성
  - 위치: `should handle null/undefined-like error gracefully` 테스트 (line 112–114)
  - 상세: `{}` 는 `null`/`undefined` 가 아니므로 "null/undefined-like"는 오해를 일으킨다. 실제 검증 의도는 빈 객체(메시지·코드 없음)에 대한 fallback 처리다.
  - 제안: 테스트명을 `"should return CODE_RUNTIME_ERROR for an error object with no code or message"` 등으로 변경한다.

- **[INFO]** 메모리 테스트 Jest 타임아웃 주석 중복
  - 위치: line 57, 707
  - 상세: `}, 30_000); // Jest timeout 30_000 ms = 30s` 주석이 diff 내 추가된 부분과 전체 파일 컨텍스트 양쪽에 동일하게 나타난다. 주석 자체는 유용하나 같은 위치에 두 번 렌더된 것은 diff와 컨텍스트가 겹쳐 보이는 artifact다. 코드 자체에는 중복 없음.

---

### 파일 2: `code.handler.ts`

- **[INFO]** 모듈 레벨 상수(`RE_*`, `LEGACY_TO_NORMALIZED`)와 사용처의 선언 순서 역전
  - 위치: 파일 하단 line 1382–1393 (상수 선언), line 1354 (사용처)
  - 상세: `LEGACY_TO_NORMALIZED`와 `RE_*` 정규식들이 `failure()` 메서드 및 `classifyError()` 아래에 선언되어 있으나, JavaScript/TypeScript `var` 호이스팅이 아닌 `const`는 TDZ(Temporal Dead Zone)가 존재한다. 실제로는 클래스 본문 밖 모듈 스코프이고 사용 시점이 런타임이므로 동작상 문제는 없다. 그러나 코드를 위에서 아래로 읽을 때 `failure()` 안의 `LEGACY_TO_NORMALIZED[errorCode]`가 어디서 왔는지 찾으러 스크롤을 내려야 한다.
  - 제안: 모듈 레벨 상수(`MAX_CONSOLE_LINES`, `ISOLATE_MEMORY_LIMIT_MB` 등 기존 상수 블록)와 함께 파일 상단으로 이동시켜 "상수 → 헬퍼 함수 → 클래스" 순서를 유지한다.

- **[WARNING]** `execute()` 메서드의 과도한 길이 및 다중 책임
  - 위치: `CodeHandler.execute()` 메서드 전체 (line 1169–1330, 약 160줄)
  - 상세: 단일 메서드가 다음 책임을 모두 처리한다: (1) isolate 생성 및 컨텍스트 주입, (2) host callback 주입, (3) dayjs/bootstrap 로드, (4) 사용자 코드 컴파일, (5) 이중 타임아웃 race, (6) `$vars` sync-back, (7) 성공 결과 조립. 현재 로직이 복잡하고 안전성 의미론(ordering constraint)도 포함되어 있어 향후 변경 시 부작용 영향범위 추적이 어렵다.
  - 제안: 최소한 (a) `_buildIsolateContext(isolate, input, context, logs)` — 컨텍스트 주입 전담, (b) `_runWithTimeout(script, ctx, timeoutMs)` — race 로직 전담으로 추출하여 `execute()`가 오케스트레이션만 담당하도록 분리한다. `BOOTSTRAP_SOURCE` 주석(W13 순서 주의)은 해당 단계 헬퍼에 이전한다.

- **[INFO]** `W`-번호 참조의 집중화 부재
  - 위치: 코드 전반 (`W2`, `W4`, `W8`, `W13`, `W14`, `W15` 등)
  - 상세: 파일 상단 주석 또는 별도 `// ## Review Notes` 블록 없이 W-번호가 본문 곳곳에 분산되어 있다. 처음 파일을 보는 기여자는 W-번호 체계를 이해하기 위해 review 산출물을 별도로 찾아야 한다.
  - 제안: 파일 상단에 한 줄 `// Review annotations (W*): see review/code/2026/06/11/22_03_15/` 를 추가하거나, 내부 링크 없이도 w-번호가 "review 항목 참조"임을 알 수 있도록 `// W8: [review] ...` 형식으로 통일한다. 현재는 일부는 `// W8:`, 일부는 `// W13 (IMPORTANT ...)`, 일부는 `// W4/INFO#3` 등 형식이 불일치한다.

- **[INFO]** `syntaxIsolate`의 모듈 레벨 `let` 가변 상태
  - 위치: line 1121 `let syntaxIsolate: ivm.Isolate | undefined;`
  - 상세: 모듈 레벨 가변 상태는 테스트 격리를 어렵게 만든다. 현재는 `syntaxCheck()` 내 `isDisposed` 재생성 로직(W4/INFO#3 수정)이 있어 부분적으로 완화되었지만, 테스트 간 상태 누출 가능성(특히 OOM 이후 상태)이 있다.
  - 제안: 단기: 현 상태 유지 (이미 W4 수정으로 방어). 중기: `syntaxCheck`를 클로저나 클래스로 캡슐화하여 모듈 레벨 가변 상태를 제거.

- **[INFO]** `wrapUserCode()` 함수의 라인 오프셋 매직 넘버
  - 위치: W14 주석 및 `wrapUserCode()` 함수 (line 1107–1116)
  - 상세: W14 주석이 "+4 offset" 을 언급하나 `wrapUserCode` 반환값의 실제 헤더 줄 수를 세야 확인 가능하다. 오프셋 값이 주석에만 있고 상수로 추출되지 않아 wrapper 구조 변경 시 주석을 수동으로 갱신해야 한다.
  - 제안: `const WRAP_LINE_OFFSET = 4; // lines prepended by wrapUserCode()` 를 선언하고, W14 주석에서 이 상수를 참조하도록 한다. 에러 리포팅 시 이 값을 실제로 뺄 계획이 있다면 특히 중요.

---

### 파일 3: `backend-labels.ts`

- **[INFO]** `CODE_MEMORY_LIMIT` 메시지의 하드코딩된 용량 값
  - 위치: `ERROR_KO` 객체, `CODE_MEMORY_LIMIT` 항목
  - 상세: `"코드 실행 중 메모리 한도(128MB)를 초과했어요."` 에 `128MB`가 리터럴로 하드코딩되어 있다. `code.handler.ts`의 `ISOLATE_MEMORY_LIMIT_MB = 128` 상수와 독립적으로 관리된다. 메모리 한도가 변경되면 두 파일을 동시에 수정해야 함을 인지해야 한다.
  - 제안: 단기적으로는 이 파일에 주석 `// keep in sync with ISOLATE_MEMORY_LIMIT_MB in code.handler.ts`를 추가해 동기화 의무를 명시한다. 장기적으로는 백엔드가 에러 코드에 `params`를 담아 프론트엔드가 `{{mb}}` 보간으로 처리하는 방식이 유지보수성을 높인다.

- **[INFO]** i18n 주석 스타일 불일치
  - 위치: `ERROR_KO` 내 신규 추가 주석 `// code 노드 실행 에러 코드 (SUMMARY#1 — isolated-vm 전환으로 신규/변경).`
  - 상세: 기존 `ERROR_KO` 내 다른 주석들(예: `// PR2a — §8 active-running...`, `// PR1 — 통합 모델 설정...`)은 `PR`-번호 + `§` 섹션 참조 형식을 따르는데, 신규 항목은 `SUMMARY#1` 형식을 사용한다. 참조 체계가 일관되지 않다.
  - 제안: 기존 `PR` 번호 또는 spec 섹션 참조 형식으로 통일한다. 예: `// spec §4-nodes/5-data/2-code — isolated-vm 전환으로 신규 추가`.

---

### 파일 4: `spec/4-nodes/5-data/2-code.md`

- **[INFO]** 변경 내용이 최소적이고 명확하며 유지보수성 문제 없음
  - 위치: diff 전체 (4줄 변경)
  - 상세: `CODE_MEMORY_LIMIT` 에러 코드 추가, `EXECUTION_MEMORY_EXCEEDED` legacyCode 추가, `queueMicrotask` 차단 목록 추가 — 모두 구현 변경을 정확하게 반영한 최소 변경이다. 테이블 일관성도 유지된다.

---

## 요약

전반적으로 이번 변경은 유지보수성 관점에서 양호하다. `classifyError`의 `export` 및 우선순위 3단계 로직 분리, `LEGACY_TO_NORMALIZED` 테이블 도입, 모듈 레벨 정규식 상수화, `syntaxCheck`의 disposed 재생성 처리, 테스트 추가 모두 가독성과 변경 내성을 향상시키는 방향이다. 주요 주의 사항은 두 가지다: (1) `execute()` 메서드가 약 160줄에 7가지 책임을 가지고 있어 향후 수정 시 부작용 추적 부담이 높고 (WARNING), (2) 모듈 레벨 상수(`LEGACY_TO_NORMALIZED`, `RE_*`)가 사용처보다 파일 하단에 선언되어 코드 읽기 흐름을 역행한다 (INFO). 나머지는 네이밍 정확도, 매직 넘버 문서화, W-번호 참조 일관성에 대한 경미한 개선 제안이다.

## 위험도

LOW
