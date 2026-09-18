### 발견사항

- **[WARNING] 번들 예산 초과로 규약 원문 268/274개 파일 미적재 — 하지만 실제 판정 대상(마이그레이션 규약)은 직접 Read 로 확인**
  - target 위치: `_prompts/convention_compliance.md` 본문 전체 + 말미 "⚠️ 컨텍스트 예산 초과로 생략된 파일 268개" 블록
  - 위반 규약: 없음(target 자체 위반이 아니라 이 검토 호출의 조립 결함) — 다만 이 결함이 감추는 것은 `spec/conventions/swagger.md`(API 문서 규약)·`error-codes.md`(출력 포맷 규약)·`secret-store.md`·`spec-impl-evidence.md`(문서 구조 규약)·`node-output.md`·`node-cancellation.md`·`redis-keys.md`·`chat-channel-adapter.md`·`conversation-thread.md` 등 정확히 이 검토가 맡은 5개 관점(특히 ②출력 포맷·④API 문서 규약)의 SoT 문서들이다.
  - 상세: 274개 헤더 중 6개(`audit-actions.md`, `cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`, `cafe24-api-metadata.md`)만 본문이 실렸고 나머지 268개(97.8%)는 "본문 생략됨 — 컨텍스트 예산 초과" placeholder다. 예산이 `cafe24-api-catalog/` 하위 250여 개 참조용 field-level 카탈로그(§7.1 에 의해 spec frontmatter 가드 자체가 면제되는 저가치 생성물)에 먼저 소진되고, 정작 ②·④ 관점을 판정할 규범 문서는 하나도 못 실렸다. 이는 기존에 기록된 하네스 결함(`feedback_consistency_spec_mode_budget.md` — "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다")의 재발이다.
  - 처리: placeholder 자체의 지시("판정에 관련되면 Read 로 직접 열어라")에 따라, 프롬프트 말미의 "(main 추가) 착수할 작업" 절이 지목한 실제 판정 대상 — `migrations.md`(전문), `codebase/backend/migrations/README.md` §2·§4·§5, `plan/in-progress/spec-draft-deletion-cascade-indexes.md`, 이미 커밋된 `spec/1-data-model.md`/`data-flow/{3-execution,5-integration,7-llm-usage}.md` 변경분, `codebase/backend/migrations/` 실제 파일 — 을 직접 Read 하여 검증했다. 그 결과는 아래.
  - 제안: 번들러가 "관련도 높은 파일 우선 적재" 순서를 두거나(현재 작업이 참조하는 `migrations.md` 같은 문서를 cafe24 카탈로그보다 먼저), 청크당 크기 상한을 낮춰 최소한 헤더별 진위(생략 여부)가 항상 눈에 띄게 유지하는 정책 갱신을 권고.

- **[정보 — 실제 판정 결과] 마이그레이션 계획(V112~V116)은 `migrations.md`·README 규약을 준수**
  - target 위치: `plan/in-progress/spec-draft-deletion-cascade-indexes.md` §"구현" · 이미 커밋된 `spec/1-data-model.md` §3(921·951·952·956·957행)·§2.10.1·§2.24·`## Rationale`
  - 근거 규약: `spec/conventions/migrations.md` §1(명명)·§2(V번호 정책)·§5(추가 절차·CONCURRENTLY 패턴), `codebase/backend/migrations/README.md` §4·§5
  - 확인 사항(모두 통과):
    - V번호: main 현재 max 는 V111(2026-09-18 머지된 `V111__trigger_workflow_id_index.sql`) — 신규 V112~V116 은 gap 없이 연속. §2 "단조 증가·gap 금지" 충족.
    - 인덱스 이름: `idx_node_execution_node_id`·`idx_integration_usage_log_node_execution_id`·`idx_integration_usage_log_workflow_id`·`idx_llm_usage_log_node_execution_id`·`idx_llm_usage_log_execution_id` — 모두 `idx_<table>_<column>` 패턴으로, 기존 선례(`idx_trigger_workflow_id`, `idx_node_container`, `idx_execution_trigger_started`)와 동일 규칙. partial index 도 이름에 "partial" 접미 없음 — 기존 `idx_node_container`(§V002, partial)와 동일 관례. `codebase/`·`spec/`·`plan/` 전수 grep 재확인 결과 5개 이름·V112~V116 모두 0건 충돌(직접 확인).
    - CONCURRENTLY 패턴: "파일당 CREATE 하나 + `.conf executeInTransaction=false` + CREATE 앞 `DROP INDEX CONCURRENTLY IF EXISTS`" — README §5 "신규 추가에도 0) 을 둡니다"·직전 선례 V111 과 정확히 일치.
    - spec 교차참조: `spec/1-data-model.md` 의 V112~V116 표기가 `data-flow/3-execution.md`(V112)·`5-integration.md`(V113·V114)·`7-llm-usage.md`(V115·V116) 각 sink 표와 번호·컬럼이 1:1로 일치함을 grep 으로 직접 대조.
  - 결론: 이 항목에서 CRITICAL/WARNING 없음.

