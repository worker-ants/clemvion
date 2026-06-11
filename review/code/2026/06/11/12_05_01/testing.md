# 테스트(Testing) 리뷰

## 발견사항

### [INFO] README.md — 테스트 대상 아님 (문서 변경)
- 위치: `codebase/backend/README.md` 전체
- 상세: 순수 문서 변경이며 로직이 없다. 테스트 관점에서 별도 검증 대상이 아니다.
- 제안: 해당 없음.

---

### [INFO] `beforeAll` 내부 `readFileSync` 실패 시 `envExampleContent` 가 `undefined` 로 남아 이후 테스트가 불명확하게 실패
- 위치: `production-guards.spec.ts` L380–384
- 상세: `beforeAll` 에서 `readFileSync` 가 throw 하면 Jest 는 `beforeAll` 실패를 기록하고 같은 `describe` 의 `it` 들을 건너뛴다 — "이 블록만 실패" 한다는 커밋 메시지의 의도는 맞다. 단, `envExampleContent` 는 `let envExampleContent: string` 으로 선언되어 `undefined` 인 채로 `it` 에 노출될 가능성이 타입 시스템 상으로는 열려 있다. 런타임에서 Jest 의 skip 동작이 이를 방어하지만, `let envExampleContent!: string` (definite assignment assertion) 또는 `let envExampleContent = ''` 처럼 명시적으로 초기화하는 편이 의도를 더 명확하게 전달한다.
- 제안: `let envExampleContent!: string;` 사용 — `beforeAll` 이 실행되지 않으면 `string` 계약이 위반됨을 컴파일러 수준에서 표시.

---

### [INFO] `beforeAll` 내부에서도 `readFileSync` 는 여전히 동기 I/O — 비동기 대안 없음
- 위치: `production-guards.spec.ts` L382–383
- 상세: Jest `beforeAll` 은 비동기 콜백을 지원하지만, 여기서는 의도적으로 동기 `readFileSync` 를 사용한다. `.env.example` 은 CI 환경에서 항상 존재해야 하는 파일이므로 동기 읽기가 허용 범위 내에 있다. 단, 만약 워크트리·CI 경로가 달라 파일이 없을 경우 오류 메시지가 명확하지 않다.
- 제안: `beforeAll` 에 `try/catch` 를 추가하고 파일 경로와 함께 사람이 읽기 쉬운 오류 메시지를 출력하면 디버깅이 쉬워진다.

  ```ts
  beforeAll(() => {
    const envExamplePath = path.resolve(__dirname, '../../../.env.example');
    try {
      envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
    } catch (e) {
      throw new Error(`[blacklist Set sync] .env.example not found at ${envExamplePath}: ${e}`);
    }
  });
  ```

---

### [INFO] `OAUTH_STUB_MODE=false` / `LLM_STUB_MODE=false` 가 `.env.example` 에 명시적으로 존재 — 블랙리스트 동기화 테스트 없음
- 위치: `production-guards.spec.ts` `blacklist Set sync` describe, `.env.example` L(OAUTH_STUB_MODE/LLM_STUB_MODE 행)
- 상세: `.env.example` 에 `OAUTH_STUB_MODE=false`, `LLM_STUB_MODE=false` 가 명시되어 있다. 현재 동기화 테스트는 `INSECURE_JWT_SECRETS` + `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 만 검증한다. `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 는 Set 블랙리스트가 아니라 `isFlagOn` 로직으로 처리되므로 동기화 갭은 없다. 그러나 이 점이 테스트 구조에서 명시적으로 표현되지 않으며, 향후 유지보수자가 왜 stub 모드 값에 대한 동기화 테스트가 없는지 의아해할 수 있다.
- 제안: `blacklist Set sync` describe 상단 주석에 "stub 모드는 Set 블랙리스트 방식이 아니라 isFlagOn 논리로 처리하므로 별도 동기화 테스트 불필요" 임을 한 줄 명시.

---

