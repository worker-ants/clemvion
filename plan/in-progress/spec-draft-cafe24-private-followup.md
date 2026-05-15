---
worktree: spec-cafe24-private-followup-ae9995
started: 2026-05-16
owner: project-planner
---

# Spec follow-up — Cafe24 Private 영역 (consistency I-1·I-2·I-4 + W-1·W-2)

## 배경

`cafe24-request-scopes-ui-b6e34d` worktree 에서 진행한 UI 구현(`review/consistency/2026/05/16/00_36_35` 의 BLOCK: NO 검토 결과) 가 spec §4.4 와 Rationale 에 남긴 follow-up 항목 5건을 반영한다. 이 변경은 코드 동작을 바꾸지 않으며 spec 의 정합성·완결성을 보강한다.

## 대상 파일

- `spec/2-navigation/4-integration.md` 한 파일.

## 변경 1 — §4.4 의 UI 결정 흡수 (consistency I-1, I-2, I-4)

현행 §4.4 의 `[Request scopes]` 행은 한 셀 안에 두 분기 결과를 압축한 표 형태. UI 표시 결정(inline alert vs toast vs modal), `scopesAdded` 표현 방식, 영문 안내 문구 예시가 모두 미정의. 두 분기를 표 행 두 개로 분리하고 본문 sub-bullet 으로 명시화한다.

### 신규 형태 (제안)

§4.4 의 `[Request scopes]` 버튼 행을 다음으로 대체:

```markdown
| `[Request scopes]` 버튼 | 체크된 추가 scope 와 함께 `POST /api/integrations/:id/request-scopes` 호출. 응답 분기는 아래 두 가지 — provider 분기는 backend 가 응답 shape 으로 결정하므로 frontend 는 응답 shape 만 보고 UI 를 분기한다. 응답 필드 전체 정의는 §9.2 참조. |

**분기 ① — 일반 OAuth provider (Google / GitHub / Cafe24 Public)**

- 응답: `authUrl` 포함 (기타 필드는 §9.2 참조).
- UI: 새 창으로 OAuth 팝업 열고 성공 토스트 ("Scope request window opened" / "권한 요청 창을 열었어요"). 팝업 닫힘 시 success 면 부모 페이지가 `credentials.scopes` 병합 결과를 refetch.

**분기 ② — Cafe24 Private**

- 응답: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }`.
- 사유: Private 앱은 우리 서버가 OAuth 를 시작할 수 없어 popup 진입점이 없다. Cafe24 Developers 의 앱 권한 설정에서 사용자가 직접 scope 활성화 후 "테스트 실행" 으로 재인증해야 한다 (Rationale "Cafe24 Private request-scopes 흐름" 항).
- UI:
  - **inline alert** (영구 표시, amber 톤) — Scope 카드 안에 다음 안내를 고정 표시한다. modal 이 아니라 inline 인 이유는 사용자가 Cafe24 측 작업을 진행하는 동안 안내를 계속 참조하기 때문이다.
    - Title: "Cafe24 Developers 에서 권한을 추가해 주세요" / "Grant the additional scopes in Cafe24 Developers"
    - Description: "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다. (Private 앱은 외부에서 OAuth 화면을 띄울 수 없어 Cafe24 측 작업이 필요해요.)" / "Enable the additional scopes in your Cafe24 Developers app permission settings, then click 'Test run' again to refresh the token with the new scopes. (Private apps cannot initiate the OAuth flow externally, so the action must happen on Cafe24.)"
    - `scopesAdded` 가 비어 있지 않으면 그 목록을 작은 칩(tag) 으로 alert 안에 나열한다 ("Scopes added: [scope_a] [scope_b]"). 빈 배열이면 칩 영역을 표시하지 않는다.
  - **즉시 토스트** (info 레벨) — alert 표시와 동시에 한 번 띄워 사용자에게 응답이 왔음을 인지시킨다. alert 가 안내의 본문이고 토스트는 도착 신호 역할.
  - **다음 mutate 시 reset** — 새 요청 시작 직전에 alert 를 비워 옛 안내가 잔류하지 않게 한다 (구현 측면에서는 `useMutation` 의 `onMutate` 훅이 자연스러운 자리).
  - **refetch 미실행** — Cafe24 측 후속 작업이 완료될 때까지 실제 token 변화가 없으므로 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다. "테스트 실행" 콜백 성공 시 별도 경로(callback handler → integration row UPDATE) 로 token 이 갱신된다.
