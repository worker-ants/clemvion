# Rationale 연속성 검토 결과

## 발견사항

- **[WARNING]** target payload 범위 불일치 — 실제 구현 대상 spec 파일이 전달되지 않음
  - target 위치: 본 checker 에 전달된 `prompt_file` 의 "Target 문서" 섹션 — `spec/5-system/1-auth.md`(전체) + `spec/5-system/10-graph-rag.md`(§5 API 도중까지, 이후 "truncated due to size limit") 만 포함됨. 두 파일 다음 이어지는 "## 관련 Rationale 발췌" 섹션도 `spec/5-system/` 외부(0-overview·1-data-model·2-navigation/*) 문서만 나열한다.
  - 과거 결정 출처: 해당 없음 (프로세스 관측 — Rationale 위반이 아니라 checker 파이프라인 구성 이슈).
  - 상세: `plan/in-progress/suggestions-prefix-dry.md` 의 `spec_area: spec/5-system/5-expression-language.md` 가 이번 작업의 실제 대상이다. 그러나 `spec/5-system/` 디렉터리의 파일 목록을 알파벳순으로 나열하면 `1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`, … `4-execution-engine.md`(대용량) 다음에야 `5-expression-language.md` 가 나온다. orchestrator 가 "구현 대상 영역: `spec/5-system/`" 라며 폴더 전체를 알파벳순으로 이어붙이다 크기 제한(payload 자체에 "... (truncated due to size limit)" 리터럴 마커가 두 번 박혀 있음)에 걸려 `5-expression-language.md` 도달 전에 잘렸다. 결과적으로 이 작업과 무관한 두 파일(`1-auth.md`, `10-graph-rag.md`)만 근거로 Rationale 연속성을 판단하라는 입력이 구성된 셈이라, payload 만으로는 실제 변경과 관련된 Rationale 대조가 원천적으로 불가능하다.
  - 제안: impl-prep payload 조립 로직이 `plan/in-progress/*.md` 의 `spec_area` frontmatter를 우선 포함하도록 target 선정 순서를 바꾸거나(예: spec_area 파일을 맨 앞에 배치 후 나머지로 확장), 크기 제한에 걸릴 경우 spec_area 파일이 누락되지 않았는지 assembly 단계에서 검증하는 가드를 추가할 것을 권장한다. 본 검토에서는 파일시스템 직접 접근으로 실제 대상 파일을 별도로 읽어 아래 항목으로 보완했다.

- **[INFO]** 실제 구현 대상(`5-expression-language.md` + `use-expression-suggestions.ts` 리팩터) 직접 확인 — Rationale 연속성 이상 없음
  - target 위치: `spec/5-system/5-expression-language.md` §7.1 "트리거 조건" / §7.2 "자동완성 데이터 소스" / §8.4.2 "자동완성" 표 + 문서 말미 `## Rationale`(§`$trigger`/`$env` 런타임 주입, 2026-07-07 결정 1건뿐); 코드 diff `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts`(`NESTED_DRILL_SOURCES` 테이블 + 단일 loop 도입, `$input.`/`$params.`/`$sourceItem.`/`$dataSource.` 4개 if-block 대체).
  - 과거 결정 출처: `spec/5-system/5-expression-language.md` `## Rationale` — 자동완성 내부 dispatch 구조(if-block 나열 vs 테이블+공통 핸들러)에 대한 결정 기록이 존재하지 않음(spec 은 "무엇을 제안하는가" 행동 계약만 규정하고 "어떻게 구현하는가"는 범위 밖). 인접 선례: git 커밋 `c417bd299`/`709650032`("refactor(expression): enricher 공통 헬퍼 + `OUTPUT_SCHEMA_ENRICHERS` 디스패치 테이블", PR #880) — 같은 파일군(`node-output-schema-enrichers.ts`)에서 동형 "prefix/키 → getter 테이블 + 단일 dispatcher" 패턴을 이미 도입해 병합 완료(`consistency-check`/`ai-review` 0 Critical, `b7f6f0b02` 산출물).
  - 상세: `plan/in-progress/suggestions-prefix-dry.md` 가 제안한 "`NESTED_DRILL_SOURCES` 테이블 + 단일 loop" 리팩터는 (a) spec §7.1/§7.2/§8.4.2 가 규정하는 prefix→소스 매핑(`$input.`→직전 노드 출력, `$params.`→`$input.parameters` 단축, `$sourceItem.`/`$dataSource.`→Table 노드 한정 컨텍스트)을 그대로 보존하고, (b) `$sourceItem.`/`$dataSource.` 의 "소스 미가용 시 조건 자체가 성립하지 않아 아래 root-변수 목록으로 흘러야 하는" 기존 동작을 `available` 게이트 함수로 정확히 재현한다(diff 주석 "mirrors the old `&& expressionData.sourceItemSample` so a missing sample falls through" 확인). spec Rationale 에 이 dispatch 구조 자체를 다른 방식으로 결정했다는 기록이 없으므로 "기각된 대안의 재도입"에 해당하지 않으며, 오히려 이미 승인·병합된 동형 패턴(#880)을 명시적으로 선례로 인용하는 리팩터라 저장소 관행과 정합적이다. 실제 git diff 를 확인한 결과 4개 if-block → 단일 loop 전환 외 로직·순서 변경은 없다(behavior-preserving, plan 이 명시한 "기존 테스트 전수 통과 = behavior 보증" 전제와 부합).
  - 제안: 없음 — 문제 발견되지 않아 확인 기록 목적.

- **[INFO]** payload 에 포함된 `1-auth.md`/`10-graph-rag.md` 자체는 spot-check 상 이상 없음 (범위 밖, 비전수 검토)
  - target 위치: `spec/5-system/1-auth.md`(전체), `spec/5-system/10-graph-rag.md`(부분)
  - 과거 결정 출처: 각 문서 자체의 `## Rationale`(1-auth.md 는 1.1.B-1~6·1.4.A~K·2.3.A~C·4.1.A~B 등 다수 항목 보유; 10-graph-rag.md 는 payload 절단으로 자체 Rationale 절 확인 불가).
  - 상세: 이번 작업(`suggestions-prefix-dry`)과 무관한 문서이므로 전수 대조는 수행하지 않았다. 다만 `1-auth.md` 본문을 훑어본 결과 §1.4.2(WebAuthn 우선·TOTP fallback 금지)는 Rationale 1.4.D 와, §2.3(SameSite 기본 `none`)은 Rationale 2.3.B 와, §4.1(액션 네이밍)은 Rationale 4.1.A/4.1.B 와 각각 일치해 명백한 모순은 관측되지 않았다.
  - 제안: 두 파일은 본 작업 범위 밖이므로 별도 조치 불요. 향후 이 두 문서가 실제 변경 대상이 되는 작업에서는 전수 재검토 필요.

## 요약

이번 impl-prep Rationale 연속성 점검은 두 층위로 나뉜다. (1) checker 에 전달된 target payload 자체는 크기 제한으로 인해 이번 작업의 실제 spec 대상(`spec/5-system/5-expression-language.md`)을 담지 못하고 무관한 `1-auth.md`/`10-graph-rag.md` 만 포함하는 조립 오류가 있었다 — payload 만으로는 유의미한 대조가 불가능했다. (2) 파일시스템에서 실제 대상 spec 문서·코드 diff·`plan/in-progress/suggestions-prefix-dry.md`·선례 커밋(#880)을 직접 확인한 결과, 이번 리팩터(`NESTED_DRILL_SOURCES` 테이블+dispatcher 도입)는 spec 이 규정하는 행동 계약을 변경하지 않는 순수 내부 구조 개선이며, spec Rationale 에 기록된 어떤 결정도 번복·우회하지 않고, 오히려 이미 채택된 동형 패턴(#880 enricher DRY)을 정합적으로 따른다. 실질적인 Rationale 연속성 위반은 발견되지 않았다.

## 위험도

LOW
