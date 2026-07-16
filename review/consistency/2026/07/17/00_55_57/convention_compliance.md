# 정식 규약 준수 검토 — D1(⑦ Cafe24 D-2 명문화) + D2(⑧ Merge P2→P3 ADR)

## 검토 범위

target: 스크래치패드 spec draft (`spec-draft-d2-adr.md`) + 실제 적용된 diff 대조
(`git diff --cached spec/2-navigation/4-integration.md`, `spec/4-nodes/1-logic/11-merge.md`,
`plan/complete/merge-p2-async-fanin.md`, `plan/complete/eia-distributed-seq-counter.md`,
`plan/in-progress/cafe24-backlog-residual.md`). draft 와 실제 적용본은 내용이 일치함을 확인.

## 발견사항

- **[INFO]** Rationale 앵커 `R-adr-async-fanin` 접두 신설 — 기존 관례와 정합, 형식 SoT 부재
  - target 위치: D2 §변경 2-3, 실제 적용 `spec/4-nodes/1-logic/11-merge.md:226`
  - 위반 규약: 해당 없음 (참고 확인)
  - 상세: `spec/conventions/**` 어디에도 Rationale 앵커 명명 taxonomy(예: `R-N` vs `R-wontdo-*` vs
    `R-CC-*` vs `R-adr-*`)를 규정하는 정식 문서가 없다. 저장소 전수 검색 결과 이미 `R-wontdo-cached-capabilities`
    (`5-system/11-mcp-client.md`), `R-wontdo-rawws-rest`(`5-system/6-websocket-protocol.md`),
    `R-outbound-flood`/`R-replay-unavailable`(`5-system/14-external-interaction-api.md`), `R-K`(`5-system/15-chat-channel.md`)
    등 서술형 non-numeric 접두가 다수 선례로 존재한다. 신설 `R-adr-async-fanin` 은 이 관례의 자연스러운 연장이며
    본문 구조(**결정**/**근거**/**기각한 대안**/**재검토 트리거**)도 `R-wontdo-rawws-rest` 의 결정-근거-폐기대안 템플릿과
    형식이 일치한다. 검토 요청 관점 3("R-adr-* 접두가 기존 관례와 정합한가")에 대한 답: **정합** — CRITICAL/WARNING 대상 아님.
  - 제안: 위반 아님. 다만 `R-adr-*`/`R-wontdo-*` 류 서술형 접두가 계속 늘고 있으므로, 언젠가 `spec/conventions/`
    에 "Rationale 앵커 명명" 절을 신설해 (1) 순번형 `R-N`, (2) 결정 유형 접두(`R-wontdo-`/`R-adr-`), (3) 도메인
    접두(`R-CC-`/`R-D-`/`R-S-`) 3갈래를 명문화하면 향후 checker 가 참조할 SoT 가 생긴다 — 이번 draft 의 필수 조치는 아님.

- **[INFO]** `11-merge.md` 에 명시적 `## Overview` 헤딩 부재 — 형제 문서 관례와 일치, 위반 아님
  - target 위치: D2 §변경 2-3 (`## Rationale` 신설), 대상 파일 전체 구조
  - 위반 규약: `project-planner/SKILL.md` §Spec 문서 구조 (3섹션 권장: Overview/본문/Rationale)
  - 상세: `spec/4-nodes/1-logic/` 디렉토리의 13개 노드 spec 전부(`0-common.md` ~ `12-background.md`)가
    명시적 `## Overview` 헤딩 없이 인트로 단락으로 Overview 역할을 암묵 대체하는 동일 패턴을 쓴다. `11-merge.md`
    도 동일 패턴(L12 인트로 단락 → 본문(§1~§7) → 신설 `## Rationale`)이라 **디렉토리 관례와 일치**하며 3섹션
    권장을 어긴 것이 아니다. 오히려 신설 전에는 `## Rationale` 섹션 자체가 없어(본문 곳곳에 인라인 Rationale 파편만
    존재) 3섹션 권장을 **미충족한 상태**였고, 본 draft 가 이를 신설해 정합 상태로 이행시킨다 — 규약 준수 방향의 개선.
  - 제안: 조치 불요.

- **[INFO]** `spec/2-navigation/4-integration.md` frontmatter `code:` 가 새로 상세 인용된 processor/spec 경로를 커버하지 않음
  - target 위치: D1 (§10.5 신설 불릿), 실제 적용 `spec/2-navigation/4-integration.md:943`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface 의 구현 경로")
  - 상세: 신설 문단이 `cafe24-token-refresh.processor.ts` 의 `process()` re-throw invariant 와 회귀 테스트
    `cafe24-token-refresh.processor.spec.ts` `TEST-C2` 를 구체적으로 인용하지만, 이 두 파일은
    `codebase/backend/src/nodes/integration/cafe24/` 아래에 있고 현재 frontmatter `code:` 글로브
    (`codebase/backend/src/modules/integrations/**` 등, frontend 경로 다수)는 이 디렉토리를 커버하지 않는다.
    `spec-code-paths.test.ts` 가드는 `status: implemented` spec 의 글로브가 **≥1** 매치만 요구하므로 다른 glob
    항목으로 이미 통과하며 **build 는 깨지지 않는다** — CRITICAL/WARNING 대상 아님. 단, 이 gap 은 이번 draft 가
    새로 만든 것이 아니라 기존 frontmatter 의 pre-existing 상태(같은 파일 §11.1/§Rationale 다수 위치에서
    `cafe24-token-refresh` 큐·`Cafe24TokenRefreshProcessor` 를 이미 여러 번 인용하고 있었음)이며, 본 draft 는
    그 인용 밀도를 한 단계 더 높였을 뿐이다.
  - 제안: 조치 불요(빌드 비차단). 근거 추적성을 높이려면 추후 `code:` 에
    `codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` 를 명시 추가하는 것을
    권장(선택 사항, 이번 draft 범위 밖).

## 명명·출력 포맷·API 문서·금지 항목 점검 결과 (해당 없음)

- **명명 규약**: 신규 API endpoint·DB 컬럼·이벤트 페이로드 필드 없음. 유일한 신규 식별자는 위에서 다룬
  Rationale 앵커 `R-adr-async-fanin` 1건 — 관례 정합.
- **출력 포맷 규약**: draft 는 순수 산문 spec 명문화 + plan 상태 갱신이며 API 응답/이벤트 payload/에러 코드
  스키마 변경이 없다. `MERGE_TIMEOUT` 언급(§6 note)은 draft 이전부터 존재하던 미구현 예정 코드 서술을 그대로
  유지한 것으로, 이번 변경이 새로 도입한 코드가 아니다(`error-codes.md` 카탈로그 등재 대상 아님 — 미구현 상태 불변).
- **문서 구조 규약**: `_product-overview.md`/`0-` prefix 대상 파일 없음(둘 다 기존 numbered leaf spec 파일 본문
  수정). plan 이동(`merge-p2-async-fanin.md` → `plan/complete/`)은 `spec_impact:` frontmatter 를 정확히
  선언(`spec/4-nodes/1-logic/11-merge.md`)해 Gate C(`spec-impl-evidence.md` §4.2 R-8) 취지에 맞게 처리됨
  — grandfather 면제 대상(`started: 2026-05-11` < cutoff `2026-06-04`)임에도 자발적으로 선언한 것은 규약
  이상의 선제 조치.
- **API 문서 규약(OpenAPI/Swagger)**: 해당 변경 없음.
- **금지 항목**: `audit-actions.md`(인라인 action 문자열 금지)·`error-codes.md`(구현 세부를 이름에 박지 않기)
  등 관련 금지 규칙에 저촉되는 신규 표현 없음.

## 요약

D1(Cafe24 `cafe24-token-refresh` 에러 격리 정책 명문화)과 D2(Merge dormant 표기 P2→P3 격하 + `## Rationale`
신설)는 명명·출력 포맷·문서 구조·API 문서·금지 항목의 5개 관점에서 `spec/conventions/**` 를 직접 위반하는
지점이 없다. 신설 Rationale 앵커 `R-adr-async-fanin` 은 저장소에 이미 존재하는 서술형 `R-wontdo-*`/`R-CC-*`
류 접두 관례의 연장이며 구조(결정/근거/기각한 대안/재검토 트리거)도 선례 템플릿과 일치한다. `11-merge.md` 의
`## Rationale` 신설은 3섹션 권장을 오히려 더 충족시키는 방향의 개선이다. 유일한 관찰 사항은 `4-integration.md`
frontmatter `code:` 가 새로 구체 인용된 `cafe24-token-refresh.processor.*` 경로를 명시 커버하지 않는다는
pre-existing gap(빌드 비차단, INFO)뿐이다.

## 위험도

NONE
