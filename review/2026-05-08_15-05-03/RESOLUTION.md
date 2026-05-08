# Code Review 조치 (RESOLUTION)

## 본 PR 의 범위

`engine-raw-config-exposure` Phase 2 — Send Email + HTTP Request 핸들러를 CONVENTIONS Principle 7 (config = raw / output = evaluated) 패턴으로 마이그레이션. Phase 1 에서 도입된 `ExecutionContext.rawConfig` 를 핸들러가 echo 하고, evaluated subject·body·requestBody·responseHeaders 를 신규 output 필드로 노출.

ai-review 결과 — Critical 0 / Warning 16 / Info 15 / 위험도 HIGH (Security HIGH 다수). 사용자 지시 (`auto mode`) 에 따라 Phase 2 scope 내 모든 Warning 을 즉시 처리, scope 외 / 정책 결정성 항목만 deferred.

---

## (A) 본 PR 에서 조치한 항목 — 11건 + Info 1건

### Security (W-1, W-4) — 2건

| ID | 카테고리 | 조치 |
|----|---------|-----|
| W-1 | Security | `sanitizeUrlCredentials` 가 `?api_key=…` / `?token=…` 등 query-string 자격증명도 `[REDACTED]` 로 마스킹. 13개 키 (`api_key`, `apikey`, `access_token`, `accesstoken`, `auth_token`, `authtoken`, `token`, `secret`, `password`, `sig`, `signature`, `x-amz-security-token`, `x-amz-signature`) 블랙리스트. 4xx/5xx 응답의 `output.error.details.url` 누출 차단. |
| W-4 | Security | `sanitize-response-headers.util.ts` 의 `EXACT_BLACKLIST` 에 `location` 추가. 3xx 리다이렉트 타겟이 `output.responseHeaders.location` 으로 raw URL 누출되지 않도록 — `sanitizeUrlCredentials` 와 대칭. 신규 unit 테스트 추가. |

### API Contract / Requirement (W-5) — 1건

| ID | 카테고리 | 조치 |
|----|---------|-----|
| W-5 | Requirement | `output.requestBodyType` 가 `rawConfig.bodyType` (raw, 미설정 시 누락) 대신 evaluated 지역변수 `bodyType` 사용. 이제 schema 의 `'json'` 기본값이 적용된 후의 effective value 가 항상 echo 됨 — Principle 7 정합 ("output = evaluated"). |

### Architecture / Maintainability (W-6, W-7, W-8) — 3건

| ID | 카테고리 | 조치 |
|----|---------|-----|
| W-6 | Architecture | `buildConfigEcho` 클로저의 12개 필드 수동 열거를 `{ ...rawConfig, url: rawUrl }` spread 로 단순화. schema 신규 필드 추가 시 echo 누락 위험 제거. |
| W-7 | Maintainability | 3개 리턴 지점 (success / non-2xx / transport error) 의 body output 스프레드 중복을 모듈 레벨 순수 함수 `buildBodyOutputFields(capped, evaluatedBodyType, responseHeaders?)` 로 통합. |
| W-8 | Maintainability | `execute()` 내 `buildConfigEcho` / `requestBodyOutput` 클로저를 모두 제거 — `configEcho` 는 단일 spread expression, body fields 는 모듈 함수. |

### Testing (W-10, W-11, W-12, W-13) — 4건

| ID | 카테고리 | 조치 |
|----|---------|-----|
| W-10 | Testing | `sanitize-response-headers.util.spec.ts` 에 (1) null / undefined 입력 → `{}` 반환, (2) `{ get: jest.fn() }` 같은 partial mock 안전 처리, (3) `Location` 헤더 마스킹 케이스 추가. |
| W-11 | Testing | "GET (no body)" 테스트가 이제 `requestBodyType: 'json'` 도 검증 — 새 helper 의 행동 (default 포함) 를 명시적으로 가드. |
| W-12 | Testing | ENG-RC-* describe 블록에 `x-www-form-urlencoded` 케이스 신규 — `output.requestBody` 가 wire 직렬화된 문자열이 아니라 사용자 구조 입력을 echo (Principle 7 의 "evaluated value" 의미) 임을 문서화. |
| W-13 | Testing | `body: null` 케이스 신규 — `truncateBodyForOutput` 의 null-passthrough 가 `output.requestBody === null` 로 명시적으로 노출됨을 검증. |

### Documentation (W-9, W-14, W-15, W-16) — 4건

| ID | 카테고리 | 조치 |
|----|---------|-----|
| W-9 | Documentation | `sanitizeResponseHeaders` JSDoc 에서 "테스트 mock 편의" 표현을 프로덕션 의미 ("partial Headers-like 구현" 일반화) 로 정정. |
| W-14 | Documentation | spec §1.3 "공통 출력 구조" 의 평탄 `data`/`meta` 표기를 nested `config`/`output`/`meta`/`port` 구조로 교정. 노드별 `meta.duration` vs `meta.durationMs` 명명 차이도 명시. |
| W-15 | Documentation | spec §6.3 Send Email 반환 shape 의 구 평탄 형식 (`{messageId, accepted, ...}`) 을 §4.3 정본 참조로 대체. |
| W-16 | Documentation | spec §6.3 의 "매 호출마다 transport 생성 후 close" 잘못된 기술을 실제 구현 (integrationId + credentials hash 캐시 재사용 + `shutdown()`) 으로 정정. |

