---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# form (Presentation) — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/4-nodes/6-presentation/4-form.md

## 미구현 항목

> **구현 진척 (2026-06-14, impl-form-gaps PR)**: §5.5(durationMs) 구현. §4/§6.2·§1.5·§1 file기본값은 **파일검증
> cluster** 로 묶여 별도 PR 권장(공유 default 상수 + 서버/클라 적용 + 재-waiting 흐름). §1 ValidationPreset 은 spec
> form.md L63 이 "Planned" 명시 — 제외.

- [ ] §4 step5 / §6.2 서버측 폼 검증 — `processFormResumeTurn` 이 화이트리스트 필터만 수행. 필수/type/validation/file 검증 + 실패 시 재-waiting 재표시 미구현. **파일검증 cluster**(chat-channel `validateFormSubmission` 재사용 가능 + file 검증·재-waiting 흐름 신규).
- [ ] §1.5 file 입력 클라이언트 검증 — `DynamicFormUI`(frontend) FileList MIME/size/count reject 없음. **파일검증 cluster**(frontend).
- [ ] §1 ValidationPreset(phone) — **보류 (spec Planned, form.md L63)**: preset 필드·카탈로그·서버 regex·UI hint 부재.
- [ ] §1 file 입력 기본값 — 13종 MIME / 10MB·50MB / count 5. **파일검증 cluster**: 공유 field schema 에 무조건 `.default()` 면 비-file 필드 config echo 오염(Principle 1.1) → file-type 한정 적용으로 §4/§1.5 와 함께.
- [x] §5.5 resumed meta.durationMs — `processFormResumeTurn` 이 resume 시 `prevStructured.meta`(durationMs=0)를 재사용하던 것을, `nodeExec.startedAt`→재개 시각 경과로 `meta.durationMs` 갱신(기존 meta 필드 보존, DB durationMs 와 동일 계산 공유). 테스트 추가.

## 비고
- 근거(claim→코드부재)는 audit findings/4-nodes.md `### spec/4-nodes/6-presentation/4-form.md` 절 참조.
- §6.1 에러 메시지 영문/한국어 차이는 spec 본문 patch 로 정정 완료.
