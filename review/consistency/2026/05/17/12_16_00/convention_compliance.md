# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/` (전체 파일군)
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-05-17

---

### 발견사항

---

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — 관련 문서 링크에 옛 `prd/` 경로 self-reference 잔류
  - target 위치: `spec/2-navigation/14-execution-history.md` 첫 번째 줄 관련 문서 목록
    ```
    > 관련 문서: [PRD 실행 내역](./14-execution-history.md) · ...
    ```
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 > 금지 항목 — "옛 `prd/`, `memory/`, `user_memo/` 폴더 컨벤션으로 만들지 않는다." 및 `spec/conventions/` 의 단일 진실 원칙
  - 상세: `[PRD 실행 내역](./14-execution-history.md)` 링크가 자기 자신(`14-execution-history.md`)을 가리키고 있다. docs-consolidation 이후 PRD 내용은 본 문서의 `## Overview` 섹션으로 흡수된 상태인데, 관련 문서 링크에서 여전히 "PRD" 접두로 같은 파일 내부를 참조하고 있어 링크 목적이 없고 혼란을 유발한다. 이는 옛 `prd/` 경로에서 링크를 복사한 흔적이 정리되지 않은 상태다.
  - 제안: 자기 참조 링크 `[PRD 실행 내역](./14-execution-history.md)` 를 삭제하거나, `[실행 내역 Overview](#overview-제품-정의)` 와 같이 내부 앵커로 바꾼다.

---

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — `## Overview` 하위에 `### 1. 개요` ~ `### 3. 요구사항` 이 중첩되고, 이후 `## 1. 개요` 가 다시 시작하는 이중 구조
  - target 위치: `spec/2-navigation/14-execution-history.md` — `## Overview (제품 정의)` 섹션 내 §1 ~ §3 과 본문 `## 1. 개요` ~ `## 7. 라우팅`
  - 위반 규약: `CLAUDE.md` 프로젝트 스펙 문서 §권장 3섹션 — "1. Overview(제품 정의) / 2. 본문(스펙) / 3. Rationale" 구성 권장. Overview 와 본문 스펙이 명확히 구분되어야 한다.
  - 상세: `## Overview (제품 정의)` 섹션 안에 `### 1. 개요`, `### 2. 페이지 구조`, `### 3. 요구사항` 이라는 기술 스펙 수준의 세부 섹션이 들어 있다. 이후 `---` 구분선 아래 `## 1. 개요`가 다시 시작하면서 "개요"가 두 번 등장한다. Overview 섹션은 사용자 가치·목표·요구사항 중심의 제품 정의이어야 하고, 기술적 페이지 구조·요구사항 ID 는 본문 스펙 영역에 두는 것이 컨벤션에 부합한다. 현재 구조는 Overview 와 본문의 경계가 흐릿하여 문서 가독성과 향후 유지보수를 저해한다.
  - 제안: `## Overview (제품 정의)` 를 배경(§1.1)과 목표(§1.2) 중심으로 축약하고, `### 2. 페이지 구조`, `### 3. 요구사항` 은 본문 스펙 구간(`## 1. 개요` 이후)으로 이동한다. 또는 현 구조를 유지하되 `## 1. 개요` 중복 절을 제거한다. (이 개정은 spec 파일 수정이므로 `project-planner` 역할 수행 필요)

---

