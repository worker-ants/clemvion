# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 신규 CORS 스냅샷 테스트가 실제 프로덕션 `defaultOptions` 를 검증하지 않는 동어반복(tautology) 구조로, "AGM-13 회귀 방지"라는 목적을 달성하지 못함. 보안·범위·부작용 측면의 Critical 이슈는 없으나, 테스트 유효성 결함이 복수 reviewer 에서 WARNING 으로 동일하게 지적됨.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement / Side-Effect / Maintainability / Documentation | 새 `'CORS exposedHeaders 스냅샷 (AGM-13 회귀 방지)'` describe 블록이 테스트 내부에서 직접 정의한 인라인 `defaultOptions` 로컬 함수를 자가 검증하는 동어반복 구조임. 실제 프로덕션 `defaultOptions`(앱 모듈에서 주입) 와는 전혀 연결되지 않아, 프로덕션 코드에서 `exposedHeaders` 를 삭제해도 이 테스트는 항상 PASS. "회귀 방지" 목적을 달성하지 못하며, 테스트 주석과 실제 검증 범위 간 간극이 존재함. | `codebase/backend/src/common/cors/web-chat-cors.spec.ts` L173–181, L246–253 | (a) 실제 프로덕션 `defaultOptions` 팩토리를 named export 로 추출해 spec 파일에서 import·호출하거나, (b) 기존 `createWebChatCorsDelegate` describe 의 `defaultOptions` fixture 에 `exposedHeaders: ['X-Deleted-Count']` 를 추가하고 비-웹채팅 경로 케이스에서 `opts.exposedHeaders` 를 함께 assert. 둘 중 하나로 실질적 회귀 방지 커버리지 확보 필요. |
| 2 | Testing | `createWebChatCorsDelegate` 기존 describe 에 `defaultOptions` 가 `exposedHeaders` 를 포함할 때 이것이 cb 응답에 전파되는지 검증하는 케이스가 없음. 현재 기존 테스트는 `credentials` 전파만 검증. | `codebase/backend/src/common/cors/web-chat-cors.spec.ts` L150–237 | "비-웹채팅 경로에서 `defaultOptions` 의 `exposedHeaders` 가 응답에 전파된다" 케이스를 `createWebChatCorsDelegate` describe 안에 추가. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `X-Deleted-Count` 는 삭제 건수(정수)만 담아 정보 노출 범위가 최소화됨. spec §6 workspace_id 격리가 명확히 요구되어 있어 현재 노출 범위는 수용 가능. 향후 `exposedHeaders` 에 항목 추가 시 OWASP A05 관점 검토 필요. | `spec/5-system/17-agent-memory.md` AGM-13, `web-chat-cors.ts` L63 | 향후 exposedHeaders 확장 시마다 보안 검토 체크리스트 적용 권장. |
| 2 | Security | 커스텀 응답 헤더 노출 컨벤션이 `spec/5-system/2-api-convention.md` 에 공식 등재 전임. 향후 다른 개발자가 검토 없이 임의 헤더를 `exposedHeaders` 에 추가하는 선례가 될 수 있음. | `spec/5-system/17-agent-memory.md` Rationale | 후속 spec 트랙에서 `spec/5-system/2-api-convention.md` 에 커스텀 응답 헤더 패턴 공식 등재 필요 (Rationale 에서 defer 명시됨). |
| 3 | Requirement / Documentation | AGM-13 spec 요구사항 ID 에 `X-Deleted-Count` echo 및 CORS `exposedHeaders` 포함 필수 요건이 추가됨. `main.ts` L191, `agent-memory.controller.ts` L184 실제 구현과 일치. spec fidelity 충족. | `spec/5-system/17-agent-memory.md` L302 | 이슈 없음. |
| 4 | Documentation | spec Rationale 신규 섹션이 결정 배경을 충실히 기록. 단, Rationale 에 "장기: spec/5-system/2-api-convention.md 에 이관" 등 TO-DO 형 미래 계획이 포함되어 spec 이 태스크 트래커처럼 기능할 수 있음. | `spec/5-system/17-agent-memory.md` L310–319 | "장기: …" 문장을 Rationale 에서 제거하고 plan 문서에만 기록. spec 은 현재 확정 사실만 담는 것을 권장. |
| 5 | Maintainability | 새 describe 블록 이름이 한국어 혼합 형식으로, 기존 describe 블록(모두 영어 함수명)과 스타일 불일치. | `web-chat-cors.spec.ts` L239 | `'exposedHeaders snapshot (AGM-13 regression guard)'` 형식으로 통일하거나 프로젝트 방침에 따라 정렬. |
| 6 | Maintainability | `it` 블록 내 불필요한 함수 래퍼 패턴(`const defaultOptions = (): CorsOptionsLike => ({ ... }); const opts = defaultOptions()`)으로 인지 부담 가중. | `web-chat-cors.spec.ts` L247–253 | WARNING #1 수정 시 자연히 해소됨. 그렇지 않더라도 `const opts: CorsOptionsLike = { ... }` 로 단순화 권장. |
| 7 | Maintainability | AGM-13 요구사항 ID 줄이 단일 문장에 과도하게 집약됨. spec bullet 및 Rationale 에 동일 내용 이미 기술됨. | `spec/5-system/17-agent-memory.md` L301 | 요구사항 ID 줄을 키워드 수준으로 압축하고 `(상세 → 아래 bullet)` 패턴 일관 적용 권장. |
| 8 | Testing | hooks/external 경로 응답에서 `exposedHeaders` 부재가 의도적임을 테스트로 명시하지 않음. | `web-chat-cors.spec.ts` L156–208 | 선택적으로 `expect(opts.exposedHeaders).toBeUndefined()` 추가 (필수 아님). |
| 9 | Side-Effect | 기존 `defaultOptions`(L78)와 신규 describe 의 `defaultOptions`(L174)는 각각 별개 스코프에 있어 shadowing 없음. 기존 테스트 오염 없음. | `web-chat-cors.spec.ts` | 이슈 없음. |
| 10 | Side-Effect | `CorsOptionsLike` 에 `exposedHeaders?: string[]` 선택적 필드 추가로 기존 호출자에 대한 파괴적 변경 없음. | `web-chat-cors.ts` L29 | 이슈 없음. |
| 11 | Security | scope 전체 삭제 엔드포인트의 SQL 쿼리가 `workspace_id` 필터 없이 DELETE 하는 로직이 없는지 구현 리뷰 시 별도 확인 권장. | `agent-memory.controller.ts` (범위 외) | 구현 코드 리뷰 시 확인. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | exposedHeaders 정보 노출 최소, 주요 보안 취약점 없음. 스냅샷 테스트 신뢰성 낮음(INFO). |
| requirement | LOW | AGM-13 spec/구현 일치. 신규 테스트가 실제 코드 회귀를 감지 못함(WARNING). |
| scope | NONE | 변경 범위 정확히 준수. 테스트 픽스처 구조는 품질 이슈이나 범위 일탈 아님. |
| side_effect | LOW | 파괴적 변경 없음. 스냅샷 테스트 동어반복 구조(WARNING). |
| maintainability | MEDIUM | 신규 테스트가 실제 팩토리와 미연결(WARNING). Rationale TO-DO 인라인 포함, describe 스타일 불일치(INFO). |
| testing | MEDIUM | 스냅샷 테스트 항상 PASS 구조(WARNING). exposedHeaders 전파 검증 누락(WARNING). |
| documentation | LOW | spec·JSDoc 문서화 품질 양호. 테스트 주석과 실제 검증 범위 간 간극(WARNING). |