```

§4.4 표 하단에 한 줄: `> 비OAuth 연동에서는 이 탭이 숨겨진다.` 는 그대로 유지.

## 변경 2 — Rationale "Cafe24 install_token mismatch 회복 흐름" cross-reference 보강 (consistency W-1, I-5)

현행 `line 1014` 의 "옛 폐기된 '100건 mall_id 스캔 + trial HMAC' 과 형태는 비슷하나 …" 문장에 다음을 보강한다.

1. **명시적 Rationale 항목 참조** — `"install_token 을 App URL path 식별 키로 승격" Rationale 항 참조` 를 본문에 박는다 (현재 그 항목명이 직접 명시되지 않아 검색·역추적이 불편).
2. **N 의 실무적 범위 근거** — V046 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 **같은 workspace 안에서는** 같은 mall_id 의 cafe24 row 를 최대 1개로 제한한다. 회복 분기 스캔은 workspace 횡단이므로 이론상 N 은 workspace 수만큼 커질 수 있으나, 실무적으로 같은 mall_id 를 둘 이상의 workspace 가 동시에 사용하는 케이스가 드물어 N=1~2 가 보통 값. 이 정도는 회복 분기 (404 fallback 한정) 호출 빈도 대비 무시 가능한 비용. ("구조적 상한 N≤2" 가 아니라 "실무적으로 소수, workspace-scoped 1개 보장" 으로 표현.)
3. **TOCTOU 부재 명시** (consistency I-5) — 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로 INSERT/UPDATE 가 없어 race 자체가 발생하지 않는다 (begin 핸들러의 V045 partial UNIQUE backstop 은 INSERT 단계의 동시 신청 차단을 담당하는 다른 보증 — 두 보증은 보완 관계).

## 변경 3 — 구 flat 경로 참조 교정 (consistency W-2)

옛 flat 경로 → 현행 nested ISO 경로 교정. CLAUDE.md 명명 컨벤션이 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 전환된 이후 옛 flat 경로 `review/consistency/2026-05-14_18-23-55` 의 누적 데이터는 nested 형태로 이미 일괄 마이그레이션 완료 (`review/consistency/2026/05/14/18_23_55/` 존재 확인). spec 본문의 참조만 교정한다.

- before: `(참고: review/consistency/2026-05-14_18-23-55)` (line 903)
- after: `(참고: review/consistency/2026/05/14/18_23_55)`

## 변경 4 — Rationale "Cafe24 Private request-scopes 흐름" 항 보강 (consistency I-3, I-4)

§4.4 의 UI 결정을 흡수하면서, 결정 근거를 본문 표가 아닌 Rationale 의 같은 항(`### Cafe24 Private request-scopes 흐름 (2026-05-15)`)에 한 문단 추가한다.

> **UI 안내 패턴 결정 (2026-05-16 추가)**: 분기 ② 응답에 대한 화면 표시는 modal/dialog 가 아닌 **inline alert + toast.info** 로 정한다. modal 은 닫히면 잊혀지지만 Cafe24 측 작업(권한 활성화 → 테스트 실행)을 진행하는 동안 사용자가 안내를 계속 참조해야 한다 — inline 으로 영구 표시. toast 는 응답 도착 신호로만 사용. alert 생존 주기는 "다음 요청 시작 직전 reset" (`onMutate`) 으로 옛 안내가 새 요청과 섞이지 않게 한다. 분기 ② 에서는 부모 페이지의 refetch 콜백을 호출하지 않는다 — token 갱신은 Cafe24 측 후속 callback handler 가 담당하므로 즉시 refetch 해도 변화 없음. `scopesAdded` 는 alert 안의 칩 목록으로 표시하되 빈 배열이면 칩 영역 자체를 숨긴다.

## 영향 범위 / 영향받는 다른 spec

- 본 변경은 §4.4 의 UI 표현 결정 흡수 + Rationale 보강만 다룬다. 데이터 모델 (§5.8, `spec/1-data-model.md`), API 응답 shape (§9.2), 상태 전이 (§6), callback flow (§10) 모두 변경 없음.
- 다른 spec 파일에서 §4.4 또는 본 Rationale 들을 참조하는 곳이 없는지 grep 확인 (이 plan 의 step 2 에서 수행).

## 체크리스트

- [x] worktree 생성, draft 작성
- [x] cross-spec grep — `spec/4-nodes/4-integration/4-cafe24.md:461` 가 Rationale 항목명만 참조 (영향 없음); 다른 spec 의 `§4.4` 참조는 모두 자기 spec 안 섹션이라 본 변경과 무관
- [x] consistency-check --spec 호출 (`review/consistency/2026/05/16/01_18_15/SUMMARY.md` — BLOCK: NO; v2 draft 갱신으로 W-1·W-2 해소, INFO 5건 흡수)
- [x] Critical 0 확인 후 spec 본문 반영:
  - `spec/2-navigation/4-integration.md` §4.4 — 분기 ①/② 풀어쓴 두 sub-section + bullet 명세 (inline alert · info 토스트 · scopesAdded 칩 · onMutate reset · refetch 미실행)
  - `spec/2-navigation/4-integration.md` Rationale "Cafe24 install_token mismatch 회복 흐름" 항 — `install_token 을 App URL path 식별 키로 승격` cross-reference, N 의 실무 범위·workspace-scoped 1개 보장 표현 완화, TOCTOU 부재 한 문단
  - `spec/2-navigation/4-integration.md` Rationale "Cafe24 Private request-scopes 흐름" 항 — "UI 안내 패턴 결정 (2026-05-16 추가)" 한 문단 신설
  - `spec/2-navigation/4-integration.md` Rationale "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 항 — flat 경로 참조 nested ISO 로 교정
  - `spec/4-nodes/4-integration/4-cafe24.md` line 456 — flat 경로 nested ISO 로 교정 (cafe24 영역 잔존분 정리)
- [x] follow-up 별도 plan 으로 분리 — `spec-paths-housekeeping-2026-05-16.md` 신설 (ai-assistant.md:1273, _product-overview.md:83 의 flat 경로 잔존분 — 본 PR 범위 밖, 별도 housekeeping plan)
- [x] consistency-check I-1 후속 (`spec/0-overview.md §3.4` 에 Inline Alert 패턴 추가 권고) — `spec-overview-ui-patterns-followup-2026-05-16.md` 신설
- [ ] plan complete 이동 (PR merge 후)
