STATUS: OK

# 보안(Security) 리뷰 결과

리뷰 대상: review/consistency 산출물 (2026-06-27 · 2026-06-28), spec/2-navigation/16-agent-memory.md, spec/5-system/17-agent-memory.md

---

## 발견사항

### **[WARNING]** endpointPath UUID 서버 검증 제거 — capability token 보안 모델 공동화
- 위치: `spec/5-system/12-webhook.md` WH-SC-01 / WH-MG-02 (consistency 검토 파일에서 확인된 구현 사실)
- 상세:
  - 기존 WH-SC-01은 `endpointPath`를 "사실상 비밀 키(capability token)"로 규정하고 CSPRNG v4 UUID를 MUST로 요구했으며, WH-MG-02는 서버 DTO에서 `@IsUUID('4')`로 형식을 강제했다.
  - 현재 구현: `create-trigger.dto.ts`의 `endpointPath`가 `@IsString() @MaxLength(255)`로 완화돼 있어, 공격자가 `/hooks/my-integration`처럼 **예측 가능한 경로**를 직접 등록할 수 있다.
  - 서버 UUID 강제가 없으면 endpointPath의 비밀성은 클라이언트(`crypto.randomUUID()`) 선택에만 의존한다 — API 직접 호출 시 클라이언트 검증을 우회해 추측 가능한 경로를 지정할 수 있다.
  - plan W1 보안 이슈가 미해소 상태에서 spec이 먼저 후퇴했으며, `spec/2-navigation/2-trigger-list.md`(139행, 325행)와 `spec/7-channel-web-chat/5-admin-console.md`(112행, 228행)는 아직 UUID 기반 보안 모델을 기술 중이어서 스펙-구현 간 보안 가정 불일치가 존재한다.
- 제안: 서버 측 `@IsUUID('4')` 검증을 복원하거나, 서버가 endpointPath를 자동 생성·강제 발급하도록 전환한다. 현행 `@IsString() @MaxLength(255)` 상태를 유지할 경우 — (1) capability token 전제를 공식 폐기하고 보안 모델을 "DB UNIQUE 제약 + 클라이언트 책임"으로 명시 재정의, (2) 인접 spec(trigger-list, admin-console)의 UUID 기반 보안 기술을 동기화, (3) plan W1 처리 방향을 확정해야 한다.

---

### **[WARNING]** 멤버 관리 Delete 권한 — RBAC 불일치로 인가 로직 모호성
- 위치: `spec/5-system/1-auth.md §3.2` vs `spec/2-navigation/9-user-profile.md §4.2, §6.1` (cross_spec.md 발견사항)
- 상세:
  - auth spec §3.2: Admin = CRU(Delete 없음)
  - user-profile spec §4.2 / §6.1 API: Admin+ = 멤버 삭제 허용(`DELETE /api/workspaces/:id/members/:memberId | Admin+`)
  - 두 spec 중 하나를 근거로 구현이 이뤄질 경우 의도하지 않은 권한 승격(Admin이 멤버 삭제 가능) 또는 권한 누락(Owner만 삭제 가능해야 함) 중 하나가 잘못 구현될 위험이 있다.
  - RBAC SoT인 auth spec §3.2와 구현 API 정의 spec이 충돌하면 실제 가드(`RoleGate`) 구현이 어느 spec을 따랐는지에 따라 미검증 권한 상승이 발생할 수 있다.
- 제안: Admin의 멤버 Delete 권한 보유 여부를 확정하고 auth spec §3.2(RBAC SoT)를 기준으로 user-profile spec §4.2 / §6.1 API 및 실제 가드 구현을 단일화한다. 구현 코드의 RoleGate 실제 동작을 즉시 점검해야 한다.

---

### **[INFO]** Prompt Injection 방어 — 저장 필터의 정규식 우회 가능성 인지 필요
- 위치: `spec/5-system/17-agent-memory.md §3` (instruction-style 저장 차단 W-2 보조), Rationale §Prompt-injection 방어 2층
- 상세:
  - spec이 명시적으로 "결정적 정규식 목록"으로만 차단하며 "주 방어는 회수 주입 시점의 data-fence"라고 기술한다 — 이 설계 선택 자체는 문서화되어 있고 의도적이다.
  - data-fence(`[memory]…[/memory]` + U+200B escape)는 LLM 모델/프롬프트 변화 시 fence 효과가 달라질 수 있는 모델 의존적 방어다.
  - 보안 리뷰 관점에서 이 설계를 명시 수용(accept)하되, 추후 LLM 모델 교체 시 data-fence 효과를 재검증하는 절차가 필요함을 기록한다.
