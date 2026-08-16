# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위

diff-base `origin/main` 대비 변경분:
- `spec/5-system/14-external-interaction-api.md` (§7.1 triggerToken 비대상 각주 정정, §R17 "내부 읽기 경로도 같은 마스킹을 적용" 신규 불릿, frontmatter `code:` 2건 추가)
- `spec/5-system/6-websocket-protocol.md` (`execution.snapshot` 행에 nested `error` 마스킹 상속 각주 추가)
- 대응 구현: `codebase/backend/src/shared/utils/redact-stored-error.ts`(신규) · `codebase/backend/src/modules/executions/executions.service.ts` · `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` · 대응 DTO 2건

이 변경은 "종결 emit ↔ 그 밖의 모든 읽기 경로" 비대칭(직전 PR #1177/#1178 이 종결 emit 만 마스킹)을 내부 REST 읽기 경로(`findById`/`toExecutionDto`/`getChain`/`stop`) + WS `execution.snapshot` + background-runs 본문 노드까지 확장한 후속 PR이다.

## 발견사항

- **[INFO]** `secret-store.md §1` 인용에 앵커 누락 — 저장소 확립 패턴과의 사소한 불일치
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.1, `config.notification.signing.secretRef` 단락 — "`config.interaction.triggerToken` 는 JSONB 평문으로 보관하며, 이는 [`secret-store.md §1`](../conventions/secret-store.md) 의 **명시적 비대상 예외**다" 문장
  - 위반 규약: 명시적 컨벤션 조항은 아니고, 저장소 전반에서 **일관되게 관측되는 cross-reference 관행** — `spec/4-nodes/7-trigger/providers/discord.md:288`, `spec/4-nodes/7-trigger/providers/slack.md:266`, `spec/5-system/15-chat-channel.md:89` 세 곳 모두 동일 절을 인용할 때 `secret-store.md#1-uri-scheme` 로 **앵커까지 명시**한다
  - 상세: 이번에 추가된 링크는 텍스트로 "§1" 을 명시하면서도 href 는 앵커 없이 문서 전체(`../conventions/secret-store.md`)를 가리킨다. `spec-link-integrity.test.ts` 가드는 앵커가 없으면 slug 검증을 하지 않으므로 빌드는 깨지지 않지만(=INFO, WARNING 아님), 같은 절을 가리키는 기존 3개 레퍼런스와 형식이 다르다
  - 제안: `[secret-store.md §1](../conventions/secret-store.md#1-uri-scheme)` 로 앵커를 보강해 기존 3개 레퍼런스와 형식을 통일. (참고: 같은 diff 의 "EIA §R17" 비-앵커 인용(`6-websocket-protocol.md:182`, `12-background.md:246`)은 이 diff 이전부터 이미 저장소 전역에서 **비-앵커가 확립된 패턴**이므로 별도 지적 대상 아님 — R17 하위 불릿 다수라 안정적 slug 가 없는 사정과 대비됨)

## 준수 확인 (위반 아님, 근거 기록)

- **`secret-store.md`§1 "비대상" 등재 절차 준수**: `config.interaction.triggerToken` 평문 보관을 새 컨벤션이 아니라 **secret-store.md §1 "비대상" 블록 자체**(다른 worktree 에서 동시 편집 중, 별도 커밋 대상)에 근거를 두고, EIA 본문은 그 판단을 재서술하지 않고 SoT 로만 가리킨다 — secret-store.md 자신이 요구하는 "예외는 각각 자기 근거를 갖는다·이 블록을 선례로 인용하면 안 된다" 원칙과 일치.
- **frontmatter `code:` 등재 정확성** (`spec-impl-evidence.md` §2): `14-external-interaction-api.md` 는 새 유틸 `redact-stored-error.ts` 와 `executions.service.ts` 를 `code:` 에 추가했다. `background-runs.service.ts` 는 이 문서에 등재하지 않았지만, 새 R17 불릿이 그 표면을 "12-background.md §8.2 가 SoT" 라고 명시적으로 위임하고, 실제로 `spec/4-nodes/1-logic/12-background.md` 의 `code:` 가 `background-runs/**` 글로브 + `redact-stored-error.ts` 를 이미 보유 — 이중 등재 없이 정확히 분업됨.
- **Swagger DTO 컨벤션 (`swagger.md` §1-1 JSDoc 의무)**: `execution-response.dto.ts`(`ExecutionDto.error`, `NodeExecutionSummaryDto.error`) · `background-run-response.dto.ts`(`BackgroundRunNodeExecutionDto`) 세 필드 모두 마스킹 사실·SoT 링크를 담은 한국어 JSDoc/description 을 신규 부여 — §1-1 요건 충족.
- **`node-output.md` Principle 3.2 `output.error` 표준 형태와 충돌 없음**: `redactStoredErrorForResponse` 는 `deepRedactSecrets` 로 **문자열 leaf 값만** 치환하고 키·형태를 보존("형태는 바꾸지 않는다" 명시) — `code`(`UPPER_SNAKE_CASE`)·`details.retryable`(boolean)·`details.retryAfterSec`(number) 등 §3.2/§3.2.1 의 타입·invariant 는 영향받지 않는다.
- **문서 구조 컨벤션 (CLAUDE.md Overview/본문/Rationale)**: 두 target 문서 모두 기존 Overview → 본문(§1~§12) → `## Rationale` 3섹션 구조를 유지하며, 신규 내용은 기존 `### R17.` 노트(= Rationale 하위) 안에 불릿으로 추가 — 신규 최상위 섹션 난립 없음, 이 문서가 반복 채택해 온 "R-번호 캐비엇" 관행과 형식이 동일.
- **`spec/1-data-model.md` §2.14 인용 정확성**: "`Execution.error` 는 최초 failed `NodeExecution` 의 에러 정보를 복사" 라는 반복 인용(§R17 신규 불릿, DTO JSDoc, `redact-stored-error.ts` 주석)이 실제 §2.14 원문(line 561)과 일치 — 근거 없는 재서술 아님.
- **egress-only 원칙 재확인**: "DB 는 원문 보존" 캐비엇이 신규 불릿에도 반복돼, 기존 §R17 종결-emit 마스킹 결정과 동일 원칙선상에 있음을 명시 — 두 결정이 서로 다른 정책을 암묵적으로 세우지 않음.

## 요약

이번 diff(내부 읽기 경로 `Execution.error`/`NodeExecution.error` 마스킹 확장)는 `spec/conventions/` 규약을 폭넓게 잘 지킨다 — secret-store.md 의 SoT 위임 원칙, spec-impl-evidence.md 의 `code:` 등재 분업, swagger.md 의 DTO JSDoc 의무, node-output.md 의 에러 형태 invariant, CLAUDE.md 문서 3섹션 구조 모두 위반 없이 준수됐고 자매 표면(background-runs) 크로스링크도 양방향으로 정확하다. 유일하게 발견된 항목은 `secret-store.md §1` 인용에서 이 저장소가 세 곳에서 이미 확립한 `#1-uri-scheme` 앵커 관행을 따르지 않은 INFO 수준의 사소한 형식 불일치뿐이며, 빌드 가드(`spec-link-integrity.test.ts`)를 깨뜨리지 않는다. CRITICAL/WARNING 없음.

## 위험도

LOW
