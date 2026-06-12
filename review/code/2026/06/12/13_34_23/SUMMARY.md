# Code Review 통합 보고서

## 전체 위험도
**LOW** — 보안·동시성·성능·아키텍처 모두 문제 없음. 경고 2건(ConfigService 우회 silent-fallback, base64 비문자열 breaking change 마이그레이션 노트 누락), SPEC-DRIFT 1건(spec 내 하드코딩 128MB 잔재). Critical 없음.

---

## Critical 발견사항

발견 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 설정·운영 | `CODE_NODE_MEMORY_LIMIT_MB`를 `process.env`에서 직접 읽어 NestJS ConfigModule 스키마 검증을 우회함. 잘못된 값이 부트 시 감지되지 않고 128로 silent-fallback됨. | `code.handler.ts` — `resolveMemoryLimitMb()` | 모듈 초기화 시 warn 로그 추가 또는 ConfigService DI 경로 검토 |
| 2 | 하위 호환성 | `$helpers.base64.encode/decode`에 비문자열을 전달하는 기존 워크플로우가 이제 error 포트로 분기됨(기존: 암묵적 `String()` 변환, 신규: `TypeError` throw). 의도적 breaking change이나 마이그레이션 노트 없음. | `code.handler.ts` — `hostB64Encode`, `hostB64Decode` | 릴리스 노트 또는 CHANGELOG에 "기존 워크플로우 영향" 항목 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §4 3번 항목과 §7.1 표에 `memoryLimit: 128` 하드코딩 잔재. 코드는 env 조정으로 올바르게 구현되었으나 spec 내부 일관성 어긋남. §7.2·§5.3.3·Rationale 은 이미 반영됨. | `spec/4-nodes/5-data/2-code.md` §4 line 130, §7.1 line 376 | 코드 유지. spec §4·§7.1의 `memoryLimit: 128` → `memoryLimit: ISOLATE_MEMORY_LIMIT_MB (기본 128, env 조정 가능)` 로 갱신 |
| 2 | 설정·운영 | `resolveMemoryLimitMb()`에서 `Number.parseInt`가 `'256abc'`를 256으로 파싱함(의도된 값으로 silent 허용). `Number()` 사용 시 NaN으로 기본값 폴백 가능. | `code.handler.ts` — `resolveMemoryLimitMb()` | 변경 불요 또는 `Number(raw.trim())` 교체 검토. 영향도 미미(모듈 로드 1회). |
| 3 | 설정·운영 | `resolveMemoryLimitMb()`가 소수 입력(`'256.9'`)을 256으로 truncation 처리함. 문서화 없음. | `code.handler.ts` — `resolveMemoryLimitMb()` | `.env.example` 주석에 "정수만 유효" 명시 검토. 변경 불요. |
| 4 | 아키텍처 | `resolveMemoryLimitMb()`가 `@internal` 주석에도 불구하고 `export function`으로 공개 심볼 노출. TypeScript는 `@internal` 강제 불가. | `code.handler.ts` line 1413 | 현재 규모에서 허용. 장기적으로 `_resolveMemoryLimitMb` prefix 컨벤션 또는 test-only re-export 파일 검토. |
| 5 | 유지보수 | `.env.example`에 새 변수 `CODE_NODE_MEMORY_LIMIT_MB`가 파일 말미("System Status" 이후)에 섹션 헤더 없이 추가됨. "Execution Engine" 섹션과 의미상 연관. | `codebase/backend/.env.example` line 363–366 | `# Execution Engine` 섹션 끝으로 이동하거나 `# Code Node` 서브섹션 헤더 추가. |
| 6 | 유지보수 | `error-codes.ts` 주석에 128MB 기본값 텍스트가 하드코딩됨. 기본값 변경 시 두 곳의 주석을 별도 갱신해야 함. | `error-codes.ts` — `CODE_MEMORY_LIMIT` 주석 | 낮은 우선순위. 주석을 "see `CODE_NODE_MEMORY_LIMIT_MB` env" 참조로 대체 고려. |
| 7 | 테스트 | `resolveMemoryLimitMb()` 테스트에 부동소수점 입력(`'256.9'` → 256 truncation) 케이스 미포함. | `code.handler.spec.ts` — `resolveMemoryLimitMb` describe 블록 | valid 케이스 배열에 `'256.9'` 추가해 동작 명시 문서화 검토. 변경 불요. |
| 8 | 테스트 | i18n 레이블 값 변경(`"메모리 한도(128MB)를 초과했어요."` → `"메모리 한도를 초과했어요."`)이 `backend-labels.test.ts`의 스냅샷 검사에 영향을 줄 수 있음. | `codebase/frontend/src/lib/i18n/backend-labels.ts` | `backend-labels.test.ts`에서 `ERROR_KO['CODE_MEMORY_LIMIT']` 스냅샷 검사 존재 여부 확인. 존재하면 업데이트 필요. |
| 9 | 테스트 | `jest.retryTimes(2)`가 describe 블록 전체에 적용되어 향후 추가될 non-race 테스트에도 재시도가 걸림. | `code.handler.spec.ts` — memory limit describe 블록 | 허용 가능. 더 세밀하게 특정 `it`에만 `{ retry: 2 }` 옵션 적용 고려. |
| 10 | 아키텍처 | `$execution` 컨텍스트에 `startedAt` 필드가 없으나 프론트엔드 docs가 이를 암시. 현재 변경 범위와 무관한 기존 문제. | `data.mdx`, `data.en.mdx`, `code.handler.ts` | 별도 spec 정비 대상. 현재 변경 불요. |
| 11 | 동시성 | `syntaxIsolate` 모듈 수준 공유 변수가 Worker Threads 도입 시 경쟁 조건 가능. 현재 단일 이벤트 루프에서는 무해. | `code.handler.ts` — `syntaxCheck()` | 현재 구조 유지. Worker Threads 도입 시 per-worker 로컬화 또는 Mutex 추가 필요. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 환경변수 파싱 512MB clamp, 타입 가드 강화, 스택 트레이스 억제 모두 양호. 신규 공격 표면 없음. |
| performance | NONE | 모듈 로드 1회 상수화, DAYJS_SNAPSHOT 재컴파일 제거, Set 기반 O(1) 분류 모두 적절. |
| architecture | NONE | 레이어 책임 분리 양호. `resolveMemoryLimitMb` export 패턴 INFO 수준. |
| requirement | LOW | SPEC-DRIFT: spec §4·§7.1에 `memoryLimit: 128` 하드코딩 잔재. 코드는 올바름, spec 갱신 필요. |
| scope | - | output_file 없음 (재시도 필요) |
| side_effect | LOW | ConfigService 우회 silent-fallback(WARNING), base64 breaking change 마이그레이션 노트 필요(WARNING). |
| maintainability | LOW | `.env.example` 섹션 배치 부적절, 내부 함수 export 패턴 혼재. 모두 INFO 수준. |
| testing | LOW | i18n 스냅샷 테스트 확인 필요, 부동소수점 케이스 미검증. 모두 INFO 수준. |
| documentation | - | output_file 없음 (재시도 필요) |
| concurrency | NONE | Promise.race + clearTimeout 패턴 정확. 단일 이벤트 루프 가정 하 모든 공유 상태 안전. |

