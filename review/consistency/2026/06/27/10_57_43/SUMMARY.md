# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불필요.

## 전체 위험도
**LOW** — WARNING 1건(5개 spec 파일 `## Overview` 섹션 누락), INFO 5건. Critical 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | 5개 spec 파일에서 `## Overview` 섹션 헤더 누락 — 3섹션 권장 구조(`Overview / 본문 / Rationale`) 중 1/3 일관 결여 | `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md` | CLAUDE.md "Spec 문서 3섹션 구성" 권장. `5-admin-console.md` 는 `## Overview (제품 정의)` 갖춤 | 각 파일의 numbered 첫 섹션 앞에 `## Overview` 추가 후 해당 spec 범위·목적을 1–3문장으로 요약 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `GlobalCall` 타입 신규 export됐으나 `2-sdk.md §5` 공개 타입 SoT 목록에 미등재 | `codebase/packages/web-chat-sdk/src/loader.ts` / `spec/7-channel-web-chat/2-sdk.md §5` | `2-sdk.md §5`에 "내부 큐 보조 타입 (노출됨)" footnote 추가 또는 `@internal` JSDoc 태그로 의도 명시 |
| I-2 | Rationale Continuity | `length > 32` 인자 상한 임계값이 spec 어디에도 근거 없는 암묵적 방어 상수 | `codebase/packages/web-chat-sdk/src/loader.ts` replay 루프 | named constant(`MAX_REPLAY_ARGS = 32`) 도입 또는 `2-sdk.md §R5`에 한 줄 rationale 추가 |
| I-3 | Convention Compliance | `spec/7-channel-web-chat/` id 값이 영역 prefix 형태(`web-chat-*`)로 basename 이탈 — 예외 허용 범위이나 명시적 근거 없음 | `spec/7-channel-web-chat/` 전체 frontmatter | 현행 허용 범위 내이므로 즉시 변경 불요. 향후 패턴 문서화 검토 |
| I-4 | Convention Compliance | `_product-overview.md` 첫 섹션이 `## Overview` 대신 `## 1. 개요 / 문제` | `spec/7-channel-web-chat/_product-overview.md` | `## Overview` 또는 `## Overview (제품 정의 및 문제)`로 헤더명 변경 검토 |
| I-5 | Naming Collision | `EmbedConfigSource`(AI 벡터 임베딩)와 `EmbedConfig*`(iframe 임베드 허용목록) 간 "embed" 의미 혼용 — TypeScript 식별자 충돌 없음, 기존 코드 관행 | `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` vs `codebase/backend/src/modules/hooks/embed-config.service.ts` | 별도 grooming 후보: `EmbedConfigSource` → `EmbeddingModelSource` 리네임으로 혼선 제거 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `GlobalCall` 타입 spec §5 미등재 (INFO). 6개 항목 일치 확인 (EIA 3값, REST 봉투, SSE 5분, retry_last_turn, RBAC, SDK 큐 replay spec 정합 복원) |
| Rationale Continuity | NONE | `length > 32` 상한 미문서화 (INFO). 기각 대안 재도입·합의 위반·invariant 우회 없음 |
| Convention Compliance | LOW | 5개 spec 파일 `## Overview` 누락 (WARNING). frontmatter 완비·pending_plans 실존 확인 |
| Plan Coherence | NONE | CRITICAL/WARNING 없음. spec §R5 요구사항과 구현 정합 복원 확인 |
| Naming Collision | NONE | `GlobalCall` 충돌 없음. 기존 `EmbedConfig*` 의미 혼용 INFO 지적 |

## 권장 조치사항

1. (WARNING 해소) `spec/7-channel-web-chat/0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md` 각각의 최상단 numbered 섹션 앞에 `## Overview` 섹션을 추가하고 해당 문서 범위·목적을 1–3문장으로 기재. `project-planner` 위임 사항 (spec 쓰기 권한).
2. (I-1 해소 권장) `spec/7-channel-web-chat/2-sdk.md §5`에 `GlobalCall`을 "내부 큐 보조 타입 (노출됨)" footnote로 추가하거나, `loader.ts`에 `@internal` JSDoc 태그 추가.
3. (I-2 해소 권장) `loader.ts`의 `32` 매직 넘버를 `MAX_REPLAY_ARGS = 32` named constant로 추출해 의도를 코드에서 자명하게 명시.
4. (I-4 선택적) `_product-overview.md` 첫 섹션 헤더를 `## Overview`로 통일.
5. (I-5 보류) `EmbedConfigSource` 리네임은 별도 grooming 티켓으로 이관. 이번 target 미도입 항목이므로 즉각 차단 불요.