- **[WARNING] `cafe24-api-catalog/_overview.md` 가 형제 파일들과 달리 lifecycle frontmatter(`id`/`status`/`code`) 없음**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 최상단(코드펜스 직후 바로 `# CONVENTION: ...` 로 시작, `---` frontmatter 블록 부재)
  - 위반 규약: 자기 자신이 §7.1 에서 정의한 예외 범위 — "`<name>-api-catalog/<resource>/**/*.md`(카탈로그 디렉토리 뒤 세그먼트 1개 이상)" 만 `spec-impl-evidence.md` 의 lifecycle frontmatter 의무에서 면제되고, "카탈로그 최상위 `<resource>.md` 인덱스는 정식 spec 으로 계속 검증된다" — 인데 `_overview.md` 는 `<resource>/` 하위도 아니고 `<resource>.md` 도 아닌 애매 지대다.
  - 상세: 같은 디렉토리의 `category.md`·`store.md`·`translation.md` 는 전부 `id`/`status: implemented`/`code:` frontmatter 를 갖는데, 디렉토리 진입점인 `_overview.md` 만 완전히 없음. `spec-impl-evidence.md` 원문이 이번 번들에서 truncate 되어 정확한 예외 조항 문구를 재확인하지 못했으므로 CRITICAL 이 아닌 WARNING 으로 낮춘다.
  - 제안: `_overview.md` 에도 `id: cafe24-api-catalog-overview` 류의 frontmatter 를 추가하거나(형제 패턴에 맞춤), 혹은 "디렉토리 진입점(`_overview.md`)은 `_product-overview.md` 와 같은 지위로 frontmatter 의무 밖" 이라는 문장을 §7.1 에 명시적으로 추가해 애매함을 없앨 것.

- **[INFO] 일부 convention 문서에 명시적 `## Overview` 헤딩 없이 본문 시작**
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md`(intro 문단 뒤 바로 `## 1. 디렉토리 구조`), `spec/conventions/cafe24-api-metadata.md`(intro 문단 뒤 바로 `## 1. 디렉토리 구조`)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: 두 문서 모두 `## Rationale` 로는 끝나지만 시작부에 `## Overview` 라벨이 없다. 같은 폴더의 `audit-actions.md` 는 `## Overview` 헤딩을 명시적으로 쓴다 — 같은 spec/conventions/ 안에서 스타일이 갈린다. "권장" 수준이라 CRITICAL/WARNING 은 아니지만, 일관성을 원하면 두 문서에도 `## Overview` 헤딩을 붙이는 편이 낫다.

- **[INFO] README.md 의 `-- DOWN:` 예시가 CONCURRENTLY 계열 마이그레이션의 실제 관례를 반영 못함**
  - target 위치: `codebase/backend/migrations/README.md` §2(`-- DOWN:` 예시, 별도 줄) vs 실제 파일 `V105`·`V106`·`V109`·`V110`·`V111`(전부 `-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): ...` 한 줄 변형)
  - 상세: `migrations.md` 가 실제 작성 가이드로 지목하는 README 의 §2 예시는 일반 트랜잭션 마이그레이션 형태만 보여주고, CONCURRENTLY 인덱스 계열이 실제로 쓰는 변형은 문서화돼 있지 않다. plan 은 "V111 선례" 를 명시적으로 따르겠다고 했으므로 구현 시 동일 변형이 V112~V116 에도 반복될 것이고, 이는 기존 5개 선례와 일관돼 문제는 아니다. 다만 README 자체가 이 변형을 예시로 싣지 않은 건 신규 기여자에게 혼란을 줄 수 있는 문서 갭이다.
  - 제안: README §2 예시 아래에 CONCURRENTLY 전용 `-- DOWN(...)：` 한 줄 변형 예시를 추가.

### 요약
이번 라운드의 번들(prompt_file)은 `spec/conventions/` 274개 파일 중 268개(97.8%)를 컨텍스트 예산 초과로 생략했고, 하필 출력 포맷·API 문서 규약을 정의하는 핵심 문서(swagger.md, error-codes.md 등)가 전부 그 안에 포함돼 있어 해당 두 관점은 이 번들만으로는 판정 불가능했다 — 이는 기존에 기록된 하네스 결함의 재발이다. 다만 프롬프트 말미가 지목한 실제 이번 작업의 판정 대상은 `spec/conventions/migrations.md`(전문 Read 확인)이며, 여기에 대해 검증한 결과 `plan/in-progress/spec-draft-deletion-cascade-indexes.md` 의 V112~V116 마이그레이션 계획과 이미 커밋된 `spec/1-data-model.md`/`data-flow/*.md` 변경은 명명·번호·CONCURRENTLY 패턴·교차참조 모두 규약을 정확히 따르고 있어 CRITICAL 위반이 없다. 부수적으로 번들에 실제 적재된 6개 파일 중 `cafe24-api-catalog/_overview.md` 가 형제 파일과 달리 lifecycle frontmatter 를 결여한 점(WARNING)과 Overview 헤딩 스타일 불일치(INFO) 를 확인했다.

### 위험도
LOW
