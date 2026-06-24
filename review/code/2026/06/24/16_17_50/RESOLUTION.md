# RESOLUTION — Dockerfile 동봉 위젯 자급 빌드 (16_17_50)

대상 SUMMARY: `review/code/2026/06/24/16_17_50/SUMMARY.md` (Critical 0, WARNING 1, INFO 12, 위험도 LOW).

## 조치 항목

| # | 발견 | 처분 |
|---|------|------|
| W-1 | k8s/README §3 코드블록 주석 "(아래 §6 주의)" 모호 | **fix(docs)** — "(§6 \"동봉 위젯\" 안내 참고)" 로 구체화 |
| I-3·I-7 | Dockerfile 주석 보강(copy-widget 동기화 안내·COPY 순서 의도) | **defer** — Dockerfile=codebase 추가 변경은 가드 재무장 유발. 후속 |
| I-5·I-6 | Dockerfile 헤더 축약·RUN 레이어 합치기 | **defer** — 동상. RUN 분리는 캐시·디버깅상 무해 |
| I-4·I-8 | 빌드방식 SoT 3곳 분산(Dockerfile 헤더·README·spec) → spec §4.1 단일 SoT 집약 | **defer** — 본 변경에서 세 곳 일관 갱신 완료. SoT 재구성은 별도 grooming |
| I-11 | `channel-web-chat` next `^16.2.6` vs `frontend` `^16.2.3` 미세 불일치 | **defer** — 단일 lockfile 환경 실질 충돌 없음. 버전 정렬은 본 커밋 범위 외 |
| I-1·I-2·I-9·I-10·I-12 | deps filter 결합·builder 이중책임·NEXT_PUBLIC 전파(무해)·미래 prepare 훅·SPEC-DRIFT(완료) | **현행 수용/완료** — 기능·보안 무영향. 위젯 API base 는 런타임 주입 설계라 ENV 전파 무해 |

## 코드 동결로 defer 한 Dockerfile 개선 (후속)
- RUN build:widget && build 단일 레이어, deps/builder 주석(copy-widget 동기화·COPY 순서), 헤더 축약, next 버전 정렬.

## TEST 결과

- **docker build 자급 검증(핵심)**: `docker build --target builder` 후 이미지 내
  `/app/codebase/frontend/public/_widget/web-chat/v1/{app/index.html(5725B), loader.js(5668B)}` 생성 확인 — 위젯 SPA HTML.
  → 젠킨스 무변경(docker build 만)으로 번들이 이미지에 포함됨이 입증됨.
- 코드(Dockerfile)는 2a2d0375 그대로 동결. 본 라운드 추가 변경은 k8s/README §3(docs, W1) + review 산출물뿐.
- next build(frontend) 정상(`/web-chat`·Proxy middleware) — builder 스테이지 빌드 로그 확인.
