# 정식 규약 준수 검토 — spec/conventions/** (--impl-prep)

## 스코프 확정
`git merge-base HEAD origin/main` = `6dbac1f53` (origin/main HEAD 와 동일) → 이번 검토가 다루는 실제 델타는
`dfd4fd783`(그래프 RAG 삭제 연쇄 FK 인덱스 넷, spec-only) **한 커밋뿐**이다. 이 커밋은 `spec/1-data-model.md` ·
`spec/5-system/10-graph-rag.md` · `spec/data-flow/6-knowledge-base.md` 만 건드리고 `spec/conventions/**` 자체는
건드리지 않는다. 따라서 본 검토는 (a) `spec/conventions/migrations.md` 를 기준으로 이 델타(다음 커밋에서 만들
V117~V120)가 규약을 지킬 준비가 됐는지, (b) `spec/conventions/**` 자체의 자기정합 두 축으로 진행했다.

> 프롬프트 번들은 `spec/conventions/migrations.md`·`secret-store.md`·`swagger.md`·`spec-impl-evidence.md`·
> `chat-channel-adapter.md`·`redis-keys.md`·`error-codes.md` 등 이번 작업과 직접 관련된 대부분의 컨벤션 파일을
> "본문 생략됨 — 컨텍스트 예산 초과" 로 절단했다(반대로 이번 작업과 무관한 `audit-actions.md`·cafe24 카탈로그
> 표본은 전문이 실렸다). 아래 검토는 해당 파일들을 저장소에서 직접 읽어 보완했다.

## 발견사항

