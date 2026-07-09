# Cross-Spec 일관성 검토 — cross_spec

## 사전 확인 (payload 신뢰성)

`prompt_file` 이 선언한 "target 문서" (`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 전문 +
`0-overview.md`/`1-data-model.md` 등 참조 덤프, line 2437 지점에서 size cap 으로 truncate)는 이번
작업(`expression-enricher-dry`, worktree `expression-enricher-dry-fbb5ce`)의 실제 diff 와 **무관**하다.
직접 검증 결과:

```
git diff origin/main --stat
 .../__tests__/node-output-schema-enrichers.test.ts |  33 ++
 .../expression/node-output-schema-enrichers.ts     | 518 +++++++++++----------
 .../editor/expression/use-expression-context.ts    |  46 +-
 plan/in-progress/expression-enricher-dry.md        |  55 +++

git diff origin/main --stat -- spec/   → (출력 없음, spec/** 변경 0건)
```

`plan/in-progress/expression-enricher-dry.md` 의 `spec_area:` 는
`spec/5-system/5-expression-language.md` 이며, 그 파일의 `code:` frontmatter
(`codebase/frontend/src/components/editor/expression/*.{ts,tsx}`)가 실제 변경 파일과 일치한다.
그런데 `meta.json` 의 `target_path` 는 `"spec/5-system/"` (디렉터리 전체)로 넓게 잡혔고, 프롬프트
생성기가 그 디렉터리를 사전순으로 순회하며 `1-auth.md`→`10-graph-rag.md` 순으로 파일을 나열하다
size cap 에 걸려 정작 code-glob 이 실제로 가리키는 `5-expression-language.md`(사전순으로 `4-`와
`6-` 사이, 즉 훨씬 뒤)는 한 줄도 포함되지 못한 채 truncate 됐다. 이 payload 로는 "target 문서 vs
다른 영역" 비교 자체가 성립하지 않는다.

이 결함은 신규가 아니다 — 같은 plan 의 `--impl-prep` 체크리스트 항목에 이미 동일 증상이
기록되어 있다: *"orchestrator target 오선정(무관 문서 평가) + 3파일 FS-flakiness 있었으나
behavior-preserving 순수 리팩터라 위반 여지 없음"*. 이번 `--impl-done` 실행에서 동일한 오선정이
재발했다.

## 실제 diff 기반 직접 검증 (payload 대신 워킹트리 diff 로 대체 분석)

`git -C <worktree> diff origin/main` 을 직접 읽어 6개 관점을 적용:

1. **데이터 모델 충돌** — 없음. `node-output-schema-enrichers.ts`/`use-expression-context.ts` 변경은
   프론트엔드 전용 autocomplete 힌트 생성 로직의 내부 구조 재배열(`cloneSchema`/`collectProps`/
   `getOrCreateObjectChild`/`mergeLeafProps`/`enrichByProjecting` 공용 헬퍼 추출 + `OUTPUT_SCHEMA_ENRICHERS`
   dispatch 테이블)이다. 각 enricher 가 project 하는 필드 경로(`output.result.extracted.*`,
   `output.interaction.data.*`, `output.rows.items.*`, `output.parameters.*`, Transform 의 top-level
   교체)는 리팩터 전후 동일 — diff 자체가 골격 추출이며 값 매핑 로직은 그대로 이동됐다. 신규
   엔티티·필드 선언 없음.
2. **API 계약 충돌** — 없음. 백엔드 endpoint·request/response 변경 없음 (프론트엔드 전용,
   `spec/**` 변경 0건).
3. **요구사항 ID 충돌** — 없음. 신규 요구사항 ID 부여 없음 (`spec/5-system/5-expression-language.md`
   자체가 diff 에 없음).
4. **상태 전이 충돌** — 해당 없음.
5. **권한·RBAC 충돌** — 해당 없음.
6. **계층 책임 충돌** — 없음. `OUTPUT_SCHEMA_ENRICHERS` 는 null-prototype + `Object.freeze` 로 구성돼
   prototype-key dispatch 위협을 차단하며(ai-review W1 후속), 프론트엔드 전용 계층 내부 재배치일 뿐
   프론트/백엔드 경계나 모듈 책임 분할을 바꾸지 않는다. `plan/in-progress/expression-enricher-dry.md`
   에 "spec·런타임·백엔드·사용자 가시 동작 무변경" 으로 명시되어 있고, 기존 테스트 248건 전수 통과가
   behavior-preserving 을 보증한다고 계획서에 기록됨 — diff 상으로도 로직 이동만 확인되고 값 계산
   분기(safe-name 필터, 타입 매핑, `{{` 표현식 스킵 등)는 그대로다.

`spec/5-system/5-expression-language.md` 자체는 이번 PR 에서 전혀 수정되지 않았으므로, 검토 대상인
"target 문서(draft)" 가 사실상 존재하지 않는다 — cross-spec 비교의 전제(신규/변경된 spec 서술)가
충족되지 않는다.

## 발견사항

- **[WARNING] Orchestrator target 오선정 재발 — payload 무효**
  - target 위치: `meta.json.target_path = "spec/5-system/"` (디렉터리 스코프), 실제 dump 는
    `1-auth.md`+`10-graph-rag.md`+참조 파일 일부 후 size-cap truncate
  - 충돌 대상: 없음 (payload 자체가 이 작업과 무관한 파일을 담고 있어 비교 불가)
  - 상세: code-glob 매칭 대상은 `spec/5-system/5-expression-language.md` 인데 프롬프트 생성이
    디렉터리를 사전순 순회하며 앞쪽 두 파일(`1-auth.md`, `10-graph-rag.md`)만 온전히 담고 정작
    필요한 파일은 truncate 이전에 도달하지 못했다. `plan/in-progress/expression-enricher-dry.md`
    의 `--impl-prep` 체크리스트에 이미 동일 증상이 "오선정" 으로 기록돼 있어 재발성 이슈다.
  - 제안: (a) 이번 게이트는 워킹트리 직접 diff 로 대체 검증 완료 — 실질 위반 없음 확인. (b)
    orchestrator 의 target 선정 로직을 "디렉터리 전체 사전순 dump" 대신 "code-glob 매칭된 spec
    파일만 우선 포함" 으로 고치는 것을 권장 (별도 tooling 이슈로 추적, 이 PR 의 병합을 막을 사유는
    아님).

- 그 외 CRITICAL/WARNING/INFO 없음 — 실제 diff 는 `spec/**` 변경 0건의 순수 프론트엔드 내부
  리팩터이며, 6개 관점 어디에서도 다른 spec 영역과의 모순을 만들지 않는다.

## 요약

이번 세션에 전달된 `cross_spec` payload 는 orchestrator 의 target 선정 결함(디렉터리 사전순
truncate)으로 인해 실제 변경과 무관한 `spec/5-system/1-auth.md`·`10-graph-rag.md` 를 "target
문서" 로 잘못 담고 있어 그대로는 유효한 cross-spec 비교를 수행할 수 없었다. 이를 보완하기 위해
워킹트리(`expression-enricher-dry-fbb5ce`)의 실제 `git diff origin/main` 을 직접 확인한 결과,
이번 변경은 `codebase/frontend/src/components/editor/expression/{node-output-schema-enrichers.ts,
use-expression-context.ts}` 의 순수 DRY 리팩터(behavior-preserving, `spec/**` 변경 0건)로,
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 충돌할
표면이 없다. payload 결함 자체는 이번 PR 의 병합을 막을 사유가 아니며 tooling 개선 항목으로
남긴다.

## 위험도

NONE
