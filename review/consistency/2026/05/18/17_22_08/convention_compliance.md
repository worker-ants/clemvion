# 정식 규약 준수 검토 결과

검토 대상: `spec/0-overview.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-18

---

### 발견사항

- **[WARNING]** `spec/0-overview.md` 파일에 `## Rationale` 섹션 부재
  - target 위치: 문서 전체 (마지막 섹션 `## 5. 배포 환경 분리`)
  - 위반 규약: `CLAUDE.md §명명 컨벤션` — "N-name.md — 정렬된 상세 spec. 본문 끝에 `## Rationale` 섹션으로 결정 근거 inline."
  - 상세: `spec/0-overview.md`는 `0-` prefix를 가진 기술 아키텍처 개요 문서다. CLAUDE.md는 `N-name.md` 패턴에 Rationale 섹션을 권장하며, `0-overview.md` 역시 번호 prefix를 가진 상세 spec 문서에 해당한다. 문서 어디에도 `## Rationale` 섹션이 없다. 아키텍처 결정 배경(왜 Redis를 선택했는지, 왜 Flyway를 선택했는지, 왜 S3 호환 구조로 KB prefix를 `workspaceId` 없이 설계했는지 등)이 spec 본문 내에 일부 inline 설명으로 분산되어 있으나 (`spec/0-overview.md §2.7` 의 `> KB 원본 키는...` 블록 인용 등) 정식 Rationale 섹션으로 통합되어 있지 않다.
  - 제안: 문서 말미에 `## Rationale` 섹션을 추가하고, 산재한 아키텍처 결정 근거(S3 키 설계, Flyway 선택, Redis 큐 도입 배경 등)를 이 섹션으로 집약한다.

- **[WARNING]** `spec/0-overview.md` 가 `spec/` 루트에 위치하나 CLAUDE.md 명명 컨벤션 상 맥락 불일치
  - target 위치: 파일 경로 `spec/0-overview.md`
  - 위반 규약: `CLAUDE.md §명명 컨벤션` — `spec/<영역>/0-overview.md` 패턴은 "영역 안의 기술 아키텍처 개요"로 정의됨
  - 상세: CLAUDE.md의 명명 컨벤션 표는 `spec/<영역>/0-overview.md` 형식으로 서브 폴더 영역의 개요를 상정한다. 그런데 `spec/0-overview.md`는 `spec/` 루트에 직접 위치하며 전체 시스템 아키텍처 개요를 담는 문서다. 이 파일은 현재 규약의 영역 개요 패턴(`spec/<영역>/0-overview.md`)의 예외에 해당하고, `spec/0-overview.md §8` 문서 맵에서도 "제품 개요 + 시스템 아키텍처 | `spec/0-overview.md` | 본 문서"로 스스로 정의하고 있다. 규약이 루트 레벨 개요 문서의 위치를 명시하지 않아 패턴 불일치가 발생한다. 실질적인 운영 문제는 없으나 규약과 실제가 어긋난다.
  - 제안: CLAUDE.md §명명 컨벤션 표에 `spec/0-overview.md` (루트 레벨) 항목을 명시적으로 추가해 "전체 시스템 아키텍처 개요 + 문서 맵"임을 선언하도록 규약을 갱신하는 것이 적절하다. target 문서 자체는 수정이 필요하지 않다.

- **[INFO]** Overview 섹션 제목이 H2가 아닌 H2 내부 H3 subsection으로 구성됨
  - target 위치: `## Overview (제품 정의)` 하위 `### 1. 제품 비전` ~ `### 8. 문서 맵`
  - 위반 규약: `CLAUDE.md §프로젝트 스펙 문서` — "Overview (제품 정의) — 영역의 사용자 가치·요구사항·목표."
  - 상세: 권장 3섹션(Overview / 본문 / Rationale) 구성에서 Overview는 H2 수준 섹션으로 두도록 안내된다. `spec/0-overview.md`의 Overview 섹션은 `## Overview (제품 정의)` (H2) → `### 1. 제품 비전` ~ `### 8. 문서 맵` 구조로 되어 있어 형식 자체는 준수하고 있다. 다만 §8 "문서 맵"은 제품 정의(사용자 가치·요구사항·목표)의 범위를 벗어나 기술 문서 구조 안내에 해당하므로 Overview 섹션 내에 두기보다 별도 H2 섹션(`## 문서 맵` 또는 본문 인트로)으로 분리하는 것이 3섹션 경계를 명확히 하는 데 도움이 된다.
  - 제안: `### 8. 문서 맵`을 `## Overview (제품 정의)` 하위에서 꺼내어 `## 문서 맵` (H2) 또는 본문 서두 섹션으로 이동하는 것을 고려한다. INFO 수준으로 즉각 수정 필수는 아니다.

- **[INFO]** `prd/0-overview.md` 출처 인용 블록이 문서 내 잔류
  - target 위치: `## Overview (제품 정의)` 바로 아래 `> 출처: \`prd/0-overview.md\` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.`
  - 위반 규약: `CLAUDE.md §폴더 구조 §명명 컨벤션` — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12)으로 모두 `spec/` 또는 `plan/complete/archive/`로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
  - 상세: 직접 위반은 아니다(신규 문서 생성이 아닌 출처 주석). 그러나 `prd/` 경로 참조 블록인용이 spec 문서 안에 잔류하면 옛 경로를 연상시켜 혼란을 줄 수 있다. 통합 완료 후 이 출처 주석은 독자에게 불필요한 정보다.
  - 제안: 출처 블록인용 제거 또는 "docs-consolidation(2026-05-12) 이후 본 문서가 단일 진실"이라는 간단한 한 줄 각주로 대체한다.

---

### 요약

`spec/0-overview.md`는 전체적으로 정식 규약의 주요 요건(문서 구조 3섹션, 명명 prefix, 문서 맵 포함, 올바른 경로)을 대체로 준수하고 있다. 파일·식별자 명명, API 출력 포맷, 카탈로그 컨벤션 위반은 없다. 주된 지적 사항은 `## Rationale` 섹션 누락(WARNING)으로, 아키텍처 결정 근거가 본문 곳곳에 산재해 있어 정식 섹션으로 집약이 필요하다. 루트 레벨 `spec/0-overview.md` 경로가 CLAUDE.md 명명 컨벤션 표의 `spec/<영역>/0-overview.md` 패턴과 정확히 일치하지 않는 점은 규약 문서 갱신으로 해소하는 것이 적합하다(WARNING). 나머지 두 항목은 INFO 수준의 형식 개선 제안이다.

### 위험도

LOW
