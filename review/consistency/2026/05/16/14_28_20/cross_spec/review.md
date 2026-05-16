# Cross-Spec 일관성 검토 — `spec/2-navigation/4-integration.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 기준: main 브랜치 대비 현재 worktree(`cafe24-mall-dup-ux-a7f2c8`) 의 spec 변경 사항 + 다른 영역 spec 과의 교차 일관성

---

## 발견사항

### 발견사항 1
- **[CRITICAL]** `Attention` 가상 필터값 삭제 — 프론트엔드 코드·도큐멘테이션과 직접 충돌
  - target 위치: `spec/2-navigation/4-integration.md` §2.3 상태 칩, §2.4 배너 클릭 동작, §9.1 GET `/api/integrations` status 파라미터, §Rationale ("Attention 가상 필터값" 항 전체 삭제)
  - 충돌 대상:
    - `frontend/src/app/(main)/integrations/page.tsx` — `needsAttention` 함수를 import 하고 `attentionCount` 변수로 배너 건수를 계산. 기존 spec 에서 정의한 `Attention` 칩·`?status=attention` 가상 필터값 기반 동작이 코드에 구현되어 있음
    - `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `export function needsAttention(...)` 함수 존재. 삭제된 Attention 개념의 핵심 술어를 export 함
    - `frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` · `.en.mdx` — "배너를 누르면 해당 상태 필터로 바로 이동" 사용자 가이드 문구가 `?status=attention` 라우팅을 전제로 기술되어 있음
  - 상세: 이번 worktree 의 target spec 은 `Attention` 단일 칩과 `?status=attention` 가상 필터값을 **완전히 제거**하고, 배너 클릭 동작을 "상태 필터를 `Expiring|Expired|Error` 로 자동 전환" 한 줄로 단순화했다. 그러나 단일 선택 칩 모델에서 세 상태를 동시에 활성화할 UI 표현이 없다는 것이 삭제된 Rationale 에서 이미 분석된 내용이다. 현재 프론트엔드 코드는 삭제된 Attention 개념에 기반하여 구현되어 있어, 이 spec 을 그대로 구현에 반영하면 (a) 배너 클릭 동작이 정의 불가한 상태가 되고, (b) 기존 `needsAttention` 함수·`attentionCount` 변수가 spec 없이 코드에만 남는 유령 로직이 된다.
  - 제안: 두 방향 중 하나를 선택해야 한다. (A) `Attention` 칩과 `?status=attention` 가상 필터값을 spec 에 복원하고 삭제된 Rationale 도 함께 복원한다. (B) Attention 개념을 실제로 제거하려면 프론트엔드 코드(`page.tsx`, `status-badge.tsx`)와 도큐멘테이션 MDX 파일도 동시에 갱신해야 한다. 현재 worktree 에서 코드 수정 없이 spec 만 삭제한 상태라면 구현 착수 전 방향 결정이 필수.

---

### 발견사항 2
- **[CRITICAL]** `GET /api/integrations/:id` 응답에서 `appUrl` 필드 제거 — 프론트엔드 코드와 직접 충돌
  - target 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` 설명 (이전: `appUrl: string | null` 포함 명시 → 현재: "상세 조회 (credentials는 마스킹)" 한 줄)
  - 충돌 대상:
    - `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` — `appUrl: "https://example.com/api/3rd-party/cafe24/install/abc"` 필드가 mock 데이터에 포함되어 있음 (line 133, 173, 197). 이 테스트는 `GET /api/integrations/:id` 응답에 `appUrl` 필드가 존재함을 전제로 작성됨
    - `spec/1-data-model.md` §2.10 Integration — `install_token` 필드가 정의되어 있고, `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 상세 페이지 표시" 항(main에 존재, worktree에서 삭제됨)이 이 필드를 `appUrl` 응답 필드로 노출하는 설계를 기술했었음
    - `spec/4-nodes/4-integration/4-cafe24.md` §9 — App URL 관련 흐름이 `install_token` 기반 URL 을 Cafe24 Developers 에서 조회·복사할 수 있어야 함을 전제함
  - 상세: 이전 spec(main)은 `GET /api/integrations/:id` 응답의 `IntegrationDto` 에 `appUrl: string | null` 필드를 포함하며, Cafe24 Private 통합의 경우 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 값을 반환하도록 정의했다. Overview 탭에 "App URL 카드"를 두어 사용자가 복사할 수 있도록 하는 것도 해당 spec 에 명시되어 있었다. 이번 worktree spec 이 두 정의를 모두 삭제했으나, 프론트엔드 테스트 코드는 `appUrl` 필드 존재를 전제로 구성되어 있다. 그대로 구현에 들어가면 Cafe24 Private 앱의 App URL 을 상세 페이지에서 조회·복사할 수 없어 사용자 운영 흐름이 단절된다.
  - 제안: (A) `appUrl` 필드와 Overview 탭 "App URL 카드"를 spec 에 복원한다. (B) 실제로 제거하려면 프론트엔드 테스트 코드(`scope-tab.test.tsx` 등)도 함께 갱신해야 한다. Cafe24 Private 통합의 운영 흐름에서 App URL 접근성이 필요한지도 재검토 필요.

---

### 발견사항 3
- **[WARNING]** §2.4 배너 `expiring` 포함 조건 단순화 — 잠재적 범위 확대
  - target 위치: `spec/2-navigation/4-integration.md` §2.4 "Need attention" 배너 조건: `token_expires_at <= now() + 7d`
  - 충돌 대상: `spec/2-navigation/4-integration.md` §11.4 UI 배지 조건 (동일 worktree 내 동일 파일) — `status IN (expired, error) OR (token_expires_at <= now() + 7d)` 카운트
  - 상세: 기존 spec(main)은 배너 조건을 `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'` 로 구체화해 `pending_install` 상태의 행과 이미 `expired` 처리된 행이 이중 포함되지 않도록 방어했다. target spec 의 단순화된 `token_expires_at <= now() + 7d` 는 이 방어 조건이 없어 `expired` 상태의 행이 "만료 임박" 로도 집계되는 이중 카운트 가능성이 있다. `spec/5-system/4-execution-engine.md` 는 Integration 상태 전이를 `connected → expired` 로 정의하며, `expired` 상태의 행은 `token_expires_at <= now()` 조건을 이미 만족하므로 `expired ∪ expiring` 이 겹칠 수 있다.
  - 제안: 배너 조건에 `status NOT IN (expired, error, pending_install)` 가드를 추가하거나, `OR` 구조(`status IN (expired, error)` 별도 + `status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d'`)로 명시적으로 분리한다. §11.4 UI 배지 조건도 동일하게 갱신.

