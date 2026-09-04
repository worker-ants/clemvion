# Rationale 연속성 검토 — spec/2-navigation/

## 검토 요약

- 검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
- `spec/2-navigation/` 자체의 spec 델타: **0개 파일** (이 브랜치는 navigation 영역 spec 을 바꾸지 않았다 — 정상)
- 실제 구현 diff: 3개 파일 / 213줄, 전부 `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` 및 `repo-guards/__tests__/swagger-dto-contract-*` — **alerts 모듈 · Swagger DTO 계약 가드** 영역이며, `spec/2-navigation/` (schedule · workflow-list · trigger-list 등) 의 code_areas(스케줄/트리거/워크플로우 목록 controller·service·frontend page) 와 겹치지 않는다.

## 발견사항

이번 diff 는 `spec/2-navigation/3-schedule.md`, `1-workflow-list.md`, `2-trigger-list.md` 의 `## Rationale` 항목(스케줄 sort/order 표기 해제, Schedule 트리거 생성 경로 제한, 딥링크 비대칭, 공유 워크플로우 정의, import permissive 정책, 폴더 계층 무결성, 태그 필터 하향, R-1~R-16 트리거 상세 정책군) 중 어느 것도 다시 열거나 뒤집지 않는다. diff 의 유일한 코드 변경(`AlertRuleDto.threshold: number → string` + `findNumericAsNumber` 신규 가드)은 alerts 도메인에 국한되며, navigation 스펙이 참조하는 API/데이터 경로(스케줄 CRUD, 트리거 CRUD, 워크플로우 목록/필터/폴더)를 건드리지 않는다. 따라서 CRITICAL/WARNING 대상은 없다.

- **[INFO] alerts DTO 타입 정정이 `spec/1-data-model.md` §2.25 와 잠재적으로 어긋남 — scope 밖이지만 기록**
  - target 위치: diff `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (`AlertRuleDto.threshold: number → string`)
  - 과거 결정 출처: `spec/1-data-model.md` §2.25 alert_rule 테이블 — `| threshold | Float | 임계치 (DB 는 NUMERIC(12,4) 고정소수) |` (해당 절 자체는 2026-08-31 Rationale "`alert_rule` 을 §2.25 로 등재" 에서 신설됨)
  - 상세: 이번 diff 는 코드 주석으로 "OpenAPI 만 거짓말을 하고 있었다"는 충분한 근거를 남기며 wire 타입을 `number`→`string` 으로 정정했다. 이는 §2.25 등재 Rationale ("컬럼이 어딘가엔 적혀 있다는 SoT 가 아니다" — 문서 정합을 중시하는 원칙)의 정신과 부합하는 방향의 수정이지만, §2.25 자체의 `Float` 표기(도메인/개념 타입)와 API 응답의 `string` (wire 타입)이 같은 문서 생태계 안에서 별다른 상호 참조 없이 다른 말을 하게 됐다. 결정을 "번복"한 것은 아니다(§2.25 는 DB 컬럼 타입 설명이지 API wire 계약이 아니었으므로 직접 충돌은 아니다) — 다만 두 문서를 같이 읽는 사람에게는 타입 불일치로 보일 여지가 있다.
  - 제안: 이 항목은 `spec/2-navigation/` 스코프 밖(alerts 는 다른 spec 영역)이라 본 검토의 판정에는 반영하지 않는다. 후속 alerts/data-model 대상 정합 검토에서 §2.25 표기에 "API 응답은 string(wire), 개념 타입은 Float" 각주를 추가할지 판단 권장.

## 요약

`spec/2-navigation/` 스코프의 spec 델타는 0이고, 이번 diff(alerts DTO 타입 정정 + 신규 numeric-as-number swagger 가드)는 navigation 영역의 코드·문서 어느 것도 건드리지 않는다. `3-schedule.md`/`1-workflow-list.md`/`2-trigger-list.md` 의 Rationale 에 기록된 기각된 대안(예: 태그 멀티 선택, `/toggle` 서브경로, Schedule 트리거 직접 생성, drawer 자동 오픈 비대칭 등)이나 합의 원칙(단일 편집 경로, config permissive vs settings hard-fail 분리 등) 중 어느 것도 이번 diff 로 재도입·위반되지 않는다. diff 자체는 alerts 도메인에서 자기완결적 rationale(코드 주석)을 남기며 이전의 잘못된(미검증) DTO 타입 표기를 정정하는 형태로, 같은 저장소의 기존 관행("Planned 해제는 번복이 아니라 문서 동기화")과 일치한다. 유일하게 주목할 점은 alerts 도메인이 참조하는 `spec/1-data-model.md` §2.25 의 `Float` 표기와 새 wire 타입 `string` 사이의 잠재적 표기 간극인데, 이는 `spec/2-navigation/` 스코프 밖이라 위험도 판정에는 반영하지 않는다.

## 위험도

NONE
