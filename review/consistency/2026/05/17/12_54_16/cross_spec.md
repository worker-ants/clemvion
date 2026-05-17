# Cross-Spec 일관성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
검토 범위: `spec/2-navigation/`
검토 일시: 2026-05-17

---

### 발견사항

- **[WARNING]** `spec/2-navigation/10-auth-flow.md` §5.3 OAuth 콜백 vs `spec/5-system/1-auth.md` 참조 일관성 미확인
  - target 위치: `spec/2-navigation/10-auth-flow.md` §5.3 Step 7 리다이렉트 구문
  - 충돌 대상: 동일 파일 §8 API 목록 + `spec/5-system/1-auth.md` (참조)
  - 상세: §5.3 리다이렉트 URL 형식이 `{frontend_url}/callback?success=true&token={accessToken}` (Access Token을 URL 파라미터로 전달)로 명시되어 있고, §7.3 로그아웃 절차에서는 "Access Token 메모리에서 제거, Cookie 삭제"로 기술된다. §8 API 목록에는 `POST /api/auth/refresh` 가 열거되어 있으나 토큰 갱신 흐름(자동 갱신 주기, 프론트엔드의 silent refresh 정책)은 `spec/2-navigation/10-auth-flow.md` 본문에 기술되지 않았다. worktree명(`integration-token-ui-autorefresh`)이 시사하는 token UI auto-refresh 구현을 착수하려면, 인증 spec(`spec/5-system/1-auth.md`)에서 정의하는 refresh token 회전 정책 및 silent refresh 흐름과 현재 UI spec 간에 간극이 있을 수 있다.
  - 제안: `spec/5-system/1-auth.md` §5 API 엔드포인트 및 token rotation 정책을 확인하여, UI spec에 silent refresh 흐름(인터셉터 기반 자동 재발급 정책, 401 감지 후 재시도 흐름)을 명시하거나 cross-reference를 추가할 것. Integration auto-refresh와 세션 token refresh를 혼동하지 않도록 범위 구분도 필요.

- **[WARNING]** `spec/2-navigation/4-integration.md` §9.1 `autoRefresh` 필드가 `spec/1-data-model.md` §2.10 Integration 엔티티에 누락
  - target 위치: `spec/2-navigation/4-integration.md` §2.2 항목 요소, §2.3 상태 칩, §2.4 배너, §4.1 헤더 메타 라인, §4.2 Overview 탭 (모두 `autoRefresh=true` / `§9.1` 참조)
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration 테이블 필드 목록
  - 상세: `spec/2-navigation/4-integration.md`는 `autoRefresh` (또는 `integration.autoRefresh`) 불리언 필드를 다수 절에서 전제하고 있다. "자동 갱신 통합(`autoRefresh=true`, §9.1)"이라는 표현이 §2.2, §2.3, §2.4, §4.1, §4.2에 반복 등장하고, 만료 임박 필터링·배너 포함 조건·Overview 탭 표시 등에서 이 값에 의존한다. 그러나 `spec/1-data-model.md` §2.10 Integration 테이블 필드 목록에는 `auto_refresh` (또는 `autoRefresh`) 컬럼이 없다. `token_expires_at`, `last_rotated_at`, `consecutive_network_failures` 등은 명시되어 있으나 `autoRefresh` 필드는 누락된 상태다. 이 상태로 구현에 착수하면 DB 스키마와 UI 로직 간 모순이 발생한다.
  - 제안: `spec/1-data-model.md` §2.10 Integration 테이블에 `auto_refresh Boolean DEFAULT false` 컬럼을 추가하고, 해당 컬럼의 의미(자동 갱신 대상 통합 여부, Cafe24 access_token 2h 갱신용 등)와 인덱스 전략(§3 인덱스 전략에 `(workspace_id, auto_refresh)` 또는 partial 인덱스 추가 여부)을 명세한다. `spec/2-navigation/4-integration.md` §9.1이 참조 기준이므로 해당 절의 전체 명세도 확인하여 데이터 모델과 동기화한다.

- **[WARNING]** `spec/2-navigation/4-integration.md`가 참조하는 §9.1, §9.2, §10.4, §10.5, §11.2, §11.4 절이 prompt에 포함되지 않아 검증 불가
  - target 위치: `spec/2-navigation/4-integration.md` §2.2, §2.3, §2.4, §4.2~§4.4, §9.1, §9.2, §10.4, §10.5, §11.2, §11.4 (파일이 2173줄에서 truncated됨)
  - 충돌 대상: `spec/1-data-model.md` §2.10 (`status`, `status_reason`, `consecutive_network_failures`, `install_token`, `mall_id` 등 신규 필드들)
  - 상세: 제공된 prompt에서 `spec/2-navigation/4-integration.md`가 약 2173줄 이후 truncated되어 `autoRefresh` 필드를 포함한 §9.1 자동 갱신 정책, §9.2 API 계약, §10.4 에러 매핑, §11.4 사이드바 배지 카운트 API 등의 내용을 확인할 수 없다. 상태 전이 모델(§6)도 미확인 상태다. 특히 `status_reason='refresh_failed'` 제거 및 `error(auth_failed)`로 이행(REQ HIGH-2, 2026-05-16 갱신)이 데이터 모델에는 반영되어 있으나 UI spec의 해당 에러 분기 처리와 일치하는지 검증되지 않았다.
  - 제안: 구현 착수 전 `spec/2-navigation/4-integration.md`의 §6(상태 전이), §9.1(자동 갱신), §9.2(API), §10.4(에러 매핑), §11(알림 및 배지)를 별도로 확인하고, 특히 `status_reason` 값 집합이 `spec/1-data-model.md` §2.10 `status_reason` 정의와 완전히 일치하는지 검증할 것.

