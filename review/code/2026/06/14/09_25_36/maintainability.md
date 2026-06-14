# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1 & 2: package.json / package-lock.json
- **[INFO]** 기존 OTel 의존성 버전 라인(`^0.218.0`)과 정렬된 단일 패키지 추가
  - 위치: `codebase/backend/package.json` 44번째 줄
  - 상세: `@opentelemetry/exporter-prometheus@^0.218.0` 을 기존 `@opentelemetry/exporter-trace-otlp-http@^0.218.0` 와 동일 버전 라인으로 삽입. 알파벳 순서도 올바르게 유지됨.
  - 제안: 현행 유지. 버전 핀 수준은 기존 스택과 일관성 있음.

### 파일 3: instrumentation.spec.ts (신규)
- **[INFO]** 테스트 파일 구조와 커버리지가 양호함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.spec.ts` 전체
  - 상세: 파일 상단 블록 주석이 "왜 부수효과 테스트를 피하는지"를 명확히 설명. `undefined`, 빈 문자열, 공백, 유효 포트, 범위 초과, 비정수 등 경계 조건을 망라함. `DEFAULT_PROMETHEUS_PORT` 상수를 테스트에서 직접 참조해 매직 넘버 9464 가 스펙 파일에만 등장하고 테스트에선 상수를 재사용하는 구조가 유지됨.
  - 제안: 현행 유지.

### 파일 4: instrumentation.ts
- **[INFO]** `resolvePrometheusPort` 함수: 단일 책임, 단순한 로직, 명확한 이름
  - 위치: 1756-1763번째 줄
  - 상세: 함수 길이 8줄, 조건 분기 2개(비어있음 확인, 범위 확인). 순환 복잡도 3. 적절히 낮음. 리턴이 빠르며 중첩 없음.
  - 제안: 현행 유지.

- **[INFO]** `DEFAULT_PROMETHEUS_PORT` 상수: 매직 넘버 9464 를 모듈 수준 네임드 상수로 선언하고 JSDoc 으로 출처(`Prometheus default-port-allocations`) 명시
  - 위치: 1749번째 줄
  - 상세: 상수가 `export` 되어 테스트에서도 재사용 가능한 구조. 매직 넘버 문제 없음.
  - 제안: 현행 유지.

- **[INFO]** `if (enabled)` 블록 내 변수명이 목적을 잘 나타냄 (`prometheusPort`, `prometheusExporter`)
  - 위치: 1768-1785번째 줄
  - 상세: 변수 이름이 역할을 명확히 표현. 코드 한 줄 인라인 주석(`// PrometheusExporter 는 생성 시...`, `// MeterProvider 에 Prometheus reader 를 연결 ...`)이 의도를 보완함.
  - 제안: 현행 유지.

- **[WARNING]** `instrumentations` 블록 내 `@opentelemetry/instrumentation-fs` 비활성화가 맥락 없이 삽입된 것처럼 보임 (기존 코드이나 신규 검토자 혼란 가능)
  - 위치: 1789번째 줄 `'@opentelemetry/instrumentation-fs': { enabled: false }`
  - 상세: 이 라인은 기존(pre-change) 코드이며 이번 PR diff 에 직접 포함되지 않음. 인라인 주석 `// fs 계측은 노이즈가 너무 많아 끔` 이 존재하지만, `OTel` 운영 문서나 환경 변수 목록에 이 결정이 문서화돼 있지 않아 후속 유지보수자가 "왜 비활성인가"를 따라가기 어려울 수 있음. 해당 라인은 이번 변경 범위가 아니므로 본 리뷰 위험도에 반영하지 않음.
  - 제안: (이번 PR 범위 외) 파일 상단 환경 변수 JSDoc 블록에 `@opentelemetry/instrumentation-fs` 비활성 이유를 한 줄 추가하거나, 별도 PR로 개선.

- **[INFO]** `console.log` / `console.warn` 사용: 기존 코드 패턴과 일관성 유지
  - 위치: 1797-1800번째 줄
  - 상세: 이 파일은 main.ts 이전 최초 import 되는 부트스트랩 레이어로, NestJS DI 컨텍스트 밖에서 실행됨. `console.*` 사용이 의도적이며 기존 패턴과 일치. 템플릿 리터럴로 포트 정보 포함한 로그 메시지가 명확함.
  - 제안: 현행 유지.

### 파일 5: plan/in-progress/spec-sync-5-system-metrics-gap.md
- **[INFO]** 플랜 문서 구조가 규약(`plan-lifecycle`) 에 따라 적절히 업데이트됨
  - 상세: `## 미구현 항목` -> `## 구현 완료` + `## 후속` 섹션 분리. 후속 항목이 명시적으로 "본 PR 범위 밖"으로 표기돼 있어 추적 가능성 확보.
  - 제안: 현행 유지.

### 파일 6: spec/5-system/_product-overview.md
- **[INFO]** NF-OB-02 상태 설명이 상당히 길어 가독성이 다소 떨어짐
  - 위치: `_product-overview.md` NF-OB-02 행
  - 상세: 단일 테이블 셀에 구현 세부(포트명, 환경변수, 수집 대상 메트릭, 후속 사항)를 모두 기술. NF-OB-03 등 다른 행과 비교해 길이가 5-6배 이상. 향후 구현 세부가 추가될수록 테이블이 더 비대해질 수 있음.
  - 제안: (선택적 개선) 상태 셀에는 요약만 기재하고 상세 구현 내용은 별도 `spec/5-system/observability-metrics.md` 또는 `instrumentation.ts` JSDoc 으로 분산. 그러나 현 프로젝트 관행(NF-OB-05 등)과 일관성이 있어 즉각적인 수정 의무 없음.
  - 제안: 현행 관행과 일관성 있어 리뷰 블로킹 아님.

---

## 요약

이번 변경은 기존 OTel 부트스트랩 레이어에 Prometheus 메트릭 내보내기를 최소 침습적으로 추가한 작업이다. `resolvePrometheusPort` 함수는 단일 책임·명확한 이름·낮은 복잡도를 갖추며, 매직 넘버는 `DEFAULT_PROMETHEUS_PORT` 상수로 격리해 테스트까지 재사용 가능하도록 설계됐다. 테스트 파일은 경계 조건을 충분히 망라하고 부수효과를 피하는 의도를 주석으로 명시해 유지보수 맥락이 명확하다. 전반적으로 기존 코드베이스 스타일·패턴과 일관성이 높고 함수 길이·중첩·중복 모두 양호한 수준이다. spec 문서 NF-OB-02 셀 길이가 다소 길지만 기존 관행과 일치하여 즉각적인 개선 필요는 없다.

## 위험도

NONE