- **[WARNING]** `spec/2-navigation/14-execution-history.md` — `## Overview` 에서 `prd/` 출처 주석을 남겨두는 것이 금지 경로 흔적을 문서에 고착시킴
  - target 위치: `spec/2-navigation/14-execution-history.md` Overview 섹션 첫 줄
    ```
    > 출처: `prd/7-execution-history.md` — docs-consolidation(2026-05-12)으로 본 문서에 흡수.
    ```
  - 위반 규약: `CLAUDE.md` 금지 항목 — "옛 `prd/` 폴더 컨벤션으로 만들지 않는다." / "spec/ 하위 문서는 제품의 최종 상태를 정의한다. history가 아닌 latest에 대한 기술"
  - 상세: docs-consolidation 후 옛 `prd/` 경로가 흡수된 사실을 blockquote 로 명시하는 것은 과도기적 주석으로 이해할 수 있으나, "spec 문서는 최종 상태를 정의하며 history가 아니다"는 원칙에 따르면 이 출처 주석은 불필요한 history 정보다. 이를 남겨 두면 향후 독자가 옛 `prd/` 경로를 의식하게 되며, 금지된 경로를 문서 본문에 명시적으로 기재하는 것이다.
  - 제안: `> 출처: prd/7-execution-history.md ...` blockquote를 삭제한다. 출처 history가 필요하다면 `## Rationale` 에 1행으로 기록하는 것이 더 적절하다.

---

- **[WARNING]** 여러 spec 파일에서 `## Rationale` 섹션이 누락됨
  - target 위치:
    - `spec/2-navigation/0-dashboard.md` — Rationale 없음
    - `spec/2-navigation/11-error-empty-states.md` — Rationale 없음
    - `spec/2-navigation/12-workflow-version-history.md` — Rationale 없음
    - `spec/2-navigation/13-user-guide.md` — Rationale 없음
    - `spec/2-navigation/14-execution-history.md` — Rationale 없음
    - `spec/2-navigation/2-trigger-list.md` — Rationale 없음
    - `spec/2-navigation/3-schedule.md` — Rationale 없음
  - 위반 규약: `CLAUDE.md` 프로젝트 스펙 문서 §권장 3섹션 — "본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: `1-workflow-list.md` 는 `## Rationale` 이 있고 `10-auth-flow.md` 도 있으나, 나머지 7개 파일에는 Rationale이 없다. 권장 사항이므로 즉각적인 규약 위반은 아니지만, 설계 결정의 배경·근거(옛 ADR) 가 없으면 향후 구현자·검토자가 맥락 없이 코드를 변경할 위험이 있다. 특히 `12-workflow-version-history.md`, `14-execution-history.md` 는 복잡한 설계 결정이 포함되어 있어 Rationale이 없는 것이 아쉽다.
  - 제안: 구현 착수 전 또는 착수 후 `## Rationale` 섹션을 추가하여 주요 설계 결정(예: "버전 생성이 캔버스 저장과 동일 트랜잭션이 아닌 이유", "실행 내역이 별도 페이지인 이유")을 기록한다. 필수는 아니나 강력 권장.

---

- **[INFO]** `spec/2-navigation/0-dashboard.md` — 파일명 prefix 패턴이 `0-` 이나 내용이 기술 아키텍처 개요가 아닌 UI 화면 스펙
  - target 위치: `spec/2-navigation/0-dashboard.md` 파일명
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — `spec/<영역>/0-overview.md` (`0-` prefix)는 "영역 안의 기술 아키텍처 개요"를 담는다. `N-name.md` (`숫자 prefix`)는 "정렬 보장된 상세 spec 문서"다.
  - 상세: CLAUDE.md 명명 컨벤션에서 `0-` prefix 파일은 `0-overview.md` 또는 `0-common.md` 처럼 영역의 아키텍처 개요나 공통 규약을 담는 것으로 정의한다. 그러나 `0-dashboard.md` 는 대시보드 화면의 UI 스펙 문서로서 일반 상세 spec에 해당한다. 이름만 보면 아키텍처 overview 처럼 읽힌다.
  - 제안: 파일명을 `0-dashboard.md` → `2-dashboard.md` 또는 적절한 번호(`N-dashboard.md`)로 변경을 검토한다. 단, `0-dashboard.md` 가 오래된 관행으로 정착해 있고 다른 파일들이 이를 링크로 참조하고 있다면, 컨벤션 자체에 예외를 명시하거나 파일명이 영역명(여기서는 `2-navigation/`)에서 `0-` 이 단순 정렬 목적임을 문서화하는 것이 더 현실적이다. (규약 갱신이 적절할 수 있음)

