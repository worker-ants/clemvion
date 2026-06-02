# Cross-Spec 일관성 검토 결과

## 발견사항

- **[WARNING]** `spec/2-navigation/_layout.md` §1 ASCII 다이어그램 동기화 누락
  - target 위치: plan/in-progress/system-status-page.md §C — `_layout.md` §2.2 수정안
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/_layout.md` §1 (레이아웃 구조 ASCII), §2.2 메뉴 항목 표
  - 상세: draft는 `_layout.md` §2.2 메뉴 항목 표에 System Status(10번)를 삽입하고 User Guide를 11번으로 올리는 안을 명시한다. 그러나 현재 `_layout.md` §1 ASCII 다이어그램("Nav Menu" 블록)에는 "Stats / User Gd" 순서로 나열되어 있다. §2.2 표만 수정하고 §1 ASCII 다이어그램을 갱신하지 않으면 같은 문서 안에서 §1과 §2.2가 불일치 상태가 된다. draft 에 ASCII 수정 지침이 없다.
  - 제안: spec 반영(C단계) 시 `_layout.md` §1 ASCII 다이어그램의 "Stats / User Gd" 사이에 "SysStatus" 라인도 함께 삽입.

- **[WARNING]** `spec/2-navigation/_product-overview.md` §2 내비게이션 구조 트리 코드블록 동기화 누락
  - target 위치: plan/in-progress/system-status-page.md §D — `_product-overview.md` 수정안
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/_product-overview.md` §2 구조 트리 코드블록
  - 상세: 현재 §2 내비게이션 구조 트리에는 Statistics → User Guide → Marketplace 순이며 System Status 항목이 없다. draft §D는 "영역 트리에 System Status 항목 추가"를 언급하지만 §2 코드블록 텍스트 자체의 수정 지침이 구체화되어 있지 않다. §3에 §3.9 신규 추가·기존 §3.9~§3.11 재번호를 명시했으나 §2 코드블록도 함께 갱신해야 단일 진실 원칙이 유지된다.
  - 제안: spec 반영(D단계) 시 §2 구조 트리 코드블록에 `System Status` 행을 Statistics와 User Guide 사이에 🚧 상태로 삽입.

- **[WARNING]** `spec/0-overview.md` §6.1 내비게이션 완료 목록 동기화 계획 부재
  - target 위치: plan/in-progress/system-status-page.md — 작업 체크리스트
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/0-overview.md` §6.1 내비게이션 행
  - 상세: `spec/0-overview.md` §6.1 내비게이션 행에는 구현 완료 항목으로 "대시보드, 워크플로우 목록, ..., 통계, 사용자 매뉴얼, 사용자 프로필"이 열거된다. System Status 페이지 구현 완료 후 이 목록에 추가되어야 하나 plan 체크리스트에 해당 단계가 없다. 구현 후 0-overview.md가 stale 상태로 방치될 위험이 있다.
  - 제안: 작업 체크리스트에 "spec/0-overview.md §6.1 내비게이션 행 갱신" 단계를 spec commit 또는 구현 완료 후 단계에 추가.

- **[INFO]** `spec/5-system/2-api-convention.md` §2.3 워크스페이스 스코핑 원칙과 `GET /queue-monitor/overview`의 cross-workspace 특성
  - target 위치: plan/in-progress/system-status-page.md §A §2 — `GET /queue-monitor/overview`
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md` §2.3
  - 상세: API 규약 §2.3은 "모든 리소스 API는 현재 워크스페이스 컨텍스트에서 동작한다"고 명시한다. 그러나 `GET /queue-monitor/overview`는 시스템 전역(cross-workspace) 큐 상태를 반환하며 `X-Workspace-Id` 컨텍스트가 무의미하다. 직접 모순은 아니지만(spec이 "모든" 예외 없는 규칙을 강제하는 건 아님) 암묵적 예외가 신규 spec 문서에서만 명시되는 구조다.
  - 제안: `spec/5-system/16-system-status.md` §2 API 설명에 "워크스페이스 컨텍스트(`X-Workspace-Id`)는 무시된다 — 시스템 전역 API" 임을 명시하여 API 규약 §2.3과의 관계를 명확히 함.

- **[INFO]** `spec/2-navigation/15-system-status.md` Rationale의 통계 화면 패턴 참조 범위 모호성
  - target 위치: plan/in-progress/system-status-page.md §B Rationale
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/7-statistics.md`
  - 상세: draft Rationale에서 "구조·인증·`{data}` 추출·폴링 패턴은 기존 통계 화면(7-statistics.md)을 그대로 따른다"고 명시한다. 그러나 통계 화면(`7-statistics.md`)은 5초 자동 폴링을 사용하지 않고 수동 새로고침 기반이다. System Status §2.4에서 `refetchInterval ~5초` 폴링을 별도 정의하고 있어 폴링 패턴이 통계 화면과 동일하지 않다. 기능 자체에는 문제가 없으나 Rationale 문구가 오해를 유발할 수 있다.
  - 제안: Rationale 참조 범위를 "레이아웃·인증·`{data}` 추출 패턴은 통계 화면을 따른다. 폴링은 실시간성 요구로 별도 정의"로 구분.

---

## 요약

target draft(`plan/in-progress/system-status-page.md`)는 기존 spec과 데이터 모델 충돌(신규 엔티티 없음), API 계약 충돌(기존 endpoint와 겹치지 않음), 요구사항 ID 충돌(NAV-SS-* 신규 네임스페이스, NF-OB-06 연속 번호), 상태 전이 충돌, RBAC 충돌이 없어 구조적으로 안전하다. 주요 위험은 세 개의 WARNING으로, spec 반영 시 `_layout.md` §1 ASCII 다이어그램·`_product-overview.md` §2 구조 트리 코드블록·`0-overview.md` §6.1 목록이 동기화 누락될 가능성이다. 모두 spec 작성 단계에서 해당 위치를 명시적으로 수정하면 해소되는 동기화 문제이며 직접 모순은 아니다.

---

## 위험도

LOW
