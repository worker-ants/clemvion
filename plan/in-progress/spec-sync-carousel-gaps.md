---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# carousel — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/6-presentation/1-carousel.md

## 미구현 항목
- [ ] `layout` 별 렌더 변형 — spec §1/§4 는 `card` / `image` / `minimal` 레이아웃 재구성을 약속하나, 렌더러 `CarouselContent` (`codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`) 는 `config.layout` 을 미참조하고 항상 가로 스크롤 카드(`flex gap-2 overflow-x-auto`)로 렌더한다. `image` / `minimal` 변형 분기 미구현.

## 비고
- `layout` config 필드 자체는 schema 검증·echo 됨 (백엔드 정상). 미구현 surface 는 **프론트 렌더 변형**에 한정.
- §7 에러 메시지(영문화)·§5.1 meta 누락은 본 audit 에서 spec 본문 정정으로 처리 완료 (코드 변경 불필요).
- 각 항목의 근거(claim→코드부재)는 audit findings/4-nodes/4-nodes__6-presentation__1-carousel.md 참조.
