# Code Review 통합 보고서 — peer 게이트 도입 (§1)

- 대상: `claude/deps-peer-gating` · diff-base `origin/main` · `--route=all`
- forced 7명 **전원** 리포트 확보.

## BLOCK: NO

Critical 1 · WARNING 4 — **전부 반영** (`RESOLUTION.md`).

## 전체 위험도

**LOW** (반영 후).

## Critical / 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | requirement | **게이트가 install 호출부 한 곳에만** — 나머지 4곳(`test-stages.sh`, Dockerfile ×3) 중 3곳은 지금도 CI 에서 돈다. "한 줄이 전부를 덮는다" 는 과장 | **반영** — 5곳 전부 적용 |
| 2 | requirement · documentation · testing | 게이트 소재지를 `deps-security-checks.yml` 로 오지목(그 워크플로는 `pnpm install` 을 실행하지 않는다) | **반영** |
| 3 | testing | "8개 워크플로" → 실측 **9개 잡 / 5개 파일** | **반영** (3곳) |
| 4 | documentation | 이번 변경으로 거짓이 된 기존 주석 + 카탈로그 행 | **반영** (테스트를 남기는 이유도 명시) |
| 5 | maintainability | 테스트 이름이 새 단언을 반영 못함 | **반영** — 단 매직넘버 유도는 vacuous 라 되돌림 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE |
| scope | NONE — 다만 내 분리 근거를 **정밀하게 정정**: "§1 이 §2 의 안전망" 은 선병합 순서를 정당화할 뿐이고, PR 분리를 뒷받침하는 건 §2 의 배치 크기다 |
| side_effect | NONE — **10개 filter 스코프 + 전체 workspace 를 격리 사본에서 실행**, 11회 exit 0 |
| maintainability | 0/0 (INFO 4) |

## 이 라운드가 잡은 것 — 범위를 좁게 잡았다

CRITICAL 은 "고친 것이 틀렸다" 가 아니라 **"고칠 곳을 절반만 봤다"** 였다. plan 자신이
"CI/**로컬** 게이트" 라고 적어 둔 범위인데 CI 의 일부만 짚었다.

이 세션에서 반복된 형태 그대로다 — **센 집합이 주장한 집합과 다른데 그 사실을 확인하지
않았다.** 이번에는 세 축에서 동시에 났다: 호출부 수(1/5), 소비자 수(8 vs 9잡/5파일),
소재지(잘못된 워크플로).

## 부수 — INFO 를 고치다 더 나쁜 결함을 만들 뻔했다

"매직넘버 `ARGC=5`" 지적을 `len(argv(proc))` 유도로 처리했다가 되돌렸다. `argv()` 가 같은
stdout 을 파싱하므로 자기 자신과 비교하는 꼴이 되고, **그 단언의 존재 이유(필터가 한 인자로
도착했는가)가 사라진다.** 지적된 것이 "매직넘버" 라 해서 그 숫자가 무엇을 지키는지 안 보고
바꾸면 리팩터가 아니라 가드 제거다.

## 검증

- harness **1032 tests / OK** · 문서 가드 **2872 passed**
- 뮤테이션: action 에서 플래그 제거 → **RED 2건**
- side_effect 11회 실행 exit 0 / testing 뮤테이션 독립 재현
