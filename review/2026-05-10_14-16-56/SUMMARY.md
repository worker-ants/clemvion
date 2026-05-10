# Code Review 통합 보고서

## 전체 위험도
**LOW** — 에러 경로 `meta` 보강이라는 핵심 목적은 올바르게 구현되었으나, PII truncation 불일치, `durationMs` 책임 분열, 에러/성공 meta shape 비대칭 등 설계 정합성 문제가 복수 리뷰어에서 공통으로 지적됨

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **PII truncation 불완전** — `truncateForErrorDetails(inputField, 500)`를 적용한다는 주석이 있으나 실제로는 ①`output.originalInput: inputField`(truncation 없음) ②`meta.llmCalls[0].requestPayload.messages[1].content`(원문 그대로) ③`output.error.details.originalInput`(500자 cap, 유일하게 처리됨) 세 경로 중 하나만 cap됨 | `handler.ts` catch 블록 | `output.originalInput`도 `truncatedInput`으로 교체하거나, 세 노출 지점의 정책을 spec §5.3에 명시. `requestPayload.messages`의 `content` truncation 또는 제외 검토 |
| 2 | Architecture / Side Effect | **`durationMs` 책임 분열** — 성공 경로는 엔진이 `meta.durationMs`를 inject하고(spec §5.1 `engine inject`), 에러 경로는 핸들러가 직접 계산·주입. 엔진이 에러 경로에서도 값을 overwrite하면 이중 할당, 하지 않으면 성공/에러 경로의 출처·시맨틱이 다름 | `handler.ts` 에러 catch 블록 vs 성공 경로 | `durationMs` 책임자를 핸들러 또는 엔진 중 하나로 통일. 엔진의 `meta` 병합 정책(overwrite vs merge-if-missing)을 문서화 |
| 3 | Architecture / API Contract | **에러/성공 meta shape 비대칭** — 성공 meta: `{ model, inputTokens, outputTokens, totalTokens, thinkingTokens, llmCalls }`, 에러 meta: `{ durationMs, model, llmCalls }`. 토큰 필드가 에러 경로에 없어 `$node[X].meta.inputTokens`가 에러 포트에서 `undefined` 반환. CONVENTIONS Principle 2가 요구하는 균일 표현식 해석 보장이 불완전 | `handler.ts` 전체 meta 구성 | 에러 경로에 `inputTokens: 0, outputTokens: 0, totalTokens: 0` 기본값 추가하거나, spec §5.3 필드 표에 "에러 경로에서 토큰 필드 미포함" 명시 |
| 4 | Requirement / Documentation | **spec §5.3 필드 표에 `output.originalInput` 누락** — JSON 예시에는 `"originalInput": "환불 요청드립니다"` 가 추가되었으나 필드 표에 해당 행이 없음. `output.error.details.originalInput`(500자 cap)과 `output.originalInput`(원문)의 차이가 문서에서 구분 불가 | `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 | 필드 표에 `output.originalInput \| String \| handler return \| LLM 투입 resolved 입력 원문 (truncation 없음; details.originalInput의 500자 cap 값과 별개)` 행 추가 |
| 5 | Requirement | **`meta.durationMs` 측정 기준점이 spec 설명과 불일치** — `callStartedAt`이 `execute()` 진입 시점이 아닌 `llmService.chat()` 호출 직전에 찍혀, `resolveConfig`·프롬프트 빌드 등 사전 처리 시간이 누락됨. spec §5.3은 "에러 발생 전까지 소요된 시간"으로 기술 | `handler.ts` catch 블록 `const errorDurationMs = Date.now() - callStartedAt` | `callStartedAt`을 `execute()` 시작 직후로 이동하거나, spec 설명을 "LLM 호출 소요 시간"으로 수정 |
| 6 | Maintainability | **에러 메트릭 검증 로직 테스트 중복** — 단일/멀티 레이블 에러 케이스 테스트 본문이 8줄 이상 거의 동일(멀티 레이블 쪽이 `requestPayload` 검증 하나만 누락). meta 계약 변경 시 수정 누락 위험 | `handler.spec.ts` 신규 테스트 2개 | `assertErrorMeta(meta, expectedModel)` 등 로컬 헬퍼로 공통 단언 추출 |
| 7 | API Contract / Dependency | **`output._llmCalls` 제거로 인한 잠재적 breaking change** — 다운스트림 워크플로우 expression이 `$node["X"].output._llmCalls`를 참조한 경우 silent `undefined` 발생. `_` prefix로 내부 필드임을 암시했으나 공식 제거 공지 없음 | `handler.ts` diff catch 블록 | 배포 전 `grep -r '_llmCalls'` 로 다른 소비 지점 확인. 있다면 마이그레이션 노트 추가. 릴리즈 노트에 명기 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | **멀티 레이블 에러 테스트에서 `requestPayload` 검증 누락** — 싱글 레이블 에러 테스트에는 `expect(llmCalls[0].requestPayload).toBeDefined()`가 있으나 멀티 레이블 버전에는 없음 | `handler.spec.ts` L784 | 멀티 레이블 에러 테스트에 동일 단언 추가 |
| 2 | Testing | **멀티 레이블 에러 경로의 모델 폴백 테스트 미존재** — `config.model` 미설정 시 폴백 검증이 싱글 레이블에만 있음. 동일 코드 경로를 공유하나 미검증 | `handler.spec.ts` | 멀티 레이블 `describe` 블록에 동일 폴백 테스트 추가 |
| 3 | Testing | **`output.originalInput` (에러 포트) 검증 없음** — 에러 경로에서 `output.originalInput`(full 원문)이 반환되나 신규 테스트 및 기존 테스트 모두 `output.error.*`만 검증 | `handler.ts:147`, `handler.spec.ts` | 신규 Principle 2 테스트 중 하나에 `expect(result.output.originalInput).toBe('I need a refund')` 추가 |
| 4 | Testing | **`output._llmCalls` 부재에 대한 negative 단언 없음** — `_llmCalls`가 `output`에서 제거되었으나 테스트가 이를 검증하지 않음 | `handler.spec.ts` | `expect(result.output).not.toHaveProperty('_llmCalls')` 추가 |
| 5 | Testing | **`meta.durationMs === llmCalls[0].durationMs` 동치 미검증** — 동일 변수에서 나온 두 필드 값이 일치함을 테스트가 보장하지 않아, 향후 별도 `Date.now()` 계산으로 변경되면 조용히 갈라질 수 있음 | `handler.spec.ts` 신규 에러 테스트 | `expect(meta.durationMs).toBe(llmCalls[0].durationMs)` 추가 (선택적) |
| 6 | Architecture | **`meta.durationMs`와 `meta.llmCalls[0].durationMs` 시맨틱 중복** — 에러 경로에서 동일 값 `errorDurationMs` 공유. 재시도 로직 추가 시 두 필드의 시맨틱이 분리되어야 하나 현재 동일값 | `handler.ts` catch 블록 | `meta.durationMs`는 핸들러 전체 실행 시간, `llmCalls[i].durationMs`는 개별 호출 시간으로 시맨틱 분리 명시 (spec 또는 주석) |
| 7 | Security | **`requestPayload` 전체(시스템 프롬프트 포함)가 `meta.llmCalls`에 노출** — 카테고리 목록·instructions·JSON Schema 포함. 이번 변경으로 `output._llmCalls`(내부용 암시)에서 `meta.llmCalls`(공식 접근 경로)로 승격됨. 성공 경로도 동일하므로 신규 위험은 아님 | `handler.ts` 에러 return `llmCalls[0].requestPayload` | spec에 "디버그 전용, 외부 노출 의도 없음" 명시 또는 `messages[1].content` 마스킹 검토 |
| 8 | Security | **LLM provider 에러 메시지 원문 패스스루** — rate limit 헤더·내부 엔드포인트 URL 등이 `output.error.message`에 포함될 수 있음. spec에서 "원문 보존, 국제화 없음"으로 의도된 설계 | `handler.ts:125` | spec에 "다운스트림에서 사용자 노출 시 sanitize 책임은 호출자" 명기 |
| 9 | Maintainability | **성공/에러 경로 `durationMs` 주입 주체 비대칭이 코드에 미문서화** — 미래 기여자가 성공 경로에도 `durationMs`가 누락된 것으로 오인하고 추가할 위험 | `handler.ts` 성공 경로 meta 구성 | 성공 경로 `meta` 블록 근처에 엔진 주입 사실을 한 줄 주석으로 명시 |
| 10 | Maintainability | **`void _omit` 패턴 비표준** — `const { model: _omit, ...rest } = ...; void _omit;`는 비관용적 lint 억제 패턴 | `handler.spec.ts` 모델 폴백 테스트 | `const { model: _, ...configWithoutModel } = ...`로 단순화 |
| 11 | Maintainability | **테스트 내 `as number` 타입 캐스트 잉여** — 바로 위 줄에서 `typeof meta.durationMs === 'number'` 검증 후 `as number` 캐스트는 불필요 | `handler.spec.ts` 신규 테스트 2개 | `as number` 제거 |
| 12 | Documentation | **멀티 레이블 에러 테스트에 CONVENTIONS 설명 주석 없음** — 싱글 레이블 버전에는 Principle 2 설명 5줄 주석이 있으나 멀티 레이블에는 없어 규약 검증 목적 불명확 | `handler.spec.ts` L784 | 동일 주석 블록을 `(multi-label)` 수식어 추가해 반영 |
| 13 | Documentation | **핸들러 주석 마지막 두 줄 중복** — `requestPayload.model` 재사용 이유 설명이 이미 앞선 CONVENTIONS 인용으로 커버됨. CLAUDE.md "Don't explain WHAT the code does" 경계선 | `handler.ts` L130–135 | 마지막 두 줄 제거, 앞 세 줄(Principle 2 · spec §5.3 · 균일 표현식 해석)만 유지 |
| 14 | Performance | **`errorDurationMs` 측정이 `truncateForErrorDetails()` 이후** — truncation 실행 시간이 LLM 호출 시간에 포함됨. 수 마이크로초 수준으로 실용적 영향 미미 | `handler.ts` catch 블록 | timestamp를 catch 블록 최초 줄에 배치 (선택적) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | LOW | PII truncation이 3개 노출 지점 중 1곳에만 적용되는 불완전한 정책 |
| Architecture | LOW | `durationMs` 책임 분열(핸들러 vs 엔진)과 에러/성공 meta shape 비대칭 |
| Requirement | LOW | `callStartedAt` 측정 기준점이 spec 설명과 불일치, `output.originalInput` 필드 표 누락 |
| Side Effect | LOW | `output._llmCalls` → `meta.llmCalls` 이동으로 인한 다운스트림 silent break 가능성 |
| Maintainability | LOW | 에러 메트릭 테스트 중복, 성공/에러 `durationMs` 주입 비대칭 미문서화 |
| Documentation | LOW | spec §5.3 JSON 예시와 필드 표 불일치, 테스트 주석 비대칭 |
| API Contract | LOW | 에러 meta 토큰 필드 누락으로 인한 다운스트림 `undefined` 가능성 |
| Dependency | LOW | `output._llmCalls` 내부 계약 변경, `requestPayload` PII 노출 경로 |
| Testing | LOW | 멀티 레이블 테스트 비대칭, negative 단언 부재 |
| Performance | LOW | `requestPayload` 시스템 프롬프트 직렬화 크기 (기존 패턴 동일) |
| Scope | NONE | 모든 변경이 단일 목표에 수렴, 불필요한 확장 없음 |
| Concurrency | NONE | 공유 가변 상태 없음, `await` 올바르게 사용 |
| Database | NONE | 데이터베이스 레이어와 접점 없음 |

---

## 발견 없는 에이전트

- **Database** — DB 쿼리·스키마·ORM 관련 코드 없음
- **Concurrency** — 공유 가변 상태 없음, 동시성 위험 없음
- **Scope** — 모든 변경이 계획된 단일 목표에 정확히 수렴

---

## 권장 조치사항

1. **(필수) PII truncation 정책 통일** — `output.originalInput`을 `truncatedInput`으로 교체하거나, spec §5.3에 "세 노출 지점의 truncation 정책 상이" 명시. 주석 의도와 실제 동작의 불일치 해소가 핵심

2. **(필수) spec §5.3 필드 표에 `output.originalInput` 행 추가** — JSON 예시·코드·테스트는 이 필드를 다루지만 공식 필드 표에 없어 문서-코드 불일치 상태

3. **(권장) `durationMs` 책임 단일화 결정** — 핸들러 또는 엔진 중 하나가 모든 경로에서 책임지도록 설계 확정 후 spec 테이블 `engine inject` / `handler return` 출처 통일

4. **(권장) `grep -r '_llmCalls'` 실행** — 다운스트림 expression에서 `output._llmCalls`를 참조하는 코드 유무 확인 후 마이그레이션 노트 작성

5. **(권장) 에러/성공 meta 토큰 필드 비대칭 해소** — 에러 경로에 `inputTokens: 0, outputTokens: 0, totalTokens: 0` 기본값 추가 또는 spec에 "에러 경로에서 토큰 필드 미포함, optional 처리 필요" 명시

6. **(개선) `assertErrorMeta()` 헬퍼 추출** — 단일/멀티 레이블 에러 테스트의 8줄+ 중복 단언을 로컬 헬퍼로 통합해 향후 meta 계약 변경 시 수정 지점 단일화

7. **(소소) 테스트 보강** — ①멀티 레이블에 `requestPayload` 단언 추가 ②`expect(result.output).not.toHaveProperty('_llmCalls')` negative 단언 ③`output.originalInput` 검증 추가

8. **(소소) `void _omit` → `const { model: _, ... }` 패턴으로 교체** — 가독성 향상