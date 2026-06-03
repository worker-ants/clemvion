---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# form (Presentation) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/6-presentation/4-form.md

## 미구현 항목
- [ ] §4 step5 / §6.2 서버측 폼 검증 — `waitForFormSubmission` (`execution-engine.service.ts:3216-3256`) 은 화이트리스트 필터만 수행. 필수/type/validation/file 검증 + 검증 실패 시 재표시 미구현
- [ ] §1.5 file 입력 클라이언트 검증 — `DynamicFormUI` (`dynamic-form-ui.tsx:181-202`) 가 FileList 를 그대로 onChange, MIME/size/count reject 없음
- [ ] §1 ValidationPreset(phone) — `validationRuleSchema` (`form.schema.ts:20-29`) 에 preset 필드 부재, ValidationPreset 코드 자체 없음
- [ ] §1 file 입력 기본값 — 13종 MIME / 10MB(이미지)·50MB(문서) / count 5 기본 제약이 schema 에 default 로 선언/적용 안 됨 (`form.schema.ts:71-74`)
- [ ] §5.5 resumed meta.durationMs — resume 시 `prevStructured.meta` 재사용으로 durationMs 0 잔존 (`execution-engine.service.ts:3242-3256`)

## 비고
- 근거(claim→코드부재)는 audit findings/4-nodes.md `### spec/4-nodes/6-presentation/4-form.md` 절 참조.
- §6.1 에러 메시지 영문/한국어 차이는 spec 본문 patch 로 정정 완료.
