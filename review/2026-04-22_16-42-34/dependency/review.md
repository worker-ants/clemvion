### 발견사항

- **[INFO]** `handleSseEvent` / `summarizePlanState` 의 내부 → 모듈 공개 경계 변경
  - 위치: `frontend/src/lib/stores/assistant-store.ts:383, 569`
  - 상세: 두 함수가 `function`(모듈 내부)에서 `export function`으로 변경됨. JSDoc에 "Exported for unit testing — production callers go through `sendMessage`"라고 의도가 명시되어 있으나, 이제 모듈 외부에서 직접 호출 가능한 API 표면이 생겼음. 현재 `assistant-store.test.ts`만 소비하지만, 향후 다른 모듈이 우회 경로로 의존할 수 있음.
  - 제안: 테스트 전용 export임을 유지하려면 `/* @internal */` JSDoc 태그를 추가하거나, Vitest의 `vi.importActual`/barrel re-export 분리 패턴으로 테스트 전용 모듈을 따로 노출하는 방법도 고려.

- **[INFO]** 신규 테스트 파일의 `locale-store` 의존
  - 위치: `frontend/src/lib/stores/__tests__/assistant-store.test.ts:8`
  - 상세: `useLocaleStore`를 `beforeEach`에서 `setState`로 직접 조작함. 이는 `locale-store`의 내부 상태 구조(특히 `locale` 필드명)에 강결합됨. `locale-store`가 리팩토링되면 테스트도 같이 깨질 수 있음.
  - 제안: 현재 규모에서는 합리적인 트레이드오프. 다만 `locale-store` 변경 시 이 파일도 함께 점검 필요.

- **[INFO]** 새 의존성 없음 확인
  - 위치: 전체 diff
  - 상세: 6개 파일 전체에서 `package.json` 수정이나 새 `import`(외부 패키지)가 없음. `zustand`, `sonner`, `zod`, `vitest` 등 기존 의존성만 활용.

---

### 요약

이번 변경은 **외부 패키지를 전혀 추가하지 않는 순수 로직 개선**이다. 모든 import는 기존 의존성(`zustand`, `vitest`, `zod`, NestJS 내장 모듈)과 프로젝트 내부 모듈에 국한된다. 유일한 의존성 관점 변경은 `handleSseEvent`·`summarizePlanState`의 테스트 목적 export인데, 의도가 JSDoc에 명확히 기술되어 있고 실제 소비자도 테스트 파일 하나뿐이므로 관리 가능한 수준이다. `locale-store` 직접 조작으로 인한 내부 결합도 증가는 낮은 위험이다.

### 위험도

**NONE**