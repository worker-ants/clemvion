# RESOLUTION — deps-audit-floor-refresh-2026-09 (라운드 1)

SUMMARY: `review/code/2026/09/10/20_17_59/SUMMARY.md` — RISK=LOW · Critical **0** · WARNING **1** · INFO 7.
수동 처리(developer SKILL §REVIEW WORKFLOW 5).

## 조치 항목

| SUMMARY # | 구분 | 처분 | commit |
| --- | --- | --- | --- |
| WARNING 1 | `libc:` 메타데이터 57개 소실 | **수정** — lockfile 을 pnpm 10.34.5 로 재생성해 복원 + 원인·영향 실측 기록 | `ff94b54ce` |
| INFO 1 | `@next/mdx` 가 코어와 별개로 남음 | **문서 반영** — CHANGELOG 를 "`next` **코어**만 올렸다" 로 한정하고 `@next/mdx`·`eslint-config-next` 를 명시 | `ff94b54ce` |
| INFO 2 | `qs` 세 번째 소비처 `body-parser` 누락 | **문서 반영** — 소비처 3곳(그중 prod 2곳)과 부모 범위 `^6.15.2` 를 재실측해 CHANGELOG 보강 | `ff94b54ce` |
| INFO 3 | Next 마이너의 런타임 동작 표면 | 조치 불요 — build + playwright 51 로 실측 커버. 릴리스 노트 대조를 상시 체크리스트로 만드는 것은 이 PR 범위 밖 | — |
| INFO 4 | `qs` override 가 unscoped | 조치 불요 — 현 소비자 전수 확인됨(express·body-parser·superagent). pnpm override 의 일반 설계 | — |
| INFO 5 | CHANGELOG 표 "→" 열 의미 불일치 | **수정** — `js-yaml` 두 행의 "→" 열을 값만 남기고 키 상한 설명은 표 아래 산문으로 이동 | `ff94b54ce` |
| INFO 6 | `check-pnpm-security-config.py` 전용 테스트 부재 | **후속 등재** — `plan/in-progress/deps-guard-hardening.md §후속(2026-09-10 등재)` | `ff94b54ce` |
| INFO 7 | `test_override_floors.py` 가 값 변경을 안 봄 | 조치 불요 — 리뷰어 자신이 "테스트 설계 의도와 일치, 결함 아님" 으로 판정 | — |

### WARNING 1 의 실질 — 리뷰어 추정보다 넓었다

SUMMARY 는 "기능 영향은 낮아 보이나 … 재현성을 확인하고 한 줄 남길 것" 을 제안했다.
그 제안대로 재현을 돌린 결과 **두 지점에서 추정이 좁았다**:

1. **원인이 "override 재해소 부수효과" 가 아니다** — 핀한 pnpm 버전의 동작이다.
   대조군(매니페스트 변경 0 + 10.23.0)은 lockfile diff **0줄**로 57개를 보존한다.
   같은 편집을 10.34.5 로 재해소하면 57개가 **전부 남는다**(`lockfileVersion` 동일 `'9.0'`).
   macOS·Linux 컨테이너 양쪽 동일 → 플랫폼 요인 아님.
2. **영향이 "낮음" 이 아니다** — Alpine(musl) 에서 실제 설치해 세었더니 `libc:` 가 없으면
   `@tailwindcss/oxide`·`@img/sharp`·`@unrs/resolver-binding`·`lightningcss` **넷 모두**
   gnu+musl 두 변형이 깔린다(있으면 musl only). 동작은 하므로
   (`codebase/frontend/Dockerfile` 빌드 통과) **어떤 테스트도 이것을 못 잡는다.**

따라서 "한 줄 남기기" 가 아니라 **복원**으로 처분했다.

## TEST 결과

lockfile 을 교체했으므로 4단계를 **전부 재수행**했다 (라운드 1 결과는 무효 처리).

| 단계 | 결과 | 로그 |
| --- | --- | --- |
| lint | PASS 60s | `_test_logs/lint-20260910-204230.log` |
| unit | PASS 91s — backend 454 suites / 9,521 tests · frontend 289 files · channel-web-chat 23 files / 451 tests · 내부 패키지 8개 | `_test_logs/unit-20260910-204330.log` |
| build | PASS 191s + 타입체크 ratchet 2종 (backend 197건/36파일 · frontend 52건/15파일, baseline 일치) | `_test_logs/build-20260910-204510.log` |
| e2e | **통과** — 225s, backend jest 52 suites / 305 tests + playwright `51 passed (1.0m)` | `_test_logs/e2e-20260910-204841.log` |

> wrapper 요약줄 숫자는 커버리지 근거로 쓰지 않았다 — `unit` 의 `tests=14` 는 내부 패키지의
> 마지막 값이고 `e2e` 의 `tests=305` 는 backend jest 만 센다. 위 수치는 ANSI 제거 후 로그
> 전수 grep 으로 확인했다.

deps 게이트 4종도 lockfile 교체 후 재실행했다:

```
pnpm audit --audit-level=moderate                        → exit 0, No known vulnerabilities found
python3 scripts/check-override-floors.py                 → exit 0 (override 대상 30개, 재유입 0건)
python3 scripts/check-pnpm-security-config.py            → exit 0 (overrides 33건 값까지 일치)
python3 scripts/check-unmet-peers.py                     → exit 0 (미충족 2건 = 기존 등재 수용분)
pnpm install --frozen-lockfile --strict-peer-dependencies → exit 0 (핀된 10.23.0, 재작성 없음)
```

## 보류·후속 항목

| 항목 | 이관처 | 사유 |
| --- | --- | --- |
| pnpm 핀 상향(10.23.0 → `libc` 를 쓰는 버전) + lockfile `libc:` 회귀 가드 | `plan/in-progress/deps-guard-hardening.md §후속 libc` (기존 P3 항목 **갱신** — 그 항목이 미실증으로 남겨 둔 전제 (b) 를 이번에 실증) | 핀 상향은 `pnpm install` 호출부 5곳 전부의 툴체인을 바꾼다. dependabot PR 차단 해소를 목적으로 하는 본 PR 에 얹으면 이 PR 자체의 실패 표면이 넓어진다 |
| `check-pnpm-security-config.py` fail-closed 단위 테스트 | `plan/in-progress/deps-guard-hardening.md §후속(2026-09-10 등재)` | 리뷰어 스스로 "이 PR 범위 밖 · 사전 존재 구조적 갭" 으로 분류 |