---

### 발견사항 4
- **[WARNING]** §9.1 `GET /api/integrations` status 파라미터 — `expiring` 가상 필터값 정의 삭제
  - target 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations` 설명 (이전: `status` 허용값 명시·가상 필터값 변환 규칙 기술 → 현재: 허용값 기술 없음)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §2.3 상태 칩 — `Expiring (7일 이내)` 칩이 여전히 존재하며, 이 칩이 `?status=expiring` 쿼리를 발행한다는 것이 암시되어 있음. 백엔드가 `expiring` 을 WHERE 절로 변환하는 규칙이 없어지면 `?status=expiring` 이 DB Enum 에 없는 값으로 처리될 수 있음
  - 상세: 상태 칩 `Expiring` 이 남아 있으면 프론트엔드는 여전히 `?status=expiring` 을 백엔드로 보낸다. 그런데 target spec 은 백엔드가 이 가상 필터값을 합집합 WHERE 절로 변환한다는 규칙을 삭제했다. `expiring` 은 `Integration.status` DB Enum (`connected`/`expired`/`error`/`pending_install`)에 없으므로, 변환 규칙 없이 그대로 WHERE `status='expiring'` 이 되면 0건 반환이 된다.
  - 제안: `expiring` 가상 필터값 정의를 §9.1 에 복원(`status='connected' AND token_expires_at within 7d` 변환 규칙)하거나, §2.3 칩 목록에서 `Expiring` 을 실제 DB Enum 값이 아닌 가상값임을 명시한다. DB 쿼리 빌더의 변환 규칙이 spec 어딘가에 반드시 기술되어야 한다.

---

### 발견사항 5
- **[INFO]** `spec/data-flow/5-integration.md` — `appUrl` 참조가 target spec 변경과 동기화 필요
  - target 위치: `spec/2-navigation/4-integration.md` §9.1 `GET /api/integrations/:id` (appUrl 삭제)
  - 충돌 대상: `spec/data-flow/5-integration.md` — Cafe24 Private 통합 등록 시퀀스 다이어그램에 `appUrl: .../3rd-party/cafe24/install/:installToken` 참조가 있음 (line 78–79)
  - 상세: data-flow spec 은 별도 문서이지만 `appUrl` 이 `oauth/begin` 응답에 포함된다는 시퀀스를 기술하고 있다. target spec 이 §9.2 `POST /api/integrations/oauth/begin` 에서는 `appUrl` 을 여전히 응답에 포함시키므로 (`cafe24_private_pending` 응답) data-flow 참조는 실제로는 정합하다. 단, 삭제된 `GET /api/integrations/:id` 의 `appUrl` 필드 관련 data-flow 부분이 있다면 동기화 점검이 권장된다.
  - 제안: `spec/data-flow/5-integration.md` 를 확인해 삭제된 `GET /api/integrations/:id` → `appUrl` 흐름이 기술된 곳이 있으면 해당 부분도 갱신한다. `POST /api/integrations/oauth/begin` → `appUrl` 흐름은 변경 없으므로 그대로 유지.

---

### 발견사항 6
- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` 참조 표기 — target spec 변경 이후도 일관성 유지 확인 필요
  - target 위치: `spec/2-navigation/4-integration.md` §4.2 Overview 탭 (App URL 카드 제거)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §9 — "통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 갱신하세요" 형태의 안내가 HMAC 에러 페이지 응답(Rationale "Cafe24 install_token mismatch 회복 흐름" §1057)에 참조되어 있음
  - 상세: target spec 이 Overview 탭의 App URL 카드를 삭제하면, Cafe24 노드 spec 이 에러 복구 안내("통합 상세 페이지에서 현재 App URL 확인")를 가리키는 UX 경로가 실제 UI 에서 사라진다. 사용자는 에러 페이지의 안내를 따르더라도 해당 카드를 찾을 수 없게 된다.
  - 제안: App URL 카드 삭제가 확정이라면 `spec/4-nodes/4-integration/4-cafe24.md` Rationale 의 에러 복구 안내 문구("통합 상세 페이지에서 현재 App URL 을 확인")를 대체 접근 경로로 갱신한다. App URL 을 상세 페이지 다른 위치(예: Security 탭)로 이동하는 방안도 고려.

---

## 요약

이번 worktree(`cafe24-mall-dup-ux-a7f2c8`)의 target 문서 `spec/2-navigation/4-integration.md` 는 main 대비 (1) `Attention` 가상 필터 칩·`?status=attention` 쿼리값 삭제, (2) `GET /api/integrations/:id` 응답의 `appUrl` 필드 제거, (3) "Need attention" 배너 로직 단순화, (4) `expiring` 가상 필터값 변환 규칙 삭제 등 여러 UX 기능을 축소·제거하는 방향으로 개정되었다. 그러나 프론트엔드 코드(`page.tsx`, `status-badge.tsx`, `scope-tab.test.tsx`)와 사용자 가이드 MDX 파일은 삭제된 개념을 그대로 참조하고 있으며, 노드 spec(`4-cafe24.md`)의 에러 복구 안내도 삭제된 UI 요소를 가리키고 있다. 두 개의 CRITICAL 발견사항은 spec 변경이 코드·테스트와 정면으로 모순되는 상황으로, 구현 착수 전 spec 복원 또는 코드 동시 갱신 방향 결정이 필수적이다.

---

## 위험도

**HIGH**
