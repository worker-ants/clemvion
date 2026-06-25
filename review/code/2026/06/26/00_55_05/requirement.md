# 요구사항(Requirement) 리뷰 결과

리뷰 대상 커밋: `8f2b6d1263b6529ad7e37c130fe9a44f520bcd75`
리뷰 대상 파일:
- `codebase/backend/src/nodes/presentation/table/table.handler.ts`
- `pnpm-lock.yaml`
- `codebase/backend/eslint.config.mjs` (커밋 포함 — 프롬프트 외 확인)
- `codebase/backend/package.json` (커밋 포함 — 프롬프트 외 확인)

---

## 발견사항

### 1. **[INFO]** 변경 범위: behavior-preserving identifier rename 확인

- 위치: `table.handler.ts` 라인 62→63, 71→72 (diff 기준)
- 상세: `catch (e)` → `catch (err)`, 이후 참조 `e instanceof Error ? e.stack : String(e)` → `err instanceof Error ? err.stack : String(err)`. 순수 식별자 rename이며, 분기 조건(`instanceof Error`), 오류 값 전달(`err.stack`, `String(err)`), 반환값(`return null`) 모두 변경 없음. 동작 동일성 검증됨.
- 제안: 없음.

---

### 2. **[INFO]** 기능 완전성 — table.handler.ts 핵심 비즈니스 로직 무변경 확인

- 위치: 전체 파일
- 상세: 이번 커밋의 `table.handler.ts` 변경은 `safeEvaluate` 내의 catch 변수 rename 2줄뿐이다. `spec/4-nodes/6-presentation/2-table.md §4 실행 로직`이 요구하는 모든 단계 — static/dynamic 모드 분기, 컬럼 pre-classify, `$sourceItem`·`$sourceItemIndex` 컨텍스트 주입, `getNestedValue` dot-path, `sortBy`/`sortOrder` 정렬, `pageSize` 슬라이스, `truncateArrayForOutput` 1MB cap, `resolveColumnLabels`, config echo, buttons 분기 — 는 이번 변경에서 손대지 않았으므로 기존 동작이 그대로 유지된다. spec §6 "expression 평가 실패 시 해당 셀은 `null`"도 `safeEvaluate` 의 `return null`이 유지되어 충족.
- 제안: 없음.

---

### 3. **[INFO]** spec fidelity — spec/conventions 는 catch 변수 명명을 소유하지 않음

- 위치: `spec/conventions/error-codes.md`, `spec/conventions/` 전체
- 상세: 커밋 메시지가 명시하듯 `spec/conventions` 어느 문서도 catch 파라미터 명명 관례를 정의하지 않는다. `error-codes.md`는 에러 코드 문자열(예: `VALIDATION_ERROR`, `NODE_EXECUTION_FAILED`)만 정의한다. 따라서 코드 변경과 spec 사이에 line-level 불일치는 없고, lint 설정이 이 관례의 SoT로 적합하다.
- 제안: 없음.

---

### 4. **[INFO]** ESLint 규칙 범위 제한 — unicorn preset 전체가 아닌 단일 rule 활성화

- 위치: `codebase/backend/eslint.config.mjs` (커밋에 포함, 프롬프트 외 확인)
- 상세: `eslint-plugin-unicorn` 을 `plugins: { unicorn: eslintPluginUnicorn }` 으로 등록하되 `catch-error-name` 단일 룰만 `rules` 블록에서 활성화(`'unicorn/catch-error-name': ['error', { name: 'err', ignore: ['^_'] }]`). unicorn 의 나머지 100여 개 규칙은 비활성 상태 — 부수 규칙 유입이 없음이 확인됨. `ignore: ['^_']` 패턴은 기존 `caughtErrorsIgnorePattern: '^_'` 과 동일하게 의도적 미사용 변수를 면제하므로 일관성 있음.
- 제안: 없음.

---

