# 정식 규약 준수 검토 — spec-draft-canary-count-relation

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 해당 사항 없음).

검토 근거:

1. **plan frontmatter 스키마** (`.claude/docs/plan-lifecycle.md §4`, spec-impl-evidence 가드 `plan-frontmatter.test.ts` 대상) — target 은 top-level `plan/in-progress/*.md` 로 필수 3필드(`worktree`/`started`/`owner`) 전부 보유, `title`/`status`/`priority`/`spec_impact` 등 허용된 추가 필드만 사용. `spec_impact` 는 (Gate C 가 요구하는 완료 시점 이전임에도) 이미 **리스트 형태**(`- spec/5-system/1-auth.md`)로 선언돼 있어 `feedback_stale_plan_claims_and_checklist_sync`/Gate C 흔한 실패형(bare string·빈 배열)을 선제 회피.

2. **삽입 위치·문서 구조** — 변경 대상 `spec/5-system/1-auth.md` 는 이미 frontmatter(`id: auth`, `status: partial`, `code:` 글로브에 `common/decorators/*.ts`·`common/guards/*.ts` 포함 — `workspace-reflection-canary.ts` 매치 확인함)를 보유한 spec-impl-evidence 적용 대상 문서이고, 삽입 지점은 문서 최상위 `## Rationale`(line 524) 하위의 기존 `### 부트 캐너리 …` 서브섹션 안 — CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 원칙 그대로 준수. 삽입 문단은 기존 절의 볼드-리드 프로즈 스타일(`**(a)…**`, `**알려진 한계**:`)을 그대로 이어받아 이질적 포맷 도입 없음.
   - 실제 삽입 지점("단언 대상은 …" 문단 뒤, "**알려진 한계**" 앞)을 대상 파일(`spec/5-system/1-auth.md:791-795`)에서 직접 대조 확인 — plan 서술과 실제 라인 순서가 일치.

3. **링크 무결성** (`spec-link-integrity.test.ts` 규약) — Overview 의 두 상대링크(`../../spec/5-system/1-auth.md`, `../../spec/data-flow/12-workspace.md`)는 `plan/in-progress/` 기준 경로 depth 가 정확하고, 두 대상 파일 모두 실존. 인용한 `§Rationale "73건"`/`§Rationale "부트 캐너리"` 는 앵커 링크가 아니라 서술적 인용이라 slug 불일치 리스크 없음. `data-flow/12-workspace.md` 의 "73건" 실측치는 실제로 `### 멤버십 검증은 가드 1곳에서 — @Roles() 와 무관 (2026-08-08)` Rationale 안에 존재함을 확인.

4. **금지 항목·명명 규약·출력 포맷 규약·API 문서 규약** — 대상 변경은 API/DTO/이벤트 페이로드/에러 코드/OpenAPI 데코레이터를 전혀 건드리지 않는 순수 서술 보강이라 해당 관점(§1·§2·§4)은 적용 대상 자체가 없음(N/A). 삽입 문단이 재사용하는 식별자(`@WorkspaceId()`, `handlerConsumesWorkspaceId`, `assertWorkspaceIdReflectionWorks`)는 모두 같은 문서 상단 §(a)에서 이미 쓰인 표기와 100% 일치 — 신조어·표기 흔들림 없음.

5. **단일 진실 원칙 (CLAUDE.md 정보 저장 위치 표)** — plan 의 Rationale 은 "왜 `1-auth.md` 한 곳인가"를 명시적으로 근거 짓고(같은 정정 문단을 `12-workspace.md` 에도 복제하면 차기 갱신 시 한쪽만 갱신되는 실패 클래스가 재발한다는 이유), 실제로 이 저장소가 그 실패를 두 차례 겪은 전례(nil-UUID 앵커 4곳 복제, #1112 두 곳 중 한 곳만 갱신)를 근거로 든다 — CLAUDE.md 의 단일 SoT 원칙과 정확히 부합하는 설계 결정이며 규약 위반이 아니다.

6. **게이트 명칭 정확성** — 체크리스트의 "게이트 — `spec-link-integrity` · Gate C · `plan-frontmatter`" 표기는 `spec/conventions/spec-impl-evidence.md §4.2` 표의 가드명(`spec-link-integrity.test.ts`/`Gate C`/`plan-frontmatter.test.ts`)과 정확히 일치.

7. **휘발성 수치 미기재 결정** — 삽입 문단이 "구체 수치는 여기 적지 않는다"고 명시하고 SoT 를 부팅 로그로 지정한 것은, `spec/conventions/spec-impl-evidence.md` 가 애초 `status`/TTL 로 spec 이 "조용히 낡는" 것을 막으려는 것과 같은 정신(변경 압력 없는 스냅샷 수치를 spec 본문에 박지 않음)이며, 규약이 금지하는 패턴을 답습하는 것이 아니라 오히려 그 정신을 능동적으로 지키는 방향.

## 요약

target 은 `spec/conventions/**` 이 명시하는 어떤 명명·출력 포맷·API 문서·문서 구조 규약도 위반하지 않는다. 대상이 API/DTO/이벤트 페이로드를 다루지 않는 순수 spec 서술 보강이라 §1·§2·§4 관점은 적용 대상이 없고(N/A), plan frontmatter 스키마(§4.2)·spec-impl-evidence 대상 파일의 frontmatter 정합·링크 무결성·삽입 위치(`## Rationale` 하위)는 모두 실측 대조로 확인했다. 삽입 문단이 자체적으로 밝히는 설계 근거(단일 SoT 유지, 휘발성 수치 미기재)도 CLAUDE.md 의 단일 진실 원칙과 정합적이다.

## 위험도
NONE
