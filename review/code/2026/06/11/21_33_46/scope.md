# 변경 범위(Scope) 리뷰

**대상**: code-node-isolated-vm (node:vm → isolated-vm 전환)
**검토일**: 2026-06-11

---

## 발견사항

### 핵심 구현 파일 (Files 1–5)

이 파일들은 모두 `isolated-vm` 전환이라는 작업 의도에 직접 부합한다.

- **[INFO]** `package.json` / `package-lock.json` — `isolated-vm@6.1.2` 의존성 추가. 작업 의도 그 자체이며 범위 이탈 없음.

- **[INFO]** `error-codes.ts` — `CODE_MEMORY_LIMIT` 추가. 신규 에러 코드는 isolated-vm 메모리 한도 기능과 직결된다. 범위 내.

- **[INFO]** `code.handler.spec.ts` — 기존 `noProcess` 단언을 `has-process`→`no-process` flip(red→green 회귀), `should not expose host process to a direct sandbox reference` 신규 테스트, `CODE_MEMORY_LIMIT` 메모리 초과 테스트 추가. 세 변경 모두 전환의 검증이라 범위 내.

  주석 변경 관찰: 기존 `// WARNING 12 — $helpers host-realm isolation` 블록 주석이 `// SECURITY (spec §7.1 / §Rationale)` 로 교체됐다. 이는 기존 node:vm 한계를 설명하던 TODO성 주석을 새 현실에 맞게 갱신한 것이므로 범위 내 필수 정정이다.

- **[INFO]** `code.handler.ts` — `vm.createContext`/`runInContext` 전면 제거, `ivm.Isolate` + `Context` + `ExternalCopy` + `Callback` 구조로 재작성. 임포트 변경(`node:vm` / `dayjs` 제거, `node:fs` / `isolated-vm` 추가)도 전환 자체다. 범위 내.

  단, `readFileSync(require.resolve('dayjs/dayjs.min.js'), ...)` 로 dayjs UMD를 동기 파일 읽기로 불러오는 방식은 기존 `import dayjs from 'dayjs'` 대비 접근법이 크게 달라졌다. 기능적 목적(in-isolate dayjs 실행)에서 필수 변경이나, 공유 `syntaxIsolate` 가 모듈 수준 가변 상태로 추가된 부분은 테스트 격리 영향이 있을 수 있다. 이는 security/correctness 관점 항목이며 범위 이탈은 아니다.

  `formatLog` 함수가 제거되고 `BOOTSTRAP_SOURCE` 인라인 문자열 내 동등 로직으로 이전됐다. 기능 동치(기존 `parts.join(' ')` → `fmt(args)`)이므로 불필요한 리팩토링이 아니라 아키텍처 필요에 따른 이전이다.

### 문서 파일 (Files 6–7)

- **[INFO]** `data.en.mdx` / `data.mdx` — 에러 코드 표 (`EXECUTION_TIMEOUT`→`CODE_TIMEOUT`, `CODE_RUNTIME_ERROR`→`CODE_EXECUTION_FAILED`, `CODE_SYNTAX_ERROR` 삭제 + `CODE_MEMORY_LIMIT` 신규), 허용 전역에서 `setTimeout` 제거, 메모리 128MB 행 추가. 모두 spec 변경에 따른 user-docs 동기화다. 범위 내.

### 계획·추적 파일 (Files 8–9)

- **[INFO]** `plan/in-progress/code-node-isolated-vm.md` — 신규 plan 파일 생성. 작업 트래킹 의무이므로 범위 내.

- **[INFO]** `plan/in-progress/refactor/04-security.md` — C-2, M-2 체크박스를 `[x]` 완료 상태로 갱신. plan-lifecycle 규칙이 요구하는 상태 동기화이므로 범위 내.

### 일관성 검토 산출물 (Files 10–27)

- **[INFO]** `review/consistency/2026/06/11/21_03_19/` 및 `21_19_55/` 디렉터리 전체(SUMMARY.md, 각 checker별 .md, _retry_state.json, meta.json). 이 파일들은 모두 `--spec` 일관성 검토 실행의 자동 산출물이다. CLAUDE.md는 구현 착수 직전 `consistency-check --impl-prep` 실행을 의무화하며, 산출물은 `review/consistency/**` 에 저장된다. 해당 규약에 따른 정상적인 파일들이므로 범위 이탈 없음.

---

## 범위 이탈 의심 항목 (상세 검토)

### 잠재적 무관 변경 없음

전체 26개 파일을 검토한 결과 범위를 벗어난 수정은 발견되지 않았다.

- 새로운 기능이 자발적으로 추가되지 않았다(과도한 엔지니어링 없음).
- 관련 없는 파일 영역 수정이 없다.
- 임포트 변경은 모두 구현 변경과 직결된다.
- 설정 파일(`package.json`)은 필요한 의존성만 추가됐다.
- `HelpersApi` 인터페이스 제거와 `buildHelpers` 함수 제거는 구현 전환에 따라 불필요해진 코드를 정리한 것으로, 불필요한 리팩토링이 아닌 필수 정리다.
- `BOOTSTRAP_SOURCE` 인라인 문자열의 긴 글로벌 삭제 목록(`eval`, `Function`, `Reflect`, 등)은 기존 `buildSandbox` 에서 `undefined` 로 주입하던 목록을 이전한 것이다. 목록이 다소 확장(`queueMicrotask` 추가 등)됐으나 이는 isolated-vm 환경에서의 하드닝 완성을 위한 것으로 spec §7.3 의 명시적 요구사항이다.

---

## 요약

이번 변경은 code 노드의 sandbox를 `node:vm`에서 `isolated-vm`(V8 Isolate)으로 전환하는 작업이다. 수정된 모든 파일(구현, 테스트, user-docs, plan 추적, consistency-check 산출물)은 이 전환의 직접적 범주에 속한다. 범위를 벗어난 리팩토링, 무관한 기능 추가, 의도하지 않은 설정 변경은 발견되지 않았다. `formatLog` 삭제나 `HelpersApi` 인터페이스 제거처럼 삭제된 코드들도 전환으로 인해 불필요해진 것들이며, 신규 추가된 `syntaxIsolate` 모듈 상태와 `readFileSync` dayjs 로딩 방식은 아키텍처적으로 전환에 필요한 변경이다.

---

## 위험도

NONE
