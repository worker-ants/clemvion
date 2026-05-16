# 부작용(Side Effect) 리뷰

리뷰 대상: consistency-checker 세션 산출물 5개 + spec 3개 파일 변경
세션: `review/consistency/2026/05/16/14_28_20/`
연관 spec: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/5-integration.md`

---

## 발견사항

### 1. install_token 라이프사이클 의미 역전 — DB 상태 전이 부작용

- **[CRITICAL]** `spec/1-data-model.md` 와 `spec/data-flow/5-integration.md` 의 `install_token` callback 성공 시 처리 방향이 서로 반대로 수정됨
  - 위치: `spec/1-data-model.md` §2.10 `install_token_issued_at` 설명, `spec/data-flow/5-integration.md` line 87–90
  - 상세:
    - `spec/1-data-model.md` 변경 후: `install_token_issued_at` — "callback 성공 시 NULL". `install_token` — "callback 성공 또는 TTL 만료 시 NULL".
    - `spec/data-flow/5-integration.md` 변경 후: callback 성공 시 시퀀스 다이어그램이 `install_token=NULL` 로 명시.
    - 그러나 `spec/2-navigation/4-integration.md` 의 Rationale "install_token TTL 24h" 섹션(이번 worktree 에서 미수정된 부분)은 callback 성공 시 `install_token` 과 `install_token_issued_at` 이 **보존**된다고 기술하고 있었다 (2026-05-16 보강 텍스트). 이번 diff 에서 해당 Rationale 텍스트가 "(2026-05-15 갱신)" 으로 후퇴해 보강 내용이 삭제되고 "callback 성공 시 `install_token_issued_at` 도 NULL 로 비워진다"로 반전됨.
    - 실제 구현 코드(`integration-oauth.service.ts`)는 이 변경과 동기화되지 않은 상태로 남아있다. spec 이 "보존" → "NULL" 로 뒤집혔으나 코드는 기존 "보존" 동작을 유지한다면, callback 성공 후 `install_token` 이 NULL 이 아닌 채로 남아 post-install navigation 이 기존 방식으로 계속 동작하나 spec 과 어긋난 상태가 된다. 반대로 코드가 이미 NULL 처리를 하고 있다면, 그 동작은 이전 spec ("보존") 을 위반하는 미기록 변경이었던 셈이다.
    - 결정적으로 `install_token` 이 NULL 이 되면 `GET /api/integrations/:id` 에서 `appUrl` 을 계산할 수 없어 해당 필드가 항상 null 이 된다 — 이는 cross_spec 리뷰(발견사항 2)의 `appUrl` 삭제와 연동된 의도적 변경일 수 있으나, 인과 관계가 spec 본문 어디에도 명시되지 않았다.
  - 제안: `install_token` 의 callback 성공 시 처리 방향(보존 vs NULL)을 하나로 확정하고, `spec/2-navigation/4-integration.md` Rationale, `spec/1-data-model.md` §2.10, `spec/data-flow/5-integration.md` 시퀀스 다이어그램, 구현 코드 4곳을 동시에 일관된 방향으로 갱신해야 한다. 현재 세 spec 파일이 서로 다른 방향을 가리키는 상태다.

---

### 2. `GET /api/integrations/:id` 응답 스키마 암묵적 변경 — 공개 API 인터페이스 부작용

- **[CRITICAL]** `appUrl: string | null` 필드가 `IntegrationDto` 응답에서 제거됨 — API 계약 변경이 프론트엔드 소비자에게 전파됨
  - 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` diff
  - 상세: 이전 spec 은 `IntegrationDto.appUrl: string | null` 필드를 명시했다. 이번 변경에서 해당 정의가 "상세 조회 (credentials는 마스킹)" 한 줄로 대체되어 응답 shape 정의 자체가 사라졌다. `appUrl` 은 단순한 표시용 필드가 아니라 Cafe24 Developers Console 에서 앱 URL 을 비교·업데이트하는 운영 흐름의 핵심 데이터였다. 프론트엔드 `scope-tab.test.tsx` 의 mock 데이터(line 133, 173, 197)가 이 필드를 포함하고 있어 spec 제거만으로는 프론트엔드 소비자에게 영향이 전파되지 않는다 — 오히려 spec 과 코드가 불일치 상태로 남는다. API 클라이언트가 `appUrl` 에 접근하는 경로가 spec 없이 계속 존재하면, 향후 백엔드가 실제로 필드를 제거했을 때 런타임에서야 오류가 드러난다.
  - 제안: spec 에서 `appUrl` 을 제거하려면 프론트엔드 컴포넌트(`page.tsx`, `status-badge.tsx`), 테스트 mock(`scope-tab.test.tsx`), 백엔드 `IntegrationDto` 직렬화 코드를 동시에 갱신해야 한다. spec 변경 단독으로 API 인터페이스가 변경되지는 않으나, 계약 불일치 상태가 생성된다.

