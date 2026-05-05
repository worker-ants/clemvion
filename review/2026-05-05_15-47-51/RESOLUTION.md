# RESOLUTION — F-3 + F-4 ai-review 조치

대상 변경: `a2ee8f6 fix(schema): form.optionSchema.value 기본값 + http-request keyValueSchema passthrough` (F-3, F-4 묶음)

원본 리뷰: `review/2026-05-05_15-47-51/SUMMARY.md`

전체 위험도(원본): **MEDIUM** — Critical 0 / Warning 5 / Info 10. 본 조치로 Warning 5건 모두 해소(2건은 기존 핸들러 방어를 명문화·deferred 처리) + 핵심 Info 처리.

---

## Warning 조치 (5/5)

| # | 카테고리 | 원본 | 조치 |
|---|---|---|---|
| W-1 | Security | CRLF 헤더 인젝션 — `key`/`value` 가 `\r\n` 포함 값을 schema 단계에서 거부 안 함 | `keyValueSchema` 의 `key`/`value` 에 `regex(NO_CRLF_RE)` 추가 (defense-in-depth). 핸들러의 `stripCrlf` 는 그대로 유지해 2단 방어. CRLF 거부 단위 테스트 3건 추가. |
| W-2 | Security | SSRF — `url` 필드 프로토콜·사설 IP 차단 부재 | **deferred**. `url` 은 expression widget(`{{ $var.foo }}` 허용) 이라 schema-level URL parsing 이 불가. 핸들러는 이미 integration 백엔드 호출에 한해 SSRF guard 적용 (`http-request.handler.ts:202`, `SSRF_BLOCKED` 가드 + redirect chain 5 hop 제한). 비-integration 호출의 SSRF 차단은 별도 보안 audit 영역 — F-3/F-4 의 1줄 schema 보강 범위와 동떨어진 작업이라 본 commit 에 포함하지 않음. |
| W-3 | API Contract | `passthrough()` 필드가 axios 등에 그대로 전달되면 의도치 않은 헤더/쿼리 누출 | **이미 안전**. 핸들러의 `toKeyValueRecord` (line 355) 가 entry 에서 `key`/`value` 만 destructure (`rec.key`, `rec.value`) 해 record 구성 — passthrough 메타 필드는 HTTP 요청에 도달하지 않는다. JSDoc 에 명문화. |
| W-4 | Side Effect | `optionSchema.value: undefined → ''` 변경이 기존 코드의 `option.value === undefined` 체크를 silent 무력화 | **이미 안전**. `grep -rn "option\.value\s*===\s*undefined"` 결과 0건 — backend handler·frontend renderer 어느 쪽에도 undefined 분기 없음. frontend `dynamic-form-ui.tsx` 는 `opt.value` 를 React `key`/`value` 로 직접 사용하므로 `''` 도 정상 동작. 명시적 `value === ''` regression 테스트 추가. |
| W-5 | Documentation | JSDoc/spec 의 `cookies` 가 실제 schema 에 부재 | JSDoc 에서 "cookies" 제거 → "headers / queryParams 의 공용 entry" 로 정정. 테스트 describe 제목도 동일 변경. |

---

## Info 조치 (4 처리, 6 deferred)

처리:

| # | 조치 |
|---|---|
| I-1 | `keyValueSchema` 필수 필드 누락 케이스 (key 또는 value 만 제공) `safeParse(...).success === false` 테스트 추가 |
| I-2 | `optionSchema.parse({ label })` 에서 `value === ''` + `not.toBeUndefined()` 명시 검증 |
| I-3 | carousel 의 passthrough 사용 검증 — `carousel.schema.ts` 5곳에 `.passthrough()` 적용 확인. JSDoc 의 "form, carousel" 참조 정확. |
| I-4 | passthrough cast 패턴에 "Zod passthrough 는 런타임에 추가 필드를 보존하지만 추론 타입에는 미반영" 한 줄 주석 추가 (form/http-request 양쪽) |

Deferred (기존 코드 / 별도 audit):

- I-5 (export 로 공개 API 표면 확장): 테스트 목적의 inner schema export. 동일 패턴이 4번째 노드에 등장하면 `core/schemas/` 추출 검토.
- I-6 (key-value 패턴 노드 분산): 위와 동일 — drift 위험은 인지하나 현재 2 노드라 추출 시기 아님.
- I-7 (passthrough 타입 안전성): 알려진 메타 필드 (`description`, `enabled`) 의 schema 화는 별도 spec 작업.
- I-8 (`keyValueSchema.key` 빈 문자열 허용): UI 임시 행 패턴 확인 필요. F-3/F-4 범위 밖.
- I-9 (`verifySsl: false` 감사 로그): http-request handler 보안 audit 영역.
- I-10 (`optionSchema.value: z.unknown()` 다운스트림 인젝션): handler/렌더러 사용 지점 가드 검토 필요. F-3/F-4 의 default('') 만으로 결정될 사안 아님.

---

## 변경 파일

- `backend/src/nodes/integration/http-request/http-request.schema.ts` — JSDoc 정정 (cookies 제거, W-3 안전성 명문화), CRLF 거부 regex 추가
- `backend/src/nodes/integration/http-request/http-request.schema.spec.ts` — describe 제목 정정, CRLF 거부 / 누락 필드 / cast 주석 테스트 추가
- `backend/src/nodes/presentation/form/form.schema.spec.ts` — value === '' 명시 검증, cast 주석 추가

## 재검증

- backend lint 통과, 164 suites / 2630 tests 통과 (W/I 추가 5건 포함), build 성공
