# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위 및 방법론 메모

- 조립된 프롬프트는 예산 초과로 target 15개 파일 중 3개(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 전문이 실렸고, 나머지 12개 target 파일과 `related spec` 94개 파일(그중 `spec/conventions/**` 전량 포함)은 본문이 통째로 생략됐다.
- "생략됨"을 "내용 없음"으로 간주하지 않고, target 이 실제로 의존을 선언한 cross-reference 중 검증 가능성이 높은 것들을 `Read` 로 직접 열어 대조했다: `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/12-workspace.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/6-config.md`, `spec/5-system/16-system-status-api.md`.
- 대조 결과 모두 target 의 서술과 **정합**했다 (아래 상세). 다만 이번 검토는 elided 94개 파일 전부를 대상으로 한 전수 대조가 아니므로, 검증하지 않은 조합에 잠재 drift 가 남아 있을 가능성은 배제하지 못한다.
- `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 이미 다수의 과거 `--impl-prep`/cross-audit 라운드를 거치며 세부 Rationale 로 결정·기각 대안을 촘촘히 기록해 둔 성숙한 문서다(예: `1-auth.md §3.2` 각주의 "발견 경로: retry-turn P1 착수 전 --impl-prep spec/5-system/ CRITICAL #1" 처럼 과거 발견을 이미 흡수). 이번 라운드의 실제 작업(`terminal-duration-sql-safety-net`, `spec_impact: none`, e2e 전용)은 이 target 영역의 spec 본문을 변경하지 않는다.

## 발견사항

- **[INFO]** `2-navigation/9-user-profile.md §4.2` RBAC 매트릭스에 `1-auth.md §3.2` SoT 포인터 부재
  - target 위치: `spec/5-system/1-auth.md` Overview — "인가 (§3) — 워크스페이스 스코프 RBAC 매트릭스(역할별 권한 ...)" 및 §3.2 리소스별 권한 매트릭스
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2 역할 권한 매트릭스` (라인 227-240)
  - 상세: 두 문서가 각각 Owner/Admin/Editor/Viewer 권한 표를 보유한다. 실제 내용은 현재 정합적이다(워크플로우 CRUD·실행, Org Integration 생성, 멤버 관리, 워크스페이스 설정/삭제, Admin 역할 부여 모두 세부 대조 시 일치 — user-profile 쪽은 write-level 이진 표기, auth.md 쪽은 CRUD 세분 표기라는 입도 차이만 있음). 다만 같은 `9-user-profile.md` 문서의 다른 절(§4.1.1 초대 토큰, §2 이메일/비밀번호 변경 등)은 모두 "상세 흐름·API 는 [Spec 인증/인가 §X]" 형태로 SoT 포인터를 명시하는 반면, §4.2 권한 매트릭스에는 그런 포인터가 없다. `1-auth.md §Rationale`("§3.2 정정")에 따르면 과거 실제로 이 두 매트릭스가 갈렸던 이력이 있고(2026-07-28, Admin 멤버 삭제 CRU→CRUD 정정 시 user-profile.md §4.2 가 교차 검증 근거로 쓰였다) — SoT 포인터가 없으면 향후 한쪽만 갱신되는 재발 여지가 있다.
  - 제안: `9-user-profile.md §4.2` 상단에 "권한 세부(R/RU/CRUD 단위) 의 SoT 는 [1-auth.md §3.2]" 같은 한 줄 포인터를 추가해 두 표의 관계(요약 vs 상세)를 명시. spec 본문 변경 항목이라 `project-planner` 소관.

검토한 주요 cross-reference 중 실제로 대조해 **일치를 확인**한 항목(참고, 발견사항 아님):

- `1-auth.md §1.5.4`·`3-error-handling.md §1.9` 의 초대 API `lower_snake_case` historical-artifact 서술 ↔ `conventions/error-codes.md` 레지스트리(초대 API 한정 범위 서술까지 일치).
- `1-auth.md §4.1.A`(Planned 액션 dot-prefix·시제 3분류) ↔ `conventions/audit-actions.md` §1~§3 taxonomy·레지스트리(model_config 현재형 예외 포함) — 일치.
- `2-api-convention.md §2.3`/`1-auth.md §2.2`(`activeWorkspaceId` 클레임, dual-read, header-first) ↔ `data-flow/12-workspace.md §1.5`/§Overview — 일치.
- `1-auth.md §3.2` Auth Config 권한 분리(CRUD Owner/Admin, R Editor/Viewer; Reveal Admin+) ↔ `2-navigation/6-config.md §A.4`·엔드포인트 표 — 일치.
- `1-auth.md §3.2` System Status 전 역할 R(관리자 가드 없음) ↔ `5-system/16-system-status-api.md §4 보안` — 일치.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`(전문 확인) 및 이들이 명시적으로 참조하는 `conventions/error-codes.md`·`conventions/audit-actions.md`·`data-flow/12-workspace.md`·`2-navigation/9-user-profile.md`·`2-navigation/6-config.md`·`5-system/16-system-status-api.md`(직접 Read 로 대조)를 기준으로, CRITICAL/WARNING 급 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. 이 영역은 이미 여러 차례의 `--impl-prep`/cross-audit 라운드를 거쳐 발견된 충돌을 Rationale 로 흡수한 성숙 상태이며, 이번 실제 작업(`terminal-duration-sql-safety-net`, spec 본문 변경 없음)도 이 영역의 spec 서술을 건드리지 않는다. 유일한 발견은 INFO 급으로, `9-user-profile.md §4.2` RBAC 요약 표가 `1-auth.md §3.2` 를 SoT 로 명시하지 않아 향후 드리프트 재발 여지가 있다는 점이다. 다만 컨텍스트 예산 초과로 target 15개 중 12개와 관련 spec 94개(특히 `spec/conventions/**` 전량)의 본문이 이번 프롬프트에서 생략됐으므로, 이번 결과는 "생략된 조합에서 발견되지 않음"이 아니라 "샘플링된 핵심 cross-reference 에서 발견되지 않음"으로 해석해야 한다.

## 위험도
LOW
