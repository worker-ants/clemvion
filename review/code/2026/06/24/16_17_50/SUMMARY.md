# Code Review 통합 보고서 (Dockerfile 동봉 위젯 자급 빌드)

리뷰 대상 커밋: `2a2d0375` (Dockerfile 자급 빌드 + spec 0-architecture §4.1 + k8s/README)
변경 파일: `codebase/frontend/Dockerfile`, `k8s/README.md`, `spec/7-channel-web-chat/0-architecture.md`

> 통합 summary 의 terminal write 가 차단되어 main 이 멱등 persist. 상세는 동일 디렉터리 `<reviewer>.md`.

## 전체 위험도

**LOW** — Critical 0. WARNING 1(문서 참조 표현 모호, 기능 무영향). 변경 방향(Dockerfile 자급 빌드) 올바르고 세 파일 일관 갱신.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| 1 | Documentation | `k8s/README.md §3` 코드블록 주석 "(아래 §6 주의)" 모호 — §6 전체가 위젯 전용처럼 읽힘 | **fix** — "(§6 \"동봉 위젯\" 안내 참고)" 로 구체화 |

## 참고 (INFO) — 요약 (상세 reviewer 파일)

I-1~4 architecture(deps filter 결합·builder 이중 책임·copy-widget↔Dockerfile 목록 동기화 명시·빌드방식 SoT 3곳 분산), I-5~8 maintainability(헤더 주석 길이·RUN 레이어 합치기·COPY 순서 주석·README blockquote drift), I-9~10 side_effect(NEXT_PUBLIC_* ENV 위젯 빌드 전파 무해·channel-web-chat 미래 prepare 훅 위험), I-11 dependency(next 범위 ^16.2.6 vs ^16.2.3 미세 불일치), I-12 SPEC-DRIFT(§4.1 갱신 동일 커밋 완료).

## 처리

- Critical 0 → 차단 없음. 위험도 LOW.
- **fix(docs)**: W1 — k8s/README §3 주석 표현 구체화.
- **defer(비차단, 코드 동결)**: INFO 다수 — RUN 레이어 합치기(I-6)·Dockerfile 주석 보강(I-3·I-7)·헤더 축약(I-5)·next 버전 정렬(I-11)·SoT 집약(I-4·I-8). 추가 코드(Dockerfile) 변경은 가드 재무장 유발하므로 후속. I-9·I-10·I-12 는 현행 수용/완료.
- 코드(Dockerfile) 동결 — docker build 자급 검증 완료(이미지 내 public/_widget/web-chat/v1/{app/index.html,loader.js} 생성 확인).
