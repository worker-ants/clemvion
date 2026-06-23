# Code Review 통합 보고서 (스코프: spec 3파일 — 코드 미포함)

> ⚠️ **스코프 한계**: 본 세션은 orchestrator 가 spec 3파일(`5-admin-console.md`·`0-architecture.md`·
> `_product-overview.md`)만 페이로드에 담아, **frontend 구현 코드는 리뷰되지 않았다.** 코드 리뷰는
> feat 커밋(`8c5a3a54`) 스코프로 **별도 재실행**한다 (`review/code/.../` 후속 세션).

## 전체 위험도
**LOW** — spec 3건 구조·참조·결정 근거 양호. Critical 0, WARNING 3, INFO 다수.

## Critical
_없음_

## 경고 (WARNING)
| # | 카테고리 | 발견 | 위치 | 조치 |
|---|---|---|---|---|
| 1 | SPEC-GAP | `5-admin-console §6` 라이브 미리보기 — already-loaded iframe 에 boot config 전달 방식(URL param vs `wc:boot` postMessage) 미정의. **Phase 3(증분 2) 착수 전 블로커** | §6 / `2-sdk §3` | 증분 2에서 §6 에 전달 메커니즘 명시 or `2-sdk §3` 상호참조 |
| 2 | SPEC-GAP | `0-architecture §4` — `NEXT_PUBLIC_WIDGET_CDN_BASE`↔`WEB_CHAT_WIDGET_ORIGINS` 불일치 시 동작·검증 주체 미정의(엣지 CDN override 시 조용한 CORS 실패) | §4 / `4-security §2.1` | 불일치 시 CORS 거부·운영자 일치 책임 주석 추가 |
| 3 | DOCS | `0-architecture §2.1` 신규 예외 문구 둘째 줄 들여쓰기 불일치(렌더 단락 끊김) | 라인 44–45 | 2-space 들여쓰기 |

## 주요 INFO
- `_product-overview` 첫 인용 블록에 `5-admin-console` 누락(헤더 구성요소 줄엔 추가됨) → 인용 블록에도 추가.
- `5-admin-console §5` `<api-base>` 도출 = 기존 webhook-url 로직임을 SoT 링크로 명시 권장.
- 나머지 INFO(§2 필터 임계·§3 이름 유효성·§4 localStorage key·§7 삭제 UX)는 모두 구현 수준 결정 or 기존 trigger UX 재사용 — v1 범위 적합, 조치 불요.

## 재시도 필요
- `architecture` reviewer output 파일 미생성(1건). 코드 스코프 재실행에 함께 포함.

## 조치 계획
1. WARNING 3건 중 W-2·W-3 + INFO(인용블록·api-base SoT)는 본 턴 spec 정리.
2. W-1(§6 boot config 전달)은 증분 2(Phase 3) 블로커 → plan 에 기록, 증분 2에서 해소.
3. **frontend 코드 리뷰를 feat 커밋 스코프로 재실행** (본 세션은 코드 미커버).