- **[WARNING] `plan/complete/` 로 인용된 트래커가 실제로는 `plan/in-progress/` 에 있다**
  - target 위치: `spec/1-data-model.md` `## Rationale` → "그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)" 절 말미
    (`> 출처: … 실측 절차는 \`plan/complete/spec-draft-graph-fk-indexes.md\`, 구현은 V117~V120.`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` R-11 이 전제하는 "인용 경로는 그 시점의 실제 위치를 가리킨다"
    원칙(§3.1 승격 규칙과 같은 축) — 및 `.claude/docs/plan-lifecycle.md` 의 이동 규약(엄밀히는 `spec/conventions/**`
    파일이 아니라 인접 거버넌스 문서이므로 이 축은 참고 수준으로 표시한다).
  - 상세: 실제 파일은 `plan/in-progress/spec-draft-graph-fk-indexes.md` 이며 아직 `plan/complete/` 로 이동하지
    않았다(체크리스트 항목 "이 draft `complete/` 이동" 이 미체크 상태). 그런데 이번에 머지된 spec 본문은 이미
    `plan/complete/…` 경로로 인용했다. 직전 선례인 V112~V116 커밋(`6dbac1f53`)은 스펙 인용과 트래커의 `complete/`
    이동을 **같은 커밋**에서 원자적으로 처리해 인용 시점에 항상 참이었다(`git log --follow` 로 확인 — 이동 커밋 =
    인용 커밋). 이번 건은 spec-only 커밋과 구현 커밋을 분리하면서, 트래커 이동은 plan 체크리스트상 "이 PR 의
    마지막 커밋" 으로 미뤄 **인용이 먼저, 실체 이동이 나중**인 창(window)이 생겼다. 다음 커밋에서 V117~V120 SQL
    헤더 주석을 V111~V116 선례(`spec/1-data-model.md §3 … / 실측·전수·쓰기 비용: plan/complete/<name>.md`)와 같은
    패턴으로 쓰면 그 헤더도 같은 미확정 경로를 그대로 박아 넣게 된다.
  - 제안: (a) 가장 저렴한 교정 — 문제의 인용을 실제 시점 기준으로 정확히 쓰거나(`plan/in-progress/spec-draft-graph-fk-indexes.md`,
    완료 후 `complete/` 로 갱신 예정임을 명시), (b) 계획대로 PR 마지막 커밋에서 트래커를 `complete/` 로 옮기는
    시점에 이 스펙 인용문·(다음 커밋에서 새로 쓸) V117~V120 SQL 헤더 인용을 **함께** 검증하는 체크리스트 항목을
    명시적으로 추가한다. 이미 plan 체크리스트에 "이 draft `complete/` 이동" 항목이 있으므로 실전 위험은 낮지만,
    --impl-prep 단계에서 이 갭을 짚어 두지 않으면 다음 커밋(SQL 헤더 작성)에서 같은 실수가 반복될 여지가 있다.

- **[INFO] --impl-prep 번들 예산이 관련 컨벤션 본문을 통째로 생략**
  - target 위치: 본 checker 의 입력 `_prompts/convention_compliance.md` 전체 (예: 1090~1173 라인 부근,
    `migrations.md`/`spec-impl-evidence.md`/`redis-keys.md`/`swagger.md`/`secret-store.md`/`error-codes.md`/
    `chat-channel-adapter.md` 등)
  - 위반 규약: 직접적인 target 문서 위반은 아니며, 검토 harness 의 예산 정책 문제. 다만 이 harness 가 검증해야
    할 대상인 `spec/conventions/migrations.md`(이번 작업과 가장 밀접) 자체가 생략된 것은 재발 시 이 checker 를
    무력화한다(이미 알려진 패턴 — 과거 `--spec` 모드에서도 동일 증상 관측됨).
  - 상세: 이번 작업과 무관한 `cafe24-api-catalog` 하위 필드 카탈로그(§7 field-level, `spec-impl-evidence.md §1`
    에서 frontmatter 가드 대상에서도 제외되는 순수 참조 문서)와 `audit-actions.md` 전문은 남기고, 정작 이번
    변경(DB 마이그레이션 V번호 정책)의 직접 근거인 `migrations.md` 는 절단됐다. 본 checker 는 실제 파일을 저장소
    에서 직접 읽어 보완했으나, 향후 유사 라운드에서 파일 직접 조회 없이 번들만 신뢰하면 이 conventions 파일에
    대한 위반을 놓칠 수 있다.
  - 제안: target-문서 자체 수정 사항은 아님. 번들러가 "이번 diff/scope 와 직접 관련된 conventions 파일" 을
    우선순위로 실어 절단 순서를 정하도록 개선하는 편이 좋다(harness 쪽 백로그 — 본 리포트 범위 밖).

## 규약 준수 확인 (위반 없음, 참고용)

- **V번호 정책** (`spec/conventions/migrations.md` §2): 현재 실 파일 최대값은 `V116`. 새로 제안된 `V117~V120` 은
  gap 없이 단조 증가(`+1`~`+4`)하며 재사용도 아니다 — §2 "단조 증가"·"gap 금지"·"재사용 금지" 모두 충족.
- **CONCURRENTLY 패턴 예고** (§5 각주): `spec/1-data-model.md` §3 표의 4행 모두 "CONCURRENTLY, V11x" 로 명시해
  다음 커밋에서 `.conf`(`executeInTransaction=false`) 페어링과 `DROP INDEX CONCURRENTLY IF EXISTS` 선행 정리가
  필요함을 이미 예고했다 — V111~V116 선례(`check-migration-versions.py`/`check-duplicate-versions.sh` 가 검증하는
  네이밍 정규화 규칙 `V0*([0-9]+)__`)와 어긋나지 않는다.
  - 인덱스 명명(`idx_entity_last_seen_chunk_id` 등)도 `codebase/backend/migrations/README.md` 의 `idx_<table>_<col>`
    관례와 기존 `idx_llm_usage_log_execution_id` 등 선례를 그대로 따른다.
- **frontmatter/문서 구조** (`spec/conventions/spec-impl-evidence.md` §1·§2): 변경된 세 파일 중 `spec/1-data-model.md`
  는 `EXCLUDE_BASENAMES` 로 frontmatter 의무 자체가 면제되지만 기존에 `id`/`status`/`code`(`codebase/backend/migrations/V*.sql`
  글롭 포함)를 이미 보유해 이번 델타와 자연스럽게 맞물린다. `spec/5-system/10-graph-rag.md` 는 `status: implemented`
  + `code:` 유지, `spec/data-flow/6-knowledge-base.md` 는 §1 의 명시적 제외 대상(`spec/data-flow/**`)이라 frontmatter
  의무 없음 — 셋 다 규약과 어긋나지 않는다.
- **링크 무결성**: `spec/5-system/10-graph-rag.md` 에 새로 추가된 `[데이터 모델 §3](../1-data-model.md#3-인덱스-전략)`
  링크의 앵커(`## 3. 인덱스 전략`)가 실제로 `spec/1-data-model.md` 에 존재 — `spec-link-integrity.test.ts` 가
  요구하는 slug 대조와 어긋나지 않는다.
- **표 포맷**: `spec/1-data-model.md` §3 표에 추가된 4행은 인접 행(V112~V116)과 동일한 컬럼 구조·백틱 사용 방식을
  따르며 파이프(`|`) 이스케이프 누락 등 표 구문 파손 없음.
- **cafe24 등 다른 conventions 파일**(전문 확인분: `audit-actions.md`, `cafe24-api-catalog/_overview.md`·
  `category.md`·`store.md`): 이번 작업과 무관하며, `## Overview`/본문/`## Rationale` 3섹션 권장이 적용되는
  `audit-actions.md` 는 이를 충족. 카탈로그 leaf 문서(`category.md`/`store.md`)는 3섹션 권장이 적용되지 않는
  참조성 데이터 문서로 §7 field-level 제외 규정과 일관되게 취급되고 있어 이번 검토에서 별도 위반을 찾지 못했다.

## 요약
이번 라운드의 실질 델타(`dfd4fd783`, 그래프 RAG 삭제 연쇄 FK 인덱스 V117~V120 스펙 예고)는 `spec/conventions/migrations.md`
의 V번호 단조성·gap 금지·CONCURRENTLY 페어링 예고, 그리고 `spec-impl-evidence.md`/링크 무결성 규약과 정면으로
어긋나는 지점은 없다. 다만 spec 본문이 아직 `plan/in-progress/` 에 있는 트래커를 `plan/complete/` 경로로 앞당겨
인용한 대목이 있어(직전 V112~V116 선례의 원자적 인용 관행과 대비), 다음 커밋(V117~V120 SQL 헤더 작성)에서 같은
미확정 인용이 반복되지 않도록 --impl-prep 단계에서 짚어 둘 필요가 있다 — 다만 이 자체는 plan 체크리스트가 이미
추적 중인 낮은 리스크다. 별도로, 검토 harness 의 컨텍스트 예산이 이번 작업과 직접 관련된 `migrations.md` 등
컨벤션 본문을 절단한 점은 target 문서의 결함은 아니지만 이 checker 의 커버리지를 구조적으로 약화시키는 요인으로
기록해 둔다.

## 위험도
LOW
