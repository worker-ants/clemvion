### 발견사항

- **[INFO]** 선례 plan(`error-codes-catalog-sot.md`)이 완료 상태인데 in-progress 에 잔류
  - target 위치: `plan/in-progress/workspace-membership-codes.md` 전체 (§1.9 신설이 의존하는 "도메인 spec 참조" 패턴의 직접 선례)
  - 관련 plan: `plan/in-progress/error-codes-catalog-sot.md` — `## 워크플로` 전 항목 `[x]`, `## 후속` 2건도 `[x]`(#893 PR `7f395638f` 로 완료 확인)이나 여전히 `in-progress/` 에 위치, `plan/complete/` 로 미이동
  - 상세: target 이 §1.9 를 신설하며 참조하는 "§1.5~§1.8 도메인 참조 패턴"은 정확히 이 plan 이 §1.2.1/§1.8 을 추가하며 확립한 것과 동일 패턴이다. 코드로 검증한 결과 현재 `spec/5-system/3-error-handling.md` intro 문장("...webhook §1.7·KB/Graph RAG §1.8)")과 §1.2.1/§1.8 실제 내용이 target 문서에 인용된 문장과 정확히 일치해 target 의 diff baseline 은 stale 하지 않다. 다만 선례 plan 자체가 라이프사이클상 미종결 상태로 남아 있는 것은 target 과 무관한 housekeeping 갭이다.
  - 제안: target 의 작업과는 독립적으로, `error-codes-catalog-sot.md` 를 별도로 `plan/complete/` 이동 처리(plan-lifecycle 규칙 따라 frontmatter 정비 포함) 권장. target 자체의 승인·진행을 막을 사유는 아님.

### 요약

`workspace-membership-codes.md` 는 `spec/5-system/3-error-handling.md §1` 에 신규 §1.9(워크스페이스 멤버 직접 추가 에러 코드)를 추가하는 draft 이며, 코드로 대조한 결과 (1) diff 대상 파일의 현재 intro 문장·§1.2/§1.2.1/§1.8 실제 내용이 target 인용과 정확히 일치(§1.9 번호 미점유 확인), (2) 참조하는 본문 SoT `spec/data-flow/12-workspace.md §1.9`(`#19-멤버-직접-추가-기가입-사용자` 앵커) 가 이미 존재하며 트리거·코드 3종이 target 표와 동일, (3) `spec/conventions/error-codes.md §3` historical-artifact 레지스트리가 이미 "직접 추가 경로(§1.9)"를 언급하며 UPPER/lowercase 분리를 명시해 target 의 naming_collision 결론과 정합, (4) 배경으로 인용한 #893(`7f395638f`, `error-codes-catalog-sot.md` 후속 항목)이 실제로 "별도 완결성 pass"로 이 workspace 직접-추가 3코드를 남긴 것과 일치함을 확인했다. `plan/in-progress/**` 전수 검색 결과 이 target 의 §1.9 배치·코드 정의와 충돌하거나 미해결로 남긴 관련 결정 항목은 발견되지 않았고(가장 근접한 `error-codes-catalog-sot.md` 는 카탈로그 확장 선례를 이미 확정·완료), 다른 in-progress plan 의 후속 항목을 무효화하지도 않는다. CRITICAL/WARNING 없음.

### 위험도
NONE