---

## 발견 없는 에이전트

- **security**: Critical/Warning 없음. 전반적으로 견고한 구현.
- **performance**: Critical/Warning 없음. 성능 최적화 패턴 올바름.
- **architecture**: Critical/Warning 없음. 레이어 분리 양호.
- **concurrency**: Critical/Warning 없음. 동시성 모델 안전.

---

## 권장 조치사항

1. **(WARNING)** 릴리스 노트에 `$helpers.base64.encode/decode` breaking change 명시 — 비문자열 입력이 이제 error 포트로 분기됨을 기존 워크플로우 사용자에게 고지.
2. **(WARNING)** `resolveMemoryLimitMb()` 내 잘못된 환경변수 값에 대한 warn 로그 추가 — silent-fallback을 운영자가 감지할 수 있도록.
3. **(SPEC-DRIFT)** spec `4-nodes/5-data/2-code.md` §4 line 130, §7.1 line 376의 `memoryLimit: 128` 하드코딩을 env 조정 가능 설명으로 갱신 (코드 변경 불요, spec 갱신만).
4. **(INFO)** `backend-labels.test.ts`에서 `ERROR_KO['CODE_MEMORY_LIMIT']` 스냅샷 검사 존재 여부 확인 후 필요 시 업데이트.
5. **(INFO)** `.env.example`의 `CODE_NODE_MEMORY_LIMIT_MB`를 "Execution Engine" 섹션으로 이동.
6. **(INFO)** `.env.example` 주석 또는 `resolveMemoryLimitMb()` 함수 주석에 "정수만 유효, 소수는 절사" 명시 (선택사항).

---

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing_status=done`).

- **실행** (10명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency
- **강제 포함 (router_safety)**: maintainability, requirement, scope, security, side_effect, testing
- **제외** (4명):

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

**비고**: scope, documentation 은 실행 목록에 포함되었으나 output_file 이 생성되지 않아 해당 reviewer 결과 없음 (재시도 필요 2건).