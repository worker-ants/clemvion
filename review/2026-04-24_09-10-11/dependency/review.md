### 발견사항

---

**[INFO]** `llm-config.controller.spec.ts` — `Pick<>` + `jest.Mocked<>` 타입 선언으로 의존성 drift 위험 감소
- **위치**: `llm-config.controller.spec.ts:4-11`
- **상세**: 이전 리뷰(architecture/dependency 라운드)에서 `as never` 캐스팅이 서비스 인터페이스 변경 시 silent drift를 유발한다고 지적했음. 이번 파일은 `Pick<LlmService, 'testConnection' | 'listModels' | 'previewModels' | 'clearClientCache'>` 형태로 mock 타입을 명시적으로 선언해 이를 개선. `LlmService`에서 해당 메서드가 rename/제거되면 컴파일 오류로 즉시 감지 가능.
- **제안**: 현행 유지. 의존성 관점에서 올바른 개선.

---

**[INFO]** `preview-llm-models.dto.ts` — `LLM_PROVIDERS`, `LlmProvider` 단일 출처 재사용
- **위치**: `preview-llm-models.dto.ts:10`
- **상세**: `create-llm-config.dto`에서 상수·타입을 import해 중복 정의 없이 재사용. provider 목록 변경 시 수정 지점이 단일 파일로 유지됨. 이전 리뷰에서 권장한 패턴이 올바르게 적용됨.
- **제안**: 현행 유지.

---

**[INFO]** `llm-configs.test.ts` — 이중 응답 형태(envelope / raw array) 계약 고착화 지속
- **위치**: `llm-configs.test.ts:34-43` (`falls back to the body itself when not enveloped`)
- **상세**: `data?.data ?? data` fallback 경로를 테스트가 "정상 계약"으로 고정. RESOLUTION.md W-12에서 의도적 보류로 결정했으나, 이 이중 계약이 테스트에 남는 한 `apiClient` 인터셉터 중앙화 시 이 케이스를 제거해야 한다는 사실이 쉽게 묻힐 수 있음. `previewModels` 동일 패턴의 fallback 케이스도 추가됨(`llm-configs.test.ts:52-57`).
- **제안**: 두 fallback 케이스에 `// TODO: remove after transform interceptor centralizes response unwrapping` 주석 추가. 이 케이스가 임시 계약임을 코드에서 명확히 표시.

---

**[INFO]** `preview-llm-models.dto.spec.ts` — 새 외부 의존성 없음, 기존 `class-transformer`/`class-validator` 활용
- **위치**: `preview-llm-models.dto.spec.ts:1-2`
- **상세**: `plainToInstance`, `validate`를 기존 패키지에서 import. Jest 환경의 표준 사용.
- **제안**: 현행 유지.

---

**[INFO]** (잔존) 프론트엔드 provider 상수 미공유 — `model-combobox.tsx`
- **위치**: `model-combobox.tsx` (파일 내용 diff 생략됨, 이전 리뷰 기준)
- **상세**: 이전 라운드부터 반복 지적된 사항. 백엔드 `create-llm-config.dto.ts`의 `LLM_PROVIDERS`·`LlmProvider`에 대응하는 프론트엔드 공유 상수가 없어 `'local'`, `'azure'` 등이 컴포넌트 내부에 하드코딩됨. 신규 provider 추가 시 백엔드·프론트엔드 양쪽을 각각 수정해야 하는 암묵적 의존성.
- **제안**: `frontend/src/lib/llm-providers.ts` 생성 후 공유 상수 export. 단기적으로 수정 비용이 있으나 provider 추가 시 누락 위험을 제거.

---

### 요약

이번 변경에서 새로운 외부 패키지는 추가되지 않았으며, 번들 크기·라이선스·취약점 관련 신규 위험은 없다. `llm-config.controller.spec.ts`의 `Pick<>` + `jest.Mocked<>` 타입 선언은 이전 `as never` 문제를 실질적으로 개선했다. `preview-llm-models.dto.ts`의 내부 타입 재사용 패턴도 올바르다. 잔존 이슈는 두 가지로, `llm-configs.test.ts`의 이중 응답 형태 fallback 테스트가 임시 계약임을 명시하지 않아 향후 인터셉터 중앙화 작업 시 제거 대상을 추적하기 어렵고, 프론트엔드 provider 상수가 공유 모듈 없이 분산된 상태다.

### 위험도
**LOW**