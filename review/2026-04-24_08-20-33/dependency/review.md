## Dependency Code Review

### 발견사항

---

**[INFO]** 신규 의존성 추가 없음 — 의존성 관점에서 변경사항 없음
- **위치**: `model-combobox.tsx` imports 전체
- **상세**: 이번 변경에서 추가된 외부 패키지 없음. `@tanstack/react-query`, `axios`, `lucide-react` 모두 `frontend/package.json`에 이미 선언된 의존성. `llm-configs.ts`는 내부 `apiClient` wrapper만 사용해 외부 라이브러리 직접 임포트 없음.
- **제안**: 해당 없음.

---

**[INFO]** `axios`가 에러 타입 가드 용도로만 사용됨 — 최소 의존
- **위치**: `model-combobox.tsx:5`, `model-combobox.tsx:79`
- **상세**: `axios`는 `axios.isAxiosError()` 타입 가드 한 곳에서만 참조. 실제 HTTP 요청은 내부 `apiClient`를 통해 수행되므로 컴포넌트가 axios에 깊이 결합되지 않는다. `isAxiosError`는 axios 1.0+에서 안정적으로 제공되는 API이며 현재 버전(`^1.15.0`)에서 정상 동작.
- **제안**: 해당 없음. 다만 향후 `apiClient`가 fetch 기반으로 교체될 경우 이 가드 로직도 함께 교체해야 함.

---

**[INFO]** `@tanstack/react-query` v5 API 정합성 양호
- **위치**: `model-combobox.tsx:4,54`
- **상세**: `useMutation`의 `mutationFn` / `onMutate` / `onSuccess` / `onError` 콜백 구조는 TanStack Query v5(`^5.95.2`) API와 일치. v4와 v5 사이에 `mutationFn` 분리, `onMutate` 추가 등 breaking change가 있었으나 현재 코드는 v5 패턴에 맞게 작성되어 있음.
- **제안**: 해당 없음.

---

**[WARNING]** `@types/jest-axe`(3.x) vs `jest-axe`(10.x) 메이저 버전 불일치
- **위치**: `frontend/package.json:66,71`
- **상세**: `jest-axe: ^10.0.0`과 `@types/jest-axe: ^3.5.9`가 공존한다. 메이저 버전이 7 차이나며, jest-axe 10.x에서 변경된 API·반환 타입이 3.x 타입 정의에 반영되지 않았을 수 있어 TypeScript 타입 검사가 부정확해질 위험이 있다. 현재 변경 파일이 `jest-axe`를 직접 사용하지 않으므로 즉각적인 문제는 없으나, 접근성 테스트 작성 시 잘못된 타입 추론이 발생할 수 있다.
- **제안**: `@types/jest-axe`를 `jest-axe` 메이저 버전에 맞게 업데이트하거나, `jest-axe`가 자체 타입 선언을 포함하는 버전인지 확인 후 `@types/jest-axe` 제거 검토.

---

**[INFO]** `backend/package.json` staged 변경 — `zod ^4.3.6` 및 `uuid ^13.0.0` 주목
- **위치**: `backend/package.json`
- **상세**: 현재 backend가 `zod: ^4.3.6`과 `uuid: ^13.0.0`을 사용한다. Zod 4는 v3 대비 여러 breaking change가 있으며, uuid 13은 ESM-first로 전환되어 Jest 환경에서 변환 설정이 필요하다 — 이는 `transformIgnorePatterns`의 `uuid` 항목으로 이미 대응 중. 리뷰 대상 파일과 직접 관련은 없으나, LLM 설정 DTO(`CreateLlmConfigDto`, `UpdateLlmConfigDto`)가 zod 기반 검증을 사용한다면 v4 API 사용 여부 확인 필요.
- **제안**: `@nestjs/class-validator` 기반 DTO와 `zod` 혼용 여부 점검. zod를 validation schema 용도로 직접 사용하는 경우 v4 migration guide(`.parse()` / `.safeParse()` 동작 변경) 재검토.

---

**[INFO]** 테스트 프레임워크 버전 매우 최신 — Vitest 4.x, Jest 30.x
- **위치**: `frontend/package.json:75`, `backend/package.json:97`
- **상세**: frontend는 `vitest ^4.1.4`, backend는 `jest ^30.0.0`을 사용한다. 두 버전 모두 매우 최신이며, 특히 Vitest 4.x는 최근 메이저 릴리즈로 기존 3.x와 일부 API 차이가 있다. 현재 테스트 코드에서 사용하는 `vi.mocked()`, `vi.clearAllMocks()`, `mockRejectedValue()` 등은 모두 표준 API라 영향 없음. 다만 팀 내 CI 환경과 로컬 환경의 버전 고정(lock file) 관리가 중요함.
- **제안**: `package-lock.json` 또는 `pnpm-lock.yaml`을 통해 정확한 설치 버전이 고정되어 있는지 확인. caret range만으로는 재현성 보장이 불충분.

---

### 요약

이번 변경(`model-combobox.tsx`, `llm-configs.ts` 및 관련 테스트)은 신규 외부 의존성을 전혀 추가하지 않았다. 모든 외부 참조(`@tanstack/react-query`, `axios`, `lucide-react`)는 이미 선언된 패키지이며 API 사용 방식도 각 버전에 적합하다. 의존성 관점의 실질적 위험은 프로젝트 전체 수준에서 `@types/jest-axe`의 메이저 버전 불일치 하나다. `zod ^4.3.6`과 `uuid ^13.0.0` 도입은 별도 변경에서 이루어진 것으로 보이며, 이번 리뷰 범위 파일과 직접 충돌하지는 않는다. caret range 전략은 JS 생태계 표준이나, 재현성 보장을 위해 lock file 관리가 유지되어야 한다.

### 위험도

**NONE**