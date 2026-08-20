# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 점검 범위

- Target: `spec/5-system/` — 실제 diff 는 `12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`6-websocket-protocol.md` 4개 파일 (`Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3소비처 도입, `7da315c10`~`1539349f5` 누적 10커밋 · 라운드1~8 처분 포함).
- prompt 번들은 `spec/conventions/**` 대부분과 `<git diff>` 자체가 컨텍스트 예산 초과로 생략돼 있어 (`node-cancellation.md`·`secret-store.md` 만 전문 포함), 워크트리 절대경로 Read + `git diff origin/main...HEAD`/`git show`로 직접 재조회해 검토했다.
- 대조 규약: `spec/conventions/swagger.md`(전문), `frontend-layering.md`(전문), `i18n-userguide.md`(전문), `spec-impl-evidence.md`(전문), `error-codes.md`(적용 대상 여부만), `node-output.md`(§Principle 7 앵커만).
- 코드 대조: `codebase/frontend/src/lib/utils/masked-markers.ts`(신설) 및 3 소비처(`rerun-modal.tsx`·`editor-toolbar.tsx`·`dynamic-form-ui.tsx`), i18n dict(`ko`/`en` `editor.ts`/`history.ts`), backend `sanitize-error-message.ts`·`executions.service.ts`·`execution-response.dto.ts`·`background-run-response.dto.ts`·`background-runs.service.ts`.
- 선행 회차 확인: 같은 세션의 `review/consistency/2026/08/20/{16_26_26,16_52_12,17_14_02}/convention_compliance.md` 3회 모두 위험도 NONE(위반 0)으로 판정했다. 이번 회차는 그 판정을 재확인하되, 이전 회차들이 `swagger.md` 를 §1-1/§1-5 관점으로만 인용하고 **§3 "주석/설명 톤" 의 길이 예외 조항**(2026-08-17 규약화)은 대조하지 않았던 지점을 추가로 짚는다. 직전 3커밋(`6f1d4d41d`·`fa4718df0`·`1539349f5`)은 테스트 전용이라 `spec/5-system/`·DTO 파일을 건드리지 않았으므로 아래 발견의 대상 코드는 라운드8 이후에도 그대로다.

## 발견사항

- **[WARNING]** `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 이 swagger.md §3 예외 조항의 "요약 1~2문장 + SoT 링크" 형식을 지키지 않는다 — 같은 diff 안 자매 DTO 는 정확히 그 형식으로 다듬어졌다
  - target 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` — `ExecutionDto.inputData` JSDoc(라인 ~48-63, 3문단+인용 블록), `NodeExecutionSummaryDto.inputData` JSDoc(라인 ~174-186, 2문단). 둘 다 `@ApiPropertyOptional({...})` 에 `description` 을 직접 주지 않아 `introspectComments: true` 로 이 JSDoc 전문이 그대로 Swagger `description` 이 된다.
  - 위반 규약: `spec/conventions/swagger.md` §3 "주석/설명 톤" — "DTO `description`은 10~40자 내외" 원칙에 이어 붙은 예외 조항: *"응답 값이 저장된 값과 다를 수 있는 필드(egress 마스킹 대상 등)는 위 길이 제한의 예외다 ... **다만 상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크로 적는다**."* 이 예외 조항은 2026-08-17 에 **바로 이 두 필드**(`execution-response.dto.ts`·`background-run-response.dto.ts`)를 실측 근거로 신설됐다고 조항 본문이 명시한다.
  - 상세: `ExecutionDto.inputData` JSDoc 은 주제문 1문단 뒤에 `> 2026-08-20 이전에는 이 컬럼만 카브아웃이었다 — Re-run 모달·에디터 "히스토리에서 불러오기" 가 읽어 그대로 재제출하므로 ...` 로 시작하는 **역사적 서술 인용 블록**을 통째로 담고 있다(현재 버전에서 문단이 하나 더 늘었다 — 이전엔 "이 카브아웃은 Execution 레벨 한정이다" 1문장이었다). `NodeExecutionSummaryDto.inputData` 도 "2026-08-20 이전에는 그쪽만 원문이었다 ... 프런트 마커 가드가 서면서 카브아웃이 닫혀 ..." 로 동일하게 히스토리를 나열한다. 반면 같은 diff 가 건드린 `BackgroundRunNodeExecutionDto.inputData`(`background-run-response.dto.ts` `@ApiPropertyOptional({ description: ... })`)는 이번 커밋에서 정확히 예외 조항의 형식대로 다듬어졌다 — *"입력 데이터 (JSON). 자격증명으로 판별된 값은 마스킹되어 반환된다(DB 원문과 다를 수 있음). `Execution.inputData` 도 2026-08-20 부터 같은 규칙이다 — 두 레벨이 갈리지 않는다. SoT: EIA §R17"* (2문장 + SoT 링크, 날짜만 남기고 카브아웃 배경사는 뺐다). 같은 커밋 안에서 한 DTO 는 규약이 요구하는 형태로 압축됐는데 다른 두 DTO 는 오히려 서술이 늘어나는 방향으로 갔다 — non-production 전용 Swagger UI(§0)라 외부 유출 위험은 아니지만, 예외 조항이 지목한 바로 그 취지("소비자가 OpenAPI 만 보고 통합할 때 필요한 최소 설명")에서 멀어진다.
  - 제안: 두 JSDoc 을 `BackgroundRunNodeExecutionDto.inputData` 와 동일한 압축 형태로 정리 — 주제문(마스킹 대상이다 + DB 원문과 다를 수 있다) 1문장 + SoT 링크(`EIA §R17`) 1문장으로 줄이고, "2026-08-20 이전에는 카브아웃이었다" 류 히스토리·`MASKED_INPUT_DATA_REASON` 참조 배경은 이미 그 목적으로 존재하는 `spec/5-system/14-external-interaction-api.md` Rationale(§R17 "잔여 ②")에 맡긴다. 규약 자체가 과도하다고 판단되면 대안으로 §3 예외 조항의 "1~2문장" 표현을 "핵심 caveat 2~3문장" 정도로 완화하는 조항 개정도 가능하나, 그 경우도 현재처럼 별도 인용 블록으로 전체 결정 이력을 반복하는 형태는 규약 개정 없이는 정당화되지 않는다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지 작업은 명명 규약(backend/frontend 마커 상수·함수명 정확 일치, `MASKED_INPUT_DATA_REASON` 잔여 참조 0건), 레이어 경계 규약(`masked-markers.ts` 를 `components/` 에서 `lib/utils/` 로 승격한 것이 `frontend-layering.md` §3 처방과 정확히 일치), i18n 규약(`runWithInputMasked`/`maskedInputBlocked` ko/en parity, dict 경유, 하드코딩 없음), spec-impl-evidence 규약(`code:` frontmatter 가 신규 구현 파일과 1:1 대응, `status: partial` + `pending_plans` 정합)을 모두 준수한다. 유일하게 발견한 지점은 API 문서 규약(`swagger.md` §3) 의 길이 예외 조항이 요구하는 "요약 1~2문장 + SoT 링크" 형식을 `execution-response.dto.ts` 의 두 `inputData` JSDoc 이 지키지 않는다는 것으로, 같은 커밋에서 자매 DTO(`background-run-response.dto.ts`)는 그 형식을 정확히 따랐다는 점에서 비일관성이 뚜렷하다. non-production 전용 노출이라 보안 임팩트는 없고 CRITICAL 로 볼 시스템 invariant 위반도 아니라 WARNING 으로 등급을 매긴다.

## 위험도

LOW