---

## 발견 없는 에이전트

scope — NONE 위험도, 범위 이슈 없음.

---

## 권장 조치사항

1. **(필수 — WARNING #1)** `'CORS exposedHeaders 스냅샷 (AGM-13 회귀 방지)'` 테스트를 실제 프로덕션 `defaultOptions` 팩토리를 import·호출하는 방식으로 수정하거나, 기존 `createWebChatCorsDelegate` describe 의 fixture 를 공유해 `opts.exposedHeaders` 를 검증하도록 재작성. 현재 구조는 회귀 방지 효과 없음.
2. **(권장 — WARNING #2)** 기존 `createWebChatCorsDelegate` describe 에 "비-웹채팅 경로에서 `defaultOptions` 의 `exposedHeaders` 가 cb 응답에 전파된다" 케이스 추가.
3. **(선택 — INFO #4)** spec Rationale 에서 "장기: …" TO-DO 형 계획 문장을 제거하고 plan 문서로 이관. spec 은 현재 확정 사실만 기록.
4. **(선택 — INFO #2)** `spec/5-system/2-api-convention.md` 에 커스텀 응답 헤더(`exposedHeaders`) 패턴 공식 등재를 후속 spec 트랙으로 추진.
5. **(선택 — INFO #5)** 테스트 describe 블록 이름 스타일을 기존 패턴(영어 함수명)과 일관되게 정렬.

---

## 라우터 결정

라우터 미사용 — `routing=all`. 전체 reviewer 강제 실행됨.

- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원)
- **제외**: 없음