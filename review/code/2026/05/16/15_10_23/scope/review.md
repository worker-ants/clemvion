# 변경 범위(Scope) 리뷰

리뷰 대상 worktree: `cafe24-mall-dup-ux-a7f2c8`
리뷰 시각: 2026-05-16

---

## 발견사항

### 1. review/ 산출물 파일 (파일 1~5)

- **[INFO]** consistency-check 세션 산출물 5개는 모두 `review/consistency/2026/05/16/14_28_20/` 하위 신규 파일로, 관련 도구가 생성하는 정해진 경로이므로 범위 이탈 없음
  - 위치: `review/consistency/2026/05/16/14_28_20/{cross_spec,naming_collision,plan_coherence,rationale_continuity}/review.md`, `meta.json`
  - 상세: 모두 `new file mode` 이며 기존 파일 수정이 없다. 범위 관점에서 정상.
  - 제안: 해당 없음

---

### 2. spec/1-data-model.md — install_token 라이프사이클 기술 변경

- **[WARNING]** 이 worktree의 주 작업 의도(`cafe24-mall-dup-ux`)는 Cafe24 Public 중복 방지 UX 추가이나, `spec/1-data-model.md` §2.10 의 `install_token` / `install_token_issued_at` 필드 설명이 대폭 단축·변경됨
  - 위치: `spec/1-data-model.md` §2.10 Integration 표, `install_token` 행 (diff line 609), `install_token_issued_at` 행 (diff line 610)
  - 상세: 변경 전 `install_token` 설명은 "callback 성공 시 보존, `pending_install → expired (install_timeout)` 24h TTL 만료 또는 통합 삭제 시에만 NULL/소거", "post-install navigation 의 식별 키" 등 상세 라이프사이클을 기술하고 있었다. 변경 후에는 "callback 성공 또는 TTL 만료 시 NULL"로 줄어들어, callback 성공 시 token이 `NULL`로 처리된다는 것이 이전 기술("보존")과 정반대다. `install_token_issued_at` 도 마찬가지로 "callback 성공 시 보존" → "callback 성공 시 NULL"로 역전됐다. 이는 동일 파일의 Rationale "install_token 형식" 섹션 및 `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 의 "callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다"와는 정합하나, `spec/2-navigation/4-integration.md` diff 의 TTL 기준 섹션("**TTL 기준 (2026-05-15 갱신)**") 도 동일 내용으로 변경된 것을 보면 이 변경이 의도적임을 알 수 있다. 그러나 `cafe24-mall-dup-ux` plan의 주 목적(Public 앱 중복 방지)과 `install_token` 라이프사이클 정책 수정은 별개의 주제다. 기존 "install_token persistent 격상" 결정(`spec/2-navigation/4-integration.md` Rationale 삭제된 부분에서 언급)의 번복이므로 별도 plan/spec 개정 의도가 있었는지 확인이 필요하다.
  - 제안: `install_token` 라이프사이클 정책 변경(persistent 격상 → callback 성공 시 NULL)이 이 worktree의 작업 범위에 포함되는지 plan 문서(`cafe24-mall-dup-ux.md`)에서 명시적으로 확인한다. 범위 외라면 별도 worktree/plan으로 분리하거나, 범위 내라면 plan에 해당 항목을 추가해 추적 가능하게 한다.

---

### 3. spec/2-navigation/4-integration.md — Attention 칩 및 배너 UX 전면 삭제

- **[CRITICAL]** 현재 worktree의 plan(`cafe24-mall-dup-ux`)에서 명시적으로 요청된 작업 범위를 벗어나는 대규모 UX 삭제가 spec에 적용됨
  - 위치: `spec/2-navigation/4-integration.md` §2.3 상태 칩, §2.4 배너 클릭 동작, §9.1 status 파라미터, Rationale "Attention 가상 필터값" 전체 섹션 (diff line 1316~1399)
  - 상세: diff를 보면 (a) `Attention` 칩 삭제 및 이를 설명하는 단락 전체 제거, (b) 배너 포함 조건 상세 설명 6줄이 2줄로 단축, (c) 배너 클릭 동작(분해 카운트, 톤 강조, 단건 점프 등) 전부 제거, (d) `GET /api/integrations` status 파라미터에서 가상 필터값 설명 전체 삭제, (e) `GET /api/integrations/:id`의 `appUrl` 필드 정의 삭제, (f) §4.2 App URL 카드 행 삭제, (g) Rationale "Attention 가상 필터값" 및 "Cafe24 App URL 상세 페이지 표시" 두 섹션 전체 삭제가 이루어졌다. 이 변경들은 2026-05-16에 신설된 결정("Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출")을 같은 날 전면 번복하는 것이며, cross_spec 리뷰에서 이미 CRITICAL로 지적된 바와 같이 현재 프론트엔드 코드(`page.tsx`, `status-badge.tsx`, `scope-tab.test.tsx`)와 정면으로 모순된다. 이 변경이 이번 worktree의 주 목적(Public 앱 중복 방지)과 직접적인 연관이 없는 독립적인 UX 방향 전환이라는 점이 범위 이탈의 핵심이다.
  - 제안: `Attention` 칩 삭제, `appUrl` 필드 제거, 배너 UX 단순화가 이 worktree의 명시적 작업 범위라면 plan 문서에 해당 내용을 추가하고 연관 프론트엔드 코드도 동시에 갱신해야 한다. 그렇지 않다면 해당 변경을 별도 worktree로 분리한다.

---

### 4. spec/2-navigation/4-integration.md — install_token TTL 기준 및 Rationale 기술 변경

- **[WARNING]** Rationale "install_token TTL 24h" 섹션의 "2026-05-16 보강" 내용이 삭제되고 callback 성공 시 `install_token_issued_at` 처리 방향이 번복됨
  - 위치: `spec/2-navigation/4-integration.md` Rationale §TTL 기준 단락 (diff line 1408~1409)
  - 상세: 변경 전 "(2026-05-16 갱신 — 옛 NULL 처리 기술은 'install_token persistent 격상' 결정과 미정합 표기 잔존이었다)"와 같이 persistent 격상 결정을 명시한 2026-05-16 보강 기술이 삭제되고, callback 성공 시 `install_token_issued_at` 을 NULL로 처리한다는 내용으로 교체됐다. 이는 데이터 모델 변경(발견사항 2)과 쌍을 이루는 변경이지만, 역시 이 worktree의 주 목적과 별개의 결정이다.
  - 제안: 발견사항 2와 함께 범위 포함 여부를 확인한다.

---

### 5. spec/4-nodes/4-integration/4-cafe24.md — Fields UI 및 §9.9 Rationale 전면 교체

- **[WARNING]** `spec/4-cafe24.md` §2 설정 UI의 Fields 설명과 §9.9 Rationale이 대폭 교체됨 — 이 worktree의 주 작업(mall 중복 방지)과 직접 관련이 없는 변경
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 Fields 본문 (diff line 1446~1452), §9.9 Rationale (diff line 1461~1475), CHANGELOG 마지막 행 삭제 (diff line 1483)
  - 상세: 변경 전 §2 Fields 항목에는 `ExpressionInput` 베이스 위젯, enum/boolean/default hint, 호환 키 보존, Operation 후보 표시(planned disabled), Pagination 등 Phase 3 기능이 기술되어 있었다. 변경 후에는 "메타데이터 기반 동적 폼 렌더, Required / Optional 두 그룹 분리" 한 줄 + "편집 버퍼" 단락으로 교체됐다. §9.9는 "Fields 편집 UI — 메타데이터 기반 typed 동적 폼"에서 "Fields 편집 UI 의 내부 버퍼 분리"로 제목이 바뀌고 내용도 (A) 자유 key/value vs (B) 메타데이터 기반 비교에서 (A) object-shaped contract 직접 사용 vs (B) 편집 버퍼 분리 비교로 교체됐다. CHANGELOG에서 `(ux-cleanup)` 항목도 삭제됐다. 이 변경은 직전 PR(#88)에서 수립된 Phase 3(메타데이터 기반 typed 동적 폼 + 호환 키 보존) 내용을 되돌리는 방향이며, `cafe24-mall-dup-ux` plan의 주 목적과 관련이 없다.
  - 제안: cafe24 노드 spec §2/§9.9의 Fields UI 기술이 이 worktree에서 수정이 필요한 이유를 plan에서 명시적으로 확인한다. "ux-cleanup" 결정 번복이라면 별도 plan/worktree로 분리하는 것이 추적 가능성 면에서 낫다.

---

### 6. spec/4-nodes/4-integration/4-cafe24.md — Operation 후보 표시 및 호환 키 보존 삭제

- **[WARNING]** Phase 3 결정("Operation 후보 표시 — planned disabled", "호환 키 보존")이 spec에서 삭제됨
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI (diff line 1447~1449)
  - 상세: "Operation 후보 표시: 카탈로그의 `status: planned` 행도 dropdown에 노출하되 disabled + '(지원 예정)' 접미사", "resource 옆에 지원 N개 · 추후 지원 M개 coverage hint", "Pagination: supported가 아닌 operation (planned/unknown) 선택 시 fields/pagination 미렌더" 등의 Phase 3 기능 기술이 삭제됐다. 이 결정들은 `review/consistency/2026/05/16/13_09_46/SUMMARY.md`(출처 행도 삭제됨)에서 수립된 내용이다.
  - 제안: Phase 3 기능 삭제가 의도된 것인지 확인한다. 만약 실수로 삭제됐다면 복원이 필요하다.

---

## 요약

이번 worktree(`cafe24-mall-dup-ux-a7f2c8`)의 변경 범위는 명목상 "Cafe24 Public 앱 중복 방지 UX 추가"이나, 실제 diff에는 그 범위를 크게 벗어나는 세 가지 독립적인 변경이 혼재한다. (1) `Attention` 칩과 배너 UX 전면 삭제 및 `appUrl` 필드·Rationale 섹션 제거는 2026-05-16에 신설된 결정을 같은 날 번복하는 대규모 UX 방향 전환으로, 현재 프론트엔드 코드·테스트와 정면 충돌해 CRITICAL 수준의 범위 이탈이다. (2) `install_token` 라이프사이클 정책 변경("persistent 격상" 번복 → "callback 성공 시 NULL")이 `spec/1-data-model.md`와 `spec/2-navigation/4-integration.md`에 동시 반영됐는데, 이는 mall 중복 방지 작업과 별개의 결정이다. (3) `spec/4-cafe24.md` §2/§9.9의 Fields UI 기술이 직전 PR(#88)에서 수립된 Phase 3 결정을 되돌리는 방향으로 교체됐다. 이 세 가지 변경이 plan에 명시되지 않은 채 혼합되어 있어 추적 가능성과 리뷰어 부담이 높다. 범위 이탈이 의도적이라면 plan 갱신과 코드 동시 갱신이 선행되어야 하며, 의도적이지 않다면 각각 별도 worktree로 분리하는 것이 바람직하다.

---

## 위험도

HIGH