---

- **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` — 파일명이 `_overview.md` (언더스코어 prefix) 이지만 CLAUDE.md 에서 언더스코어 prefix는 `_product-overview.md`·`_layout.md` 용도만 명시
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일명
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — 언더스코어 prefix는 `_product-overview.md` (영역 제품 정의)와 `_layout.md` (영역 공통 레이아웃)에만 사용한다고 정의됨. `spec/conventions/` 내 파일은 "평문" 명명 규칙을 따른다.
  - 상세: `spec/conventions/*.md` 는 "평문" 명명 규칙을 따라야 하는데, `cafe24-api-catalog/_overview.md` 는 언더스코어 prefix를 사용하고 있다. `spec/conventions/` 의 하위 디렉토리(`cafe24-api-catalog/`) 안에서의 `_overview.md` 사용이므로 엄밀히 동일 level 비교는 어렵지만, 컨벤션에서 정의한 언더스코어 prefix 의미(제품 정의/레이아웃)와는 맞지 않는 용도(인덱스+동기정책)로 사용되고 있다.
  - 제안: `_overview.md` → `overview.md` 또는 `0-overview.md` 로 변경을 검토한다. 하위 디렉토리 내 인덱스 파일에 언더스코어 prefix를 허용한다면 컨벤션에 해당 예외를 추가하는 것이 좋다.

---

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §4.1 — `GET /api/auth/verify-email` 으로 명시되어 있으나 §8 API 엔드포인트 표에서는 `POST /api/auth/verify-email` 로 상충
  - target 위치:
    - §2.5 이메일 인증 안내 화면 본문: `GET /api/auth/verify-email?token={token}`
    - §8 API 엔드포인트 표: `POST | /api/auth/verify-email`
  - 위반 규약: 출력 포맷 규약 — API 엔드포인트 HTTP 메서드가 문서 내에서 일관되어야 함
  - 상세: 동일 파일 내에서 이메일 인증 확인 API 의 HTTP 메서드가 `GET` (§2.5) 과 `POST` (§8 표) 로 서로 다르게 기술되어 있다. 구현자가 다른 메서드로 구현할 위험이 있다. 이는 spec 문서 내 데이터 일관성 문제로 정식 API 규약 위반이 아니지만 내부 비일관성이다.
  - 제안: 실제 구현된 메서드를 확인 후 한쪽을 정정한다. 이메일 인증 링크는 브라우저가 직접 방문하는 경우 `GET` 이 자연스럽고, 쿼리 파라미터(`?token=`) 형태는 `GET` 을 시사한다. §8 표를 `GET` 으로 수정하거나, `POST` 가 맞다면 §2.5 의 본문 설명을 수정한다.

---

### 요약

`spec/2-navigation/` 전반은 CLAUDE.md 의 핵심 금지 항목(옛 `prd/`, `memory/` 경로 신규 사용)을 직접 답습하는 패턴은 없다. 그러나 `14-execution-history.md` 에서 docs-consolidation 이후에도 관련 문서 링크에 자기 참조 "PRD" 링크와 `prd/` 경로 출처 주석이 남아 있어, 금지된 경로 개념을 문서 본문에 고착시키고 있다. 또한 동일 파일에서 `## Overview` 와 `## 1. 개요` 가 중첩되어 권장 3섹션 구조가 흐트러져 있다. 여러 spec 파일에서 `## Rationale` 섹션 누락이 광범위하게 발생하나 이는 권장 사항이다. `0-dashboard.md` 의 파일명 prefix 관행과 `_overview.md` 의 언더스코어 사용은 컨벤션의 의도와 미세하게 어긋나나 기존 관행이 누적된 경우로 즉각적인 invariant 파괴는 없다. 전체적으로 규약 위반의 심각도는 낮으며, `14-execution-history.md` 의 구조 문제가 가장 정리가 필요한 지점이다.

### 위험도

LOW
