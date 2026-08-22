# 정식 규약 준수 검토 — `codebase/backend/src/shared/utils/`

검토 모드: `--impl-prep` (구현 착수 전 검토). 대상 디렉토리는 8개 유틸 파일
(`bcrypt-format.ts`, `redact-stored-error.ts`, `retry-after.ts`, `sanitize-error-message.ts`,
`strip-external-only-fields.ts`, `terminal-duration.ts`, `terminal-error-payload.ts` + 각 `.spec.ts`).
"구현 대상 영역" 본문이 `(없음)` 으로 비어 있어(연결된 plan 문서 미발견 — `grep -rl "depth boundary" plan/`
0건), 신규 diff 대비 검토가 아니라 **착수 전 현재 상태**를 `spec/conventions/**` 대비 점검했다.

## 발견사항

- **[WARNING]** egress 마스킹의 마커 집합·깊이 상한·경계 연산자 불변식이 정식 conventions 문서 없이 코드 JSDoc 에만 흩어져 있음
  - target 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`MAX_REDACT_DEPTH`, `deepRedactCore` 경계 `depth >= MAX_REDACT_DEPTH`), `strip-external-only-fields.ts` (`stripDeep` 경계 `depth > maxDepth`, "경계 연산자는 이 함수가 `>` 로 고정한다 — 자매와 다를 수 있다" 절), `codebase/packages/masked-markers/src/index.ts` (`MAX_MASK_DEPTH`, `MASKED_MARKERS`)
  - 위반 규약: 직접 위반은 아님 — `spec/conventions/audit-actions.md` Rationale "왜 시제를 한 규약으로 묶는가" 및 `spec/conventions/error-codes.md` Overview 의 책임분리 패턴("표기 규약은 산문에 흩어지면 도메인이 늘수록 표류하기 쉬우므로 단일 conventions 문서로 통합")과 **같은 형태의 drift 가 이미 이 영역에서 실측됨**
  - 상세: 마스킹 마커 3종(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`)·깊이 상한(`MAX_MASK_DEPTH`=10)·경계 비교 연산자(REST 계열 `deepRedactSecrets`/`reject-masked-resubmission.ts`는 `>=`, `stripExternalOnlyFields`/WS `sanitizePayloadForWs`는 `>`)라는 하나의 cross-module invariant 가 최소 5개 파일(백엔드 `shared/utils/sanitize-error-message.ts`, `shared/utils/strip-external-only-fields.ts`, `modules/websocket/websocket.service.ts`, `modules/execution-engine/utils/reject-masked-resubmission.ts`, `modules/external-interaction/interaction.service.ts` + 프런트 `masked-markers.ts`)에 걸쳐 있다. 현재 SoT는 `spec/conventions/` 가 아니라 `codebase/packages/masked-markers/src/index.ts` 의 JSDoc(코드 주석)과 `spec/5-system/14-external-interaction-api.md` §R17 산문에 나뉘어 있다. `masked-markers/src/index.ts` 자체 주석이 "두 소비 관점이 각각 다른 이름을 쓰고 있었다 — `MAX_REDACT_DEPTH` vs `MAX_MARKER_SCAN_DEPTH`" 라고 실제 drift 이력을 적어 두었고, `strip-external-only-fields.ts` 도 "초판 JSDoc 은 호출부가 자매와 같은 경계 연산자를 쓴다고 적었는데 실제로는 갈려 있었다"(`14_30_35` W3)는 과거 문서-구현 불일치를 자인한다. 이는 `audit-actions.md`/`error-codes.md` 가 각각 승격 사유로 든 "도메인이 늘수록 산문 규약은 표류" 패턴과 정확히 동형이다. 현재 브랜치명(`backend-redact-depth-boundary`)이 바로 이 깊이-경계 영역을 다시 손댈 예정임을 시사하므로, conventions 승격 없이 진행하면 동일 drift(스캐너 상한 오독·경계 연산자 오정렬)가 6번째 파일에서 재발할 위험이 있다.
  - 제안: 착수 전 `spec/conventions/egress-masking.md`(가칭)를 신설해 ① 마커 3종의 의미·소유 판정기, ② `MAX_MASK_DEPTH`/로컬 별칭 목록과 "중립 이름이 정본" 원칙, ③ 소비자별 경계 연산자(`>` vs `>=`)와 그 정당화, ④ 마커 재마스킹 금지(멱등성) 규칙을 단일 문서로 승격할 것을 권고. 다만 이는 **규약 갱신이 적절한 사안**이며 현재 코드 자체가 규약을 어긴 것은 아니므로 WARNING 등급으로 분류했다 — 승격 여부는 project-planner 판단 사항.

- **[INFO]** 위 invariant 를 다루는 파일들의 JSDoc 상호 참조는 매우 촘촘하나, 그 상호 참조가 코드 주석에만 존재해 `grep spec/conventions` 로는 발견되지 않음
  - target 위치: 해당 없음(문서화 위치 자체의 이슈)
  - 위반 규약: 없음(단순 검색성 제안)
  - 상세: `error-codes.md`/`audit-actions.md` 등 기존 conventions 문서는 frontmatter `code:` 필드로 대표 구현 파일을 역참조해 "코드 검색 없이 문서만 봐도 SoT 소재를 안다"는 패턴을 쓴다. 현재는 이 마스킹 invariant 를 알려면 `sanitize-error-message.ts`/`strip-external-only-fields.ts`/`masked-markers/src/index.ts` 세 파일을 직접 열어야 한다.
  - 제안: 위 WARNING 이 채택되어 conventions 문서가 신설된다면 `spec-impl-evidence.md` 패턴대로 frontmatter `code:` 에 이 3+2 파일을 등재해 두면 향후 검토 시 탐색 비용이 준다.

- 나머지 항목(명명 규약 / 출력 포맷 규약 / API 문서 규약 / 금지 항목) 은 위반 없음을 확인
  - 파일명: 전부 kebab-case, 모듈 성격에 맞는 이름(`redact-stored-error.ts`, `terminal-error-payload.ts` 등) — 프로젝트 관례와 일치.
  - `TerminalErrorPayload.code`/`redact-stored-error.ts` 가 다루는 `Execution.error.code` 값은 `spec/conventions/error-codes.md` §1 `UPPER_SNAKE_CASE` 원칙과 정합(본 디렉토리는 값을 생성하지 않고 통과·마스킹만 함).
  - `@workflow/masked-markers` 패키지명은 `codebase/packages/` 의 기존 스코프 규약(`@workflow/*`, 예: `@workflow/ai-end-reason`)과 일치.
  - 마커 상수 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MAX_MASK_DEPTH`/`MASKED_MARKERS` 는 SoT(`@workflow/masked-markers`)에서 재export 만 하며(`14-external-interaction-api.md` "2026-08-21 이관" 및 관련 rationale 과 정합), 로컬 재선언(fork)이 없음.
  - 본 디렉토리는 controller/DTO 를 포함하지 않아 API 문서 규약(`spec/conventions/swagger.md` 데코레이터 패턴)은 적용 대상 아님(N/A) — `TerminalErrorPayload` 는 WS/event emit 전용 plain interface 이고 `@ApiProperty` 데코레이터 대상 REST DTO 로 쓰이지 않음(실측: 소비처가 `websocket.service.ts`/`chat-channel.dispatcher.ts`/`execution-engine.service.ts` 등 이벤트 emit 경로뿐).
  - 문서 구조 규약(Overview/본문/Rationale, `_product-overview.md`, `0-` prefix)은 대상 디렉토리에 `.md` 파일이 없어 N/A.
  - `secret-store.md` 의 금지 항목(SS-SE-01/02 등)은 자격증명 **저장** 계층 대상이며 본 디렉토리는 egress **마스킹**만 다뤄 대상 영역이 다름 — 위반 아님.

## 요약

`codebase/backend/src/shared/utils/`(특히 `sanitize-error-message.ts`/`redact-stored-error.ts`/`terminal-error-payload.ts`/`strip-external-only-fields.ts`)는 명명·마커 SoT·egress-only 원칙·§R17/§6.4 스펙 인용이 매우 촘촘해 현재 `spec/conventions/**` 대비 직접 위반은 발견되지 않았다. 다만 브랜치가 다루려는 "깊이 경계(depth boundary)" 자체는 이미 5개 이상 파일에 걸친 cross-module invariant 이고, 그 SoT 가 conventions 문서가 아니라 코드 JSDoc 산문(+시스템 spec 산문)에 머물러 있어 `error-codes.md`/`audit-actions.md` 가 스스로 기록한 "산문 규약은 도메인이 늘수록 표류한다" 패턴에 이미 한 번(마커 이름 불일치) 걸린 이력이 있다. 착수 전 conventions 승격 여부를 project-planner 에게 확인받는 편이 이번 브랜치 작업의 재발 방지에 유리하다.

## 위험도

LOW
