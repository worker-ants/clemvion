## 발견사항

---

**[WARNING] `2026-04-24_08-20-33` 배치 내 일부 리뷰어가 리뷰 대상 파일을 이탈해 원본 코드 직접 리뷰**
- **위치**: `review/2026-04-24_08-20-33/concurrency/review.md`, `security/review.md`, `architecture/review.md`, `performance/review.md`, `requirement/review.md`
- **상세**: `meta.json`(파일 42)에 따르면 이 배치의 입력 파일은 `2026-04-23_18-23-15/side_effect/review.md`와 `testing/review.md` 두 개의 마크다운 문서다. 그러나 위 5개 리뷰는 해당 마크다운 파일이 아니라 그 안에서 *언급된* `model-combobox.tsx`, `llm-config.service.ts`, `llm-config.controller.ts` 등 원본 소스 코드를 직접 분석한다. 반면 동일 배치의 `database`, `api_contract`, `side_effect` 리뷰어는 "실행 가능한 코드 없음"으로 정확하게 NONE 판정을 내렸다 — 같은 입력에 대한 해석이 배치 내에서 일관되지 않다.
  - `concurrency/review.md`: `llm-config.service.ts`의 `isDefault` 플래그 트랜잭션 누락(`[MEDIUM]`)과 `remove()` 캐시-DB 삭제 순서(`[WARNING]`)를 신규 발견사항으로 제시 — 입력 파일에 없는 코드
  - `security/review.md`: `model-combobox.tsx`의 API Key props 전달 구조를 독립적으로 분석
  - `architecture/review.md`: `model-combobox.tsx` SRP 위반 및 커스텀 훅 분리 제안
  - `performance/review.md`: `useMutation` 캐싱 부재, `AbortController` 미구현 등 `model-combobox.tsx` 성능 직접 분석
  - `requirement/review.md`: provider 변경 시 모델 목록 초기화 요구사항 등 원본 컴포넌트 명세 분석
- **제안**: 해당 리뷰들은 입력이 마크다운 문서일 때 그 문서의 내용(발견사항의 완전성·정확성·표현)을 평가해야 한다. 원본 코드 분석은 해당 코드가 diff에 포함된 배치(`2026-04-24_08-11-00`)에서 수행되어야 한다.

---

**[WARNING] `2026-04-24_08-11-00/dependency/review.md` — SSRF 보안 취약점을 Dependency 범주로 분류**
- **위치**: 파일 9 — `[WARNING] isPrivateHost의 SSRF 가드가 DNS 기반 공격에 취약` 항목
- **상세**: `isPrivateHost()` 함수의 DNS 우회 가능성은 보안(security) 또는 아키텍처(architecture) 범주의 발견사항이다. 같은 배치의 `security/review.md`와 `architecture/review.md`에 동일 내용이 이미 수록되어 있어 3중 중복이 발생한다. Dependency 리뷰의 정의는 외부 패키지·라이브러리·버전 의존성 위험이며, 함수 구현의 보안 논리는 해당 범위를 이탈한다.
- **제안**: 해당 항목을 Dependency 리뷰에서 제거하고 security/architecture 리뷰로 단일화.

---

**[INFO] `2026-04-23_18-23-15/side_effect/review.md` — 테스트 패턴 지적이 Side Effect 범주 이탈**
- **위치**: 파일 2 — `[INFO] model-combobox.test.tsx — 에러 mock이 동기 throw 사용` 및 `[INFO] llm-configs.test.ts — beforeEach + afterEach mock 정리 중복` 항목
- **상세**: 두 항목 모두 테스트 코드의 구조·작성 패턴에 대한 지적이며 런타임 부작용과 무관하다. 동일 내용이 `2026-04-23_18-23-15/testing/review.md`에 중복 수록되어 있다. 이 패턴은 이후 `2026-04-24_08-20-33/scope/review.md`(파일 45)에서 동일하게 지적되었다.
- **제안**: 해당 두 항목을 `side_effect/review.md`에서 제거하고 `testing/review.md`에만 유지.

---

**[INFO] 배치 간 발견사항 대규모 중복 — SSRF 관련 항목**
- **위치**: `2026-04-24_08-11-00`의 security, architecture, dependency, requirement 리뷰 및 `2026-04-24_08-16-06`의 security, requirement 리뷰
- **상세**: DNS rebinding 기반 SSRF, IPv6 사설 대역 미차단, `local` 프로바이더 SSRF 예외, `0.0.0.0` 미차단 등 동일 취약점이 3개 배치, 4~5개 리뷰 도메인에 걸쳐 반복 수록된다. 이는 `SUMMARY.md` 합산 시 위험도 집계를 과장시키는 효과를 낸다.
- **제안**: 각 배치의 scope 리뷰어가 SSRF 항목의 중복 분포를 명시적으로 지적하고 단일 카운트로 정규화할 것을 권고.

---

## 요약

전반적으로 `2026-04-24_08-11-00` 및 `2026-04-24_08-16-06` 배치의 리뷰들은 각 도메인(security, architecture, performance 등) 범위를 대체로 준수하고 있다. 핵심 범위 이탈은 `2026-04-24_08-20-33` 배치에서 발생한다 — `meta.json`에 입력 파일이 2개의 마크다운 리뷰 문서로 명시되어 있음에도 concurrency, security, architecture, performance, requirement 리뷰어가 해당 문서 대신 원본 소스 코드(`model-combobox.tsx`, `llm-config.service.ts`)를 직접 분석하여, 같은 배치 내 database/api_contract/side_effect 리뷰어의 NONE 판정과 불일치한다. 이 외에 Dependency 리뷰의 SSRF 보안 항목 포함과 Side Effect 리뷰의 테스트 패턴 항목 포함이 도메인 경계 이탈의 부가적 사례로 식별된다.

## 위험도

**LOW**