# Documentation Review

대상 커밋: `97d02fb` — `fix(cafe24): wrap POST/PUT body in \`request\` envelope`
분석 파일:
- `backend/src/nodes/integration/cafe24/cafe24-api.client.ts`
- `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`

---

## 발견사항

### [WARNING] `spec/conventions/cafe24-api-metadata.md` — request envelope 규약 미반영
- **위치**: `spec/conventions/cafe24-api-metadata.md` §2 Operation 메타데이터 형식, §3 예시
- **상세**: 이번 fix 의 핵심은 Cafe24 Admin API 의 POST/PUT 본문이 반드시 `{ shop_no?, request: { ...payload } }` 형태여야 한다는 wire-format 규약이다. 현재 `spec/conventions/cafe24-api-metadata.md` 에 이 규약이 전혀 언급되지 않아, 신규 endpoint metadata row 를 추가하는 개발자가 같은 함정에 빠질 위험이 있다. plan/in-progress 의 `spec-update-cafe24-request-envelope.md` 가 이 갱신을 project-planner 에 위임하도록 기록했지만, 아직 spec 본문에는 반영되지 않은 상태다.
- **제안**: `spec/conventions/cafe24-api-metadata.md` 에 신규 절 추가 — plan 문서(`plan/in-progress/spec-update-cafe24-request-envelope.md`)의 §1 초안을 그대로 적용. 핵심 내용: envelope 변환은 `Cafe24ApiClient` 가 일괄 처리하므로 metadata 작성자는 `location: 'body'` 분류만 신경 쓰면 된다는 점, degenerate case(`shop_no`만 있는 경우)도 `request: {}` 로 전송한다는 점.

### [WARNING] `spec/4-nodes/4-integration/4-cafe24.md` §4.1 — Wrapper 책임 목록 미갱신
- **위치**: `spec/4-nodes/4-integration/4-cafe24.md` §4.1 (Wrapper 책임 bullet 목록)
- **상세**: `Cafe24ApiClient` 의 클래스 수준 JSDoc(`cafe24-api.client.ts` 라인 1253-1273)은 이번에 명시적으로 업데이트되지 않았다. 해당 JSDoc 의 책임 목록에는 URL 빌드, Bearer 주입, token refresh, leaky-bucket, mutex 가 나열되어 있으나 "POST/PUT body 를 `request` envelope 으로 자동 wrap" 항목이 빠져 있다. spec 파일도 동일 목록을 관리하므로 spec 과 코드 두 곳 모두 불완전하다.
- **제안**: plan 문서 §2 초안을 적용해 spec §4.1 bullet 목록에 `- POST/PUT 본문을 Cafe24 \`request\` envelope 으로 자동 wrap (세부 규약: spec/conventions/cafe24-api-metadata.md)` 한 줄 추가. 코드 내 JSDoc 도 같은 내용 한 줄 추가.

### [INFO] `wrapInCafe24Envelope` JSDoc — 양호, 단 DELETE 제외 여부 미언급
- **위치**: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 라인 1195-1216 (새 helper 함수)
- **상세**: 추가된 `wrapInCafe24Envelope` 함수에는 상세한 JSDoc(배경, wire-format 구조, Cafe24 공식 문서 링크)이 잘 작성되어 있다. 단, 호출부(`executeWithRateLimit`)의 조건은 `opts.body !== undefined && opts.method !== 'GET'` 이므로 DELETE 메서드에도 envelope 이 적용되는 것처럼 보이나 JSDoc 에는 "POST/PUT" 만 언급된다. Cafe24 Admin API 에서 DELETE 에 body 가 사용되는 케이스가 있을 경우 혼란을 줄 수 있다.
- **제안**: JSDoc 첫 줄 또는 `@remarks` 에 `DELETE` 가 body 를 갖지 않으므로 실제로는 POST/PUT 에만 적용됨을 명시하거나, 호출부 조건을 `['POST', 'PUT'].includes(opts.method)` 로 명시적으로 좁혀 코드 자체가 문서가 되도록 한다.

### [INFO] 테스트 케이스 설명 문자열 — 매우 양호
- **위치**: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` 라인 62-150
- **상세**: 4개 신규 테스트 케이스 모두 `it()` 설명 문자열이 동작을 정확히 기술하며, 일부 케이스(PUT + shop_no, degenerate shop_no-only, GET 제외)에는 이유를 설명하는 인라인 주석이 달려 있다. 특히 degenerate 케이스 주석(`// Degenerate case — caller passed only shop_no...`)은 400 에러 방지 의도를 명확히 전달한다. 기존 테스트의 `POST — same envelope applied to create requests` 케이스에는 주석이 없으나 설명 문자열 자체로 충분하다.
- **제안**: 현 상태 유지. `POST` 테스트에 PUT 처럼 Cafe24 문서 링크 주석을 추가하면 완결성이 높아지나 필수 아님.

### [INFO] CHANGELOG 부재
- **위치**: 프로젝트 루트 (CHANGELOG 파일 없음)
- **상세**: 이번 변경은 wire-format 수정이라는 버그 픽스로 통합 운영 안정성에 직접 영향을 준다. 본 프로젝트에는 CHANGELOG 파일이 없고 커밋 메시지가 그 역할을 대체하는 것으로 보인다. 커밋 메시지 자체는 상세하고 배경(운영 400 에러)·수정 전략·테스트 범위를 모두 기술하고 있어 추적 목적으로는 충분하다.
- **제안**: 현 방식(커밋 메시지 중심) 유지. 향후 외부 소비자가 있는 인터페이스에 변경이 생기면 CHANGELOG 도입 검토.

### [INFO] 환경변수 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` — 기존 문서 유지
- **위치**: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` (`resolveClientCredentials`)
- **상세**: 이번 diff 는 환경변수를 신규 추가하지 않았으므로 설정 문서 갱신 필요 없음. 기존 변수에 대한 테스트 내 사용 패턴(`process.env.CAFE24_CLIENT_ID = 'env-id'`, `delete process.env.CAFE24_CLIENT_ID`)도 기존 방식과 동일하다.
- **제안**: 해당 없음.

---

## 요약

이번 변경은 Cafe24 Admin API 의 `request` envelope 규약을 `Cafe24ApiClient` 한 곳에 중앙화한 버그 픽스로, 구현 코드(`wrapInCafe24Envelope`)와 테스트 케이스 4건 모두 문서화 품질이 양호하다. 새 helper 함수에는 배경·구조·공식 문서 링크를 포함한 JSDoc 이 있고, 테스트 설명 문자열도 동작을 명확히 기술한다. 다만, 핵심 wire-format 규약이 `spec/conventions/cafe24-api-metadata.md` 와 `spec/4-nodes/4-integration/4-cafe24.md` §4.1 에 반영되지 않은 채 plan 문서에만 위임 노트로 존재한다. 이 spec 갱신이 완료되지 않으면 신규 endpoint metadata 를 추가하는 개발자가 동일한 400 에러 함정에 다시 빠질 수 있어 WARNING 수준으로 분류한다. plan 문서(`plan/in-progress/spec-update-cafe24-request-envelope.md`)에 갱신 초안이 이미 작성되어 있으므로 project-planner 가 spec 을 갱신하는 즉시 이 항목은 해소된다.

## 위험도

MEDIUM
