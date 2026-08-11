# Cross-Spec 일관성 검토 — `spec/conventions/spec-impl-evidence.md`

## 검토 범위 및 방법

target 은 `status: implemented` 인 기존 컨벤션 문서(신규 draft 라기보다 이미 rollout 된 규약)라, 단순 서술 검토를 넘어 다음을 실측했다:

- 참조하는 8개 build-time 가드 구현(`spec-frontmatter-parse.ts` + 8개 `*.test.ts`)을 실제로 `pnpm vitest run` 실행 → **8 files / 1136 tests 전부 green**.
- `INCLUDE_PREFIXES` / `EXCLUDE_BASENAMES` / `CATALOG_FIELD_FILE` 정규식을 소스에서 직접 대조.
- 상호 참조 문서(`.claude/docs/plan-lifecycle.md`, `spec/conventions/user-guide-evidence.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `PROJECT.md` §변경 유형 매핑·§자동 가드 표)와 날짜(cutoff `2026-06-04`)·용어(`archived` vs `deprecated`)·가드 소유권 서술을 교차 대조.
- `spec/**` 전체에서 frontmatter `id:` 중복 여부를 실측(uniq -d).

결과: 서술-구현 간 괴리는 발견되지 않았고(놀랍도록 최신 상태), 발견된 유일한 실질 이슈는 target 자신이 설명하는 규약이 `spec/4-nodes/**` 의 실제 데이터와 어긋나는 지점 하나다.

## 발견사항

- **[WARNING]** `id:` 필드가 실제로는 전역 유일하지 않다 — target 이 설명하는 충돌회피 관행이 6-way 충돌엔 적용되지 않음
  - target 위치: §2.1 필드 정의 표 (`id` — "spec 식별자") 및 각주 — "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다 (예: `agent-memory` → `nav-agent-memory`) — basename 불일치처럼 보여도 의도된 패턴"
  - 충돌 대상: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/2-flow/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/7-trigger/0-common.md` — 6개 파일 전부 `id: common` (`status: implemented`) 을 그대로 사용
  - 상세: target 은 `id:` 를 "spec 식별자" 로 정의하고, basename 충돌 시 영역 prefix 로 회피하는 것이 "의도된 패턴" 이라고 명시적으로 예시(`agent-memory`/`nav-agent-memory`)까지 든다. 그런데 정작 같은 `spec/4-nodes/**` 영역 안에서 basename 이 동일한 `0-common.md` 가 6곳에 존재하고, 전부 `id: common` 을 그대로 써서 실제로는 **6-way 충돌**이 방치돼 있다. `spec-frontmatter.test.ts` 를 직접 읽어 확인한 결과 `id:` 유일성을 검증하는 로직이 없어 이 충돌은 어떤 가드도 잡지 않는다. `agent-memory` 사례처럼 prefix 로 풀렸어야 할 패턴이 정작 이 문서가 관리하는 §1 대상 영역(`spec/4-nodes/**`) 안에서는 6번 반복 위반돼 있는데, target 은 이를 언급하지 않는다.
  - 제안: 다음 중 하나로 target §2.1 을 현실과 동기화한다 — (a) 6개 `0-common.md` 의 `id:` 를 `logic-common`/`flow-common`/`ai-common`/`integration-common`/`data-common`/`trigger-common` 등으로 영역 prefix 부여(agent-memory 패턴과 동형) 하고 target 각주에 이 케이스를 추가 사례로 반영, 또는 (b) `id:` 유일성이 실제로는 강제되지 않는 "권장" 수준임을 §2.1 에 명시하고 "의도된 패턴" 문구를 "권장 패턴(미강제)" 으로 낮춘다. 현재로선 기능적 영향(§3(d) `backlog` 로드맵 매칭 등)은 없지만, `id` 를 조회 키로 쓰는 향후 tooling 이 생기면 조용히 잘못된 항목을 가리킬 수 있다.

- **[INFO]** `PROJECT.md` 의 `spec-link-integrity.test.ts` 요약이 target 의 정밀 서술보다 좁게 적혀 있음
  - target 위치: §4.2 표 1행 — "**(1)** `spec/**.md` 본문, **및 (2)** codebase `.ts`/`.tsx` 소스 … 의 JSDoc·주석 — in-repo `[..](path)` 타깃 존재 + `#anchor` slug 대조" (target 필터 없이 spec 본문의 모든 in-repo 링크를 검사한다고 명시)
  - 충돌 대상: `PROJECT.md` 279행 — `plan-link-integrity.test.ts` 설명 중 "(`spec-link-integrity` 의 역방향 — 그쪽은 spec→plan 만 본다)"
  - 상세: 실제 구현(`spec-link-integrity.test.ts` 헤더 주석, 직접 확인)은 spec 본문의 **모든** in-repo 링크(§4.2 의 target 서술과 일치, plan 링크로 국한되지 않음)와 codebase JSDoc→spec 링크까지 검사한다. `PROJECT.md` 의 한 줄 요약은 "spec→plan 만 본다" 로 축약해 실제 범위보다 좁게 서술한다. target 문서 자체는 정확하므로 모순의 근원은 `PROJECT.md` 쪽 축약 서술이지만, 두 문서가 같은 가드를 다르게 설명하는 drift 이므로 기록해 둔다.
  - 제안: `PROJECT.md` 279행 표현을 target §4.2 표현("spec 본문 전체 in-repo 링크 + 코드 JSDoc→spec 링크")에 맞춰 다음 PROJECT.md 편집 시 동기화. 기능적 영향은 없음(설명 문구 차이일 뿐).

## 요약

target(`spec/conventions/spec-impl-evidence.md`)은 8개 참조 build-time 가드를 전부 실행해 검증한 결과 서술과 구현이 정확히 일치했고(1136 테스트 green), `INCLUDE_PREFIXES`/`EXCLUDE_BASENAMES`/`CATALOG_FIELD_FILE`/cutoff 날짜(`2026-06-04`)/`archived` vs cafe24 `deprecated` 용어 분리/R-7 카탈로그 제외 로직 등 다른 spec·convention·`PROJECT.md`·`plan-lifecycle.md` 와의 교차 참조 전부가 실측과 부합했다. 유일한 실질 이슈는 target 자신이 "의도된 패턴" 이라 서술한 `id:` basename-충돌 회피 관행이 `spec/4-nodes/**` 안에서 6개 `0-common.md` 파일에 대해서는 적용되지 않아 `id: common` 6-way 충돌이 방치돼 있다는 점이다(가드 미검증, 기능 영향 현재는 없음). 그 외엔 `PROJECT.md` 한 줄 요약의 사소한 서술 축약 정도만 발견됐다.

## 위험도
LOW
