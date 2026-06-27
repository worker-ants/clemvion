# Cross-Spec 일관성 검토 — nav-spec-doc-fix

**검토 대상**: `plan/in-progress/nav-spec-doc-fix.md`
**변경 파일**:
- `spec/2-navigation/10-auth-flow.md` — §2.5/§2.6 블록 순서 교환 (내용 무변경)
- `spec/2-navigation/14-execution-history.md` — §2.1 목업 하단 주석 1줄 추가

---

## 발견사항

없음.

6가지 점검 관점 전체에서 cross-spec 충돌이 발견되지 않았다. 근거는 다음과 같다.

**1. 데이터 모델 충돌** — 없음.
두 변경 모두 엔티티·필드 정의를 수정하지 않는다. `10-auth-flow.md` 는 section 블록 위치 교환(헤더·앵커·콘텐츠 모두 동일, 물리 순서만 교정)이고, `14-execution-history.md` 는 설명 주석 추가뿐이다.

**2. API 계약 충돌** — 없음.
endpoint·HTTP method·request/response shape 변경이 전혀 없다. `14-execution-history.md §2.1` 에 추가된 주석(`Status | Trigger | Started At | Duration | Nodes 5열`)은 §2.4 테이블 정의와 일치하며, `spec/3-workflow-editor/3-execution.md` 의 `§14-execution-history §2.4` 참조는 영향받지 않는다.

**3. 요구사항 ID 충돌** — 없음.
새로운 요구사항 ID가 부여되지 않는다. `10-auth-flow.md` 의 §2.5·§2.6 section 번호와 markdown anchor(`#25-이메일-인증-안내-화면`, `#26-초대-토큰을-통한-가입`)는 교환 전후 동일하게 유지된다.

**4. 상태 전이 충돌** — 없음.
도메인 엔티티(User, Execution 등)의 상태 머신 기술 변경이 없다.

**5. 권한·RBAC 모델 충돌** — 없음.
권한 구조 변경이 없다.

**6. 계층 책임 충돌** — 없음.
서버/클라이언트·도메인 모듈 간 책임 분할 변경이 없다.

**cross-spec 참조 안전성 확인**

| 참조처 | 참조 내용 | 영향 |
|--------|-----------|------|
| `spec/6-brand.md #8` | `10-auth-flow.md #1-화면-구성-개요` (§1 레이아웃) | 영향 없음 — §1 미변경 |
| `spec/conventions/error-codes.md` | `10-auth-flow.md #54-oauth-에러-처리` (§5.4) | 영향 없음 — §5.4 미변경 |
| `spec/2-navigation/0-dashboard.md`, `4-integration.md`, `_product-overview.md` | `10-auth-flow.md` 파일 단위 참조 | 영향 없음 |
| `10-auth-flow.md §2.4` 내부 | `"§2.6 분기 참고"` | 유효 — §2.6 이 여전히 초대 토큰 가입 섹션 |
| `spec/3-workflow-editor/3-execution.md` | `§14-execution-history §2.4` | 영향 없음 — §2.4 미변경 |

---

## 요약

`nav-spec-doc-fix` draft 의 두 변경(10-auth-flow §2.5/§2.6 블록 순서 교정, 14-execution-history §2.1 목업 주석 추가)은 기존 spec 의 어떤 영역과도 충돌하지 않는다. 두 변경 모두 내용·API·데이터 모델·요구사항 ID·상태 머신·RBAC 을 수정하지 않는 순수 문서 정합성 교정이며, cross-spec anchor 참조 5건을 전수 확인한 결과 모두 안전하다.

## 위험도

NONE
