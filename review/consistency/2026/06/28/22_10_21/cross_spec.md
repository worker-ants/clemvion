# Cross-Spec 일관성 검토 결과

- 검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
- 검토 대상: `spec/5-system/` (1-auth.md, 10-graph-rag.md 등 전체 하위 파일)
- 검토 기준일: 2026-06-28

---

## 발견사항

### [WARNING] `1-auth.md` Rationale 2.3.B 의 IP 추출 경로 수 기술이 §2.3 표와 불일치

- **target 위치**: `spec/5-system/1-auth.md` §2.3 세션 정책 표(클라이언트 IP 행) vs Rationale 2.3.B
- **충돌 대상**: 동일 파일 내 두 섹션 간 불일치 — §2.3 표 vs Rationale 2.3.B
- **상세**:
  - §2.3 표(line 321)는 `extractClientIpFromHeaders` 직접 호출 경로를 "webhook/rate-limit/`ip_whitelist` 경로"로 묘사한다. 이 세 경로는 사실상 webhook 처리 흐름 안에 있는 하나의 논리 경로다.
  - Rationale 2.3.B(line 662)는 "IP 를 읽는 **세 경로**(세션·감사 IP `auth/utils/client-ip`, 공개 webhook rate-limit, `ip_whitelist` 검증)"라고 명시한다. 그러나 PR #765(refactor: `extractClientIp` 단일 구현 통합)가 merged 된 현재, `data-flow/1-audit.md` line 86~87은 감사 IP 경로도 `extractClientIp`(`auth/utils/client-ip.ts`)를 사용한다고 기술한다. 즉 경로 분류는 `extractClientIp` 사용(세션+감사 IP) vs `extractClientIpFromHeaders` 사용(webhook rate-limit + ip_whitelist)의 **두 계열**인데, Rationale 2.3.B는 "세 경로"로 열거하며 세션·감사를 별개 항목처럼 나열한다.
  - 이 불일치는 §2.3 표의 구현 서술("세션·감사 IP 경로(`extractClientIp(req)`)에 한정")과 Rationale의 경로 열거가 서로 다른 분류 방식을 쓰고 있어 독자에게 혼란을 준다.
- **제안**: Rationale 2.3.B의 "세 경로" 표현을 "두 계열 — ① `extractClientIp`(세션·감사 IP), ② `extractClientIpFromHeaders`(webhook rate-limit·ip_whitelist)"로 통일하거나, §2.3 표의 서술을 Rationale과 일치시킨다.

---

### [INFO] `1-auth.md §3.2` Integration (Org) RBAC 표현이 `4-integration.md §8` · `0-overview.md`의 세부 규칙과 서술 방식 차이

- **target 위치**: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스 — "Integration (Org): Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R"
- **충돌 대상**: `spec/2-navigation/4-integration.md §8` 권한 규칙 — "Organization 생성/수정/전환: Admin 이상(Editor 불가)"
- **상세**:
  - `1-auth.md §3.2`는 Integration (Org)를 "Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R"로 표기한다. 이는 Editor가 Org-scope Integration에 대한 쓰기 권한이 없음을 나타낸다.
  - `4-integration.md §8`은 Organization-scope에서 생성·수정·Reauthorize·Rotate·전환 모두 "Admin 이상"으로 지정한다.
  - `0-overview.md`(line 78)는 "@Roles('editor')가 라우트 가드 floor이며 Org-scope 세부 RBAC은 Integration §8 + 사용자 §4.2가 SoT"라고 명시하며 "본 행과 상보 관계(모순 아님)"라고 주석한다.
  - 즉 `1-auth.md §3.2`의 "Editor=R"은 사실상 세부 규칙과 일치하나, 서술의 상세도가 다를 뿐 모순은 없다. 단, 독자가 §3.2만 보면 Editor가 읽기를 갖는다는 것은 알 수 있어도 Admin이 CRUD를 갖는 근거(Editor보다 강함)를 `4-integration.md §8`에서 찾아야 하는 cross-reference 부담이 있다.
  - `0-overview.md`가 이미 "상보 관계(모순 아님)"라고 명시하고 있으므로 기존 정리가 되어 있으나, `1-auth.md §3.2` 하단 주석에도 동일한 크로스 레퍼런스 안내를 추가하면 독자 혼선을 줄일 수 있다.
- **제안**: `1-auth.md §3.2`의 "Integration (Org)" 행 아래에 "세부 액션별 Admin+ vs Editor 구분은 [Integration §8](../2-navigation/4-integration.md#8-권한-규칙) SoT" 주석을 추가한다.

---

### [INFO] `1-auth.md §3.2` 권한 매트릭스의 "Integration (Org)" 행과 `2-navigation/9-user-profile.md §4.2` 매트릭스 간 Integration 항목 서술 범위 차이

- **target 위치**: `spec/5-system/1-auth.md §3.2`
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §4.2` 역할 권한 매트릭스
- **상세**:
  - `9-user-profile.md §4.2`는 "Integration 생성 (Org): Owner=✅, Admin=✅, Editor=❌, Viewer=❌"만 기재하고 조회·수정·삭제는 생략한다.
  - `1-auth.md §3.2`는 "Integration (Org): Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R"로 전체 CRUD를 기재한다.
  - 두 매트릭스의 커버 범위가 달라 어느 쪽이 완전한 SoT인지 불명확하다. `0-overview.md`가 `4-integration.md §8`을 SoT로 지정하고 있으므로 모순은 아니나, `9-user-profile.md §4.2`가 Org-scope의 조회 권한을 별도로 나타내지 않아 불완전하다.
- **제안**: `9-user-profile.md §4.2`의 Integration 행을 `1-auth.md §3.2`와 동등한 상세도로 동기화하거나, "세부 규칙은 [Integration §8] 참조" 포인터를 추가한다. 현재 수준에서 구현을 막는 충돌은 없다.

---

## 요약

`spec/5-system/` 전반은 다른 영역의 spec과 심각한 모순 없이 잘 정합되어 있다. 주된 발견사항은 `1-auth.md` Rationale 2.3.B의 "IP 추출 세 경로" 서술이 §2.3 표의 기술 방식과 분류 차원이 달라 독자에게 혼선을 주는 WARNING 한 건과, Integration (Org) RBAC이 `1-auth.md §3.2`, `4-integration.md §8`, `9-user-profile.md §4.2` 세 곳에 다른 상세도로 중복 기술되는 INFO 두 건이다. 전자는 `0-overview.md`가 이미 "상보 관계(모순 아님)"라고 명시하고 `4-integration.md §8`을 SoT로 지정했으므로 구현을 차단하지 않는다. 후자(IP 경로 서술 불일치)는 기능상 코드에 영향을 주지 않으나, 구현자가 IP 추출 경로 목록을 오해할 소지가 있어 동기화를 권장한다. 전체적으로 구현 착수를 차단하는 CRITICAL 발견사항은 없다.

---

## 위험도

LOW
