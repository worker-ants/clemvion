# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/web-chat-ai-presentation-render.md`
검토 모드: `--impl-done` (구현 완료 후)
검토 기준 브랜치: `origin/main`

---

## 발견사항

### [WARNING] `web-chat-preview-improvements` 의 "핵심 단순화" 가정이 target 구현으로 무효화됨
- **target 위치**: `plan/in-progress/web-chat-ai-presentation-render.md` — "수정" 섹션 전체 (asEnvelope 헬퍼 신설, classifyPresentation PresentationPayload 분기)
- **관련 plan**: `plan/in-progress/web-chat-preview-improvements.md` §"핵심 단순화" (L44-53)
  - 해당 절은 `channel-web-chat/src/lib/presentation.ts` 의 `classifyPresentation`/`toCarousel` 등이 **오직 flat `{ config, output }` envelope 만** 읽는다고 명시하며, 이를 근거로 "타입별 변환 없이 `presentations: [{ config, output }]` 한 형태로 **4종 전체** 커버" 라고 결론 내린다.
- **상세**: target 구현(`asEnvelope`, `classifyPresentation` PresentationPayload fast-path, `toTemplate` `content` fallback)은 `presentation.ts` 가 두 shape(flat envelope + PresentationPayload)를 처리하도록 변경했다. `web-chat-preview-improvements` 의 §"핵심 단순화" 서술은 더 이상 코드 현실과 일치하지 않는다. 이 절을 전제로 Phase 4 §I1 spec 주석("동일 위젯 렌더 경로, 단 envelope 직접 운반")이 작성 예정이므로, spec 주석이 단일 shape 기준으로 작성되면 실제 dual-shape 구현과 어긋난다.
- **제안**: `web-chat-preview-improvements.md` §"핵심 단순화"에 주석을 추가하여 "web-chat-ai-presentation-render(2026-06-25) 구현으로 presentation.ts 는 flat envelope 와 PresentationPayload 두 shape 모두 처리함 — asEnvelope() 참조" 를 명시. Phase 4 §I1 spec 작성 시 dual-shape 관계를 반영하도록 해당 계획 항목을 갱신해야 한다.

### [INFO] `web-chat-preview-improvements` Phase 4 §I1 spec 주석 작성 시 dual-shape 근거 활용 가능
- **target 위치**: `plan/in-progress/web-chat-ai-presentation-render.md` — "spec: 변경 없음" + 코드 주석으로 두 shape 처리 명시
- **관련 plan**: `plan/in-progress/web-chat-preview-improvements.md` Phase 4 §I1 (L104-105): EIA §5.2 에 `PresentationPayload` 와의 관계를 annotate 예정
- **상세**: target 구현이 `presentation.ts` 상단 주석에 두 shape 처리를 이미 명시했으므로(`// 위젯이 받는 presentations[i] 는 두 shape 중 하나다`), `web-chat-preview-improvements` Phase 4 §I1 의 EIA spec 주석 작성 담당자가 해당 코드 주석을 인용·정합할 수 있다. 별도 충돌은 없으나, spec 주석 작성 시 asEnvelope() 동작을 인지해야 "동일 위젯 렌더 경로, 단 envelope 직접 운반" 문구가 정확하다.
- **제안**: `web-chat-preview-improvements.md` Phase 4 §I1 항목에 "(web-chat-ai-presentation-render 구현으로 presentation.ts 이미 dual-shape 처리 — asEnvelope 동작 참조하여 spec 기술)" 한 줄 추적 노트 추가 권장.

---

## 요약

target(`web-chat-ai-presentation-render.md`) 구현은 spec 미해결 결정을 일방적으로 우회하거나 선행 plan 의 미해소 결정과 충돌하지 않는다. 다만 동시 진행 중인 `web-chat-preview-improvements.md` 가 `presentation.ts` 를 "오직 flat `{ config, output }` envelope 만 처리"한다고 전제하며, 이를 근거로 Phase 4 §I1 EIA spec 주석 작성을 계획하고 있어 WARNING 1건이 발생한다. target 구현으로 해당 가정이 깨졌으므로 `web-chat-preview-improvements.md` §"핵심 단순화" 갱신 및 Phase 4 §I1 계획 항목 보강이 필요하다.

---

## 위험도

LOW
