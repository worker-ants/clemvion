# 요구사항(Requirement) Review — mcp-client-diagnostics-followups

## 리뷰 대상 성격

본 diff 배치(파일 1~22)는 **`codebase/**` 코드 변경을 포함하지 않는다** — 전량이 `review/consistency/**` 산출물(3개 라운드: 23:20, 23:40, 00:00/00:16)과 spec 문서(`spec/5-system/11-mcp-client.md`, `spec/conventions/error-codes.md`) 2개다. 실제 기능 코드(`mcp-error-codes.ts`, `cafe24-mcp-tool-provider.ts`, `makeshop-mcp-tool-provider.ts`, `mcp-tool-provider.ts` 등)는 이번 요청의 diff 범위 밖이며(선행 커밋에서 이미 구현·커밋됨), 이번 배치는 그 구현에 대한 **consistency-check 라운드 기록물 + 그 라운드가 지적한 spec 자기모순의 정정 커밋**으로 구성된다. 따라서 본 리뷰는 (a) 리뷰 아티팩트 자체의 자기정합성, (b) 정정된 spec 본문이 실제 코드 구현(직접 Read 로 대조)과 line-level 로 일치하는지에 집중했다.

## 발견사항

- **[INFO]** 리뷰 대상에 실제 `codebase/` diff 부재
  - 위치: 파일 1~20 (`review/consistency/2026/07/06/23_20_02/`, `23_40_32/`, `2026/07/07/00_00_54/`, `00_16_19/`)
  - 상세: 요구사항 충족 여부를 코드 레벨로 직접 검증할 diff 가 없다. 이 배치는 산출물(review artifacts)이며, 기능 코드는 이전 커밋(`d395fd7cc` feat, `88414653b` test)에서 이미 반영되어 있다는 것이 아티팩트 본문(plan_coherence.md, 파일 19)에서 확인된다.
  - 제안: 조치 불요 — 정보성. 코드 자체의 요구사항 충족 여부는 선행 `/ai-review` 라운드(`review/code/2026/07/07/00_00_54/`)에서 이미 다뤄졌을 것이므로 중복 판정 대상 아님.

- **[INFO]** §2.3 자기모순 CRITICAL 이 실제로 해소됨 — 코드·spec 정합 확인
  - 위치: `spec/5-system/11-mcp-client.md` §2.3 "에러 처리" 단락 (파일 21, diff 라인 1552-1553)
  - 상세: `00_00_54` 라운드의 `cross_spec.md`(파일 11)가 지적한 CRITICAL(§2.3 이 call-phase `errors[]` 누적을 "Planned"로 잘못 기술 — §6.2/§8.1/§8.2 및 실제 구현과 모순)이, 이번 diff(파일 21)에서 "call-phase 실패(API 4xx/5xx·transport)는 ... `mcpDiagnostics.errors[]` 에도 동일 vocabulary·`phase='tools/call'` 로 누적된다"로 정확히 정정되었다. `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 의 `mcpErrorDelta` 반환 로직(코드 직접 확인 결과 존재)과 이 spec 문장이 line-level 로 일치한다. 후속 `00_16_19` 라운드(파일 16, 20)가 이 해소를 재확인했다.
  - 제안: 조치 불요 — 이미 올바르게 해소됨.

- **[INFO]** `redactMcpSecrets`/`SECRET_LEAK_PATTERNS` 중복 WARNING(naming_collision, 23_40_32 라운드) 도 실제로 해소됨
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts` (직접 Read 로 확인, 라인 13, 39-50, 68-76)
  - 상세: `23_40_32` 라운드 naming_collision.md(파일 7)의 WARNING — "`redactMcpSecrets`/`MCP_REDACTED_PLACEHOLDER` 가 공용 `sanitizeLastErrorMessage`/`SECRET_LEAK_PATTERNS` 와 목적 중복, placeholder `[redacted]` vs `***` 파편화" — 이 SUMMARY.md(파일 3)에서 "해소(후속 커밋)" 로 처분되었고, 실제 코드를 확인한 결과 `redactMcpSecrets` 는 `import { SECRET_LEAK_PATTERNS } from '../../shared/utils/sanitize-error-message'` 로 공용 SoT 를 직접 재사용하고, MCP 전용 extras(`MCP_EXTRA_SECRET_PATTERNS` — URL userinfo, bare token)만 얇게 얹으며, placeholder 도 `***` 로 통일됐다(`MCP_REDACTED_PLACEHOLDER` 제거됨 — grep 무매치). spec `## Rationale` "에러 message redaction 은 공용 패턴 재사용" 항목(파일 21, 라인 1642-1643)도 이 구조를 정확히 설명한다. 코드·spec·리뷰 처분 3자가 모두 정합.
  - 제안: 조치 불요 — 이미 올바르게 해소됨.

