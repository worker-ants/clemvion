# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`
검토 모드: impl-done (diff-base=origin/main)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] `data-flow/10-triggers.md` 의 "인증 webhook 은 무제한 통과" 표현이 부분적으로 stale
- **target 위치**: `spec/5-system/12-webhook.md` §6 + WH-NF-02 — 인증 webhook 에 1MB 라우트 스코프 body-parser limit 추가
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/data-flow/10-triggers.md` L98 — "인증 webhook 은 무제한 통과. SoT: Spec 웹채팅 보안 §4"
- **상세**: `data-flow/10-triggers.md` L98 의 문장은 `PublicWebhookThrottleGuard` 의 IP rate-limit + 32KB body 제한 맥락에서 "인증 webhook 은 무제한 통과"라 기술한다. 그 Guard 범위에서는 여전히 사실이지만, WH-NF-02 옵션 C 구현 이후 인증 webhook 은 `/api/hooks/*` 라우트 스코프 1MB body-parser limit 으로 별도 게이트된다. 위 문장만 읽으면 인증 webhook 이 본문 크기 제한 없이 완전히 무제한이라는 인상을 줄 수 있어 혼동 여지가 있다. 직접 모순은 아니지만 동기화가 필요하다. `12-webhook.md §6` 은 이미 "(본문 크기는 아래 라우트 스코프 파서가 별도 게이트)"라는 단서를 추가했으나, data-flow 문서는 미반영 상태다.
- **제안**: `spec/data-flow/10-triggers.md` L98 의 "인증 webhook 은 무제한 통과" 를 "인증 webhook 은 이 Guard(IP rate-limit + 32KB 본문)를 무제한 통과(본문 크기는 `/api/hooks/*` 라우트 스코프 1MB body-parser 가 별도 게이트)" 와 같이 qualifier 를 추가해 동기화 권장.

---

### [INFO] `spec/7-channel-web-chat/4-security.md` §4 rate-limit 주석의 "무제한 통과" 표현 동기화 권장
- **target 위치**: `spec/5-system/12-webhook.md` WH-NF-02 / §8 — 인증 webhook 1MB 본문 크기 게이트 구현
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/7-channel-web-chat/4-security.md` L143 — "공개 trigger에만 적용되고 인증 webhook(서버-to-서버)은 무제한 통과한다"
- **상세**: 해당 구절은 "rate-limit 구현 특성(v1)" 주석 맥락이라 rate-limit 에 한정된 설명임이 문맥상 추론 가능하다. 직접 충돌은 아니다. 그러나 body 크기 제한 관련 내용이 같은 §4 절에 혼재("body 32KB: webhook gate 구현됨 v1")하고 있어, 인증 webhook 의 1MB 게이트가 이 절에 언급되지 않으면 "인증 webhook 은 body 제한도 없다"는 오독 가능성이 있다. 권장 조치: rate-limit 주석에 "rate-limit 에 한함. 본문 크기는 라우트 스코프 body-parser 별도 게이트(SoT: Spec Webhook WH-NF-02)" 단서 추가.
- **제안**: 동기화 권장(필수 아님). SoT 는 `spec/5-system/12-webhook.md` WH-NF-02 이므로 참조 링크만 추가해도 충분.

---

### [INFO] `spec/5-system/12-webhook.md` 프런트매터 `code:` 목록에 `hooks-body-parser.ts` 누락
- **target 위치**: `spec/5-system/12-webhook.md` 프런트매터 `code:` 배열 (L4–L13)
- **충돌 대상**: WH-NF-02 본문(L106) 과 §6(L332) 이 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 를 구현 파일로 명시
- **상세**: `hooks-body-parser.ts` (`createHooksBodyParsers` / `createGlobalBodyParsers`) 는 WH-NF-02 구현의 핵심 파일이지만 프런트매터 `code:` 목록에 없다. spec-impl-evidence 추적 · spec-coverage audit 에서 해당 파일이 webhook spec 과 연결되지 않을 수 있다. 실제 동작·API 계약에는 영향 없음.
- **제안**: `codebase/backend/src/bootstrap/hooks-body-parser.ts` 를 `spec/5-system/12-webhook.md` 프런트매터 `code:` 에 추가. `main.ts` 도 `bodyParser: false` + 파서 직접 등록 로직을 포함하므로 이미 목록에 있다면 중복이 아닌 포인터 추가로 충분.

---

## 요약

이번 변경(WH-NF-02 인증 webhook 1MB body-parser limit 구현, `PAYLOAD_TOO_LARGE` 413 코드 추가)은 `spec/5-system/` 내부에서 일관성이 잘 유지된다. `2-api-convention.md §5.3·§6` 의 413 행, `3-error-handling.md §1.3` 의 `PAYLOAD_TOO_LARGE` 항목, `12-webhook.md` WH-NF-02·§3.1·§6·§8 모두 동일 내용을 가리킨다. 검출된 이슈는 모두 **INFO** 수준으로, `data-flow/10-triggers.md` 와 `7-channel-web-chat/4-security.md` 의 "인증 webhook 무제한 통과" 표현이 Guard 범위에서는 사실이나 새로 추가된 body-parser 게이트를 언급하지 않아 오독 여지를 남기는 문서 동기화 문제다. RBAC·API 계약·데이터 모델·상태 전이·요구사항 ID 충돌은 발견되지 않았다.

## 위험도

LOW

---

STATUS: OK
