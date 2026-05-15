## 의존성 리뷰

### 발견사항

- **[INFO]** `jest-e2e.json`에 ESM 전용 패키지 예외 추가
  - 위치: `backend/test/jest-e2e.json` `transformIgnorePatterns`
  - 상세: `uuid`, `p-limit`, `yocto-queue`는 ESM-only 패키지로, CommonJS 환경의 Jest에서 `ts-jest`를 통한 트랜스폼이 필요. 이 패턴은 해당 패키지들이 직접 또는 전이적 의존성으로 사용되기 시작했음을 의미함. 단, 변경된 diff 어디에도 `p-limit` / `yocto-queue`를 직접 `import`하는 코드가 없음.
  - 제안: `p-limit`가 어느 패키지의 전이적 의존성인지 `npm ls p-limit`로 확인하고, package.json에 직접 명시되지 않았다면 어떤 업스트림 패키지 업그레이드로 진입했는지 기록해 두는 것이 좋음

- **[INFO]** `transformIgnorePatterns`에 pnpm 경로 패턴 포함
  - 위치: `backend/test/jest-e2e.json` 6번째 줄 (`\\.pnpm/[^/]+/node_modules/`)
  - 상세: CLAUDE.md가 npm을 패키지 매니저로 명시하고 있으나, 정규식 패턴이 pnpm의 중첩 node_modules 경로도 처리하도록 작성됨. npm 환경에서는 이 분기가 절대 매칭되지 않으므로 무해하지만, 패턴 출처(다른 프로젝트에서 복사)가 명확하지 않음.
  - 제안: npm 전용 환경이라면 `node_modules/(?!(uuid|p-limit|yocto-queue)/)` 로 단순화 가능. 단, 현재 패턴도 동작에 문제 없음.

- **[INFO]** 병렬 실행에 외부 concurrency 라이브러리 미사용 — 올바른 선택
  - 위치: `ai-agent.handler.ts` `Promise.all(providerToRun.map(...))`
  - 상세: `p-limit` 같은 외부 concurrency 제어 라이브러리 없이 네이티브 `Promise.all`만 사용. `providerToRun`의 크기는 `maxToolCalls` 잔여 예산(`providerBudget`)으로 이미 상한이 걸려 있으므로 추가 동시성 제어가 불필요. 신규 프로덕션 의존성 없음.

- **[INFO]** 단위 테스트 jest 설정(`jest.json`)에는 해당 `transformIgnorePatterns` 변경이 없음
  - 위치: `backend/test/jest-e2e.json` only
  - 상세: 단위 테스트는 AppModule 전체를 로드하지 않으므로 `p-limit`/`yocto-queue` 전이 의존성이 노출되지 않는 것으로 보임. e2e만 영향받는 것이 일관성 있음. 단위 테스트 jest 설정도 동일 패턴이 필요한지 주기적으로 점검 필요.

- **[INFO]** `moduleNameMapper` `^(\\.{1,2}/.*)\\.js$: $1` 추가
  - 위치: `backend/test/jest-e2e.json`
  - 상세: ESM 패키지들이 `.js` 확장자로 import를 명시하는 경우 ts-jest의 CommonJS 변환과 충돌 방지 목적. 표준적인 해결책이며 외부 의존성을 추가하지 않음.

---

### 요약

이번 변경에서 **프로덕션 코드에 새로운 외부 의존성은 전혀 추가되지 않았다.** 병렬 실행은 네이티브 `Promise.all`로 구현되었고, `maxToolCalls` 잔여 예산으로 동시 실행 수를 이미 상한 제어하고 있어 `p-limit` 같은 추가 라이브러리가 불필요하다는 올바른 판단이 반영되어 있다. 테스트 설정(`jest-e2e.json`)의 `transformIgnorePatterns` 변경만이 의존성 관련 수정인데, 이는 기존 전이적 의존성(`uuid`, `p-limit`, `yocto-queue`)이 ESM-only로 배포되는 데 따른 Jest CommonJS 호환 조치이다. `p-limit`/`yocto-queue`의 직접 import가 diff에 보이지 않으므로 어느 업스트림 패키지에서 진입한 전이 의존성인지 `npm ls` 로 한 번 확인해 두면 추후 버전 관리가 용이해진다.

### 위험도

**LOW**