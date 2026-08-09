# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-auth-invariants-sync.md`

## 검토 범위 및 방법

target 은 `spec/**` 를 편집할 **plan draft**(diff 제안 6건 + 원 plan 2건 체크박스 갱신)이며, 실제 spec 반영은 아직 이 plan 이 실행되지 않은 상태다. `spec/conventions/**` 번들 전체(대상 45개 파일)를 훑어, target 이 실제로 건드리는 영역(에러 코드 카탈로그, spec frontmatter evidence, secret-store)에 해당하는 정식 규약을 축으로 대조했다.

- 직접 관련: `error-codes.md`(항목 1·2), `spec-impl-evidence.md`(항목 3), `secret-store.md`(항목 6)
- 간접 관련(문서 구조): CLAUDE.md 의 Overview/본문/Rationale 3섹션 권장 + `## Rationale` 배치 규칙
- 무관 확인(훑고 배제): `audit-actions.md`, `swagger.md`, `chat-channel-adapter.md`, cafe24/makeshop 카탈로그류, `node-cancellation.md`, `execution-context.md`, `conversation-thread.md`, `rag-evaluation.md`, `interaction-type-registry.md`, `migrations.md`, `cross-node-warning-rules.md`, `data-hydration-surfaces.md`, `frontend-layering.md`, `i18n-userguide.md`, `cafe24-restricted-scopes.md` — target 이 DTO/decorator/webchat/i18n/RAG/노드 표면을 건드리지 않아 적용 대상 아님.

## 발견사항

- **[INFO]** 신설 카탈로그 행의 "코드 + scope 한정자" 셀 포맷이 `error-codes.md` 자체가 아니라 target 이 자체 인용한 로컬 선례(`3-error-handling.md` 의 `RESERVED_VARIABLE_NAME` 행)에 의존
  - target 위치: `## 1. 3-error-handling.md §1.3` 변경 1-b 의 신규 행 `VALIDATION_ERROR (X-Workspace-Id 형식)`, `## 왜 코드가 두 행에 나뉘는가` 각주
  - 위반 규약: 없음(직접 위반 아님) — 참고 규약은 `spec/conventions/error-codes.md §3`(historical-artifact 레지스트리는 코드 컬럼에 순수 코드값만 넣고 scope 한정은 "진실(의미)" 컬럼에 두는 패턴을 보임)
  - 상세: `error-codes.md` 는 카탈로그·트리거의 SoT 를 `3-error-handling.md §1`(conventions 밖 문서)에 명시적으로 위임하므로, 그 문서의 표 포맷 규칙은 본 conventions 번들에 없다. target 이 인용하는 "`RESERVED_VARIABLE_NAME` 행이 이미 `400 (저장) / — (런타임)` 로 scope 한정자를 코드 컬럼 옆에 쓴다" 는 주장은 이 번들로는 검증 불가(3-error-handling.md 미포함). `error-codes.md §3` 자체 레지스트리에서는 scope 한정 텍스트가 코드 컬럼이 아니라 "진실(의미)"/근거 컬럼에 있는 패턴(예: `invitation_not_found` 등 행의 "**초대 API 한정**" 문구)이라, 완전히 동일한 셀 배치 관례라 단정하기는 이르다.
  - 제안: 정보성 — 실제 반영(implementation) 시 `3-error-handling.md` 현재 `RESERVED_VARIABLE_NAME` 행의 정확한 셀 구조를 재확인해 동일 패턴인지 1회 확인 권장. 규약 위반 소지는 낮음(target 자체가 근거를 명시하고 있고, 코드 값 자체는 `VALIDATION_ERROR` 로 변경 없음 — `error-codes.md §2` 의 "이름 정확성 향상만을 위한 rename 금지, 의미 분기 시 신규 코드" 원칙과 충돌하지 않음).

- **[INFO]** target(plan 문서)에 spec 문서용 Overview/본문/Rationale 3섹션 강제가 문자 그대로 적용되는지는 별도 축
  - target 위치: 문서 전체 구조(`## Overview` → `## ⚠️ 착수 중 발견` → 항목 1~6 → `## 체크리스트` → `## 후속` → `## Rationale`)
  - 위반 규약: 해당 없음 — CLAUDE.md 의 3섹션 권장은 `spec/**` 문서 대상이며, target 은 `plan/in-progress/**` 문서로 plan-lifecycle 축(`.claude/docs/plan-lifecycle.md`, 본 conventions 번들 밖)이 SoT
  - 상세: 그럼에도 target 은 `## Overview` 로 시작해 `## Rationale` 로 끝나는 형태를 자연스럽게 따르고 있어 실질적으로 문제 없음. 오히려 target 이 실제 spec 반영을 제안하는 대목(항목 4·5)에서 정확히 "기존 `## Rationale` 섹션 말미에 신설 subsection 추가"(1-auth.md 의 기존 `### Production fail-closed 가드 …` 다음, 12-workspace.md 의 기존 `### URL slug = FE 라우팅 SoT` 다음) 형태로 CLAUDE.md 규칙("결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`")을 정확히 지킨다.
  - 제안: 조치 불필요 — 정보성 확인.

