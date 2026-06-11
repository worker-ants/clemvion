# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1: codebase/backend/README.md

- **[INFO]** 문서 전용 변경 — 부작용 없음
  - 위치: 줄 55 (추가된 배포 주의 blockquote)
  - 상세: README.md 에 배포 주의사항 1줄을 추가한 순수 문서 변경이다. 런타임·빌드·테스트에 어떠한 영향도 없다.
  - 제안: 없음.

---

### 파일 2: codebase/backend/src/common/config/production-guards.spec.ts

- **[WARNING]** 테스트 모듈 최상위 레벨에서 `fs.readFileSync` 동기 I/O 실행
  - 위치: 줄 209-210 (`describe` 블록 안, `it` 밖)
  ```
  const envExamplePath = path.resolve(__dirname, '../../../.env.example');
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
  ```
  - 상세: `describe` 콜백은 Jest 가 테스트를 수집(collect)하는 단계에 동기적으로 실행된다. 따라서 `fs.readFileSync` 가 파일 수집 단계에서 즉시 실행된다. `.env.example` 이 없거나 경로가 맞지 않으면 `ENOENT` 가 발생해 파일 내의 **모든 테스트 스위트**가 로드 실패로 처리될 수 있다. 특히 CI 환경에서 워크트리가 다른 위치에 체크아웃되거나, `__dirname` 이 다른 디렉토리를 가리키면(예: `dist/` 컴파일 후 경로) 경로가 어긋날 수 있다.
  - 제안: `beforeAll` 훅 안으로 이동시켜 `it` 블록 수집과 I/O를 분리하거나, 경로 계산을 `path.resolve(process.cwd(), 'codebase/backend/.env.example')` 같이 리포 루트 상대로 교체해 `__dirname` 의존성을 줄인다. 또는 `try/catch` 로 감싸 파일 미존재 시 `it.skip` 으로 graceful 처리한다.

- **[INFO]** `process.env.JWT_SECRET` 임시 삭제 후 복원 패턴 — 구현은 올바르나 동시 실행 주의
  - 위치: 줄 222-231 (`INSECURE_JWT_SECRETS contains the jwt.config.ts dev fallback`)
  - 상세: `delete process.env.JWT_SECRET` → `try`/`finally` 복원 패턴은 직렬 실행 환경에서는 올바르게 동작한다. 그러나 Jest 의 `--runInBand` 없는 기본 병렬(worker) 실행 모드에서는 동일 worker 내 다른 테스트와 경쟁이 없으므로 실질적 위험은 낮다. `jwtConfig` 가 `registerAs` 래퍼를 통해 NestJS ConfigService 에 캐시를 남기는 경우, 환경 변수 삭제 전 캐시가 이미 채워졌다면 반환값이 예상과 다를 수 있다 — 단 `jwtConfig()` 를 직접 호출하므로 래퍼 실행 계층을 거치지 않아 실질 위험은 없다.
  - 제안: 현재 구현으로 충분하다. 문서 주석에 "병렬 Worker 격리 가정" 을 명시하면 더 명확하다.

- **[INFO]** `isFlagOn` import 추가
  - 위치: 줄 158
  - 상세: `production-guards` 에서 `isFlagOn` 을 추가로 import 한다. 이 함수는 이미 export 되어 있으므로 기존 API 계약에 변화 없다.
  - 제안: 없음.

- **[INFO]** `jwtConfig` import — 테스트 전용 의존성
  - 위치: 줄 155
  - 상세: `jwtConfig` 는 `registerAs` 로 감싸진 NestJS config factory 이다. spec 파일에서 직접 호출하면 `registerAs` 가 내부적으로 namespace 키를 등록하는 부수 효과(전역 config 레지스트리 누적)가 있을 수 있다. 그러나 현재 코드에서 `jwtConfig()` 를 직접 invoke 하는 것은 팩토리 함수 본문을 실행하는 것이며, `registerAs` 반환 객체의 메타데이터만 등록될 뿐 실제 NestJS 앱 컨텍스트 없이는 전역 영향이 없다.
  - 제안: 없음.

---

### 파일 3: codebase/backend/src/common/config/production-guards.ts

- **[INFO]** JSDoc `@throws`·`@param`·`@returns` 태그 추가 — 런타임 부작용 없음
  - 위치: 줄 511-514, 522-523
  - 상세: 순수 문서 주석 변경이다. 함수 시그니처·동작·export 목록 모두 변경 없다.
  - 제안: 없음.

---

## 요약

이번 변경은 (1) README.md 문서 추가 1줄, (2) `production-guards.ts` JSDoc 보강, (3) `production-guards.spec.ts` 테스트 추가라는 세 범주로 구성된다. 런타임 동작·공개 API 시그니처·전역 상태·네트워크 호출·파일시스템 쓰기에 대한 의도치 않은 부작용은 없다. 주목할 유일한 지점은 테스트 파일에서 `describe` 최상위 수준에 동기 `fs.readFileSync` 가 위치해 있어, CI 경로 불일치 시 전체 스위트 수집을 차단할 수 있다는 점이다(WARNING). 기능 구현 코드(`production-guards.ts`)는 이번 커밋에서 변경되지 않아 기존 호출자에게 영향이 없다.

## 위험도

LOW
