# RESOLUTION — review/code/2026/07/31/13_08_31

대상: main 의 postcss package.json↔lockfile 드리프트 수정 (독립 브랜치 `claude/fix-postcss-lockfile-drift`,
커밋 2건). 결과 **Critical 0 · Warning 1 · INFO 5**, 위험도 LOW.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| WARNING #1 | 문서(추적성) | plan §1 에 "lockfile diff 의 blast radius" 표 추가 (본 커밋) | 코드 수정 불요 — reviewer 도 non-blocking 으로 판정 |
| INFO #1·#2·#5 | 검증 완료 | 조치 불요 | GHSA-r28c-9q8g-f849 해소, package.json 2-라인 정확 일치, 번들/peer-semver 영향 없음 |
| INFO #3·#4 | 후속 등재 | plan §3 에 이미 있음 | `next>postcss` 오버라이드 하한, `tailwindcss` lockstep 스큐 |

### WARNING #1 — 실측 확인 후 문서화

리뷰어 주장(`pnpm-lock.yaml` diff 가 `--filter frontend` 범위를 넘어 backend·`packages/*` 까지
재작성)을 **직접 세어 확인**했다:

| 변경 종류 | 실측 | 판정 |
| --- | --- | --- |
| `specifier:` 변경 | **1건** — `@tailwindcss/postcss` `^4.2.2` → `^4.3.3` | 의도한 변경. **이것뿐이다** |
| `libc:` 필드 삭제 | 57건 | 네이티브 바이너리 패키지 메타. pnpm 재계산 부산물 |
| `ts-jest` peer-key 표기 확장 | backend + `packages/*` 6~7곳 | 해소 버전 불변, peer 경로에 `ts-node` 정보가 붙는 형태 변화 |

즉 리뷰어의 관찰은 사실이고, 동시에 **버전 다운그레이드·신규 취약점·워크스페이스 그래프 변경은
없다**는 것도 사실이다. `pnpm update` 가 lockfile 을 전역 재계산하는 데서 오는 불가피한 부산물이며,
`--filter frontend` 로 좁혀도 lockfile 자체는 저장소 단일 파일이라 이 범위를 줄일 수 없다.

조치는 reviewer 제안대로 **문서화**다 — plan §1 에 위 표를 넣어 후속 리뷰어가 "postcss 수정이 왜
sharp/canvas/next-swc 를 건드렸나" 로 헤매지 않게 했다.

## TEST 결과

- lint  : 통과 — 58s (`_test_logs/lint-20260731-125537.log`)
- unit  : 통과 — backend **412 suites** + frontend/web-chat/channel-web-chat/internal packages 전부.
  87s (`_test_logs/unit-20260731-125642.log`)
- build : 통과 — 279s. **원래 깨져 있던 지점**(docker 이미지의 `pnpm install --frozen-lockfile`)을
  통과하는 것이 본 PR 의 핵심 검증이다 (`_test_logs/build-20260731-125813.log`)
- e2e   : 통과 — backend Jest e2e **260/260**, 316s, 재시도 없이 1회 통과
  (`_test_logs/e2e-20260731-130302.log`)

## 보류·후속 항목

- **`pnpm audit` 잔여 20건** — 본 PR 은 postcss 1건만 해소(21 → 20). 나머지는 backend·
  channel-web-chat 계열 선재 취약점으로 저장소 차원 대응 필요. plan §3 등재.
- **의존성 위생 2건** (INFO #3·#4) — `next>postcss` 오버라이드 하한(2-place 동시 갱신 필요),
  `tailwindcss` lockstep 스큐. 둘 다 실질 위험 없음. plan §3 등재.
- **dependabot 재발 방지** — 근본 원인은 "구 base 에서 만들어진 PR 이 최신 보안 bump 를 되돌리는"
  패턴이다. plan §3 등재.

민감 변경: 의존성 상향(보안 복원, 사용자 확인 완료). spec 변경·SPEC-DRIFT 0건.
