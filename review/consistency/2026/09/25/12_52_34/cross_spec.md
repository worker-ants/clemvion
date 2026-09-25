# Cross-Spec 일관성 검토 — CHANGELOG 기준 plan (changelog-criteria)

## 발견사항

없음.

target 문서(`plan/in-progress/changelog-criteria.md`)는 `spec_impact: none` 으로 선언돼 있고, 실제 처방(B절)도
`CHANGELOG.md` 본문과 `.claude/agents/documentation-reviewer.md` 관점 6 서술만 변경한다 — 둘 다 `spec/**` 트리 밖이다.
Cross-Spec 점검 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 은 모두 `spec/**` 이 정의하는
엔티티·계약·요구사항 ID·상태 머신·권한 구조·모듈 경계를 대상으로 하는데, 이 plan 은 그중 어느 것도 새로 정의하거나
바꾸지 않는다 — 새 엔티티/필드, 새 endpoint, 새 요구사항 ID, 새 상태 전이, 새 권한 규칙, 새 계층 분할 중 어느 것도
등장하지 않는다.

보조로 확인한 사항:

- `spec/**` 안에서 "CHANGELOG" 를 언급하는 곳은 세 군데뿐이다 — `spec/2-navigation/0-dashboard.md:170`,
  `spec/5-system/15-chat-channel.md:1006`, `spec/conventions/swagger.md:398`. 전부 과거 결정의 근거를 설명하는
  Rationale/inline 서술이고, "CHANGELOG 에 무엇이 들어가야 하는가" 를 규범적으로 정의하는 spec 문서는 존재하지
  않는다. 즉 target 이 세우려는 기준과 형식적으로 충돌할 기존 spec 정의가 없다 (target 이 제거하려는 유일한
  기존 서술은 `.claude/agents/documentation-reviewer.md` 관점 6 의 원문인데, 이 파일은 `spec/` 이 아니라
  harness 거버넌스 문서라 이 checker 의 스코프 밖이다 — code-review-agents/harness self-consistency 쪽에서
  다룰 사안).
- target 이 참조하는 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 실재한다 — 인용이
  가리키는 대상은 존재를 확인했다 (본 checker 는 그 트래커 항목 서술 자체의 정합성까지는 검증하지 않았다;
  plan 라이프사이클 검토 범위).
- `spec/0-overview.md` §8 문서 맵의 spec 트리 구조·영역 경계 서술과도 접촉점이 없다 — target 은 어떤 spec
  영역 폴더도 새로 만들거나 옮기지 않는다.

## 요약

target 은 제품 spec 이 아니라 저장소 운영 규약(어떤 커밋이 CHANGELOG 항목을 내는가)을 성문화하는 harness/프로세스
성격의 plan 이며, 변경 대상 파일(`CHANGELOG.md`, `.claude/agents/documentation-reviewer.md`) 도 처방(B절)도
`spec/**` 트리를 건드리지 않는다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도
`spec/**` 의 다른 영역과 모순될 표면 자체가 없다.

## 위험도

NONE
