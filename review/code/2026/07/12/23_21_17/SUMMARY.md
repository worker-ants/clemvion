# Code Review 통합 보고서 (pnpm §1 Dockerfile devDeps 제거)

## 전체 위험도
**MEDIUM** — Critical 0, WARNING 2(상위목표 부분달성·devDeps 제거 회귀가드 부재). 코드 되돌림 불요. 아래 W1 은 main 이 실측 재검증 후 판정.

## Critical
없음.

## 경고 (WARNING) — 처리
| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | 요구사항 | reviewer 실측 주장: `node-linker=hoisted` 로 프런트엔드 스택(next/@next 등 ~400MB)이 "pruned" backend 이미지에 잔존 → 상위목표(크기·공격표면) 부분달성. 내 diff 회귀 아님(구 builder 동일), prod-deps 는 backend 자신 devDeps(170MB)만 제거 | **main 실측 재검증**(--filter "backend..." 스코핑과 모순 주장 → 직접 확인) 후 plan §1 스코프 정확화 + 후속 등재 |
| 2 | 테스트 | devDeps 제거 자체를 보장하는 자동 회귀 가드 부재(e2e 는 "동작"만 봄) | plan 에 CI 스모크 체크(이미지 내 jest 부재) 후속 등재 — 신규 CI 인프라라 별 항목 |

## 참고 (INFO) — 판정
- I1 (`--filter "backend..."` 두 스테이지 하드코딩 중복): 선택 — 현 규모상 필수 아님
- I2 (native 재컴파일 CI 빌드시간): 의도된 트레이드오프. Dockerfile 주석 "dist 존재 시 tsc 스킵" 으로 정밀화 검토
- I3 (원본 TS 소스 잔존): 스코프 밖 후속 최적화 — plan 등재
- I4/I9 (swagger 핀·openapi3-ts): 이미 §2 defer 문서화, 조치 불요
- I5 (§2 조사 메모 동봉): 허용 범위
- I6 (CHANGELOG 미갱신): 관례 일치(선행 npm→pnpm 도 미갱신) — 조치 불요
- I7 (아카이브 plan stale "npm prune"): 역사 문서, 소급 불요
- I8 (PR 번호 placeholder): PR 생성 후 교체(선택)
- I10 (root 실행 단계): 중간 레이어, 런타임 미노출 — 조치 불요
- I11 (devDep 도구 운영 관행): grep 무발견, e2e 검증됨 — 조치 불요

## 에이전트별 위험도
security NONE · performance NONE(170MB↓) · architecture NONE · requirement MEDIUM(→W1) · scope NONE · side_effect LOW · maintainability LOW(I1) · testing LOW(→W2) · documentation NONE · dependency NONE

## 권장 조치 → 처리
1. W1 — main 실측 재검증 후 plan §1 스코프 정확화(+ 후속 등재)
2. W2 — CI devDep 부재 스모크 체크 plan 후속 등재
3~5. 선택(ARG 단일화·빌드시간 기록·node-linker strict/옵션A) — plan 후속
