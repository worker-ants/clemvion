# Convention Compliance Review

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 대상**: `spec/2-navigation/4-integration.md`
**정식 규약 참조**: `spec/conventions/swagger.md`, `spec/conventions/node-output.md`, `spec/conventions/cafe24-api-catalog/_overview.md`

---

## 발견사항

- **[INFO]** 문서 구조 — `## Rationale` 섹션 위치 적합
  - target 위치: 문서 최하단 `## Rationale` 섹션 (line 930~)
  - 위반 규약: `spec/conventions/` 및 CLAUDE.md 명명 컨벤션 (권장 3섹션: Overview / 본문 / Rationale)
  - 상세: 문서가 `## 1. 라우트 구성` 으로 시작해 `## Overview (제품 정의)` 섹션이 별도 존재하지 않는다. 대신 서두의 관련 문서 링크가 `_product-overview.md` 를 가리키고, 본 파일이 "기술 명세(스펙) 본문" 역할을 담당하는 구조다. CLAUDE.md 에서 "`spec/<영역>/N-name.md` — 본문 끝에 `## Rationale` 섹션을 권장" 이라고 명시한 규약은 충족되어 있다. `4-integration.md` 의 파일명 패턴(`N-name.md`) 도 적합하다. 다만 스펙 본문의 첫 절 앞에 간략한 `## Overview` 요약 섹션(사용자 가치·목표 2~3문장)이 없어 단일 파일에서 제품 정의 맥락을 바로 확인하기 어렵다.
  - 제안: 1절 앞에 `## Overview` 섹션 추가를 고려하거나, 현재처럼 링크를 통해 `_product-overview.md` 로 위임하는 구조를 명시적으로 유지한다. 규약상 강제 사항은 아님.

- **[INFO]** API 응답 error code 형식 혼재 — `status_reason` vs HTTP 에러 코드 구분은 의도적
  - target 위치: `§9.4 공통 응답 포맷` 및 `§10.4 에러 매핑`
  - 위반 규약: `spec/conventions/swagger.md §2-4` (상태 코드 응답 규칙)
  - 상세: HTTP 응답 에러 코드 (`INTEGRATION_IN_USE`, `CAFE24_INSTALL_MISSING_PARAMS` 등) 는 `UPPER_SNAKE_CASE` 를 사용하고, DB 컬럼 `status_reason` 값 (`auth_failed`, `install_timeout`, `oauth_token_exchange_failed` 등) 은 `snake_case` 를 사용한다. 두 표기 체계가 혼재하나, Rationale 에서 의도적으로 도메인 분리(HTTP 컨벤션 vs DB 컨벤션)를 명문화하고 있다. `spec/conventions/swagger.md §2-4` 는 HTTP 상태 코드 데코레이터 규칙을 정의하며, 응답 `code` 필드의 casing 규칙은 해당 문서에 명시적으로 정의되어 있지 않다. 실질적인 convention 위반이 아니며 Rationale 문서화로 충분히 설명됨.
  - 제안: `spec/conventions/swagger.md` 에 "응답 body 의 `code` 필드는 `UPPER_SNAKE_CASE`" 규약을 선택적으로 추가해 문서 간 명시적 일관성을 강화할 수 있음. 본 파일 수정 불필요.

- **[INFO]** `spec/conventions/cafe24-api-catalog` 연동 방향
  - target 위치: `§5.8 Cafe24` — scope 권장 프리셋 표
  - 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §1` (18 resource 단위 enumeration 이 단일 진실)
  - 상세: `§5.8` 의 Scope 권장 프리셋 표가 `Application`, `Store`, `Design`, `Community`, `Collection`, `Supply`, `Personal`, `Privacy` 를 포함해 총 18 카테고리를 나열하고 있다. 이는 `cafe24-api-catalog/_overview.md §5` 의 18 resource (`store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application`, `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation`) 와 내용상 중복이다. 두 문서가 같은 진실을 다른 맥락에서 서술하는 것은 자연스러우나, 카테고리 목록이 달라질 경우 두 곳을 동시에 갱신해야 하는 동기화 부담이 있다.
  - 제안: `§5.8` 의 scope 프리셋 표에 `[Cafe24 API 카탈로그 §1](../../conventions/cafe24-api-catalog/_overview.md#1-디렉토리-구조)` 참조 링크를 추가해 SoT 를 명확히 가리키는 것을 권장. 강제 수정은 불필요.

- **[INFO]** 파일명 패턴 준수 확인
  - target 위치: `spec/2-navigation/4-integration.md` 파일 자체
  - 위반 규약: CLAUDE.md 명명 컨벤션 `spec/<영역>/N-name.md`
  - 상세: `4-integration.md` 는 숫자 prefix (`4-`) + 평문 이름 패턴을 따른다. `spec/2-navigation/` 디렉토리 안에 `_product-overview.md`, `_layout.md`, `0-dashboard.md` 등이 적절히 배치되어 있다. 규약 준수 확인 — 이상 없음.
  - 제안: 없음.

- **[INFO]** 금지 경로 참조 없음 확인
  - target 위치: 문서 전체 링크 및 참조
  - 위반 규약: CLAUDE.md "옛 `prd/`, `memory/`, `user_memo/` 폴더 사용 금지"
  - 상세: 문서 내 링크가 `spec/`, `../`, `plan/` 경로만 참조하며, 폐기된 `prd/`, `memory/`, `user_memo/` 경로를 사용하지 않는다. Rationale 섹션의 review 참조 (`review/consistency/2026/05/14/18_23_55`) 는 역사 기록용 참조로 폐기 경로가 아님. 규약 준수 확인 — 이상 없음.
  - 제안: 없음.

---

## 요약

`spec/2-navigation/4-integration.md` 는 정식 규약(`spec/conventions/`) 을 전반적으로 잘 준수하고 있다. 파일명 패턴(`N-name.md`), `## Rationale` 섹션 포함, 금지 경로 미사용, HTTP 에러 코드 규약(`UPPER_SNAKE_CASE`) 의 일관된 적용 등 핵심 규약 준수 사항이 모두 충족된다. DB 내부 `status_reason` 값의 `snake_case` 와 HTTP 응답 `code` 의 `UPPER_SNAKE_CASE` 혼재는 Rationale 에서 의도적으로 명문화되어 있어 위반이 아니다. 발견된 사항은 모두 INFO 등급(소규모 형식 일관성 제안) 으로, 구현 착수를 차단하는 CRITICAL 이나 WARNING 은 없다.

## 위험도

NONE