- **[INFO]** `spec/conventions/error-codes.md` 의 `INVALID_TOOL_ARGUMENTS` prefix-less 예외 등재 — spec 본문 신설 근거 타당
  - 위치: `spec/conventions/error-codes.md` (파일 22, diff 라인 1730-1735)
  - 상세: 신설 문구가 "`MCP_` prefix 를 붙이지 않는 이유 — AI Agent 의 모든 tool provider 경로에서 공유되는 LLM 인자 검증 category, `MCP_INVALID_TOOL_ARGUMENTS` rename 은 breaking 일 뿐 의미 이득 없음"이라는 근거를 제시한다. 이는 §2 rename-안정성 정책(코드 값이 LLM 과의 계약이므로 임의 rename 금지)과 정합하며 새로운 예외 카테고리를 만드는 것이 아니라 이미 존재하는 코드값의 명명 근거를 소급 문서화한 것 — CRITICAL 급 spec 위반 없음.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 아티팩트 배치 내 경미한 표기 불일치 잔존 (본 diff 무관, 후속 권장 사항으로 이미 기록됨)
  - 위치: `spec/5-system/11-mcp-client.md` §4.4 vs §6.2/§8.2 (`resources/list`/`prompts/list` 의 "10s 타임아웃 = build 계열처럼 보임" vs "call phase" 축 차이), §8.3 "2KB" vs §8.2 `MCP_ERROR_MESSAGE_MAX_LEN = 2048` 표기 차이
  - 상세: `00_16_19` 라운드 cross_spec.md(파일 16)가 이미 INFO 로 식별·기록했고 "이번 PR 필수 수정 아님"으로 명시했다. 실질적 모순이 아니라 표현 명확성 차원의 개선 여지이며, 코드 확인 결과(`mcp-tool-provider.ts` `executeMeta`)도 두 축(타임아웃 길이 vs 진단 phase)이 실제로 다른 것이 맞아 코드가 스펙과 어긋나는 것이 아니다.
  - 제안: 조치 불요(이미 하위 리뷰에서 처분 완료, 필수 아님으로 명시).

## 요약
본 리뷰 배치는 기능 코드 diff 를 포함하지 않고, MCP 클라이언트 진단 파이프라인 후속 작업(`mcp-client-diagnostics-followups`)에 대한 3라운드 consistency-check 아티팩트와 그 라운드가 검출한 spec 자기모순(§2.3 "Planned" 오기재, CRITICAL)의 정정 diff 로 구성된다. 코드베이스를 직접 대조(`mcp-error-codes.ts` Read)한 결과, (1) §2.3 self-contradiction 은 실제로 올바르게 정정되어 코드(Cafe24/Makeshop `mcpErrorDelta`)와 spec 본문이 line-level 로 일치하고, (2) 앞선 라운드의 naming_collision WARNING(`redactMcpSecrets` vs 공용 `SECRET_LEAK_PATTERNS` 중복)도 공용 SoT 재사용 구조로 리팩터되어 해소되었으며 placeholder(`***`)도 통일됐다. 신규 `error-codes.md` 예외 등재도 기존 rename-안정성 정책과 정합한다. 미해결 CRITICAL/WARNING 은 발견되지 않았고, 잔존하는 것은 이전 라운드가 이미 INFO 로 명시적으로 처분한 표기 개선 권고(§4.4/§8.3 표기 통일 등, 필수 아님)뿐이다. TODO/FIXME 류 미완성 표식이나 반환값 누락, 엣지케이스 미처리 등 기능적 결함은 이번 배치(리뷰 산출물 + spec 정정) 성격상 해당 사항이 없다.

## 위험도
NONE
