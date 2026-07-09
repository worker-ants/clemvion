### 발견사항

- **[INFO]** Rationale 연속성 검토 대상 spec 파일이 payload 에 누락 — 직접 재확인으로 대체
  - target 위치: 본 checker 에 전달된 "Target 문서" 섹션 (`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 전체 덤프)
  - 과거 결정 출처: 해당 없음 (payload 구성 문제)
  - 상세: 이번 diff(`codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` · `use-expression-context.ts` · 신규 테스트 · `plan/in-progress/expression-enricher-dry.md`)가 실제로 관련된 spec 문서는 `spec/5-system/5-expression-language.md`(plan frontmatter `spec_area` 도 이를 명시)인데, 본 checker 에 전달된 target 페이로드에는 이 파일이 전혀 포함되지 않고 무관한 `1-auth.md`·`10-graph-rag.md` 전문만 담겨 있었다. `git -C <worktree> diff origin/main --stat -- spec/5-system/` 확인 결과 이번 PR 은 spec/5-system 하위 어떤 파일도 변경하지 않았다(순수 코드 리팩터). 이 orchestrator target 오선정은 `plan/in-progress/expression-enricher-dry.md` §워크플로 체크에 "orchestrator target 오선정(무관 문서 평가)" 로 impl-prep 단계에서도 동일하게 관찰·기록된 재발 이슈다. 본 checker 는 이를 인지하고 실제 관련 파일(`spec/5-system/5-expression-language.md`, 특히 §7.2 "config 기반 스키마 보강 (enricher)" 및 그 `## Rationale`)을 워크트리 절대경로로 직접 재확인해 검토를 수행했다.
  - 제안: consistency-check orchestrator 의 `--impl-done` 페이로드 빌더가 spec frontmatter `code:` glob 매칭 또는 diff 파일 경로 기반으로 target 파일을 선정하도록 재점검 권장(별도 tooling 이슈, 본 PR 차단 사유 아님).

### (참고) 실제 관련 spec/코드 대조 결과 — 위반 없음

`spec/5-system/5-expression-language.md` §7.2 표(5개 노드 타입 `information_extractor`/`form`/`table`/`transform`/`manual_trigger` 및 각 투영 규칙)와 그 `## Rationale`(`$trigger`/`$env` 런타임 주입, 2026-07-07 결정)을 직접 열람한 결과, 본 diff 와 관련된 기존 결정·원칙은 없다. `node-output-schema-enrichers.ts`/`use-expression-context.ts` 변경은 5개 enricher 의 공통 골격(`cloneSchema`/`collectProps`/`getOrCreateObjectChild`/`mergeLeafProps`/`enrichByProjecting`)을 추출하고 `if/else` 5-way dispatch 를 `OUTPUT_SCHEMA_ENRICHERS`(null-proto + frozen) 레지스트리로 대체한 **순수 내부 리팩터**로, `plan/in-progress/expression-enricher-dry.md` 가 명시하듯 "spec·런타임·백엔드·사용자 가시 동작 무변경"을 목표로 하며 기존 테스트 전수(신규 33줄 추가만, 삭제 없음)를 회귀 게이트로 사용했다. §7.2 표가 기술하는 5개 노드 타입·투영 대상(`.output.result.extracted.<name>` 등)은 코드상 그대로 보존되어 있어 spec 서술과 구현이 계속 일치한다. 이 리팩터는 spec 문서 어디의 `## Rationale` 에도 기각된 적 없는 새로운 구현 세부사항이며, 기존에 합의된 원칙(예: `EXPRESSION_EXCLUSIONS` 단일 SoT, prototype-pollution 안전장치 `isSafeFieldName`)을 그대로 재사용·강화(null-proto 레지스트리로 prototype-key dispatch 추가 차단)했을 뿐 우회하지 않는다.

### 요약
이번 PR 은 spec/5-system 하위 문서를 전혀 변경하지 않는 순수 프론트엔드 내부 리팩터(behavior-preserving DRY)이며, 실제로 관련된 `spec/5-system/5-expression-language.md`(§7.2 및 그 Rationale)와 대조해도 과거 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 등 Rationale 연속성 문제는 발견되지 않았다. 다만 본 checker 에 전달된 target 페이로드가 실제 관련 spec 파일을 누락하고 무관한 두 파일(1-auth.md, 10-graph-rag.md)만 담고 있었던 것은 orchestrator payload 구성의 재발성 결함으로, 별도 tooling 이슈로 보고할 가치가 있다(PR 자체를 막을 사유는 아님).

### 위험도
NONE