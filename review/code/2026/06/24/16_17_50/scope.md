# 변경 범위(Scope) 리뷰

## 발견사항

특이 사항 없음 — 모든 변경이 커밋 메시지에 명시된 의도 범위 내에 있다.

**[INFO]** 3개 파일 변경이 단일 커밋에 묶여 있음 (Dockerfile + k8s/README.md + spec)
- 위치: 커밋 2a2d0375
- 상세: `codebase/frontend/Dockerfile`(빌드 로직), `k8s/README.md`(운영 가이드), `spec/7-channel-web-chat/0-architecture.md`(spec 동기화) 세 파일이 하나의 커밋에 묶임. 각각 다른 레이어(인프라/문서/spec)이지만, 모두 "호스트 선행 build:widget 전제 → Dockerfile 자급 빌드"라는 단일 설계 변경을 반영하는 필수 동기화 세트다. spec 변경은 구현 변경의 SoT 갱신이므로 동일 커밋에 포함되는 것이 일관성 측면에서 적절하다.
- 제안: 현행 유지. 단, spec 변경이 구현 완료 후 추가됐다면 별도 커밋으로 분리하는 것이 추적성 면에서 더 명확할 수 있으나 필수 아님.

## 개별 파일 분석

### 파일 1: codebase/frontend/Dockerfile

변경 내용:
1. 헤더 주석: 구 "호스트 선행" 설명 제거 → 신 "이미지 내부 자급" 설명으로 교체
2. deps 스테이지 `pnpm install` `--filter` 에 `channel-web-chat...`, `@workflow/web-chat...` 추가
3. builder 스테이지에 `COPY codebase/channel-web-chat`, `RUN pnpm --filter frontend build:widget` 추가

모든 변경이 "위젯 빌드를 이미지 내부로 이동"이라는 목적에 직결된다. 불필요한 리팩토링, 포맷팅 변경, 무관한 설정 변경 없음.

### 파일 2: k8s/README.md

변경 내용:
1. 로컬 빌드 섹션: `pnpm --filter frontend build:widget` 선행 커맨드 제거, 한 줄 주석 추가
2. CI 파이프라인 예시 섹션: `pnpm --filter frontend build:widget` 선행 커맨드 제거
3. §6 경고 블록: 구 "호스트에서 선행 실행 필수" 경고 → 신 "docker build만 하면 됨" 설명으로 교체

변경이 Dockerfile 수정과 정확히 대응한다. 불필요한 문서 정리나 관련 없는 섹션 수정 없음.

### 파일 3: spec/7-channel-web-chat/0-architecture.md

변경 내용:
- §4.1 "동봉 방식" 항목 갱신: 기존 한 줄 → 신규 "build:widget 실행 위치 = frontend Dockerfile builder 스테이지(이미지 내부 자급)" 상세 설명 추가 (운영 회귀 사례 언급 포함)

spec은 구현 SoT이므로 구현 방식 변경 시 동기화가 필요하다. 변경 범위는 §4.1 해당 항목으로 국한되며, 다른 섹션(§1~§3, §5, Rationale)은 일절 건드리지 않았다. 적절한 범위.

## 요약

이번 변경은 "frontend Dockerfile이 위젯을 외부 호스트 선행 없이 이미지 내부에서 자급 빌드"라는 단일 설계 변경을 Dockerfile·운영 가이드(k8s/README)·spec(§4.1) 세 레이어에 일관되게 반영한 것이다. 요청되지 않은 기능 추가, 불필요한 리팩토링, 포맷팅 혼입, 무관한 파일 수정은 발견되지 않았다. 세 파일 모두 해당 설계 변경에 직결된 최소한의 수정만 포함하며, 변경 범위 관점에서 이상 없다.

## 위험도

NONE