---

### 3. `Attention` 칩 제거 — 프론트엔드 상태 의존 함수 export 부작용

- **[WARNING]** `needsAttention` 함수가 `status-badge.tsx` 에 `export` 로 남아있으나 spec 에서 개념이 삭제됨
  - 위치: `spec/2-navigation/4-integration.md` §2.3 diff — `Attention` 칩 제거, `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
  - 상세: spec 변경이 `Attention` 가상 필터값과 칩을 삭제했다. 그런데 `needsAttention` 함수는 `export function` 으로 선언되어 `page.tsx` 에서 import 되어 `attentionCount` 를 계산하는 데 사용된다. spec 상 개념은 사라졌으나 코드상 `export` 심볼은 남아 있어, 이 함수를 다른 모듈에서도 import 할 수 있는 공개 인터페이스 상태가 된다. spec 이 확정된다면 이 export 함수는 "유령 공개 API" 가 되며, 함수의 의미(Attention 조건 충족 여부)를 믿고 사용하는 코드는 spec 없이 동작하는 미아 로직이 된다.
  - 제안: (A) `Attention` 개념을 spec 에 복원한다. (B) 실제 제거 방향이라면 `needsAttention` export 를 제거하거나 `isActionRequired` 등 새 이름으로 대체하고 `page.tsx` 의 `attentionCount` 계산 로직도 갱신한다.

---

### 4. `?status=attention`/`?status=expiring` 가상 필터값 변환 규칙 삭제 — 백엔드 쿼리 빌더 부작용

- **[WARNING]** `expiring` 가상 필터값의 WHERE 절 변환 규칙이 spec 에서 삭제됨 — 백엔드 동작 변경 없이 spec 만 삭제되면 불일치 상태
  - 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations` diff
  - 상세: 기존 spec 은 `status=expiring` 을 `status='connected' AND token_expires_at within 7d` 로 변환하는 백엔드 쿼리 빌더 규칙을 명시했다. 이번 변경에서 `status` 허용값과 변환 규칙 전체가 삭제됐다. 그러나 §2.3 에 `Expiring (7일 이내)` 칩이 여전히 존재한다. 프론트엔드는 이 칩 클릭 시 `?status=expiring` 을 백엔드로 전송한다. 백엔드 구현이 아직 변환 규칙을 유지하고 있다면 spec 과 코드가 불일치, 백엔드가 spec 을 따라 규칙을 제거하면 `expiring` 칩이 0건을 반환하는 런타임 버그가 발생한다. 이 상황은 `Expiring` 칩이 남아있는 한 어느 쪽도 정합하지 않다.
  - 제안: `Expiring` 칩을 spec 에서도 제거하거나, 변환 규칙을 §9.1 에 복원한다. 두 가지 중 하나를 선택하지 않으면 UI 와 API 계약이 분리된 상태로 남는다.

---

### 5. 배너 집계 조건 단순화 — 이중 카운팅 의도치 않은 상태 변경

- **[WARNING]** `token_expires_at <= now() + 7d` 단순화로 `expired` 상태 행이 "만료 임박" 과 "만료" 양쪽에 이중 집계될 수 있음
  - 위치: `spec/2-navigation/4-integration.md` §2.4 배너 조건 diff, §11.4 UI 배지 조건 diff
  - 상세: 기존 조건은 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'` 로 `expired` 상태 행이 만료 임박으로 이중 집계되지 않도록 방어했다. 변경 후 조건 `status IN (expired, error) OR (token_expires_at <= now() + 7d)` 는 `expired` 상태이면서 `token_expires_at <= now() + 7d` 를 동시에 만족하는 행을 두 번 카운트하게 된다. `status='expired'` 인 행은 토큰이 이미 만료된 것이므로 `token_expires_at <= now()` ⊆ `token_expires_at <= now() + 7d` 를 반드시 만족한다. 따라서 `expired` 상태의 모든 행이 "만료 + 만료 임박" 이중으로 집계된다. 이 이중 집계는 배너의 "N건이 주의 필요" 수치를 실제보다 부풀린다.
  - 제안: 배너 조건과 §11.4 UI 배지 조건 양쪽에 `status NOT IN (expired, error, pending_install)` 가드를 `token_expires_at` 조건 앞에 추가한다.

---

### 6. `spec/4-nodes/4-integration/4-cafe24.md` §9.9 Rationale 재작성 — Fields 편집 버퍼 적용 범위 변경

