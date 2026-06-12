# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능·보안·아키텍처·API 계약 관점에서 실질적 문제 없음. 유일한 발견은 `workspace.decorator.spec.ts` 의 이중 factory 호출 패턴(테스트 가독성/안정성 수준)으로, 핵심 에러 코드 단언이 첫 단언 실패 시 누락될 수 있는 구조적 취약점이 있다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Maintainability | `workspace.decorator.spec.ts` 에서 `factory(undefined, ctx)` 를 `expect(() => ...).toThrow(BadRequestException)` 로 먼저 실행한 뒤 `try/catch` 블록에서 동일 factory 를 다시 호출하는 이중 호출 패턴. 첫 `toThrow` 단언이 실패(예외 미발생)할 경우 `catch` 블록에 도달하지 않아 핵심 단언인 `code: 'WORKSPACE_ID_REQUIRED'` 검증이 누락된다. | `codebase/backend/src/common/decorators/workspace.decorator.spec.ts` 122–135행 | 선행 `expect().toThrow()` 제거 후 `try/catch` 단독 사용, 또는 단일 호출로 양쪽 단언 통합: `let caught; expect(() => { try { factory(...) } catch(e) { caught = e; throw e; } }).toThrow(BadRequestException); expect((caught as BadRequestException).getResponse()).toEqual(expect.objectContaining({ code: 'WORKSPACE_ID_REQUIRED' }));` |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 빈 문자열 헤더(`X-Workspace-Id: ""`) 케이스 테스트가 예외 타입(`BadRequestException`)만 단언하고 `code: 'WORKSPACE_ID_REQUIRED'` 를 단언하지 않아 다른 케이스와 일관성이 없다. | `workspace.decorator.spec.ts` 137–141행 | 동일 `code` 단언 추가 또는 의도적 차이를 인라인 주석으로 명시 |
| 2 | Testing | `user` 가 `null`/`undefined` 인 케이스도 예외 타입만 확인하며 `code` 단언이 없다. 동일 코드 경로를 타는지 회귀 방어가 약하다. | `workspace.decorator.spec.ts` 143–153행 | 세 "throw" 케이스 모두 `code: 'WORKSPACE_ID_REQUIRED'` 단언 추가, 또는 공통 헬퍼로 추출해 반복 제거 |
| 3 | Testing | `backend-labels.ts` 에 추가된 `ERROR_KO['WORKSPACE_ID_REQUIRED']` 가 CI i18n parity guard(P3-C-2)에 자동 포함되는지 확인 필요. guard 가 수동 등록 기반이라면 누락될 수 있다. | `codebase/frontend/src/lib/i18n/backend-labels.ts` + `__tests__/backend-labels.test.ts` | `backend-labels.test.ts` 의 P3-C-2 guard 목록에 `WORKSPACE_ID_REQUIRED` 포함 여부 점검 |
| 4 | Side Effect | `backend-labels.ts` 파일 주석 상의 i18n 가드 CI 가 `WORKSPACE_ID_REQUIRED` 의 백엔드 `ErrorCode` enum 존재 여부를 검증하는지 본 변경 범위 내에서 직접 확인되지 않는다. `/consistency-check --impl-done` 수행으로 parity 확인 권장. | `plan/in-progress/chat-channel-followups-batch.md` — 검증 섹션 미체크 항목 | plan 체크박스 수행 후 PR 커밋에 포함 |
| 5 | Architecture | `spec/conventions/error-codes.md §5` preamble 정확화로 "게이트를 넓힌 것"이 아니라 "기준을 명확화한 것"임을 주석으로 구분하면 §2 안정성 원칙과의 관계가 더 명확해진다. | `spec/conventions/error-codes.md` §5 preamble | §5 진입 기준("client 코드 분기 없음" + "user-docs 동기화 완료")을 주석으로 명시 |
| 6 | Architecture | `spec/5-system/11-mcp-client.md` §2.3 본문과 §3.1 표가 분리되어 있어 새 Internal Bridge 구현체 추가 시 두 위치를 동시 갱신해야 하는 절차 취약점이 구조적으로 존재한다. | `spec/5-system/11-mcp-client.md` §2.3 / §3.1 | 장기적으로 §3.1 표를 §2.3 아래 인라인으로 이동해 단일 절에서 관리 고려 |
| 7 | Maintainability | `backend-labels.ts` 가 13개 테이블을 단일 파일에 유지해 도메인별 응집 단위와 파일 단위가 불일치한다. 현재는 관리 가능 수준이나 향후 확장 병목 가능성 있음. | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 장기적으로 `error-labels.ts`, `node-labels.ts` 등 서브 모듈 분리 후 re-export 구조 고려 |
| 8 | API Contract | §5.4 `rotate-bot-token` 응답에 `triggerId`/`chatChannelHealth`/`botIdentity` 3필드 추가(미구현)는 additive change 이나, 기존 클라이언트가 응답을 strict parse 하는 경우 영향 가능. | `spec-sync-chat-channel-gaps.md` 비고 / 미구현 항목 | 구현 시 클라이언트의 unknown 필드 허용 여부 확인 후 진행 |
| 9 | Documentation / User Guide | `triggers.mdx`/`triggers.en.mdx` callout 에 열거된 6개 코드 중 `WORKSPACE_ID_REQUIRED` 만 ko 매핑이 추가됨. 나머지 5개(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)는 여전히 미등록. 현재 callout 의 "일부 코드는 영문 노출" 문구는 사실이라 차단 수준 아님. | `codebase/frontend/src/lib/i18n/backend-labels.ts` / `triggers.mdx` | 선택적: triggers.mdx 에서 `WORKSPACE_ID_REQUIRED` 를 "ko 지원됨"으로 표시하거나 나머지 5개를 별도 명시 |
| 10 | Plan | `plan/in-progress/chat-channel-followups-batch.md` 의 `/ai-review` 및 `/consistency-check --impl-done` 항목이 미체크 상태. 본 리뷰 완료 후 체크박스 갱신 + PR 커밋 포함 필요 (MEMORY 규약). | `plan/in-progress/chat-channel-followups-batch.md` 검증 섹션 | 리뷰 완료 후 체크박스 갱신하여 PR 커밋에 포함 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 취약점 없음. falsy 헤더 케이스 테스트 추가는 입력 검증 회귀 방지에 긍정적 |
| performance | NONE | 런타임 로직 변경 없음. 테스트 내 이중 factory 호출은 프로덕션 무관 |
| architecture | NONE | 구조 변경 없음. 테스트 이중 호출 패턴·단일 파일 집중·spec §5 게이트 명확화 등 INFO 수준 |
| requirement | NONE | 모든 변경이 spec 계약과 정합. 에러 코드 chain 완결 확인 |
| scope | NONE | 범위 이탈 없음. 전 파일이 plan G1-3/G1-4/G2-5/G3-6/G3-7 에 1:1 대응 |
| side_effect | NONE | 런타임 부작용 없음. i18n guard CI parity 확인 권장(INFO) |
| maintainability | LOW | 테스트 이중 호출 패턴 WARNING 1건. 나머지는 기존 패턴 준수 |
| testing | LOW | 이중 단언 구조로 핵심 code 단언 누락 가능성 WARNING 1건. 빈문자열/null/undefined 케이스 code 단언 미비 |
| documentation | NONE | 문서화 품질 양호. spec 교차 참조 보완 긍정적 |
| dependency | NONE | 신규 외부 의존성 없음. 내부 의존 방향 정상 |
| database | NONE | DB 관련 변경 없음 |
| concurrency | NONE | 동시성 코드 없음 |
| api_contract | NONE | Breaking change 없음. 기존 계약 문서 정합 강화 |
| user_guide_sync | NONE | 동반 갱신 누락 0건. triggers.mdx callout 정확도 INFO 1건 |