## 정합성 확인 (규약 준수가 확인된 지점 — 긍정 근거)

- **`error-codes.md` SoT 분리 원칙 준수**: `error-codes.md` 는 "카탈로그·분류·트리거 = `3-error-handling.md §1` (SoT)" 로 책임을 명시적으로 위임한다. target 항목 1·2 는 정확히 그 문서(`3-error-handling.md`, `15-chat-channel.md`)의 카탈로그 표만 편집하고, `error-codes.md` 자체(명명 규율 SoT)는 건드리지 않는다 — 책임 경계 준수.
- **신규 코드 미신설, rename 없음**: `error-codes.md §2` ("이름 정확성 향상만을 위한 rename 금지 / 의미 분기 시 신규 코드")를 target 은 명시적으로 준수한다 — 새 트리거 케이스를 기존 `VALIDATION_ERROR` 에 귀속시키고, 새 코드 신설을 "`#1108` 이 이미 기각했다" 고 스스로 인용하며 재확인한다(항목 1 각주).
- **`spec-impl-evidence.md §2.1`/R-1 (`code:` 글로브) 준수**: 항목 3 의 `1-auth.md` frontmatter `code:` 확장(`common/decorators/*.ts`, `common/utils/workspace-context.util.ts`, `common/utils/uuid.ts` 추가)은 글로브 허용 원칙(R-1)에 부합하고, `spec-code-paths.test.ts` 의 "≥1 매치 의무"(전수 매치 아님) 규칙을 정확히 인용한다(§3 표를 정확히 재인용).
- **`spec/data-flow/**` frontmatter 면제 인지**: 항목 4·5 는 `data-flow/12-workspace.md` 본문(`## Rationale`)만 편집하고 frontmatter 를 건드리지 않는다 — `spec-impl-evidence.md §1` 의 "`spec/data-flow/**` 는 frontmatter 의무 대상 아님(frontmatter 자체가 없다)" 규정과 정합.
- **기각된 대안 재확인, 재기각 없이 존중**: 항목 5(b) 는 `data-flow §Rationale "멤버십 검증은 가드 1곳에서"` 가 이미 기각한 "라우트별 opt-in 마커" 패턴을 실제 앵커로 인용하며 그 기각을 되돌리지 않는다고 명시 — 날조된 "기각된 대안" 이 아니라 실제 이력에 근거.
- **anchor slug 정확성**: 신설 subsection 2건(`12-workspace.md`, `1-auth.md`)의 heading 텍스트로부터 역산한 github-slugger 스타일 slug(`#x-workspace-id-헤더-vs-id-경로-파라미터--uuid-검증-강도-비대칭-2026-08-09`, `#부트-캐너리--workspaceid-reflection-자가검증-fail-closed-2026-08-09`)가 target 이 실제로 쓰는 앵커 문자열과 정확히 일치한다(em-dash·괄호·콤마·`@` 제거 후 이중 하이픈 패턴 포함) — `spec-link-integrity.test.ts` 가 요구하는 링크 무결성을 사전에 만족.
- **secret-store.md §2.1 정합**: 항목 6 의 diff 는 기존 "Trigger 삭제" 행 문구를 정확히 그대로 인용한 뒤 증분만 추가하고, 신설 각주가 §1 URI Scheme("`secret://<scope>/<resourceId>/<name>` 구조 자체가 메타문자를 배제")를 근거로 삼는다 — 문서 내부 정합.
- **plan frontmatter/Gate C**: target 자신의 frontmatter(`worktree`/`started`/`owner` 필수 필드 + `spec_impact` 리스트, bare string 이나 빈 배열 아님)가 `plan-frontmatter.test.ts`/Gate C 스키마에 부합하고, `spec_impact` 5개 경로가 실제로 항목 1~6 이 편집을 제안하는 spec 파일과 정확히 일치한다.

## 요약

target 은 `spec/conventions/error-codes.md`(SoT 분리·신규 코드 미신설·rename 금지 원칙), `spec/conventions/spec-impl-evidence.md`(글로브 `code:` 허용, `data-flow/**` frontmatter 면제, `partial`/`implemented` ≥1 매치 규칙 인용 정확성), `spec/conventions/secret-store.md`(§2.1 호출 규약 표 정합) 를 정밀하게 지키며, 실제 spec 반영 시 anchor slug 까지 사전 검증된 상태다. 유일한 지적 사항은 두 건 모두 INFO 수준으로, (1) 신규 에러 카탈로그 행의 셀 포맷 선례가 본 conventions 번들 밖 문서(`3-error-handling.md`)에 있어 이 번들만으로는 완전 검증이 불가하다는 절차적 한계, (2) plan 문서와 spec 문서의 3섹션 구조 강제 축이 다르다는 스코프 확인이며 둘 다 실질적 위반이 아니다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

LOW
