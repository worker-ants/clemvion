# 신규 식별자 충돌 검토 — llm-usage-doc-alignment (#501 후속, docs-only)

검토 대상: `spec-draft.md` (변경 2 — `spec/1-data-model.md` §2.16.1 LlmUsageLog 신설 등)

## 발견사항

### [Warning] `§2.16.1` 번호는 과거 RerankConfig 에 배정됐던 식별자의 재사용 — 코드 내 살아있는 stale 참조가 의미 충돌을 일으킴

- target 신규 식별자: `spec/1-data-model.md` `### 2.16.1 LlmUsageLog` (draft `## 변경 2`, `spec-draft.md:23-41`)
- 기존 사용처:
  - `codebase/backend/migrations/V081__rerank_config.sql:2` — `-- RerankConfig (Spec data-model §2.16.1)` (마이그레이션 파일 헤더 주석, 현재도 리포지토리에 그대로 존재)
  - `plan/complete/unified-model-management.md:125,132` — "`1-data-model.md`: §2.16 LLMConfig + §2.16.1 RerankConfig → 통합 **§2.16 ModelConfig(kind 판별)**." / "`1-data-model.md §2.16.1`(sibling 분리)을 **번복**"
  - `plan/complete/spec-draft-unified-model-management.md:87,89,98,180` — "### §2.16.1 (삭제) RerankConfig", "§2.16.1 RerankConfig 엔티티 → §2.16 ModelConfig `kind='rerank'`로 흡수, 섹션 삭제"
  - `plan/complete/rag-rerank-impl.md:12`, `plan/complete/rag-rerank-followup.md:36`, `plan/complete/rag-rerank-followup-v2.md:14,37`, `plan/complete/spec-draft-rag-reranking.md:190` — 모두 `1-data-model.md §2.16.1` = RerankConfig 로 참조
- 상세: `§2.16.1` 은 `V081`(RerankConfig 도입) 시점부터 `V090/V092`(ModelConfig 로 흡수·`rerank_config` 테이블 DROP)로 해당 섹션이 **삭제**되기까지 실제로 "RerankConfig" 를 가리키던 식별자다. 현재 `spec/1-data-model.md` 라이브 본문에는 `### 2.16.1` 헤딩이 존재하지 않음(확인됨 — `grep -n "^### 2\." spec/1-data-model.md` 결과 2.16 → 2.17 사이 없음)을 재확인했으나, **`V081__rerank_config.sql:2` 주석은 여전히 "§2.16.1 = RerankConfig" 라고 명시**하고 있다. 이 마이그레이션은 이미 적용된 과거 파일이라 일반적으로 재편집하지 않는 대상이다(파일 내 자체 서술: `V092__drop_rerank_config.sql` 의 "DOWN: 비가역" 관례 및 리포지토리에 마이그레이션 checksum 도구가 있다면 사후 편집이 위험할 수 있음).
  target 이 동일 번호 `§2.16.1` 을 `LlmUsageLog` 로 **재사용**하면, 이 stale 주석을 근거로 `spec/1-data-model.md §2.16.1` 을 찾아가는 개발자/에이전트는 (지금까지는 "그런 섹션 없음" 이라는 명백히 깨진 링크를 만났지만) 앞으로는 **실제로 존재하는, 그러나 전혀 다른 의미(LlmUsageLog)의 섹션**에 도달하게 된다. 깨진 링크보다 조용한 오귀속이 더 위험하다 — "RerankConfig 필드 표를 보려는데 LlmUsageLog 필드 표가 나온다" 는 혼선이 즉시 발생.
- 제안:
  - (권장) target 의 신규 `### 2.16.1 LlmUsageLog` 헤딩 도입부에 "본 번호는 `V081~V092`(RerankConfig) 기간에 한시적으로 쓰였다가 통합 리팩터(`unified-model-management`)로 섹션이 삭제된 뒤 재사용됨" 각주를 1줄 추가해 두 세대 참조자 모두의 혼선을 방지.
  - (대안) `V081__rerank_config.sql` 은 재편집하지 않는 편이 안전(체크섬 위험)하므로, 굳이 번호 재사용을 원치 않으면 `LlmUsageLog` 섹션을 `2.16.1` 대신 다른 유일 번호(예: 순번을 당겨 `2.24` 로 말미 배치하거나 `2.16.2` 로 배정)로 옮기는 선택지도 있음 — 다만 선례(`§2.10 Integration → §2.10.1 IntegrationUsageLog` 처럼 "부모 엔티티 바로 뒤 `.1`") 를 따르고 싶다면 위 각주 방식이 더 실용적.
  - 어느 쪽이든 project-planner 결정 필요(문서 구조 선택 사안이라 본 검토는 각주/대안 두 옵션만 제시).