### [INFO] `MIN_JWT_SECRET_LENGTH` 상수 자체의 값(32)에 대한 테스트 없음
- 위치: `production-guards.ts` L63, `production-guards.spec.ts` L263–274
- 상세: `JWT_SECRET` 길이 경계 테스트는 `'short-but-not-blocklisted'` (24자) 와 `'x'.repeat(48)` (48자) 두 케이스만 존재한다. 경계값(정확히 31자 → throw, 32자 → pass) 테스트가 없어, `MIN_JWT_SECRET_LENGTH` 가 32에서 다른 값으로 변경되어도 테스트가 탐지하지 못한다.
- 제안: 경계값 테스트 추가:
  ```ts
  it('throws when JWT_SECRET length is exactly MIN_JWT_SECRET_LENGTH - 1', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ JWT_SECRET: 'x'.repeat(MIN_JWT_SECRET_LENGTH - 1) })),
    ).toThrow(/JWT_SECRET/);
  });
  it('passes when JWT_SECRET length is exactly MIN_JWT_SECRET_LENGTH', () => {
    expect(() =>
      assertProductionConfig(prodEnv({ JWT_SECRET: 'x'.repeat(MIN_JWT_SECRET_LENGTH) })),
    ).not.toThrow();
  });
  ```

---

### [INFO] `OAUTH_STUB_MODE=false` 명시 / `LLM_STUB_MODE=false` 명시 케이스 테스트 없음
- 위치: `production-guards.spec.ts` `assertProductionConfig` describe
- 상세: 현재 `OAUTH_STUB_MODE` 테스트는 `'true'` 케이스만 있다. `isFlagOn` 은 별도로 `'false'`/`''`/`undefined` 를 커버하지만, `assertProductionConfig` 수준에서 `OAUTH_STUB_MODE='false'` 명시 시 통과를 검증하는 케이스가 없다. `isFlagOn` 테스트가 이를 간접 커버하나, 통합 관점 갭이다.
- 제안: `OAUTH_STUB_MODE='false'` 명시 시 pass 케이스를 `assertProductionConfig` describe 에 추가.

---

### [INFO] `jwtConfig()` 직접 호출 — `registerAs` 반환값이 팩토리 함수이므로 올바름
- 위치: `production-guards.spec.ts` L399
- 상세: 개정된 주석에서 "jwtConfig 는 registerAs 가 반환한 팩토리 함수 자체이므로, 직접 호출하면 설정 객체를 반환한다" 라고 정확하게 설명한다. `jwtConfig()` 가 실제 `{ secret, ... }` 객체를 반환함을 `.env.example` 파싱 없이 소스 레벨에서 확인하는 방식은 적절하다. 테스트 격리를 위해 `process.env.JWT_SECRET` 을 `try/finally` 로 복원하는 패턴도 올바르다.
- 제안: 해당 없음.

---

### [INFO] `process.env` 직접 조작 — 병렬 테스트 실행 시 격리 위험
- 위치: `production-guards.spec.ts` L396–405
- 상세: `delete process.env.JWT_SECRET` 후 `try/finally` 로 복원하는 패턴은 단일 스레드 직렬 실행에서 안전하다. Jest 기본 모드는 파일 단위 병렬이지만 파일 내부는 직렬이므로 현재 문제없다. 그러나 Jest worker 레벨에서 같은 파일의 다른 테스트와 실제 `process.env` 를 공유하므로, `jestConfig` 에서 `--runInBand` 가 아닌 worker 격리 옵션을 쓰는 환경에서는 잠재적 경쟁 조건이 있다.
- 제안: 주석에 "Jest 파일 내부는 직렬 실행이므로 안전" 임을 명시하거나, `jest.isolateModules` + 환경변수 모킹(`jest.replaceProperty`) 으로 더 강한 격리 적용을 검토.

## 요약

이번 변경의 핵심인 `describe` 최상위 동기 `readFileSync` 를 `beforeAll` 로 이동한 수정은 Jest 수집 단계에서 전체 스위트가 로드 불가해지는 실질적 fragility 를 정확히 제거한 것으로, 테스트 설계 관점에서 올바른 방향이다. 전체 테스트 스위트는 순수 함수 기반으로 환경변수를 주입해 모든 주요 분기(no-op outside prod, stub 모드, JWT 블랙리스트, 길이 제한, 암호화 키, MCP URL, fail-fast 순서)를 커버하고 있으며 격리도 양호하다. 개선 여지는 경계값 `MIN_JWT_SECRET_LENGTH - 1 / MIN_JWT_SECRET_LENGTH` 정확 경계 테스트 추가, `beforeAll` I/O 실패 시 진단성 향상, `definite assignment assertion` 적용 등 모두 낮은 우선순위 INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
