# RESOLUTION — `/ai-review` 라운드 5 (`review/code/2026/09/13/12_00_32`)

Critical 0 · WARNING 3 · INFO 8 · 위험도 LOW. **전 항목 처분 완료.**
같은 라운드 `--impl-done`(`12_01_01`) 도 **BLOCK: NO · Critical 0**.

**이 라운드가 종착이다** — 세 WARNING 이 전부 `codebase/**` 를 건드리지 않고 닫힌다.
라운드 2 에 선언한 종료 조건(**`codebase/**` 수정 0 으로 끝나는 라운드**)이 여기서 성립한다.

## WARNING

| # | 카테고리 | 처분 | 근거 |
|---|---|---|---|
| 1 | api_contract | **등재** | `PreviewTestResultDto` 도 `code` 미선언 — 같은 클래스의 **세 번째** DTO. 다만 `#1330` 이 만진 것은 `/:id/test`(저장된 통합)이고 preview 는 **다른 엔드포인트**(`preview-test`, 미저장 자격증명)라 내 diff 가 닿은 자리가 아니다. 고치면 스코프가 또 한 겹 넓어지고 라운드 6 이 필요해진다 |
| 2 | testing | **등재** | 라운드 4 에 넣은 MakeShop `<Callout>` 문구가 handler 템플릿의 수기 사본인데 패리티 가드가 없다. **선실측 조건을 함께 적었다** — 그 문구는 `${...}` 보간을 포함해 8갈래 문장처럼 완전 일치로는 못 보고 **접두까지만** 대조하는 축이 필요하다 |
| 3 | documentation | **고침** | CHANGELOG 가 라운드 0 에 멈춰 있었다. 라운드 1(가드 신설) · 3(SSRF 코드 2종 보강) · 4(CRITICAL 해소 · `<Callout>`)를 반영하고, `guide-error-code-existence` 에는 **"존재≠방출" 한계**도 병기했다. 루트 `CHANGELOG.md` 는 `codebase/**` 가 아니라 리뷰 시계를 올리지 않는다 |

## 왜 #1·#2 를 고치지 않고 등재했나

라운드 2 에서 *결과를 보기 전에* 선언한 정지 규칙이 **`codebase/**` 수정 0 으로 끝나는
라운드**였다. 둘 다 고치면 라운드 6 이 필요하고, 그 라운드는 또 인접 사각지대를 찾을 것이다 —
이 PR 이 5라운드 동안 실제로 보인 패턴이다(결함 클래스가 인접 파일로 계속 번졌다:
`ModelTestConnectionResultDto` → `TestConnectionResultDto` → `PreviewTestResultDto`).

**"한 칸 더" 를 멈추는 지점이 규칙의 존재 이유다.** 두 항목 모두 등재 문구에 *"왜 이번에
안 했나"* 와 *"착수 전 무엇을 선실측할 것인가"* 를 적어 다음 사람이 판단을 다시 하지 않게 했다.

## INFO — 조치 불요 (사유 기록)

- **1 (architecture)**: *"존재 검사 ≠ 완전성/방출 검사"* 가 이 PR 안에서 **세 번**
  나타났다(DTO 유령 필드 → 가이드 표 누락 → 가드 자신의 방출 오판). 세 항목이 트래커에 인접
  등재돼 있고, 라운드 4 에서 *"같은 근본 원인"* 연결을 등재 문구에 반영했다.
- **2 (security)**: 8갈래 고정 문구만 노출 — 정보 유출 없음(5라운드 연속 확인).
- **3 (performance)**: 가드 전량 스캔 — 5라운드 연속 같은 판단(차단 아님).
- **4 (api_contract)**: `code` 에 `@ApiPropertyOptional({ example })` — 선택 사항.
- **5 (api_contract)**: 프런트 `integrations.ts` 타입이 `code` 등을 안 받음 — PR 범위 밖,
  위 #1 등재와 같은 턴에 처리될 축.
- **6 (requirement·scope)**: `user-guide-evidence.md §2` 인벤토리 — 이미 등재분(전수 감사 확인).
- **7 (scope)**: 스코프 확장이 CHANGELOG·plan 에 disclosure 됨.
- **8 (user_guide_sync)**: Cafe24 twin — 가이드 미인용이라 거짓 서술 없음, 등재분.

## 검증

`run-test-all.sh` 5회 ALL PASS (e2e 307) · 타입체크 ratchet 둘 baseline 일치 ·
**등재 주장 11건 전수 감사 — 실재 11 · 부재 0**.
