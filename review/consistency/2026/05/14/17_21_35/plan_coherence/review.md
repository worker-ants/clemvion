진단 완료. 결과를 정리한다.

---

## Plan Coherence Check — 발견사항

### [WARNING] legacy path 영구 폐기 후속 항목 plan에 미기재

- **target 위치**: DRAFT 2I Rationale "install_token 을 App URL path 식별 키로 승격" 절 마지막 문장
  > "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 의 후속 항목으로 추가 (운영 데이터·외부 등록 URL 잔존 여부 확인 후 결정)"
- **관련 plan**: `cafe24-pending-polish.md` 변경 2
  > `[ ] 기존 토큰 없는 /oauth/install/cafe24 라우트 410 Gone 또는 제거 (외부 등록 URL 영향 사전 확인)`
- **상세**: spec draft는 410 Gone을 현행 처리로 확정하고, 영구 폐기는 "별도 후속 항목으로 추가한다"고 명시한다. 그런데 현재 plan의 변경 2에는 이 영구 폐기 후속 task가 없다. spec draft가 통과 후 적용되면 plan 상의 사후 추적 경로가 사라진다.
- **제안**: `cafe24-pending-polish.md` 변경 2에 다음 항목 추가 —
  `[ ] /oauth/install/cafe24 legacy path 영구 폐기 시점 결정 (운영 데이터·외부 등록 URL 잔존 확인 후, CAFE24_INSTALL_LEGACY_PATH 410 응답 제거)`

---

### [WARNING] `expired (install_timeout)` reauthorize 비활성 FE task 미기재

- **target 위치**: DRAFT 2D-pre (§6 노트 추가), DRAFT 2D §6 전이 표 신규 행, DRAFT 2I Rationale "install_token TTL 24h" 절
  > "`status_reason='install_timeout'` 으로 expired 처리된 Cafe24 Private 행은 reauthorize 버튼이 **비활성** 이다"
- **관련 plan**: `cafe24-pending-polish.md` 변경 0 (FE 진단 메시지), 변경 1 (FE 폴링) — 어느 쪽에도 이 버튼 상태 변화가 task로 기재되지 않음
- **상세**: spec draft가 `expired + status_reason='install_timeout'` 상태의 reauthorize 버튼 비활성을 명시했으나, 구현 plan 어디에도 이 FE 조건 분기 task가 없다. 변경 4 (BE TTL 전이) 구현 후 FE에서 이 상태를 렌더링할 때 재인증 버튼을 잘못 활성화할 위험이 있다.
- **제안**: `cafe24-pending-polish.md` 변경 1 또는 변경 0 끝에 다음 항목 추가 —
  `[ ] FE: expired 상태에서 status_reason='install_timeout'이면 reauthorize 버튼 비활성 처리 (Cafe24 Private 앱 전용 — 재인증 진입점 없음)`

---

### [INFO] Expiry scanner 2-message dispatch 패턴이 plan에 미명시

- **target 위치**: DRAFT 3C-bis §1.4 OAuth 만료 스캐너 본문 보강
  > `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` 로 두 갈래 별도 큐 메시지 dispatch
- **관련 plan**: `cafe24-pending-polish.md` 변경 4
  > `purgeExpired() 확장 또는 1시간 주기 @Cron`
- **상세**: spec은 expiry scanner가 단일 큐 job에서 `reason` discriminator로 두 경로를 분기하는 메시지 형태를 명시한다. plan의 변경 4는 "purgeExpired 확장 또는 Cron"으로만 기술되어 있어, developer가 구현 착수 시 이 dispatch 형태를 spec에서 직접 파악해야 한다. blocking은 아니나 spec과 plan 사이 언급 수준의 차이가 존재.

---

### [INFO] CHANGELOG가 아직 확정 전인 consistency-check 세션을 forward-reference

- **target 위치**: DRAFT 2J-2 §10 CHANGELOG 확장 행
  > `consistency-check 세션: review/consistency/2026-05-14_17-12-13/`
- **상세**: 현재 실행 중인 Plan Coherence Check가 바로 그 검토 과정의 일부다. spec draft가 통과되어 실제 spec 파일에 적용될 시점에 `17-12-13` 세션이 최종 통과 세션으로 확정되는지 확인 후 CHANGELOG에 기재해야 한다. 적용 시 세션 ID가 다를 경우 CHANGELOG가 stale reference를 담게 된다.

---

## 요약

spec-draft-cafe24-pending-polish.md 는 `cafe24-pending-polish.md` 의 BLOCK 해소 목적에 충실하며, 핵심 결정(install_token 식별 키 승격, callback 실패 status 보존, 24h TTL expired 전이)이 원 plan의 변경 0–4와 일관성 있게 대응된다. Critical 위배는 없다.

다만 **WARNING 2건**(legacy path 영구 폐기 후속 task 누락, expired(install_timeout) FE 버튼 비활성 task 누락)은 구현 착수 전 `cafe24-pending-polish.md`에 반영해야 추적이 끊기지 않는다. INFO 2건은 구현 시 spec을 참조해 처리 가능한 수준이다.

## 위험도

**LOW** — blocking 요인 없음. WARNING 2건은 plan 문서 갱신으로 즉시 해소 가능.