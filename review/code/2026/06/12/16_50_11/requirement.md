# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] 파일 1 — `workspace.decorator.spec.ts`: 테스트 패턴 이중 단언 (중복)

- **위치**: 테스트 `should throw BadRequestException with WORKSPACE_ID_REQUIRED code when no workspace ID is available` (lines 123–136)
- **상세**: `expect(() => factory(undefined, ctx)).toThrow(BadRequestException)` 을 먼저 실행한 뒤 즉시 동일 factory 호출을 `try/catch` 로 다시 실행해 `code` 필드를 단언한다. 즉 factory 가 두 번 호출된다. 기능 검증 목적은 달성되나, 첫 번째 단언이 실패하면 두 번째 try/catch 는 도달하지 않으므로 이중 호출은 불필요한 잡음이다. 단일 `try/catch` + `expect(e).toBeInstanceOf(BadRequestException)` + `getResponse()` 단언으로 합쳐도 동일 커버리지를 얻는다.
- **제안**: 두 단언 블록을 하나의 `try/catch` 로 통합하는 것을 권장하나, 기능 정확성에는 영향 없으므로 필수 수정은 아니다.

---

### [INFO] 파일 1 — `workspace.decorator.spec.ts`: `WORKSPACE_ID_REQUIRED` code 단언이 빈 문자열 케이스에는 없음

- **위치**: 테스트 `should throw BadRequestException when X-Workspace-Id header is an empty string (falsy)` (lines 138–142)
- **상세**: 빈 문자열 헤더 케이스는 `expect(() => factory(undefined, ctx)).toThrow(BadRequestException)` 만 단언하고, `code: 'WORKSPACE_ID_REQUIRED'` 존재 여부는 검증하지 않는다. 다른 케이스(no workspace ID)가 코드를 단언하므로 구현 측 코드 경로는 동일하게 커버되지만, 에러 코드 계약 명세 관점에서 빈 문자열 케이스에도 동일 코드를 단언하면 회귀 방어가 더 강해진다. spec §1.3의 `WORKSPACE_ID_REQUIRED` 는 "X-Workspace-Id 헤더와 JWT `workspaceId` 둘 다 없음"으로 정의되는데, falsy 빈 문자열은 "헤더가 있지만 비어있음"으로 사실상 동일 시나리오에 해당한다.
- **제안**: 기능 정확성에 영향은 없으나, 빈 문자열 케이스에도 `code` 단언을 추가하면 spec §1.3 계약을 더 완전하게 테스트할 수 있다.

---

### [INFO] 파일 2 — `backend-labels.ts`: `WORKSPACE_ID_REQUIRED` 한국어 메시지 위치

- **위치**: `ERROR_KO` 객체 내 lines 757–760
- **상세**: 신규 에러 코드 `WORKSPACE_ID_REQUIRED` 가 `ERROR_KO` 에 등록되어 있고, spec `3-error-handling.md §1.3` 의 canonical 코드와 완전히 일치한다. 메시지 문구("요청에 워크스페이스 정보가 없어요. 다시 로그인하거나 워크스페이스를 선택해 주세요.")도 사용자 안내 목적에 적합하다. 추가 조치 불필요.

---

### [INFO] 파일 3 — `chat-channel-followups-batch.md`: plan 파일 상태

- **위치**: `## 검증` 섹션 (lines 977–978)
- **상세**: `/ai-review` 및 `/consistency-check --impl-done` 두 항목이 아직 미체크(`[ ]`)다. 이는 본 리뷰가 진행 중인 상태와 일치하며, 리뷰 완료 후 plan 체크박스를 갱신해야 한다 (MEMORY 규약: e2e/ai-review 수행 후 체크 + PR 커밋 포함).

---

### [INFO] 파일 4 — `spec-sync-chat-channel-gaps.md`: §7 동시 갱신 의무 비고 추가

- **위치**: `## 비고` 마지막 줄 (line 1039/1065)
- **상세**: `§5.4 rotate-bot-token` 성공 응답 3필드 구현 시 `chat-channel-adapter.md §7` 의 "두 spec 동시 갱신" 규약을 따른다는 안내가 추가되었다. 기능 변경이 아닌 추적 문서 보강으로, 미구현 항목의 구현 시 절차를 명확히 한다. 적합하고 완전하다.

---

### [INFO] 파일 5 — `1-auth.md §1.1`: 인증 토큰 유효기간 동기화

- **위치**: `§1.1` 테이블 "인증 메일 재발송" 행 (line 1086/1129)
- **상세**: "발급되는 인증 토큰은 24h 유효 (§5 동일)" 문구가 추가되어 §1.1 과 §5(`POST /api/auth/resend-verification`) 의 토큰 유효기간 기술이 일치한다. spec §5 API 엔드포인트 표의 "인증 메일 재발송 (24h 유효)" 와 동기화된 개선이다.

---

### [INFO] 파일 6 — `11-mcp-client.md §3.1`: `makeshop` Internal Bridge 행 추가

- **위치**: `§3.1 Internal Bridge 적용 service_type` 표 (lines 1738, 1854)
- **상세**: `makeshop` / `MakeshopMcpToolProvider` 행이 추가되어 `spec/4-nodes/4-integration/5-makeshop.md §8` 과 정합된다. spec link 앵커(`#8-ai-agent-노출-internal-mcp-bridge`)도 makeshop spec의 실제 `## 8. AI Agent 노출 (Internal MCP Bridge)` 헤더와 일치한다. `§2.3 본문` 표에도 이미 `makeshop`이 기재되어 있으며 (`적용 service_type: 현재 cafe24, makeshop`), 이번 §3.1 추가로 §2.3 ↔ §3.1 간 불일치가 해소되었다.

---

### [INFO] 파일 7 — `15-chat-channel.md` R-CC-18: spec 변경 내용 정확성

- **위치**: R-CC-18 Rationale (lines 2317–2319)
- **상세**: `400 WORKSPACE_ID_REQUIRED` 전환 경위를 세 가지 이유 ((i) 의미적 올바름, (ii) JWT fallback 누락, (iii) 코드명 불일치)로 명확히 기술하고 있으며, `3-error-handling.md §1.3` canonical과 일치한다. `error-codes.md §5 Rename 이력` 에도 `WORKSPACE_REQUIRED → WORKSPACE_ID_REQUIRED` 가 등재되어 있어 이력 추적이 완결되었다.

---

## 요약

7개 파일에 걸친 변경이 의도한 기능을 정확히 구현하고 있다. 핵심 변경인 `WORKSPACE_ID_REQUIRED` 에러 코드 도입은 (1) decorator 구현(`workspace.decorator.ts`)이 `BadRequestException({ code: 'WORKSPACE_ID_REQUIRED' })`를 정확히 throw하고, (2) 테스트가 이를 단언하며, (3) 프론트엔드 i18n이 한국어 메시지를 등록하고, (4) spec `3-error-handling.md §1.3`에 canonical 정의가 존재하며, (5) `error-codes.md §5`에 retire 이력이 등재된 chain이 완결되어 있다. MCP Client spec의 `makeshop` 행 추가도 `5-makeshop.md §8` 과 `11-mcp-client.md §2.3` 양방향 정합이 확인된다. spec 일치도(spec fidelity)는 전 파일에서 문제 없음. 발견된 항목은 모두 INFO 수준의 개선 제안이며 기능 결함은 없다.

## 위험도

NONE
