# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/7-channel-web-chat/` — 전체 영역 (`0-architecture`, `1-widget-app`, `2-sdk`, `3-auth-session`, `4-security`, `5-admin-console`, `_product-overview`)

---

## 발견사항

### [CRITICAL] `5-admin-console.md` 가 참조하는 `0-architecture §4.1`·`§R8 carve-out` 이 실제 파일에 존재하지 않음

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` §6 "라이브 미리보기" — `[0-architecture §4.1·§R8 carve-out]` 반복 참조; `§R6` Rationale — `[0-architecture §R8]` 참조.
- **과거 결정 출처**: 실제 `/Volumes/project/private/clemvion/spec/7-channel-web-chat/0-architecture.md` (현행 파일).
- **상세**: `5-admin-console.md` 는 다음 내용을 `0-architecture` 에서 정의된 것으로 전제한다:
  - `§4.1 위젯 동봉(co-deploy)` — 위젯을 `frontend workspace 의존 + /_widget/web-chat/v1/` 경로로 동봉 서빙, `<widget-cdn-base>` 기본 self-origin 설정.
  - `§R8 carve-out` — admin 콘솔 미리보기는 cross-origin 격리 목적이 아니므로 same-origin 동봉 위젯 `src` iframe 허용.
  
  그러나 현재 `0-architecture.md` 파일에는 `§4.1`이 없으며(§4 는 단순 `<widget-cdn-base>` 플레이스홀더 테이블만 존재), `§R8` 에 carve-out 텍스트가 없다. `0-architecture.md §R8` 은 일반 고객 임베드에 대한 srcdoc 기각 근거만 서술하고, admin 콘솔 미리보기에 대한 예외(carve-out)가 기록되어 있지 않다. 또한 `_product-overview.md` 의 "§4 제품 구성요소" 테이블에 구성요소 D(운영 콘솔)가 없고, `§2 비목표`는 운영 콘솔 예외(emit-only 빌더 carve-out) 없이 단순히 "위젯 외형의 서버사이드 관리 콘솔"을 비목표로 선언하고 있다.
  
  결과적으로 `5-admin-console.md` 전체가 `0-architecture §4.1·§R8 carve-out`이라는 존재하지 않는 근거 위에 구축되어 있다. 이 상태에서 구현을 착수하면 Rationale 선행이 없는 동봉 구조·carve-out 을 구현하게 된다.
- **제안**:
  1. `0-architecture.md §4` 를 갱신해 `§4.1 위젯 동봉(co-deploy) + 버전 잠금` 소절을 추가하고, `§R8` 에 admin 콘솔 미리보기 carve-out 단락을 삽입한다.
  2. `_product-overview.md §4 제품 구성요소` 테이블에 구성요소 D(운영 콘솔) 행을 추가하고, `§2 비목표` 에 emit-only 빌더 carve-out 주석을 추가한다.
  3. 위 변경이 완료된 이후 `5-admin-console.md` 구현을 착수한다.

---

### [WARNING] `_product-overview.md` 비목표 항목과 `5-admin-console.md` 의 경계 명확화 — Rationale 이 target 에만 존재

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` §Rationale R2 "외형 백엔드 미저장 — 기존 비목표와의 경계 명확화 (번복 아님)"; `_product-overview.md` (payload 버전) §Rationale "운영 콘솔(구성요소 D)과 외형 백엔드 미저장 비목표의 경계".
- **과거 결정 출처**: 실제 `/Volumes/project/private/clemvion/spec/7-channel-web-chat/_product-overview.md §2 비목표` — "위젯 외형의 서버사이드 관리 콘솔 — 외형은 v1·v2 모두 **로더(boot) 옵션으로만** 주입(백엔드 미저장)."
- **상세**: 현행 `_product-overview.md` 는 운영 콘솔 전체를 비목표로 규정하고 있다(예외 carve-out 주석 없음). `5-admin-console.md` 의 R2 와 `_product-overview.md` (payload 버전) Rationale 은 "설치 스니펫 빌더 콘솔은 당시 명시 검토 대상이 아니었다"고 경계를 명확화한다. 그러나 이 명확화 Rationale 은 target 문서에는 존재하지만 실제 `_product-overview.md` 파일에는 없으므로, 실제 파일 기준으로 비목표가 번복되지 않았음을 보여주는 근거가 부재하다. 이는 번복에 해당하는지 아닌지를 외부 검토자가 판단할 수 없는 상태다.
- **제안**: `_product-overview.md §2 비목표` 해당 행을 payload 버전처럼 갱신해 "emit-only 빌더 콘솔은 본 비목표에 해당하지 않으며 v1 범위"라는 carve-out 주석을 추가하고, `§4 제품 구성요소` 테이블에 구성요소 D 를 등재한다.

---

