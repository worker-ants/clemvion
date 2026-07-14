# 코드 리뷰 SUMMARY — backend Dockerfile 내부패키지 COPY 를 closure 4개로 (§4 item1)

- 범위: `--range HEAD~1..HEAD` (커밋 `aec1edcf1` — `codebase/backend/Dockerfile` 1파일)
- reviewer 2종 (focused — build-context 변경이라 dependency·side-effect 가 핵심)

## 종합 위험도: **LOW** (Critical 0 / Warning 0 / Info)

| reviewer | 위험도 | Critical | Warning | 핵심 |
|---|---|---|---|---|
| dependency | NONE | 0 | 0 | `pnpm --filter "backend..." list` 로 closure=4개 재검증. sdk/web-chat-sdk 는 완전 분리 그래프(전이 경로 0). manifest 6개 유지→frozen 무영향. 누락 COPY 는 prepare/tsc + builder 타입체크 + CI docker build 로 이중 hard-fail |
| side_effect | LOW | 0 | 0 (1 INFO) | sdk/web-chat-sdk 는 이전에도 `--filter "backend..."` 밖이라 "dead build-context" → 런타임/산출 이미지 델타 0(cache-only). backend-e2e-runner(target=deps) 무영향. frontend 독립 미변경 |

**차단 사유·수정 없음.** 양 reviewer 공통 INFO(신규 backend 내부패키지 추가 시 Dockerfile COPY 수동 동기화 필요)는 기존 manifest COPY 리스트 패턴의 연장이며, 주석 경고 + docker build 하드 실패(비침묵) + `codebase/**` PR 마다 도는 e2e.yml docker build 게이트로 충분히 완화 → 조치 불요.

## 검증
lint · unit(14) · build(위생 스모크) · **e2e 253/253** 통과. docker build: sdk/web-chat-sdk 소스 없이 frozen install·native(bcrypt/isolated-vm)·@workflow 4개 주입 정상.
