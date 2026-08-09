# Cross-Spec 일관성 검토 — target: `spec/5-system/` (--impl-done)

## 검토 방법 메모

`spec/5-system/`(diff-base `origin/main` 대비 델타 0 — 현재 HEAD 는 `origin/main` 을 포함하는
후속 커밋들이며, 그 5커밋은 backend hygiene(auth guard reflection 테스트 보강·secret-store LIKE
e2e·CI backend-checks 등)만 다루고 `spec/**` 는 건드리지 않았다)와 `spec/**` 전 영역을 대조했다.
전략: (1) 직전 두 라운드(`review/consistency/2026/08/09/20_02_21/cross_spec.md` --impl-prep 전체
스캔, `20_07_08/cross_spec.md` --spec 좁은-스코프 5-item diff 검토)가 이미 커버한 범위를 실제
파일(`spec/5-system/1-auth.md`·`3-error-handling.md`·`15-chat-channel.md`·
`conventions/secret-store.md`·`data-flow/12-workspace.md`)로 재확인해 두 라운드의 WARNING/INFO
가 이후 커밋(`602f677cd` #1112)에서 실제로 반영됐는지 검증, (2) 두 라운드가 아직 다루지 않은
"폭넓은" 교차참조 — 새로 등재된 `VALIDATION_ERROR`(X-Workspace-Id 형식오류) 항목이 `X-Workspace-Id`
를 언급하는 다른 모든 spec 문서(`2-navigation/4-integration.md`·`9-user-profile.md`·
`5-system/2-api-convention.md`·`16-system-status-api.md`·`data-flow/1-audit.md`·`0-overview.md`)
와 모순되지 않는지 전수 grep, (3) 이번 세션이 코드에 남긴 docstring 정정(`uuid.ts` 캐너리 앵커
재지목, 커밋 `9b775e878`)이 대응 spec Rationale(`data-flow/12-workspace.md`)과 여전히 일치하는지
대조, (4) 20_02_21 라운드가 남긴 유일한 WARNING(Agent Memory RBAC 매트릭스 누락 행)의 현재
상태를 재확인.

---

## 발견사항

- **[WARNING] Agent Memory 리소스가 §3.2 RBAC 매트릭스에서 여전히 누락 (직전 라운드 이월, 미해결)**
  - target 위치: `spec/5-system/17-agent-memory.md` §6 (라인 120-123) —
    `GET /agent-memories/scopes`·`GET /agent-memories` = "워크스페이스 멤버(viewer+)",
    `DELETE /agent-memories/:id`·`DELETE /agent-memories?scopeKey=` = "editor+"
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" (라인 364-389) — Overview
    가 "인가(§3) — 워크스페이스 스코프 RBAC 매트릭스(역할별 권한)"를 이 문서의 단일 진실로
    선언하는 바로 그 표
  - 상세: `review/consistency/2026/08/09/20_02_21/cross_spec.md` 가 이미 동일 항목을 WARNING 으로
    보고했고(구조적으로 동형인 Knowledge Base·Model Config 는 §3.2 행이 있는데 Agent Memory 만
    없음), `spec/2-navigation/16-agent-memory.md` 라인 49·63-64 도 동일 viewer+/editor+ 권한을
    재확인하지만 §3.2 로의 역참조는 없다. 이번 세션(backend-hygiene-followups)은 `spec/5-system/`
    에 델타가 없어(diff-base 대비 0) 이 갭이 그대로 재현된다 — 코드·문서가 값 자체는 모순되지
    않지만(양쪽 도메인 spec 은 서로 일치), §3.2 를 유일 참조점으로 신뢰하는 독자(신규 리소스
    추가 시 권한 설계 참고·감사/보안 리뷰)는 Agent Memory 의 존재를 여전히 놓친다. 같은 클래스의
    drift(도메인 spec 의 실제 권한이 §3.2 표와 어긋나거나 누락)는 과거 실제 impl-prep 게이트에서
    CRITICAL 로 처리된 전례가 있다(`71ce6c12b`).
  - 제안: `spec/5-system/1-auth.md` §3.2 표에 `Agent Memory | — | — | D(scope) | R` 형태의
    행(또는 create/update 없음 각주)을 추가하고 `17-agent-memory.md` §6 에서 §3.2 를 역참조.
    이 항목은 본 checker 의 권한 밖(`spec/` 쓰기는 project-planner 소관)이라 반복 보고만 한다.

- **[INFO] 검증 완료 — 최근 auth 불변식 spec 동기화(#1112, 커밋 `602f677cd`)의 신규 콘텐츠는
  Cross-Spec 모순 없음**
  - 확인 대상: `3-error-handling.md §1.3` 신설 `VALIDATION_ERROR`(X-Workspace-Id 형식오류) 3분기
    노트, `15-chat-channel.md §5.4` 형제 행, `1-auth.md` 신설 "부트 캐너리" Rationale,
    `data-flow/12-workspace.md` 신설 "UUID 검증 강도 비대칭" Rationale, `conventions/secret-store.md
    §2.1` `deleteByPrefix` LIKE 메타문자 거부 각주.
  - 상세: (1) `X-Workspace-Id` 를 언급하는 다른 모든 spec 문서(`2-navigation/4-integration.md`
    `2-navigation/9-user-profile.md`·`5-system/2-api-convention.md`·
    `5-system/16-system-status-api.md`·`data-flow/1-audit.md`·`0-overview.md`)를 전수 grep 한
    결과, 새 3분기(부재→`WORKSPACE_ID_REQUIRED`/형식파손→`VALIDATION_ERROR`/비멤버→코드없는403)
    와 모순되는 이분법 서술은 없었다(`WORKSPACE_ID_REQUIRED` 언급은 대상 4개 파일에만 존재).
    (2) 직전 --spec 라운드(`20_07_08`)가 지적한 두 건 — "ParseUUIDPipe 19곳"(실측 오류, 18곳이
    맞음)과 `12-workspace.md` 신설 subsection 위치 서술 "Rationale 말미"(자기모순) — 둘 다 병합
    커밋에서 실제로 정정돼 있음을 파일 grep 으로 재확인(`18곳`으로 수정, "말미" 표현 소거).
    (3) 이번 세션이 코드에 남긴 `uuid.ts` docstring 정정(캐너리를
    `system-status.e2e-spec.ts`→`uuid.spec.ts`/`workspace-context.util.spec.ts` 로 재지목,
    커밋 `9b775e878`)은 `data-flow/12-workspace.md` "캐너리 지목 정정 (2026-08-09)" 서브섹션이
    이미 동일 내용으로 선반영돼 있어 spec↔code docstring 간 drift 없음.
  - 결론: 재보고 불요, 참고용 기록.

---

## 요약

`spec/5-system/`는 이번 세션(backend hygiene followups)에서 자체 델타가 없고(diff-base
`origin/main` 대비 0), 직전 두 consistency-check 라운드(--impl-prep 전체 스캔·--spec 좁은-스코프
diff 검토)가 이미 이 영역과 `spec/**` 전체를 다각도로 대조해 실질 갭 1건(Agent Memory RBAC 매트릭스
행 누락, WARNING)만 남겨 놓은 상태다. 본 라운드는 그 WARNING 이 여전히 미해결임을 재확인했고,
직전 라운드들이 지적한 정확성 이슈(ParseUUIDPipe 실측치·subsection 위치 서술)가 병합 시점에
정정됐음을 검증했으며, `X-Workspace-Id` 를 다루는 spec 전 문서에 대해 새 3분기 에러코드 분류와의
모순 여부를 전수 확인해 추가 갭을 찾지 못했다. 데이터 모델·API 계약·요구사항 ID·상태 전이·
RBAC·계층 책임 축 전반에서 새로운 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다.

## 위험도

LOW
