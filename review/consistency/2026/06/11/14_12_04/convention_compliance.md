# 정식 규약 준수 검토 결과

**검토 대상**: `spec/2-navigation/14-execution-history.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-06-11

---

## 발견사항

### [WARNING] `PUT` 메서드 사용 — API 규약 금지 항목
- **target 위치**: `§5 API 엔드포인트` 테이블, `POST /api/executions/:executionId/re-run` 행 참조 링크 경유 (`Spec Re-run §8.1`)
- **위반 규약**: `spec/5-system/2-api-convention.md §3 HTTP 메서드` — "PUT: 사용하지 않음 (PATCH 선호)"
- **상세**: 본 target 문서 자체에 `PUT`을 직접 정의하진 않는다. 그러나 `§3.7 Re-run 액션`에서 언급하는 `POST /api/executions/:executionId/re-run` 은 규약 준수. 문제는 `§5 API 엔드포인트` 테이블에서 참조되는 Spec Re-run 문서(`../5-system/13-replay-rerun.md`) 외부에 있으므로 본 target 범위에서는 직접 위반이 아님. **INFO 격하** — 본 문서 내 직접 정의된 엔드포인트에서 `PUT` 사용 없음. 이 항목은 취소.

### [INFO] frontmatter `id` 필드가 파일 basename 과 일치하지 않음
- **target 위치**: frontmatter 2행 — `id: execution-history`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "id: 파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일명은 `14-execution-history.md` (basename 제외 확장자: `14-execution-history`)이고 frontmatter `id` 는 `execution-history`로 숫자 prefix `14-`가 빠져 있다. spec-impl-evidence §2.1 은 "basename 불일치처럼 보여도 의도된 패턴"(다른 영역과 충돌 회피를 위한 prefix 조정)을 허용하며, `id`가 basename 에서 숫자 prefix를 제거한 형태는 이 프로젝트의 관행적 패턴이다. 가드(`spec-frontmatter.test.ts`)는 basename 동일성이 아닌 `id` 유효성(kebab-case)을 검증하므로 빌드 실패는 없다. 단, `spec-impl-evidence §2.1`이 권장하는 "basename 기반"에서 명시적으로 벗어나므로 INFO 로 등재.
- **제안**: 현행 패턴(`14-execution-history` basename에서 숫자 prefix 제거 → `execution-history`)은 이 프로젝트 전반에 걸쳐 일관되게 사용되는 관행이므로 수정 불필요. 규약 문서에 "숫자 prefix 제거는 허용된 관행"임을 명시하면 혼동 여지가 없어진다.

### [INFO] `§5 API 엔드포인트` — `sort` 기본값이 API 규약 예시(`created_at`)와 다름
- **target 위치**: `§5 API 엔드포인트` 쿼리 파라미터 표 — `sort` 기본값 `started_at`
- **위반 규약**: `spec/5-system/2-api-convention.md §4.1` — sort 기본값 예시 `created_at`
- **상세**: target 문서는 이 불일치를 스스로 인식하고 "의도된 도메인 오버라이드 — 실행 이력의 자연 정렬 축은 생성이 아니라 시작 시각"이라고 인라인 주석으로 명시하고 있다. API 규약 §4.1 은 기본값 `created_at`을 "예시"로 제시하며, 강제 규약이 아니다. 도메인 오버라이드가 문서화되었으므로 실질 위반이 아니다.
- **제안**: 규약 문서 자체에 "도메인별 오버라이드 허용" 문구를 명확히 추가하면 이런 인라인 주석 없이도 의도를 전달할 수 있다. 현재 target 문서의 처리는 충분.

### [INFO] 문서 구조 — `## Overview` 섹션 내 하위 소제목이 3레벨(`###`)로 세분화됨
- **target 위치**: `## Overview (제품 정의)` 아래 `### 배경`, `### 목표`, `### 요구사항` 소제목
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 구조
- **상세**: CLAUDE.md 는 Overview / 본문 / Rationale 3섹션을 권장하며 각 SKILL.md 를 참조한다. target 은 이 3섹션을 모두 갖추고(`## Overview`, `## 1.` 이하 본문, `## Rationale`), Overview 내 세분화는 규약 위반이 아니다. 위반 없음, 이 항목은 취소.

### [WARNING] `§5 API 엔드포인트` 응답 샘플 — `pagination` 키 내 필드명이 API 규약과 다름
- **target 위치**: `§5 API 엔드포인트` > 목록 API 응답 형식 JSON 샘플, `"pagination"` 객체
- **위반 규약**: `spec/5-system/2-api-convention.md §5.2 목록 응답` — pagination 객체의 필드명
- **상세**: API 규약 §5.2 예시:
  ```json
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3
  }
  ```
  target 문서 §5 JSON 샘플:
  ```json
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 87,
    "totalPages": 5
  }
  ```
  필드명이 완전히 일치(`page`, `limit`, `totalItems`, `totalPages`). **위반 없음** — 이 항목은 취소.

### [INFO] `§5 API 엔드포인트` 테이블 — `GET /api/executions/workflow/:workflowId` 경로 스타일 혼재
- **target 위치**: `§5 API 엔드포인트` 메서드·경로 표
- **위반 규약**: `spec/5-system/2-api-convention.md §2.2 명명 규칙` — "케밥 케이스", "리소스는 복수형 명사"
- **상세**: `/api/executions/workflow/:workflowId` 에서 `workflow`(단수)가 중간 세그먼트로 사용되었다. 규약 §2.2 는 "리소스는 복수형 명사"를 명시하며, 동일 규약의 주석 "3단계 이상은 최상위로 분리" 가이드가 있다. `workflow` 는 필터 sub-path 로 사용된 것으로, RPC-style 예외(`§2.2 예외`)에 해당하지 않는다. 단수 `workflow` 세그먼트는 미약한 불일치다.
- **제안**: `/api/executions/workflows/:workflowId` (복수형)으로 통일하거나, 현재 구현이 이미 배포된 경우 spec 에 "도메인 오버라이드 — 필터 경로의 단수 허용" 주석을 추가한다. 이미 `status: implemented`이고 `code:` 경로에 구현 파일이 명시되어 있으므로, 구현 변경 없이 spec 에 주석만 추가하는 것으로 충분.

---

## 요약

`spec/2-navigation/14-execution-history.md`는 정식 규약 준수 관점에서 전반적으로 양호하다. 3섹션 구조(Overview / 본문 / Rationale) 완비, frontmatter 스키마(`id`/`status`/`code:`) 충족, API 규약 §5.2 목록 응답 포맷 정확 준수, HTTP 메서드(POST/GET 한정), 페이지네이션 파라미터 정렬 등 핵심 규약을 잘 따르고 있다. 발견된 실질 이슈는 `/api/executions/workflow/:workflowId` 에서 중간 세그먼트 `workflow`가 단수형으로 API 규약 §2.2 "리소스는 복수형 명사" 와 미약하게 불일치하는 INFO 수준 1건이다. frontmatter `id`가 basename 숫자 prefix를 제거한 것은 프로젝트 전반 관행으로 실질 위반이 아니다.

---

## 위험도

LOW
