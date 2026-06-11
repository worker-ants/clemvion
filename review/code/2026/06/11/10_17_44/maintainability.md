### 발견사항

- **[INFO]** `production-guards.ts` — `isFlagOn` 함수가 모듈 내부에서만 사용됨에도 `export` 되지 않아 테스트에서 직접 검증하지 않는다. 현재 테스트는 `assertProductionConfig` 를 통해 간접적으로 동작을 커버하므로 실질 문제는 없으나, 별도 단위 테스트가 필요한 수준의 로직이 있다면 export 고려가 가능하다. 현재 구성(내부 헬퍼로 비공개 유지)은 일관성 면에서 오히려 적절하다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` L695–697
  - 상세: 해당 함수의 동작(정확히 `'true'`/`'1'` 만 ON)은 주석으로 명시돼 있어 의도가 명확하다. 현 설계가 올바르다.
  - 제안: 변경 불필요.

- **[INFO]** `assertProductionConfig` 는 "첫 위반에서 즉시 throw" 정책을 로컬 `fail` 화살표 함수로 구현한다. 이 패턴은 가독성 면에서 충분히 명확하지만, 향후 이 함수에 검사 항목이 늘어날수록 `fail()` 호출이 반복되는 구조가 된다. 현재 규모(5개 검사)에서는 허용 가능하다.
  - 위치: `production-guards.ts` L711–713
  - 상세: `const fail = (message: string): never => { throw new Error(...) }` — 인라인 클로저로 에러 prefix 를 한 곳에서 관리하므로 중복을 효과적으로 줄이고 있다.
  - 제안: 현재 규모에서는 적절. 검사 항목이 10개 이상으로 늘어나면 검사 항목을 배열·루프 방식으로 재구조화 고려.

- **[WARNING]** `main.ts` 내 `ALLOW_PRIVATE_HOST_TARGETS` warn 블록이 `isFlagOn` 헬퍼를 사용하지 않고 `=== 'true'` 리터럴 비교를 직접 사용한다. `production-guards.ts` 는 `isFlagOn` 을 통해 `'true'`/`'1'` 두 값을 모두 처리하나, `main.ts` 의 warn 블록은 `'1'` 을 감지하지 못한다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/main.ts` L988
  - 상세: `process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true'` — `.env` 관례상 `'1'` 도 ON 의미이므로 `ALLOW_PRIVATE_HOST_TARGETS=1` 로 설정한 운영자는 경고 로그를 보지 못한다. `production-guards.ts` 의 `isFlagOn` export 후 재사용하거나, 최소한 `'1'` 조건을 OR 로 추가해야 한다.
  - 제안: `isFlagOn` 을 `production-guards.ts` 에서 export 하여 `main.ts` 에서 `isFlagOn(process.env.ALLOW_PRIVATE_HOST_TARGETS)` 로 교체. 또는 `main.ts` 에 `|| process.env.ALLOW_PRIVATE_HOST_TARGETS === '1'` 추가.

- **[INFO]** `production-guards.spec.ts` 의 "no-op outside production" 테스트가 `for` 루프를 사용한다. `it.each` 로 교체하면 각 케이스(`'development'`, `'test'`, `undefined`)가 독립적인 테스트 결과로 표시되어 실패 시 어떤 값이 문제인지 바로 알 수 있다.
  - 위치: `production-guards.spec.ts` L407–418
  - 상세: `for (const nodeEnv of ['development', 'test', undefined])` — 루프 내 단일 `it` 블록이라 실패해도 어느 `nodeEnv` 값에서 실패했는지 기본 출력으로 식별하기 어렵다. `MCP_ALLOW_INSECURE_URL` 케이스들은 이미 `it.each` 를 올바르게 활용하고 있어 불일치가 있다.
  - 제안: `it.each(['development', 'test', undefined])('is a no-op when NODE_ENV=%p', (nodeEnv) => ...)` 패턴으로 교체.

- **[INFO]** `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set 에 "옛 .env.example 예시 키 (~2026-06)" 주석이 날짜를 하드코딩한다. 향후 placeholder 가 추가될 때마다 날짜 표기 관리가 필요하다. 현재는 2개 항목이라 허용 가능하지만, 규칙을 주석 상단 JSDoc 의 "동기화 의무" 절에 집약하고 항목별 날짜 주석은 최소화하는 방향이 유지보수성에 유리하다.
  - 위치: `production-guards.ts` L686–691
  - 상세: 항목 수가 늘어날수록 날짜 주석의 정확도 관리 비용이 증가한다.
  - 제안: 현재 수준은 허용 가능. 3개 이상으로 늘어나면 "추가된 Git 커밋 해시나 PR 번호" 형태로 변경 추적성을 확보하는 게 낫다.

- **[INFO]** `.env.example` 에서 `ENCRYPTION_KEY` placeholder 가 `0000...` 으로 변경되고, 관련 주석이 `!! MUST regenerate` 와 생성 명령(`openssl rand -hex 32`)을 직접 인라인했다. 기존 `JWT_SECRET=change-me-...` 등 다른 secret 항목들과 주석 스타일이 통일되지 않는다(일부는 `# REQUIRED ...` 서술형, 일부는 `!!` 강조 prefix). 일관성 측면의 minor 지적이다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/.env.example` L196–202
  - 상세: `JWT_SECRET` 라인은 상단 주석 섹션에 "Production MUST override this" 서술형, `ENCRYPTION_KEY` 는 `!!` 강조형으로 혼용.
  - 제안: 스타일 통일이 필요하다면 `JWT_SECRET` 도 `!!` 강조 추가 또는 `ENCRYPTION_KEY` 를 서술형으로 통일. 기능적 영향 없으므로 별도 PR 불필요.

### 요약

`production-guards.ts` 는 순수 함수 분리, 로컬 `fail` 헬퍼를 통한 에러 prefix 일관화, `ReadonlySet` 활용, 그리고 상세한 JSDoc 으로 유지보수성이 전반적으로 높다. 테스트 파일도 `prodEnv` 팩토리 함수를 통해 기본 유효 환경을 간결하게 구성하며 각 분기를 독립적으로 커버한다. 주목할 실질 문제는 `main.ts` 의 `ALLOW_PRIVATE_HOST_TARGETS` warn 조건이 `isFlagOn` 헬퍼를 재사용하지 않아 `'1'` 값을 감지하지 못하는 일관성 결함(WARNING)이다. 나머지는 테스트 스타일 불일치(루프 vs `it.each`)와 `.env.example` 주석 스타일 혼용 등 Minor 개선 사항이며 기능 영향은 없다.

### 위험도

LOW