- 제안: 이 발견은 현 설계를 차단하지 않는다. 단, `spec/5-system/17-agent-memory.md Rationale`에 "모델 교체 시 data-fence 효과 재검증 필요"를 명시하면 향후 추적이 용이하다.

---

### **[INFO]** workspace_id 격리 의무 선언 — 구현 검증 필요
- 위치: `spec/5-system/17-agent-memory.md §5, §6`
- 상세:
  - spec이 "모든 회수·추출·evict·삭제 쿼리는 `workspace_id` 필터를 강제"하고, 단건 삭제도 `WHERE id = $1 AND workspace_id = $ws`로 교차 삭제를 차단한다고 선언한다.
  - 이번 변경(X-Deleted-Count 헤더 추가)은 scope 전체 삭제 엔드포인트 변경을 포함하는데, scope 전체 삭제 쿼리(`DELETE /agent-memories?scopeKey=`)의 WHERE 절도 동일하게 `workspace_id` 격리를 포함하는지 이번 diff에서는 직접 확인되지 않는다.
- 제안: `DELETE /agent-memories?scopeKey=` 구현 코드에서 `WHERE scopeKey = $1 AND workspace_id = $ws` 구조를 확인한다. 누락 시 타 워크스페이스 scopeKey를 알면 전체 삭제가 가능한 권한 우회가 된다.

---

### **[INFO]** X-Deleted-Count 헤더 CORS exposedHeaders — 정보 노출 수준 확인
- 위치: `spec/5-system/17-agent-memory.md §6`, `codebase/backend/src/main.ts`
- 상세:
  - `X-Deleted-Count` 헤더를 CORS `exposedHeaders`에 추가해 cross-origin 브라우저에서 읽을 수 있도록 한다.
  - 이 헤더는 삭제된 메모리 행 수(정수)만 반환하며 내용 자체는 민감 정보가 아니다. 정보 노출 위험은 낮다.
  - 단, `exposedHeaders` 범위가 필요 이상으로 넓어지지 않도록(모든 응답에 적용되는 와일드카드 등) 관리할 필요가 있다.
- 제안: 비차단. `exposedHeaders: ['X-Deleted-Count']` 가 최소 필요 범위로 한정되어 있는지 구현 확인.

---

### **[INFO]** 하드코딩된 시크릿 — 없음 확인
- 위치: 전 변경 파일
- 상세: 리뷰 대상 파일(consistency 산출물, spec 파일 2개)에 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다.

---

## 요약

이번 변경에서 가장 중요한 보안 이슈는 두 가지다. 첫째, webhook `endpointPath`의 서버 측 UUID 형식 강제(`@IsUUID('4')`) 제거 — WH-SC-01이 "사실상 비밀 키(capability token)"라고 규정했던 endpointPath가 이제 임의 문자열을 수용해, API를 직접 호출하는 행위자가 예측 가능한 경로를 등록하고 webhook을 가로채거나 충돌시킬 수 있는 위험이 발생했다. plan W1 보안 이슈가 미해소 상태에서 spec이 구현 현황에 맞춰 먼저 후퇴했으며 인접 spec과의 보안 전제 불일치가 남아 있다. 둘째, 멤버 관리 Delete 권한이 auth spec(RBAC SoT)과 user-profile spec API 정의 간에 명시적으로 충돌해, 실제 RoleGate 구현이 어느 spec을 따랐는지에 따라 의도치 않은 권한 승격이 발생할 수 있다. Agent Memory의 prompt injection 방어 2층 설계(data-fence 주, 저장 필터 보조)와 workspace_id 격리 선언은 spec에 적절히 문서화되어 있으나 scope 전체 삭제 쿼리의 격리 구현 확인은 필요하다. 하드코딩된 시크릿, SQL 인젝션, XSS, 경로 탐색, 안전하지 않은 암호화 알고리즘 등의 전통적 인젝션 취약점은 이번 변경 대상에서 발견되지 않았다.

---

## 위험도

MEDIUM

(WARNING 2건: endpointPath capability token 보안 모델 공동화 + RBAC 불일치)
