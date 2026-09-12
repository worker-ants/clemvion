# RESOLUTION — 라운드 2 (`review/code/2026/09/12/23_40_57`)

**판정**: Critical 0 · WARNING 5. Critical 0.

**해소 커밋**: `81736dbfd`

| # | 지적 | 처분 |
|---|---|---|
| 1 | 핵심 전제(22P02)가 **실 DB e2e 로 검증된 적 없다** — 두 테스트 다 mock | **e2e 2건 추가(305→307) + 그것으로 전제를 실측** |
| 2 | `uuid.spec.ts` 의 *"호출부는 한 곳뿐"* 을 **내 변경이 거짓으로 만들었다** | 개수 대신 **세는 법**을 적었다 |
| 3 | 계약 비대칭 — 리뷰도 *"되돌릴 필요 없음"* | 기등재 |
| 4 | 근거 주석 복제 (5개 리뷰어 중복) | 등재 — 주석-only |
| 5 | 신규 테스트 1건만 `.then()` — vacuous 위험 | `async/await` 통일 |

**전제를 실 DB 로 처음 실측했다.** 검증을 떼고 e2e 를 돌리니 두 엔드포인트 모두
**실 Postgres 에서 500 이 관측**됐다(`login-history` 기대 200 → 실측 500,
`background-runs` 기대 400 → 실측 500). 한 실행이 (a) 전제 실측 (b) 새 e2e 의 비-vacuity 를
동시에 증명한다. 원복 후 재실행 PASS.

---

검증: 각 라운드마다 `.claude/tools/run-test-all.sh lint unit build e2e` ALL PASS
(e2e 307 tests — 이 배치가 실 DB 케이스 2건을 더했다). 뮤테이션 6/6 예측 일치.
