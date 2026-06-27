# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (--impl-done, diff-base=acfa6735b1e426f73f5965bf9272aa88a2a7aafd)

이번 변경에서 spec/5-system/12-webhook.md와 spec/data-flow/ 파일 3개, 그리고 백엔드 코드가 동시에 변경됐다. 핵심 변경 두 가지는 (1) webhook trigger의 endpointPath UUID 서버 강제 검증 제거, (2) workspace-invitations-pruner BullMQ 큐·서비스 완전 삭제다.

---

## 발견사항

### 발견 1

- **[WARNING]** `spec/2-navigation/2-trigger-list.md` — endpointPath UUID 보안 모델 기술이 대상 spec과 불일치
  - target 위치: `spec/5-system/12-webhook.md` §3.2 WH-SC-01, WH-MG-02
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` 139행, 325행
  - 상세:
    - trigger-list.md 139행: "`endpointPath` 는 클라이언트가 `crypto.randomUUID()` 로 생성해 전송한다 (UUID 가 사실상 capability token — R-15)"
    - trigger-list.md 325행: "[WH-SC-01]은 ... `endpointPath` 의 UUID 가 사실상 capability token 역할을 겸한다고 정의한다"
    - 변경 후 WH-SC-01은 CSPRNG v4 UUID 강제·capability token 근거 언급을 모두 삭제. 서버는 `@IsUUID('4')` → `@IsString() @MaxLength(255)` 로 완화돼 임의 문자열(예: `/hooks/my-integration`)도 수용.
    - `spec/data-flow/10-triggers.md`(동시 변경)는 명시적으로 "서버는 UUID 형식을 강제하지 않는다"고 기술.
    - trigger-list.md는 WH-SC-01 포인터로 security 문맥을 설명하는데, WH-SC-01이 바뀌어 포인터가 가리키는 내용이 변경됐음에도 trigger-list.md 본문은 구 보안 주장(UUID = capability token)을 유지 중.
  - 제안: `spec/2-navigation/2-trigger-list.md` 139행과 325행의 "UUID 가 사실상 capability token" 서술을 현행 정책으로 갱신. 서버가 UUID 형식을 강제하지 않는다면 capability token 전제가 성립하지 않으므로, 보안 모델 설명을 "유일성은 DB UNIQUE 제약이 보장하나 예측 불가능성은 클라이언트 책임" 형태로 수정하거나, 반대로 UUID 강제를 복원하고 trigger-list.md의 보안 기술을 유효하게 유지할지 결정이 필요하다.

---

### 발견 2

- **[WARNING]** `spec/7-channel-web-chat/5-admin-console.md` — endpointPath "UUID 형식 제약" 참조가 제거된 서버 강제와 불일치
  - target 위치: `spec/5-system/12-webhook.md` WH-MG-02 (UUID 형식 강제 제거)
  - 충돌 대상: `spec/7-channel-web-chat/5-admin-console.md` 111행, 112행, 228행
  - 상세:
    - 112행: "콘솔은 신규 검증을 도입하지 않고 **기존 webhook 트리거 생성 규약([2-trigger-list §2.5])의 형식·유일성 제약**을 그대로 따른다 — 공개 webhook path 이므로 경로 주입·중복 가로채기 방지는 그 규약(+ DB unique)이 단일 책임"
    - 111행: "콘솔이 `endpointPath` 를 `crypto.randomUUID()` 로 생성"
    - 228행: "`endpointPath` 는 외부 사이트에 그대로 박히는 **공개 UUID**(비밀 아님)"
    - 2-trigger-list.md §2.5의 "형식 제약"은 서버 UUID 강제였는데 이 강제가 제거됐다. admin-console.md는 이 제약에 의존해 "경로 주입·중복 가로채기 방지는 그 규약(+ DB unique)이 단일 책임"이라고 기술 중. UUID 형식 강제가 없어지면 예측 가능 경로(예: `/hooks/my-integration`) 직접 등록이 가능하므로 이 보안 보장이 약화됨.
    - 228행의 "공개 UUID" 표현도 실제로는 임의 문자열이 허용되는 현재 상태와 불일치.
  - 제안: `spec/7-channel-web-chat/5-admin-console.md` 112행의 "형식·유일성 제약" 기술 중 "형식" 부분을 갱신. 228행의 "공개 UUID" 표현 수정. 또는 2-trigger-list.md §2.5의 현행 형식 제약 기술을 현실화한 뒤 admin-console.md가 그 포인터를 통해 올바른 내용을 참조하도록 체인 정비.

---

### 발견 3

- **[INFO]** Entity.type 필드 타입 표기 불일치 (Enum vs String)
  - target 위치: `spec/5-system/10-graph-rag.md` §2.3 Entity 데이터 모델 표
  - 충돌 대상: `spec/1-data-model.md` §2.12.2 Entity 데이터 모델 표
  - 상세:
    - `spec/1-data-model.md §2.12.2`: `type | Enum | person / organization / concept / location / event / other`
    - `spec/5-system/10-graph-rag.md §2.3`: `type | String | entity 타입. P0 enum: person / organization / concept / location / event / other`
    - 동일 필드가 data-model.md에서는 `Enum`, graph-rag.md에서는 `String`(P0 enum 값 목록 첨부)으로 표기된다. 열거값 집합은 동일하나 PostgreSQL 스키마 관점에서 formal ENUM 타입인지 VARCHAR + CHECK 제약인지 달라진다. V025 마이그레이션이 실제 타입을 결정하지만 두 spec 문서의 표기가 다르면 신규 기여자가 혼동할 수 있다.
  - 제안: V025 SQL 확인 후 data-model.md와 graph-rag.md 중 실제 타입 표기에 맞게 정합. 관례상 data-model.md가 SoT이므로 graph-rag.md §2.3을 맞추는 것이 자연스럽다.

---

### 발견 4

- **[INFO]** `plan/in-progress/trigger-review-deferred-fixes.md` — W1·W7 항목이 구현 방향과 역방향 또는 현실과 불일치
  - target 위치: `spec/5-system/12-webhook.md` WH-SC-01/WH-MG-02 변경; `spec/data-flow/12-workspace.md` 프루너 제거 반영
  - 충돌 대상: `/Volumes/project/private/clemvion/plan/in-progress/trigger-review-deferred-fixes.md`
  - 상세:
    - W1 항목(`[ ]`): "서버 강제 발급 또는 DTO `@IsUUID(4)` 검증"으로 fix 방향을 기술하나, 이번 구현은 `@IsUUID('4')`를 제거하고 `@IsString() @MaxLength(255)`로 완화하는 반대 방향을 택했다(spec도 동기 갱신). plan의 fix 설명이 채택된 방향과 정반대.
    - W7 항목(`[ ]`): "pruner 프로덕션 호출자 없음"을 미완으로 표시하나, 이번 구현은 `workspace-invitations-pruner.service.ts`·`.spec.ts` 파일 자체를 삭제하고 모듈 등록도 제거했다. `WorkspaceInvitationsService.pruneExpired` 메서드는 존재하나 호출자가 없는 채 유지. W7은 "미구현 → 서비스 삭제"로 처리됐으므로 열린 체크박스로 남아 있으면 오해를 유발한다.
  - 제안: W1 항목을 "UUID 강제 제거 방향으로 처리, spec·data-flow 동기 완료"로 닫거나 설명 수정. W7 항목을 "pruner 서비스 삭제로 대신 처리(만료 row는 영구 잔존 정책으로 변경)"로 기술하고 닫기 또는 이관.

---

### 발견 5

- **[INFO]** `spec/data-flow/12-workspace.md` §3.1 데이터 접근 패턴 표 — workspace_invitation pruneExpired 행이 큐 제거 이후에도 잔존
  - target 위치: `spec/data-flow/12-workspace.md` (이번 변경에 포함된 파일)
  - 충돌 대상: 동일 파일 내 §3.1 표 196행 (`workspace_invitation | 취소(§1.8)·만료 정리(§3.1) | DELETE (revoke 물리 삭제 / pruneExpired)`)
  - 상세: 동일 파일 §3.1에서 "pruner 호출자 없어 만료 row 영구 잔존"으로 기술하면서도, 데이터 접근 패턴 표(196행)에는 `workspace_invitation`의 "만료 정리(§3.1)" + `pruneExpired` 참조가 그대로 남아 있다. §3.1의 갱신 내용과 표의 기술이 내부적으로 미세하게 모순된다(표는 정리가 이루어지는 것처럼 암시).
  - 제안: 데이터 접근 패턴 표 196행의 "만료 정리(§3.1)" 항목에서 pruneExpired 언급을 제거하거나 "호출자 없음 — 미구현" 주석 추가.

---

## 요약

`spec/5-system/` 대상 Cross-Spec 일관성 검토 결과, CRITICAL 수준의 직접 모순은 없다. 그러나 webhook spec 단순화(WH-SC-01·WH-MG-02에서 UUID 서버 강제 제거)의 파급이 두 개 인접 영역 — `spec/2-navigation/2-trigger-list.md`(capability token 전제)와 `spec/7-channel-web-chat/5-admin-console.md`(UUID 형식 제약 참조) — 에 미반영된 채 남아 있어 WARNING 2건이 발생했다. 이 두 스펙은 endpointPath의 보안 모델을 UUID 기반으로 기술하는데 실제 구현은 임의 문자열을 수용하므로, 보안 전제와 구현 사이의 의미 갭이 명시적으로 존재한다. Entity.type 표기 불일치(INFO)·plan 항목 스테일(INFO)·data-flow 표 내부 모순(INFO)은 비차단 수준이다.

---

## 위험도

MEDIUM