### [WARNING] `0-architecture §4` — `<widget-cdn-base>` 설명이 payload 버전과 현행 파일 사이에 불일치

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` §5 설치 스니펫, §6 라이브 미리보기 — `<widget-cdn-base>` 기본값을 `배포 origin` (self-origin) 으로 전제; `0-architecture §4.1`·`[0-architecture §4](./0-architecture.md)` 반복 참조.
- **과거 결정 출처**: 실제 `0-architecture.md §4` — `<widget-cdn-base>` 는 "SaaS 는 공식 CDN, 셀프호스팅은 운영자 지정"이라 기재; 기본값이 self-origin 이라는 선언 없음.
- **상세**: `5-admin-console.md` 는 `<widget-cdn-base>` 기본값이 배포 self-origin 이라는 점을 전제하여 "`NEXT_PUBLIC_WIDGET_CDN_BASE` 미설정 시 self-origin 기본값"을 쓴다. 실제 `0-architecture.md §4` 는 이 기본값 정책을 정의하지 않고 플레이스홀더 테이블만 존재한다. self-origin 기본값은 동봉(co-deploy) 결정과 함께 도입되어야 하는 신규 결정인데 그 결정이 아직 `0-architecture` 에 기록되지 않은 상태다.
- **제안**: `0-architecture §4` 에 동봉 서빙 정책 및 `<widget-cdn-base>` self-origin 기본값 결정을 명시하고 `§4.1` 소절을 추가한 후, `5-admin-console.md §5` 내용과 상호 참조가 성립하는지 확인한다.

---

### [INFO] `5-admin-console.md §R6` — 동봉(co-deploy) 결정 날짜 기재 ("2026-06-23")는 신규 결정임을 명시하나 부모 문서 갱신이 선행 필요

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §Rationale R6` — "결정(2026-06-23): 위젯을 제품과 같은 릴리스로 동봉(co-deploy)".
- **과거 결정 출처**: `0-architecture §4`, `_product-overview §2/§4`.
- **상세**: R6 는 동봉 결정이 신규임을 날짜와 함께 명시하는 점에서 Rationale 연속성 형식을 준수했다. 다만 이 신규 결정이 반영되어야 할 상위 문서(`0-architecture §4`, `_product-overview §2/§4`)가 아직 갱신되지 않아 위 CRITICAL/WARNING 항목이 발생한다. R6 자체는 올바른 ADR 형식을 따르고 있으므로 INFO 로 분류한다.
- **제안**: CRITICAL 항목 해소 시 R6 가 참조하는 `[0-architecture §R8]` 와 `[0-architecture §4.1]` 이 실제로 존재하는지 재확인하고, target 문서의 상호 링크가 유효한지 검증한다.

---

### [INFO] `5-admin-console.md §2` — "신규 백엔드 트리거 유형·facade 미신설" 원칙(0-architecture R5)과의 정합 재확인 권장

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §2` — "신규 백엔드 트리거 유형·테이블·엔드포인트·facade 를 추가하지 않는다 ([0-architecture R5])".
- **과거 결정 출처**: `0-architecture §R5` "클라이언트 consumer 로 한정 — EIA·신규 트리거 유형·facade 미신설".
- **상세**: `5-admin-console.md §2` 는 `GET /api/triggers` 클라이언트 필터로 목록을 조회하고, `POST /api/triggers` 로 생성하며 신규 엔드포인트를 추가하지 않아 R5 원칙을 준수하고 있다. 현재는 위반 없음으로 판단된다. 단, 향후 "서버 `?interactionEnabled=true`" 파라미터 도입 검토(§2 백로그)가 구현될 경우 백엔드 API 확장이 필요해 R5 범위를 벗어날 수 있으므로 주의가 필요하다.
- **제안**: `§2` 의 "서버 필터 파라미터 도입 검토 백로그" 항목에 R5 원칙과의 상충 가능성을 명시해 두면 추후 결정 시 Rationale 갱신 의무를 상기할 수 있다.

---

## 요약

`spec/7-channel-web-chat/5-admin-console.md` 는 admin 콘솔 라이브 미리보기를 위한 "위젯 동봉(co-deploy) + same-origin 미리보기 carve-out" 구조를 신규 결정으로 도입하고 있다. 이 결정 자체의 Rationale(R6)은 target 문서 안에 날짜와 함께 서술되어 있어 ADR 형식은 갖추었다. 그러나 이 결정이 전제하는 두 가지 기반 — `0-architecture §4.1`(동봉 전략·self-origin 기본값) 및 `§R8 carve-out`(admin 콘솔 미리보기 격리 예외) — 이 현재 실제 `0-architecture.md` 파일에 존재하지 않는다. 또한 `_product-overview.md §2 비목표`는 운영 콘솔 전체를 비목표로 선언하고 있어 `5-admin-console.md` 의 범위를 정당화하는 경계 명확화 Rationale 이 현행 파일에 반영되지 않은 상태다. 이 두 가지는 CRITICAL 및 WARNING 수준의 Rationale 공백으로, `0-architecture.md` 및 `_product-overview.md` 갱신이 구현 착수 전에 반드시 선행되어야 한다.

## 위험도

HIGH
