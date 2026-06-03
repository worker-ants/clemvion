# 정식 규약 준수 검토 결과

검토 범위: `spec/` (--impl-done, diff-base=origin/main)
검토 대상 문서: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`
검토 기준: `spec/conventions/` 전체 (node-output.md, error-codes.md, swagger.md, spec-impl-evidence.md 외)

---

## 발견사항

- **[INFO]** `spec/1-data-model.md` — `## Overview` 섹션 부재
  - target 위치: `spec/1-data-model.md` 최상단 (첫 섹션이 `## 1. 엔티티 관계 개요`)
  - 위반 규약: CLAUDE.md §정보 저장 위치 — "진입 문서의 `## Overview`" / `spec/0-overview.md §8` 문서 컨벤션 — "단일 spec 파일 영역은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다"
  - 상세: `spec/1-data-model.md`는 `spec/conventions/spec-impl-evidence.md §1`의 frontmatter 의무 **제외** 대상이지만, 단일 파일 영역 문서로서 본문 최상단에 `## Overview (제품 정의)` 섹션이 없다. 다만 CLAUDE.md의 문서 맵 컨벤션은 `_product-overview.md`·`0-overview.md`·`N-name.md` 패턴에 주로 적용되고, `1-data-model.md`는 "단순 overview 성격" 제외 예시로 명시되어 있으므로 엄격한 위반은 아니다.
  - 제안: 명시적 `## Overview (제품 정의)` 섹션을 추가하거나, 현 상태를 예외로 규약에 명시. 현재 `## Rationale` 섹션은 존재하므로 규약 준수 수준은 INFO.

- **[INFO]** `spec/2-navigation/1-workflow-list.md` — `## Rationale` 섹션 노출 여부 불확인
  - target 위치: `spec/2-navigation/1-workflow-list.md` 말미 (페이로드 크기 초과로 truncated)
  - 위반 규약: `spec/0-overview.md §8` 문서 컨벤션 — "`N-name.md` 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline"
  - 상세: 페이로드가 `... (truncated due to size limit) ...` 로 잘려 말미를 확인하지 못했다. 단, 내용 상 `⚠️` 경고 주석(상태 필터 파라미터 불일치)이 인라인에 서술되어 있는데, 이 결정 근거는 본문이 아닌 별도 `## Rationale` 섹션에 두는 것이 권장된다.
  - 제안: 말미에 `## Rationale` 섹션 존재 여부를 확인하고, 파라미터 불일치 관련 결정 근거를 Rationale 에 이동 검토.

- **[INFO]** `spec/0-overview.md` — frontmatter 없음 (의도적 제외)
  - target 위치: `spec/0-overview.md` 최상단
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — 적용 대상 목록
  - 상세: `spec-impl-evidence.md §1` 의 **제외 목록**에 `spec/0-overview.md` 가 명시(`spec/0-overview.md (cross-cutting 진입 문서)`)되어 있다. frontmatter 없음은 의도된 패턴이며 위반이 아님.
  - 제안: 없음 (규약 준수).

- **[INFO]** `spec/1-data-model.md` — frontmatter 존재 (제외 대상이지만 자발적 추가)
  - target 위치: `spec/1-data-model.md` 1~6행
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — 적용 대상 및 제외 목록
  - 상세: `spec/1-data-model.md`는 `spec-impl-evidence.md §1` 의 제외 목록(`spec/1-data-model.md · spec/6-brand.md (단순 overview 성격)`)에 포함되어 frontmatter 가 의무가 아니다. 그러나 해당 파일은 frontmatter를 자발적으로 보유하고 있고, `status: implemented`, `code:` 경로도 명시되어 있다. 이는 규약 위반이 아니라 권장 수준을 초과한 준수이다.
  - 제안: 없음 (규약 위반 아님, 오히려 긍정적).

- **[WARNING]** 페이로드 내 `spec/conventions/` 문서가 로드되지 않음 — 검토 커버리지 제한
  - target 위치: 페이로드 말미 `## 정식 규약 모음 (spec/conventions/)` 블록
  - 위반 규약: 해당 없음 (target 문서 위반이 아닌 orchestrator 페이로드 구성 문제)
  - 상세: 페이로드의 `## 정식 규약 모음` 섹션에 `(없음)` 이 기재되어 있어, 규약 원문이 페이로드에 포함되지 않았다. 본 검토에서는 실제 파일(`/spec/conventions/`)을 직접 읽어 기준으로 삼았으나, 향후 재현 시 규약 내용이 로드되지 않으면 검토 누락이 발생할 수 있다.
  - 제안: orchestrator 페이로드 생성 시 `spec/conventions/` 핵심 파일(node-output.md, error-codes.md, swagger.md, spec-impl-evidence.md)을 포함하도록 페이로드 빌드 로직을 점검.

- **[INFO]** `spec/1-data-model.md §2.10` — `status_reason` 값 표기 이중성 (의도적 설계, 규약 명시 필요)
  - target 위치: `spec/1-data-model.md §2.10` Integration 테이블 `status_reason` 필드 설명 말미
  - 위반 규약: `spec/conventions/error-codes.md §1` — 의미 기반 명명 / `spec/5-system/3-error-handling.md §3.2` (UPPER_SNAKE_CASE 표기)
  - 상세: `status_reason` DB 저장값은 `snake_case`(`install_timeout`, `token_expired` 등), API 에러 코드는 `UPPER_SNAKE_CASE`(`OAUTH_*`)로 **의도적으로** 분리함이 본문에 명시되어 있다. error-codes.md는 API 코드에 UPPER_SNAKE_CASE 를 요구하고, DB 컬럼 값에 대한 표기 규칙은 별도 정의되지 않았다. 따라서 현 설계는 위반이 아니나, DB 저장값 케이스 규칙의 SoT 가 어느 문서인지 명시되지 않아 혼동 여지가 있다.
  - 제안: `spec/conventions/error-codes.md` 또는 `spec/5-system/2-api-convention.md` 에 "DB 저장 status_reason 은 snake_case, API 응답 error.code 는 UPPER_SNAKE_CASE" 를 명시적으로 규약화하거나, 현 `1-data-model.md §2.10` 의 인라인 주석이 SoT 임을 규약에서 참조하도록 추가.

---

## 요약

검토 대상 4개 문서(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`)는 전반적으로 정식 규약(`spec/conventions/`)을 잘 준수하고 있다. CRITICAL 위반은 없으며, WARNING 1건은 규약 자체의 적용 범위를 넓혀 다루어야 할 orchestrator 페이로드 구성 문제다. 실질적인 target 문서 위반은 모두 INFO 수준으로, `spec/1-data-model.md`의 `## Overview` 섹션 부재, `spec/2-navigation/1-workflow-list.md` 의 Rationale 섹션 확인 필요, DB 저장값 케이스 표기 규약의 SoT 명시 부재 등이다. `spec/conventions/spec-impl-evidence.md`의 frontmatter 의무 스키마(id/status/code/pending_plans)는 의무 대상 문서에서 올바르게 준수되고 있다.

---

## 위험도

LOW