- **[INFO]** `spec/2-navigation/14-execution-history.md` §5 `Execution` DTO에 `re_run_of` 필드가 API 응답 예시에 누락
  - target 위치: `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 형식 JSON 예시
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` §3.7 Re-run 액션 (체인 배지 조건 `execution.reRunOf != null`), `spec/5-system/13-replay-rerun.md` §RR-PL-05
  - 상세: §3.7에서 "Chain badge — `execution.reRunOf != null` 인 실행은 chain badge 표시"라고 명시하나, §5의 목록 API 응답 JSON 예시에는 `re_run_of` 또는 `reRunOf` 필드가 포함되어 있지 않다. 구현 시 프론트엔드가 응답에서 이 필드를 기대하지만 백엔드 DTO가 이를 포함하지 않을 위험이 있다.
  - 제안: §5 목록 API 및 상세 API 응답 예시에 `reRunOf: string | null` 필드를 명시적으로 추가한다.

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §2.5 이메일 인증 처리 방식이 `GET` vs `POST` 혼재
  - target 위치: `spec/2-navigation/10-auth-flow.md` §2.5 ("이메일 인증 링크 클릭 → `GET /api/auth/verify-email?token={token}`")
  - 충돌 대상: 동일 파일 §8 API 목록 ("POST | /api/auth/verify-email | 이메일 인증 확인 (쿼리: token)")
  - 상세: §2.5 본문에서는 이메일 인증 링크가 `GET /api/auth/verify-email?token={token}`으로 기술되어 있으나, §8 API 목록에는 `POST /api/auth/verify-email`로 등록되어 있다. 이메일 링크는 사용자가 클릭하는 것이므로 브라우저가 GET 요청을 보내게 되어 있는데, §8의 POST 정의와 모순된다.
  - 제안: §8 API 목록의 `POST /api/auth/verify-email`을 `GET /api/auth/verify-email`로 수정하거나, §2.5 본문을 POST 흐름(링크 클릭 → 중간 페이지 → POST 요청)으로 조정하고 어느 쪽이 실제 구현 의도인지 명확히 한다.

- **[INFO]** `spec/2-navigation/10-auth-flow.md` §2.6 `invitationToken` 흐름 — 섹션 번호 비연속
  - target 위치: `spec/2-navigation/10-auth-flow.md` §2.4(처리 플로우) 다음에 §2.6(초대 토큰을 통한 가입)이 오고 §2.5(이메일 인증 안내 화면)가 뒤에 위치
  - 충돌 대상: 없음 (내부 구조 문제)
  - 상세: 섹션 번호가 2.4 → 2.6 → 2.5 순으로 배치되어 있어 가독성을 저해하고, 구현자가 §2.6의 분기(invitationToken 흐름)를 §2.5 이전에 처리해야 하는 시퀀스상 혼동을 줄 수 있다.
  - 제안: §2.5와 §2.6의 순서를 교환하거나 번호를 재정렬한다.

- **[INFO]** `spec/2-navigation/12-workflow-version-history.md` §8 데이터 모델과 `spec/1-data-model.md` §2.15 WorkflowVersion 간 필드 이름 차이
  - target 위치: `spec/2-navigation/12-workflow-version-history.md` §8 `workflow_version` 테이블
  - 충돌 대상: `spec/1-data-model.md` §2.15 WorkflowVersion
  - 상세: `spec/2-navigation/12-workflow-version-history.md`의 §8 테이블에는 `change_summary text NULL` 컬럼이 있으며, §7.4에서 `POST /workflows/:id/save` body의 `changeSummary?: string` 필드 추가를 기술한다. `spec/1-data-model.md` §2.15 WorkflowVersion에는 동일하게 `change_summary String?`이 있어 일치한다. 그러나 navigation spec의 §7 API 경로가 `/workflows/:wfId/versions`로 기술된 반면, 데이터 모델에는 API 경로가 정의되지 않아, 구현 시 `/api/workflows/:wfId/versions`(API prefix 포함)가 맞는지 확인이 필요하다. 다른 API들은 모두 `/api/` prefix를 사용하고 있다.
  - 제안: §7 API 스펙의 경로를 `/api/workflows/:wfId/versions` 형식으로 통일하거나, 모든 navigation spec에서 `/api/` prefix 생략이 암묵적 규약임을 명시한다.

---

### 요약

`spec/2-navigation/` 영역은 전반적으로 `spec/1-data-model.md`와의 참조 일관성이 양호하다. 그러나 구현 착수 전 가장 중요한 점검 사항은 두 가지다. 첫째, `spec/2-navigation/4-integration.md`가 광범위하게 사용하는 `autoRefresh` 불리언 필드가 `spec/1-data-model.md` §2.10 Integration 테이블에 누락되어 있어, 이 필드 없이 구현을 진행하면 데이터 계층 불일치가 발생한다(WARNING). 둘째, worktree가 시사하는 token UI auto-refresh 구현과 관련하여 `spec/2-navigation/10-auth-flow.md`에 프론트엔드 세션 토큰 silent refresh 흐름이 명시되지 않아, `spec/5-system/1-auth.md`와의 계약을 별도 확인해야 한다(WARNING). 이 외에 이메일 인증 endpoint의 GET/POST 불일치(INFO), 실행 내역 API 응답 예시의 `reRunOf` 필드 누락(INFO), 섹션 번호 비연속(INFO) 등이 발견되었다. CRITICAL 수준의 모순은 없으나, `autoRefresh` 필드 데이터 모델 누락은 구현 전에 반드시 해소할 것을 권장한다.

---

### 위험도

MEDIUM