- **[WARNING]** §9.9 이 "메타데이터 기반 typed 동적 폼"에서 "내부 버퍼 분리"로 재작성됨 — cafe24 노드 현재 구현 상태와의 정합 불명확
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI, §9.9 diff
  - 상세: 이전 spec (ux-cleanup 버전)은 Phase 3 (PR #88) 으로 cafe24 노드가 `KeyValueEditor` + 편집 버퍼 패턴을 완전히 폐기하고 메타데이터 기반 동적 폼으로 전환했음을 명시했다. 이번 변경은 §9.9 를 다시 "내부 편집 버퍼 분리" 안으로 재작성하고 `편집 버퍼` 한 줄을 §2 설정 UI 에 추가했다. 그런데 이 변경 이전의 CHANGELOG 에는 "2026-05-16 (ux-cleanup)" 엔트리가 PR #88 완료 후 KeyValueEditor 의존을 제거했다고 기록되어 있다. 현재 diff 에서 이 CHANGELOG 엔트리가 삭제됐다. 즉, Phase 3 완료로 한 번 닫힌 결정이 다시 열린 형태이며, cafe24 노드가 현재 실제로 어떤 UI 패턴을 사용하는지(동적 폼 vs KeyValueEditor + 버퍼)가 불명확해졌다. 두 가지 Rationale 가 충돌한다면 구현자가 어느 것을 따라야 할지 판단할 수 없다.
  - 제안: cafe24 노드의 현재 구현 상태(PR #88 의 Phase 3 적용 여부)를 확인한 뒤, spec §2 와 §9.9 를 현재 상태와 일치하도록 단방향으로 정리한다. 삭제된 "ux-cleanup" CHANGELOG 엔트리 복원 여부도 함께 결정해야 한다.

---

### 7. review/consistency 산출물 파일 생성 — 의도된 파일시스템 부작용

- **[INFO]** `review/consistency/2026/05/16/14_28_20/` 하위 5개 파일이 새로 생성됨
  - 위치: `review/consistency/2026/05/16/14_28_20/cross_spec/review.md`, `naming_collision/review.md`, `plan_coherence/review.md`, `rationale_continuity/review.md`, `meta.json`
  - 상세: consistency-checker 세션의 정상 산출물로 의도된 파일 생성이다. `review/` 디렉토리의 쓰기 권한 범위(`review/consistency/**`) 안에 있으므로 규약 위반 없음. 다만 `meta.json` 에 newline 이 없어(`\ No newline at end of file`) POSIX 표준 텍스트 파일 형식과 어긋난다 — orchestrator 가 파일을 닫기 전 개행을 추가하도록 개선 권장.
  - 제안: orchestrator 의 `meta.json` 생성 코드에 개행 추가.

---

### 8. `spec/data-flow/5-integration.md` 시퀀스 다이어그램 단방향 수정

- **[INFO]** callback 성공 시 시퀀스 다이어그램이 `install_token=NULL` 로 변경됨 — 발견사항 1 과 연동
  - 위치: `spec/data-flow/5-integration.md` line 87–90 diff
  - 상세: `install_token + install_token_issued_at 보존` 텍스트가 `install_token=NULL` 로 교체됐다. 이 변경은 발견사항 1(install_token 라이프사이클 역전)과 직접 연관된다. data-flow 다이어그램과 `spec/1-data-model.md` 는 같은 방향(NULL)으로 수정됐으나, `spec/2-navigation/4-integration.md` Rationale 의 install_token TTL 24h 섹션 일부와 충돌 가능성이 있다. 상태 불일치가 발견사항 1 에서 이미 지적됐으므로 추가 개별 조치 필요성은 낮다.
  - 제안: 발견사항 1 의 방향 결정이 이루어지면 data-flow 다이어그램도 그에 따라 갱신한다.

---

## 요약

이번 변경 세트는 consistency-checker 세션 산출물 파일 5개(의도된 생성), spec 3개 파일의 실질적 변경으로 구성된다. 부작용 관점에서 가장 심각한 문제는 두 가지다. 첫째, `install_token` 의 callback 성공 시 처리 방향(보존 vs NULL)이 `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/2-navigation/4-integration.md` Rationale 사이에서 서로 상충하는 방향으로 수정되어 구현 코드가 어느 spec 을 따라야 하는지 불명확해졌다(CRITICAL). 둘째, `GET /api/integrations/:id` 의 `appUrl` 필드가 spec 에서만 삭제되고 프론트엔드 소비자 코드와 동기화되지 않아 API 계약과 구현 사이의 불일치가 누적된다(CRITICAL). `Attention` 칩과 `expiring` 가상 필터값 변환 규칙의 부분 삭제는 프론트엔드 export 함수와 백엔드 쿼리 빌더 동작에 연쇄 부작용을 일으킬 수 있으며, 배너 집계 조건 단순화는 이중 카운팅이라는 의도치 않은 상태 표시 오류를 유발한다. spec 만 변경하고 코드를 동기화하지 않은 "반쪽 변경" 패턴이 이번 세트의 공통 위험 요인이다.

---

## 위험도

HIGH
