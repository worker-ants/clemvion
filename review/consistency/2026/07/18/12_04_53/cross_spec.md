### 발견사항

- **[INFO]** `scope` 필드/컬럼명이 두 도메인에서 다른 의미로 중복 사용
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §2 표 컬럼 정의 (`scope` = `read`/`write`, `mall.<scope>_<resource>` 의 가운데 토큰) · 각 field-level 문서의 `**Scope**: mall.read_application` 등
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration 엔티티의 `scope | Enum | personal / organization`
  - 상세: 두 문서 모두 "scope" 라는 동일 단어를 쓰지만 전자는 Cafe24 OAuth 권한 스코프(`read`/`write`), 후자는 Integration 레코드의 공유 범위(개인/조직)를 가리켜 개념이 전혀 다르다. 실질적 파싱·타입 충돌은 없다(서로 다른 테이블·문서 스코프이며 target 자신도 문맥상 이미 `mall.<scope>_<resource>` 로 한정해 모호성을 최소화함). 다만 두 문서를 나란히 참조하는 사람이 "scope" 를 같은 개념으로 오인할 여지가 낮게나마 있다.
  - 제안: 실질 조치 불요(우선순위 낮음). 필요 시 cafe24-api-catalog `_overview.md` §2 표에 "Cafe24 OAuth scope(카페24 권한 단위)이며 `Integration.scope`(개인/조직 공유 범위)와 무관" 각주 1줄 추가 정도로 충분.

- **[INFO]** `status` enum 값 `planned` 가 두 레이어에서 재사용되나 이미 target 문서 내에서 명시적으로 분리·고지됨
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §3 status enum (`deprecated` 행 설명 중 "spec frontmatter `status: archived`" 언급)
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` 의 spec 문서 lifecycle `status` (`implemented`/`planned`/`archived`)
  - 상세: 카탈로그의 `status: planned`(엔드포인트 미구현)와 spec frontmatter `status: planned`(스펙 문서 자체 상태, 정의는 spec-impl-evidence.md)는 별 도메인인데 동일 토큰 `planned` 를 공유한다. 다만 target 이 `deprecated` 행 설명에서 이미 "spec frontmatter `status: archived` 와는 별 도메인" 이라고 명시적으로 disambiguate 하고 있어(§3 표), 실질 충돌이라기보다 이미 인지·처리된 용어 중복이다.
  - 제안: 현행 유지. 후속 편집 시 `planned` 행에도 동일한 "별 도메인" 주석을 대칭적으로 붙이면 §3 표 전체가 self-contained 해짐(선택 사항).

### 교차검증 결과 (충돌 없음 확인)

아래 항목은 잠재 충돌 후보로 점검했으나 실제 repo 상태를 대조한 결과 **완전히 일치**함을 확인했다 (별도 조치 불요, 참고용 기록):

- `spec/conventions/audit-actions.md` 의 verb 시제 3분류·도메인별 분류 레지스트리(§3)는 `spec/5-system/1-auth.md` §4.1 이 실제로 산문 taxonomy 를 제거하고 카탈로그(구현/Planned 액션 목록)만 소유하도록 이미 리팩터되어 있어 서술 중복·모순이 없다. 구현 액션 목록(Integration/workspace/member/execution/auth_config/user)과 Planned 목록(workflow/trigger/schedule/model_config)이 두 문서에서 완전히 대칭(action 이름·개수·분류 패턴 일치).
- `workspace.deleted` 감사 제외 근거(`audit_log.workspace_id ON DELETE CASCADE`, V001)는 `spec/data-flow/12-workspace.md` §Rationale "workspace.deleted 감사 제외" 및 `spec/data-flow/1-audit.md` 에도 동일하게 서술되어 3개 문서가 일관됨.
- `spec/1-data-model.md` §2.18 `AuditLog.action` 은 "String"(자유 문자열 컬럼)으로 정의되어 있고, target 의 "읽기측은 닫힌 enum 으로 단정하지 않는다" 서술과 정확히 부합 — 데이터 모델 충돌 없음.
- Cafe24 endpoint 총량 485(카탈로그 supported row 합계)는 `spec/4-nodes/4-integration/4-cafe24.md` §9.2("실측 485, 3중 교차검증")·`_overview.md` §5 Coverage Matrix·실제 `codebase/backend/src/nodes/integration/cafe24/metadata/*.ts` 개수(18 resource 파일)까지 전부 일치. `application`(17)·`category`(17) 개별 resource 카운트도 target 표 row 수와 Coverage Matrix 수치가 일치.
- `application` resource 의 "Cafe24 앱 관리 API ≠ 우리 서비스 Integration `app_type`" naming-collision 주의는 target 문서 자체가 이미 명시적으로 disambiguate.
- `restricted` 컬럼 토큰(`scope`/`operation`)과 backend `restrictedApproval.level` 은 target §4 규칙9 에서 동일 토큰으로 강제 동기화됨이 명시되어 있어 별도 충돌 없음.

### 요약

target(`spec/conventions/audit-actions.md` + `spec/conventions/cafe24-api-catalog/**`)은 데이터 모델·API 계약·상태 전이·RBAC·계층 책임의 6개 관점 모두에서 `spec/0-overview.md`·`spec/1-data-model.md`·`spec/5-system/1-auth.md`·`spec/data-flow/1-audit.md`·`spec/data-flow/12-workspace.md`·`spec/4-nodes/4-integration/4-cafe24.md` 등 관련 영역과 대조했을 때 실질적 충돌(CRITICAL/WARNING)이 발견되지 않았다. 두 문서군 모두 이미 명시적 SoT 경계 선언(`이 문서가 소유하는 것` / `~는 별 도메인`)과 상호 참조를 갖추고 있고, 핵심 수치(485 endpoint, action 레지스트리, workspace.deleted 제외 근거)는 실제 repo 파일(1-auth.md §4.1, data-flow 문서, 4-cafe24.md, backend metadata 디렉터리)과 대조해도 완전히 일치했다. 발견된 것은 "scope"·"status(planned)" 두 단어가 서로 다른 도메인에서 재사용되는 저강도 용어 중복뿐이며, 둘 다 문맥상 혼동 가능성이 낮고 이미 부분적으로 disambiguate 되어 있다.

### 위험도
LOW