### INFO

| ID | 조치 |
|----|-----|
| I-9 | `output.responseHeaders` 가 빈 객체일 때 schema `optional()` 과 정합되도록 — `buildBodyOutputFields` 가 `responseHeaders === undefined` 일 때만 필드 생략. transport-error 분기에서 `undefined` 전달로 자연스럽게 omit 됨. |

---

## (B) 본 PR 외로 deferred — 6건 + Info 다수

### Security 정책 결정성 (W-2, W-3) — 2건

| ID | 카테고리 | 사유 |
|----|---------|-----|
| W-2 | Security | `output.requestBody` 의 사용자 본문 sanitization. CONVENTIONS Principle 7 은 "config / output 모두 사용자 raw evaluated value 를 보존" 을 명시하며, 본문에 `password` 키가 들어 있어도 그 자체가 사용자 의도. heuristic redaction 은 false positive 위험 (예: `{ "password_hint": "..." }` 처럼 hint 인 경우) 이 있어 Phase 2 scope 외 — 별도 정책 PRD 필요. |
| W-3 | Security | `authentication=none/custom` 의 SSRF 검사. pre-existing 결정 (배포 환경 별 internal endpoint 호출 허용) 으로, 환경변수 게이트 도입은 별도 인프라 PRD 영역. |

### Architecture 기술부채 (I-5, I-6, I-7) — 3건 (Info)

| ID | 카테고리 | 사유 |
|----|---------|-----|
| I-5 | Architecture | `sanitizeResponseHeaders` 가 null 허용을 프로덕션 API 로 노출. 테스트 mock 을 실제 `Headers` 인스턴스로 교체하는 광범위 리팩터 — Phase 3 의 핸들러 마이그레이션과 묶어 다음 정리 라운드. |
| I-6 | Architecture | `rawConfig ?? config` fallback 의 임시 부채. Phase 1 (engine plumbing) 자체는 완료됐지만, 핸들러가 모두 raw-echo 로 마이그레이션되면 fallback 을 제거하고 `rawConfig` 를 필수 필드로 승격할 수 있다. Phase 7 (정리) 에서 일괄 처리. |
| I-7 | Architecture | output schema 와 핸들러 반환값 수동 동기화. 공통 베이스 스키마 추출은 Phase 3 카테고리 마이그레이션 후 모든 핸들러의 echo 패턴이 안정화됐을 때 진행. |

### Concurrency / Performance (I-2, I-3, I-4, I-8) — 4건 (Info)

| ID | 사유 |
|----|-----|
| I-2 | `truncateBodyForOutput` 를 SSRF 검사 이후로 이동 — 미세 최적화. Phase 3 일괄 정리 권장. |
| I-3 | `typeof Headers !== 'undefined'` 가드 모듈 상수화 — 미세 최적화. |
| I-4 | sanitize 루프의 `String(value)` 래핑 — 미세 최적화. |
| I-8 | SMTP transport 캐시의 credential 회전 시 race — pre-existing, Phase 2 scope 외. 별도 안정성 PR 영역. |

### Documentation (I-12, I-13, I-14) — 3건 (Info)

| ID | 사유 |
|----|-----|
| I-12 | `meta.duration` vs `meta.durationMs` 노드 간 명명 차이 — §1.3 에서 "노드별 편차 + 향후 PRD 통일" 한 줄 추가로 흡수. |
| I-13 | §2.3 예시의 `config.url` 평가형 / `config.body` raw 형 혼재 — `config.url` 도 raw 표현식 형태로 통일하면 더 명확. 다음 spec 정리 라운드에서 통일. |
| I-14 | output schema `config.headers` 타입의 느슨함 사유 주석 — 마이크로 개선. |

### Scope (I-15) — 1건

| ID | 사유 |
|----|-----|
| I-15 | `style(integration): Phase 2 prettier / lint --fix 자동 정리` 커밋이 의도된 분리. 단계별 자동 커밋 정책 (developer skill `style(...)` slot) 에 부합. |

---

## (C) 사용자 결정 영향

사용자 지시: `auto mode` — "남은 작업 진행".

본 PR 에서 조치한 12건 (Warning 11 + Info 1) 외 deferred 9건은 모두 (a) 사용자 정책 결정 (Security W-2/W-3 의 sanitization·SSRF 정책), (b) 광범위 영향 리팩터 (Architecture I-5/I-7 — 다른 핸들러 마이그레이션 동시 진행 필요), 또는 (c) 미세 최적화 / 다음 라운드 일괄 정리 후보 (Performance / Documentation Info 다수) 로 분류되어 별도 단위로 처리하는 게 PR 가독성·rollback 안정성에 유리하다.

deferred 항목은 `plan/in-progress/engine-raw-config-exposure.md` 의 후속 phase (Phase 3 / Phase 7) backlog 에 자연스럽게 합쳐진다 — 별도 plan 신설 없음.

---

## 검증

- `npm run lint` clean
- `npm run test` — 169 suite, 2778 / 2778 pass (Phase 2 직전 2773 → +5 신규: body:null / x-www-form-urlencoded / sanitize null·undefined / Location 마스킹 / GET requestBodyType)
- `npm run build` clean
- 기능 회귀 없음
