## 의존성 코드 리뷰

### 발견사항

---

**[INFO]** `cron-parser` v5.5.0 신규 추가 (backend + frontend)
- 위치: `backend/package.json`, `frontend/package.json`
- 상세: `cron-parser` v5는 v4 대비 API가 변경됨 (`parseExpression` → `CronExpressionParser.parse`). backend에서 `CronExpressionParser.parse`를 올바르게 사용 중. MIT 라이선스, Node >=18 요구사항은 현재 환경과 호환됨.
- 제안: 문제 없음.

---

**[WARNING]** `bullmq` 내부에서 `cron-parser` v4.9.0을 별도로 사용 중
- 위치: `backend/package-lock.json` — `node_modules/bullmq/node_modules/cron-parser`
- 상세: 최상위 `cron-parser`가 v5.5.0으로 업그레이드되면서, `bullmq`가 의존하는 v4.9.0이 별도 중첩 설치됨. 두 버전이 동시에 존재하며 `luxon` 의존성 중복 발생. 실제 동작 문제는 없으나 번들/설치 크기 불필요하게 증가.
- 제안: `bullmq`가 내부적으로 사용하는 버전이므로 직접 제어 불가. 향후 `bullmq` 업그레이드 시 해소될 것. 현재는 허용 가능.

---

**[WARNING]** `colord` → `@colordx/core` 교체 (postcss-colormin, postcss-minify-gradients)
- 위치: `backend/package-lock.json` — `node_modules/postcss-colormin`, `node_modules/postcss-minify-gradients`
- 상세: 기존 `colord@2.9.3`이 `@colordx/core@5.0.0`으로 교체됨. `@colordx/core`는 `colord`의 포크/계승 패키지로 보이나 npm 다운로드 수, 유지보수 상태 등 신뢰도 검증이 필요한 비교적 알려지지 않은 패키지임. `optional: true`로 마킹되어 있어 빌드 실패 위험은 낮음.
- 제안: `@colordx/core` 패키지의 출처 및 유지보수 상태 확인 권장. `cssnano`의 의존성이므로 직접 통제 영역 밖이나, `cssnano`가 이 패키지로 전환한 이유를 확인하는 것이 좋음.

---

**[INFO]** frontend 신규 의존성 — `cronstrue`, `recharts`, `cron-parser`
- 위치: `frontend/package.json`
- 상세:
  - `cronstrue@^3.14.0`: cron 표현식을 human-readable 문자열로 변환. MIT 라이선스. 경량 라이브러리, 적절한 사용.
  - `recharts@^3.8.1`: React 차트 라이브러리. MIT 라이선스. 번들 크기 약 ~500KB(gzip ~150KB)로 통계 페이지에서 사용. 적절한 트레이드오프.
  - `cron-parser@^5.5.0`: 프론트엔드에서 cron 미리보기 계산에 사용. 단, 이 로직은 백엔드 API(`POST /schedules/preview`)가 이미 제공하므로 **클라이언트에서 직접 파싱할 필요가 없을 수 있음**.
- 제안: `cron-parser` 프론트엔드 의존성의 필요성 재검토. 백엔드 API를 통해 처리하면 프론트엔드 번들 크기 절감 가능.

---

**[INFO]** 테스트 인프라 추가 — `vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react`
- 위치: `frontend/package.json` devDependencies
- 상세: TDD 원칙에 따른 적절한 테스트 환경 구성. 모두 devDependencies에 올바르게 배치됨. MIT 라이선스. `vitest@^4.1.2`는 현재 최신 버전 계열로 안정적.
- 제안: 문제 없음.

---

**[INFO]** `cssnano-preset-default` 마이너 업그레이드 (7.0.11 → 7.0.12)
- 위치: `backend/package-lock.json`
- 상세: 패치 버전 업그레이드. `postcss-colormin`, `postcss-minify-gradients` 연동 업데이트 포함. 모두 optional 의존성. 영향 범위 최소.
- 제안: 문제 없음.

---

**[INFO]** `ExecutionEngineModule`을 `SchedulesModule`에 추가
- 위치: `backend/src/modules/schedules/schedules.module.ts`
- 상세: `SchedulesController`에서 `ExecutionEngineService`를 직접 주입하는 구조. 컨트롤러가 서비스 레이어를 우회하여 실행 엔진에 직접 접근하는 것은 레이어 분리 위반 소지가 있음. `run-now` 기능은 `SchedulesService`를 통해 위임하는 것이 바람직함.
- 제안: `executionEngineService.execute()` 호출을 컨트롤러에서 `schedulesService.runNow()` 메서드로 이동 권장.

---

**[INFO]** `AuthConfigsModule`에 `Execution`, `Trigger` 엔티티 직접 주입
- 위치: `backend/src/modules/auth-configs/auth-configs.module.ts`
- 상세: `AuthConfigsService`가 실행 통계 조회를 위해 타 모듈의 엔티티 리포지토리를 직접 사용. 모듈 간 경계가 느슨해지는 패턴. 단, 현재 규모에서는 허용 가능한 수준.
- 제안: 중장기적으로 `ExecutionsModule`, `TriggersModule`에서 서비스를 export하여 주입받는 방식이 바람직함.

---

### 요약

전반적으로 의존성 변경은 기능 목적에 부합하며 라이선스(MIT), 버전 안정성 면에서 큰 문제가 없다. 주요 주의사항은 두 가지다: ① `bullmq`와 최상위 레벨의 `cron-parser` 버전이 다르게 중첩 설치되어 불필요한 번들 크기 증가가 있으나 동작에는 영향 없음; ② 프론트엔드에서 `cron-parser`를 직접 사용하는 것은 이미 백엔드 API(`POST /schedules/preview`)가 제공되므로 중복 의존성이 될 수 있다. `@colordx/core`는 `cssnano`의 전이 의존성으로 직접 통제 밖이지만 낮은 지명도 패키지인 만큼 출처 확인을 권장한다. 내부 모듈 의존성 측면에서는 `SchedulesController`가 `ExecutionEngineService`를 직접 호출하는 부분이 레이어 분리 원칙에서 벗어나므로 리팩터링이 권장된다.

### 위험도

**LOW**