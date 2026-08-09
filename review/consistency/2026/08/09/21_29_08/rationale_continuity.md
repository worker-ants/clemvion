# Rationale 연속성 검토 — spec-draft-secret-store-verification-footnote

## 검토 대상

- target: `plan/in-progress/spec-draft-secret-store-verification-footnote.md`
- 변경 지점: `spec/conventions/secret-store.md` §2.1 각주(†) 마지막 문단 ("알려진 검증 공백" → "검증은 두 층으로 갈라 고정한다")

## 실측 근거 (본 검토자가 직접 확인)

- `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts` 존재, `it(` 3건 확인 (target 의 claim 과 일치).
- `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts:317` — `expect(repo._lastDeleteQuery.condition).toBe('ref LIKE :prefix')` 존재, `ESCAPE` 부재 단언도 존재 (target 의 claim 과 일치).
- `plan/in-progress/backend-lint-gate-broken-on-main.md:332-340` — 이 정정을 이미 "철회 대기" 항목으로 명시한 선행 plan 존재. target 이 지어낸 이력이 아니라 실제 병렬 세션 경위(#1112/#1113)와 일치.
- `.claude/skills/project-planner/SKILL.md:35` — "옛 내용을 정리해 latest 만 남김 (history 가 아님)" 원칙 실재. target 의 "project-planner §5" 인용 정확 (작업 워크플로 5번째 항목).
- `spec/conventions/spec-impl-evidence.md:199` (R-1) — `code:` 글로브가 "영역 단위 책임"을 표현하며 명시 파일 나열을 요구하지 않는다는 target 의 claim과 일치.
- `.claude/hooks/_lib/review_guard.py:666` `_spec_linked_changes` — `code:` 글로브 매치 시 `--impl-done` 을 요구하는 게이트 로직 실재. target 의 "frontmatter 미변경" trade-off 판단 근거가 실측에 부합.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 Rationale 연속성 결함을 발견하지 못했다.

세부적으로 4개 검토 관점을 각각 적용한 결과:

1. **기각된 대안의 재도입** — 옛 각주가 이미 기각했던 "mock 에 LIKE 해석기를 심는" 대안을 target 이 재도입하지 않는다. 오히려 대체 문단이 그 기각 근거("테스트가 DB 를 흉내 내다 틀릴 위험")를 **그대로 보존**하며 명시적으로 반복 서술한다. target 의 draft-Rationale ("왜 `mock 에 LIKE 해석기` 기각 근거를 남기는가")이 이 저장소의 "`## Rationale` 에 기각된 대안을 남기는" 관행과 정합적으로 스스로를 근거 짓는다.

2. **합의된 원칙 위반** — `project-planner` 의 "latest-only" 원칙(SKILL.md §작업 워크플로 5번, `spec/0-overview.md` Rationale 서두의 동일 원칙)을 target 이 정확히 인용하고 따른다 ("정정 이력" 이 아니라 현재 상태로 교체). `spec-impl-evidence.md` R-1(글로브 허용 원칙)과도 충돌 없음 — frontmatter `code:` 를 건드리지 않는 선택이 이 원칙과 정합.

3. **결정의 무근거 번복** — 이 변경은 과거 아키텍처 결정의 번복이 아니다. `deleteByPrefix` 의 LIKE 메타문자 거부라는 핵심 invariant 는 그대로 유지되며, 바뀌는 것은 "검증이 아직 안 됐다" 는 시점부 캐버트(caveat) 뿐이다. 그 캐버트가 거짓이 된 이유(#1113 이 실제로 e2e+단위 연결점을 추가함)를 target 이 실측 근거(파일 존재, `it(` 개수, 쿼리 형태 단언)로 뒷받침한다 — "무근거" 가 아니다. 다만 이 저장소에는 "spec 서술이 코드와 어긋나 있었다" 류의 drift 를 정정할 때 `## Rationale` 에 날짜 붙은 정식 항목("### … 정정 (YYYY-MM-DD)")을 남기는 관행이 다수 존재한다 (예: `spec/1-data-model.md` "WorkflowVersion.snapshot 구성 서술 정정", `spec/5-system/1-auth.md` "§2.3 재인증 흐름 정합화"). 그러나 이번 건은 "spec 이 원래부터 틀렸던" drift 정정이 아니라 "작성 시점엔 참이었던 캐버트가 후속 작업으로 해소됨" 이라 성격이 다르고, 그 각주 자체가 이미 §2.1 본문 인라인에 위치하는(§2.1 전체가 결정 근거를 인라인 각주로 유지하는 기존 스타일) 선례를 따른다 — 새 결함이 아니라 #1112 가 세운 배치 스타일의 연속.

4. **암묵적 가정 충돌** — SS-SE 계열 보안 요구사항(§4)·`## Rationale` R1-R5 그 무엇도 이 각주 문단에 의존하지 않는다. `spec/` 전역에서 "알려진 검증 공백" 문구 또는 이 각주를 인용하는 다른 문서를 찾지 못했다(target 의 side-effect 체크리스트 항목이 실제로 빈 결과를 낼 것으로 예상되며, 이는 문제가 아니라 확인 결과다).

## 요약

target 은 순수한 시점부 캐버트 정정이며, 과거에 기각된 대안(mock LIKE 해석기)을 되살리지 않고 그 기각 근거를 오히려 명시적으로 보존한다. "latest-only" spec 작성 원칙과 `spec-code-paths`/`review_guard` 관련 trade-off 판단 모두 실제 코드·훅 로직으로 검증되어 근거가 있다. 저장소의 다른 "정정" 사례들과 달리 이번 건은 spec 이 애초에 틀렸던 경우가 아니라(작성 시점엔 참이었음) 후속 작업이 조건을 바꾼 경우라, `## Rationale` R1-R5 에 별도 날짜 항목을 추가하지 않은 선택도 기존 §2.1 인라인 각주 스타일과 정합적이다. Rationale 연속성 관점에서 우려할 결함을 발견하지 못했다.

## 위험도

NONE