---

## 발견 없는 에이전트

- **database** — DB 접근 코드·마이그레이션·스키마 변경 없음
- **concurrency** — 동시성 코드 없음, 모든 변경이 순수 정적 상수 또는 문서
- **dependency** — 신규 외부 패키지 없음, package.json 무변경
- **security** — 실질적 취약점 없음

---

## 권장 조치사항

1. **[WARNING 해소 — 필수]** `workspace.decorator.spec.ts` 122–135행의 이중 factory 호출 패턴을 단일 `try/catch` 또는 `expect.assertions` 기반 단일 호출로 리팩터링하여 `code: 'WORKSPACE_ID_REQUIRED'` 단언이 항상 실행되도록 보장한다.
2. **[INFO — 강력 권장]** plan 검증 섹션의 `/ai-review` 및 `/consistency-check --impl-done` 체크박스를 완료 후 체크하여 PR 커밋에 포함한다 (MEMORY 규약 준수).
3. **[INFO — 권장]** 빈 문자열·null·undefined 케이스 테스트에도 `code: 'WORKSPACE_ID_REQUIRED'` 단언을 추가하거나 공통 헬퍼로 추출해 일관성을 높인다.
4. **[INFO — 권장]** `backend-labels.test.ts` P3-C-2 guard 에 `WORKSPACE_ID_REQUIRED` 가 포함되어 있는지 점검한다.
5. **[INFO — 선택]** `spec/conventions/error-codes.md §5` preamble 에 진입 기준 주석을 추가해 "게이트 확장"이 아닌 "기준 명확화"임을 구분한다.
6. **[INFO — 선택]** `triggers.mdx`/`triggers.en.mdx` callout 을 갱신해 `WORKSPACE_ID_REQUIRED` 의 ko 지원 완료 상태를 반영한다.

---

## 라우터 결정

라우터 미사용 — `routing=all` (전체 reviewer 실행).

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)