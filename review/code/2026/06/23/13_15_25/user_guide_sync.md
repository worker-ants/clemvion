# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [INFO] 라이브 미리보기 admin console 기능 — user guide 갱신 의도적 보류

- 변경 파일: `codebase/frontend/src/components/web-chat/live-preview.tsx`, `codebase/frontend/src/app/(main)/web-chat/page.tsx`, `codebase/frontend/scripts/copy-widget.mjs`
- 매트릭스 항목: `integration-provider-change` (semantic) — "codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키"
- 관련 docs 경로: `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` / `web-chat.en.mdx`
- 상세: 이번 커밋은 웹채팅 admin console 에 same-origin contained iframe 라이브 미리보기를 추가한다. 기존 `06-integrations-and-config/web-chat.{mdx,en.mdx}` 는 end-user 설치(CDN 스니펫·npm) 문서이며, admin console 라이브 미리보기 사용 방법은 미기술 상태다. 그러나 `plan/in-progress/web-chat-console.md` Phase 4 에 `**(증분 2) user guide 페이지 신규 작성 ('user-guide-writer') — 미리보기 포함 완성 시` 로 명시되어 있으므로 **의도적 보류**다. 결론적으로 누락 아님.
- 제안: Phase 3 전체 완성(plan 체크리스트 완료) 후 별도 user-guide-writer 턴에서 admin console 사용법(웹채팅 만들기 → 외형 빌더 → 스니펫 복사 → 라이브 미리보기)을 `web-chat.mdx` / `web-chat.en.mdx` 에 섹션으로 추가할 것.

---

**i18n parity 확인 (PASSED)**

`live-preview.tsx` 의 모든 `t()` 호출은 이미 ko/en 양쪽에 존재하는 키만 사용한다:
- `t("webChat.preview.title")` — ko: "라이브 미리보기" / en: "Live preview" — 양쪽 등록 확인
- `t("webChat.preview.unavailable")` — ko/en 양쪽 등록 확인

새 한국어 리터럴이 TSX 에 하드코딩된 사례 없음. i18n parity 위반 없음.

**신규 섹션 디렉토리 확인 (PASSED)**

이번 커밋에서 `codebase/frontend/src/content/docs/<NN>-<name>/` 신규 디렉토리를 추가한 파일 없음. `locale.ts` SECTION_LABELS_BY_LOCALE 누락 없음.

**backend 노드·warningCode·errorCode 확인 (해당 없음)**

변경 파일 중 `codebase/backend/src/nodes/**`, `error-codes.ts`, `warningRules` 파일 없음. backend-labels.ts 동반 갱신 불필요.

**신규 backend zod ui.label/hint/group 확인 (해당 없음)**

backend 코드 변경 없음. backend-labels.ts 매핑 추가 불필요.

---

## 요약

매트릭스 총 19개 trigger 중 이번 변경 set 에 실질적으로 매칭되는 trigger 1개(semantic: `integration-provider-change`)를 검토했다. 해당 trigger 의 docs 동반 갱신(`web-chat.mdx`·`web-chat.en.mdx` 에 admin console 미리보기 섹션 추가)은 `plan/in-progress/web-chat-console.md` Phase 4 에 의도적으로 보류된 계획 항목임이 확인되어 INFO 1건으로 분류된다. i18n parity(ko/en webChat dict 키 양쪽 존재 확인), 신규 섹션 디렉토리 locale 등록, backend label/errorCode 동반 갱신 모두 이슈 없음. 누락된 필수 동반 갱신 0건.

## 위험도

NONE

STATUS=success ISSUES=0
