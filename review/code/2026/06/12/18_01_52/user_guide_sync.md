# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [WARNING] triggers.en.mdx 동반 갱신 누락 — 영문 Callout 이 stale

- **변경 파일**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`
- **매트릭스 항목**: `userguide-gui-flow-section` — `codebase/frontend/src/content/docs/02-nodes/**.mdx` 변경 시 `.en.mdx` 동반 갱신; `new-node` / `node-schema-change` 행도 `<cat>.mdx + .en.mdx 의 노드 항목` 동반을 요구함.
- **누락된 동반 갱신**: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`
- **상세**:
  - KO 파일(triggers.mdx) 의 Chat Channel 에러 코드 Callout 이 변경됨:
    - 이전: "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요."
    - 이후: "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요."
  - EN 파일(triggers.en.mdx) 의 동일 Callout 은 이 변경 set 에 포함되지 않았으며, 현재 내용은:
    > "Some codes may currently appear in English in the UI."
  - `backend-labels.ts` 의 `ERROR_KO` 에 5개 chat-channel 코드가 추가됐으므로 "영문 그대로 노출"이라는 EN 문서 내용이 현실과 어긋남. 영문 유저 가이드를 읽는 사용자에게 구현 상태와 다른 정보를 제공하게 됨.
- **제안**: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` 의 해당 Callout 을 아래와 같이 갱신:
  ```
  Error codes the Chat Channel API can return: `INVALID_BOT_TOKEN`, `WORKSPACE_ID_REQUIRED`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`. All codes are displayed in Korean when the interface language is set to Korean.
  ```

---

### [INFO] spec/conventions/cafe24-api-catalog 변경 — frontmatter 가드 대상 외 확인

- **변경 파일**: `spec/conventions/cafe24-api-catalog/_generator.py`, `spec/conventions/cafe24-api-catalog/application/appstore-orders.md`
- **매트릭스 항목**: `spec-major-change` — glob `spec/conventions/**` 매칭. 대상: "frontmatter code: / status: / pending_plans: 정합 갱신".
- **상세**:
  - `_generator.py` 는 Python 스크립트로 spec `.md` 가 아니므로 frontmatter 가드 대상 외.
  - `appstore-orders.md` 는 `spec/conventions/cafe24-api-catalog/application/` 하위 필드 카탈로그 파일. `fix-spec-frontmatter-catalog.md` plan(이번 변경 set 에 포함된 `plan/complete/fix-spec-frontmatter-catalog.md`) 이 완료 처리한 guard 제외 규칙(`CATALOG_FIELD_FILE` 정규식 `^spec/conventions/[^/]+-api-catalog/[^/]+/.+\.md$`)에 의해 spec-frontmatter / spec-code-paths 가드 대상에서 제외됨.
  - 따라서 이 파일들에 대해 `status:`/`code:` parity 동반 갱신 의무는 발생하지 않음.
- **판정**: 해당 없음 (guard 면제 대상).

---

## 요약

매트릭스 총 18개 trigger 행 중 이번 변경 set 과 매칭되는 trigger 는 2개(`userguide-gui-flow-section` / `spec-major-change`)이며, 실질 누락은 1건(`triggers.en.mdx` 동반 갱신 미포함)이다. `backend-labels.ts` 의 `ERROR_KO` 신규 5개 chat-channel 코드 등록(`new-error-code` / `new-warning-code` trigger) 과 대응 테스트(`backend-labels.test.ts`) 갱신은 정상 수행됐다. KO triggers.mdx 의 에러 코드 callout 사실 갱신("이제 모두 한국어로 표시돼요")에 맞게 EN counterpart 동반 갱신이 빠진 것이 유일한 누락이다.

## 위험도

LOW