### [Info] ERD 트리 `IntegrationUsageLog` 줄의 분기 기호 버그(사실 확인, 본 변경 범위 밖)

- 사실 확인 결과: `spec/1-data-model.md:29-31`
  ```
         │       ├── Integration (1:N)
         │       └── IntegrationUsageLog (1:N)
         │       ├── Schedule (1:N)
  ```
  `IntegrationUsageLog` 행이 리스트 중간 항목인데도 마지막 분기 기호 `└──` 를 쓰고 있고, 바로 다음 `Schedule` 행이 다시 `├──` 로 돌아간다 — 기존에 이미 있던 표기 버그임을 확인. target 이 `LlmUsageLog (1:N)` 를 "ModelConfig 다음 줄" 에 추가할 때(`spec-draft.md:40`) 새로 추가하는 줄 자체는 리스트 중간이므로 `├──` 를 쓰면 되고 이 기존 버그를 반복하지 않는다. 다만 인접한 기존 버그를 함께 고칠지는 target 범위 밖 — 보고만 하고 조치는 요구하지 않음.

## 검토 관점별 결과 요약

1. **섹션 번호 충돌** — `§2.16.1` 자체는 라이브 스펙에 현재 비어 있어 형식적 중복은 없으나, 과거 RerankConfig 에 배정됐던 번호의 재사용이며 `codebase/backend/migrations/V081__rerank_config.sql:2` 에 그 사실을 명시한 stale 참조가 살아있음 → 위 Warning. `§2.17` 이하 넘버링은 `.1` 서브섹션 삽입이라 밀리지 않음을 확인(`spec/1-data-model.md:607` `### 2.17 AuthConfig` 그대로, §2.10→§2.10.1→§2.11 선례와 동일 패턴).
2. **엔티티/타입명 충돌** — `LlmUsageLog` 는 `spec/` 내 어디에도 다른 의미로 쓰이지 않음(기존 산발적 언급 `spec/5-system/10-graph-rag.md:92`, `spec/5-system/_product-overview.md:86`, `spec/data-flow/7-llm-usage.md:67,151` 은 전부 동일 의미의 비공식 언급). 코드 표기와 완전 일치: 클래스 `LlmUsageLog`(`codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:16`), 테이블 `llm_usage_log`(같은 파일 `@Entity('llm_usage_log')`, `codebase/backend/migrations/V014__llm_usage_logs.sql:4`), 서비스 `LlmUsageLogService`(`codebase/backend/src/modules/llm/llm-usage-log.service.ts:21`). `IntegrationUsageLog`/`integration_usage_log`(`codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:18-19`) 와 동일한 `<Domain>UsageLog` PascalCase 표기 관례를 따름 — 충돌 없음.
3. **anchor 충돌** — `### 2.16.1 LlmUsageLog` 가 만드는 GitHub anchor `#2161-llmusagelog` 와 동일한 anchor 를 만드는 다른 헤딩은 `spec/1-data-model.md` 전체에 없음 — 충돌 없음.
4. **ERD 트리 추가** — 현재 트리(`spec/1-data-model.md:17-46`)에 `LlmUsageLog` 항목 없음 → 신규 추가에 이름 충돌 없음. 인접 `IntegrationUsageLog` 줄의 분기 기호 버그는 위 Info 참고(범위 밖).
5. **인덱스 표 충돌** — `spec/1-data-model.md` §3 인덱스 표(`826-874`)에 `LlmUsageLog` 행 없음(현재는 `IntegrationUsageLog` 2행만 존재, `873-874`) → 신규 3행 추가에 이름 충돌 없음.

## 요약

신규 식별자 충돌 관점에서 실질적 blocking 사안은 없다 — 엔티티명·anchor·ERD 트리·인덱스 표 모두 현재 라이브 스펙과 충돌하지 않고 코드 표기(`LlmUsageLog`/`llm_usage_log`/`LlmUsageLogService`)와도 정확히 일치한다. 유일한 주의점은 `§2.16.1` 이라는 섹션 번호가 과거 RerankConfig 전용이었다가 통합 리팩터로 삭제된 이력이 있고, 그 사실을 여전히 명시하는 stale 참조(`V081__rerank_config.sql:2` 및 다수 `plan/complete/*` 문서)가 리포지토리에 남아있어 번호를 재사용하면 "깨진 링크"가 "조용히 다른 대상을 가리키는 링크"로 바뀐다는 점이다 — 각주 1줄 또는 대체 번호 선택으로 쉽게 해소 가능한 Warning 수준.

## 위험도

LOW

STATUS: DONE
