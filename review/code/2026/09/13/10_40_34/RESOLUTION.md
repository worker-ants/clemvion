# RESOLUTION — 라운드 2 (`review/code/2026/09/13/10_40_34`)

Critical 0 · WARNING 3 · INFO 8 · 위험도 LOW. **전 항목 처분 완료.**
처분 커밋: `de99def86` (*"형제 엔드포인트에도 계약 검사를 걸고, 내 JSDoc 자기모순을 고친다"*).

**이 라운드의 발견은 전부 라운드 1 에서 내가 만든 것**이다 — 새 결함이 아니라 내 수정의
뒷정리다. 발견의 성격이 동작(라운드 1: UI 무테스트) → 구조(가드 부재) → **문서·배선**으로
내려왔다.

## WARNING

| # | 카테고리 | 처분 | 근거 |
|---|---|---|---|
| 1 | scope·documentation | **고침** | CHANGELOG 제목이 *"필드 2종 제거"* 로 못박혀 있었는데 라운드 1 이 형제 DTO 까지 범위를 넓혔다(`meta` 제거 · `code` 추가). 두 엔드포인트를 갈라 적고, `code` 는 **없던 필드가 생기는 게 아니라 나가던 필드가 문서에 보이는 것**임을 명시 |
| 2 | testing | **고침 (등재로 미루지 않음)** | 리뷰는 *"후속 plan 항목 등재 적합"* 이라 했으나 **이 PR 이 그 DTO 를 고쳤다**. 자매 엔드포인트의 3층 불일치 원인이 정확히 *"정본 검사기 미배선"* 인데 형제를 고치고 배선을 미루면 같은 자리를 또 만든다. `pending_install` 케이스가 이미 `{success:false, code, message}` 를 내므로 그 자리에 `assertMatchesContract` 배선. **성공 경로는 못 건다** — MCP 3종 미선언이라 지금 걸면 RED. 사유를 테스트 주석에 기록 |
| 3 | user_guide_sync | **고침** | planner 등재 문구가 가드 **하나만** 적고 있었다 — 둘째 가드는 라운드 1 이 낳았는데 등재는 스냅샷에 멈춰 있었다. 그대로면 관계표가 3→**4건**으로 마감된다(정답 5건). 두 가드가 각각 무엇을 보는지 표로 병기 |

> WARNING #2·#3 은 `--impl-done` `10_41_13` 의 convention_compliance WARNING #1·#2 와
> 같은 자리를 짚었다(JSDoc 내부 서사 · 등재 범위). 양 게이트가 독립으로 확인한 셈이다.

## 뮤테이션

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| `code` 선언 제거 | RED (새 배선이 문다) | **RED** |
| `meta` 되살리기 | GREEN (선언-쪽 과잉은 런타임 불가시) | **GREEN** — 이 PR 에서 세 번째 재확인 |

## INFO — 조치 불요 (사유 기록)

- **1·2 (maintainability)**: 두 유사 DTO 공용 베이스는 **세 번째 유사 결함 시** 재검토.
  "`latencyMs` 생산자 0건" 반복 서술은 CHANGELOG/plan 로 수렴 중.
- **3 (testing)**: `run-test-all.sh` 체크박스 — 라운드 3 에서 갱신 완료.
- **4 (testing)**: `message: null` 경계는 프로덕션 발행 케이스가 없어 보류.
- **5 (performance)**: 가드 전량 스캔이 `spec-links.ts` 와 중복 — 후속 가드 추가 전 캐시 공유
  리팩터 근거로만 남김(차단 아님).
- **6 (dependency)**: 텍스트 스캔 soft coupling 은 의도 — vacuity floor 가 방어한다.
- **7 (side_effect)**: 저장소 밖 3rd-party 가 `.error` 를 파싱했을 가능성은 코드로 배제 불가 —
  CHANGELOG 가 *"⚠️ 배포 시 확인"* 으로 고지 완료.
- **8·9·10·11**: 스코프 확장은 전 층에서 disclosure 완료, 나머지는 이미 등재분.

> **INFO#5 는 채택하지 않았다.** 라운드 2 의 documentation 이 라운드 1 maintainability
> WARNING#1(*"근거 주석이 시그니처를 끊는다"*)을 *"부정확한 서술"* 이라 적었는데, **그건
> 라운드 1 이 이미 고친 뒤의 코드를 본 것**이다. 원 지적은 옳았다(주석이 파라미터 목록 안에
> 있었다). 되돌리지 않는다.

## 검증

`run-test-all.sh` ALL PASS (e2e 307) · 타입체크 ratchet 둘 baseline 일치.
