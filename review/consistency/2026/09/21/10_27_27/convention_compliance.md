### 발견사항

- **[WARNING] `1-workflow-list.md` frontmatter `pending_plans:` 가 이미 완료된 plan 을 "미구현 surface" 로 계속 지목**
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter (11~13행), `pending_plans:` 목록의 두 번째 항목 `plan/complete/workflow-duplicate-nodes-edges.md`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`pending_plans` 필드 정의 — "**미구현** surface 를 책임지는 plan 경로") · §3 `status` 라이프사이클 표 · §3.1 전이 규칙
  - 상세: `plan/complete/workflow-duplicate-nodes-edges.md` 는 `status: complete` 이고, 그 plan 이 고치려던 "복제가 빈 워크플로우를 만든다" 결함은 이미 해소되어 본 spec §2.6 "복제" 행이 "노드·엣지를 포함한 캔버스 전체가 복사되고…" 로 **완료된 동작**을 서술한다(더 이상 "미구현 (Planned)" 표기가 없음). 그런데 frontmatter 는 이 plan 경로를 여전히 `pending_plans:` 에 남겨 두고 있다 — §2.1 정의상 `pending_plans` 는 "그 문서가 아직 못 다한 약속을 책임지는" 항목만 담아야 하는데, 이 항목은 더 이상 그런 역할이 없다. 또한 §2.1 은 경로 표기를 "`plan/in-progress/` 또는 `plan/complete/`(**in-progress→complete 치환**)" 라고 정의하는데, 이는 가드가 존재-검사 시 in-progress 경로를 complete 로 대체 조회한다는 뜻이지, spec 저자가 애초부터 `plan/complete/...` 를 문자 그대로 적어 두라는 뜻이 아니다. `spec/2-navigation/**` 15개 문서 전수 중 `pending_plans:` 에 `plan/complete/` 경로를 직접 적은 사례는 이 한 곳뿐이다(grep 확인). 같은 문서의 나머지 항목(`plan/in-progress/marketplace-and-plugin-sdk.md`)은 §2.7 "마켓플레이스 템플릿 추천 링크 미구현" 과 실제로 연결되어 있어 `status: partial` 유지 자체는 정당하지만, 완료 plan 항목은 남겨 둘 근거가 없다.
  - 제안: 두 갈래 중 하나 — (a) `pending_plans:` 에서 `plan/complete/workflow-duplicate-nodes-edges.md` 항목을 제거(그 plan 의 spec 책임은 이미 종료됐으므로), 또는 (b) 정말 이 문서가 아직 그 plan 에 남은 책임(예: 후속 정리)이 있다면 그 사실을 본문에 "미구현 (Planned)" 형태로 명시해 `pending_plans` 존재를 정당화. 규약 자체는 이미 이런 "판정 근거를 승격/정리 commit 에 남긴다"(spec-impl-evidence.md §R-11)는 절차를 요구하므로 이번에도 그 절차를 따르면 됨 — 규약 갱신은 불필요.

- **[INFO] `14-execution-history.md` 의 bare `hh_mm_ss` 리뷰 인용은 grandfather 대상으로 확인됨 — 재-flag 불필요**
  - target 위치: `spec/2-navigation/14-execution-history.md:479` (`` `10_53_52` security/architecture W2·W3 ``)
  - 위반 규약: `spec/conventions/review-citations.md` §2 (bare `hh_mm_ss` 인용 금지)
  - 상세: `git log -S'10_53_52'` 로 확인한 결과 이 문구는 `a17e1a0da`(2026-08-27) 커밋에서 도입됐고, `review-citations.md` 규약은 §Overview 실측 기준일이 2026-09-05~06 이라 그보다 늦게 성문화됐다. §4 "기존 인용은 소급 정리 대상이 아니다" 에 해당하는 grandfather 케이스이므로 이번 검토에서 위반으로 카운트하지 않음 — 다만 향후 이 절을 다시 손댈 때 날짜를 포함한 전체 경로 형태로 정리 권장.

### 요약
`spec/2-navigation` 영역을 `spec/conventions/**`(특히 `error-codes.md`·`swagger.md`·`secret-store.md`·`audit-actions.md`·`i18n-userguide.md`·`spec-impl-evidence.md`·`redis-keys.md`·`review-citations.md`)와 대조한 결과, DTO/에러코드/감사 액션 명명·API 응답 포맷·frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 등 핵심 축에서는 실질적 위반을 발견하지 못했다 — 특히 `2-trigger-list.md`·`3-schedule.md` 의 `TriggerDto.workflow` vs `ScheduleDto.trigger.workflow` 비대칭, `secret://triggers/<id>/*` ref 명명, `trigger-config:<triggerId>` advisory lock 키, `nav-agent-memory` id 충돌 회피 등은 모두 해당 규약의 명시적 규정과 정확히 일치한다. 유일하게 확인된 실질적 이슈는 `1-workflow-list.md` frontmatter 의 `pending_plans:` 가 이미 완료·반영된 plan(`workflow-duplicate-nodes-edges.md`)을 여전히 "미구현 surface" 항목으로 지목하고 있는 문서 위생 문제로, build 가드는 통과하지만 `spec-impl-evidence.md` 가 정의한 필드 의미와는 어긋난다. 다만 `spec/2-navigation/4-integration.md`·`6-config.md`·`9-user-profile.md`·`13-user-guide.md` 등 프롬프트 번들에서 컨텍스트 예산으로 절단된 파일들은 파일시스템에서 표본적으로만 직접 열람했고 전수 정밀검토는 아니므로, 그 안의 세부 위반 가능성은 완전히 배제할 수 없다.

### 위험도
LOW