### 5. **[INFO]** pnpm-lock.yaml 신규 패키지 — `eslint-plugin-unicorn@56.0.1` 및 전이 의존성

- 위치: `pnpm-lock.yaml` (변경 부분)
- 상세: 추가된 패키지들(`eslint-plugin-unicorn@56.0.1`, `builtin-modules@3.3.0`, `clean-regexp@1.0.0`, `core-js-compat@3.49.0`, `escape-string-regexp@1.0.5`, `globals@15.15.0`, `hosted-git-info@2.8.9`, `is-builtin-module@3.2.1`, `jsesc@0.5.0`, `normalize-package-data@2.5.0`, `read-pkg-up@7.0.1`, `read-pkg@5.2.0`, `regjsparser@0.10.0`, `semver@5.7.2`, `spdx-*`, `type-fest@0.6.0/0.8.1`, `validate-npm-package-license@3.0.4`)는 `eslint-plugin-unicorn@56` 의 런타임 의존 그래프다. devDependency 이므로 프로덕션 번들에는 포함되지 않는다. `eslint-plugin-unicorn@56.0.1` 의 `engines: node '>=18.18'` 은 NestJS 프로젝트의 요구사항과 일치. 또한 `resolve` 패키지의 `optional: true` 가 제거되었는데(`-    optional: true`), 이는 `normalize-package-data` 가 `resolve` 를 필수 의존성으로 사용하면서 lockfile snapshot이 갱신된 부작용이다. 프로덕션 영향 없음.
- 제안: 없음.

---

### 6. **[INFO]** e2e 검증 보류 — 레지스트리 아웃티지 사유

- 위치: 커밋 메시지
- 상세: "behavior-preserving + unit 전건(7399 passed)" 근거로 e2e 를 보류했다. 이번 변경은 식별자 rename만이므로 e2e 관련 기능 회귀 리스크는 실질적으로 없다. 단 레지스트리가 복구된 이후 표준 절차에 따라 e2e 검증 완료가 권장된다.
- 제안: 없음(INFO 수준).

---

### 7. **[INFO]** `err_` suffix 회피 패턴 — 충돌 케이스 동작

- 위치: 커밋 메시지 (`같은 스코프에 const err/error 가 이미 있어 충돌하는 지점은 룰이 err_ suffix 로 회피`)
- 상세: unicorn `catch-error-name` 의 자동 conflict resolution 동작으로, 같은 스코프에 `const err`/`const error` 가 이미 존재하면 `catch (err_)` 로 대체한다. 이 케이스는 behavior-preserving이며, 해당 파일들에서 `err_` 를 참조하는 모든 라인도 함께 rename 되었으므로 런타임 의미 변경 없음. table.handler.ts 에는 해당 케이스 없음.
- 제안: 없음.

---

## 요약

이번 커밋은 백엔드 전체(49파일)의 catch 변수명을 `err` 로 단일화하는 순수 식별자 rename 리팩토링이다. `table.handler.ts` 변경은 `safeEvaluate` 메서드의 catch 블록 파라미터 `e` → `err` rename 2줄이며, `spec/4-nodes/6-presentation/2-table.md` 가 요구하는 실행 로직(static/dynamic 모드, 셀 평가, 정렬, 페이지네이션, cap, 컬럼 라벨 해석, 버튼 분기, config echo) 전체는 변경 없이 유지된다. spec/conventions는 catch 변수 명명 관례를 소유하지 않으므로 spec fidelity 충돌이 없고, lint 설정이 SoT 역할을 올바르게 담당한다. `eslint-plugin-unicorn@56` 은 devDependency이며, unicorn preset 전체가 아닌 `catch-error-name` 단일 규칙만 활성화되어 부수 규칙 유입 없음이 확인됐다. 기능 완전성·엣지 케이스 처리·에러 시나리오·반환값 경로 모두 이번 변경의 영향 바깥에 있으며, 비즈니스 로직 변경은 0이다.

## 위험도

NONE
