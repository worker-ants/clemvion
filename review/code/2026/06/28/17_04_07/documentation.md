# 문서화(Documentation) 리뷰 결과

리뷰 범위: 전체 changeset (review/consistency 산출물 35개 파일 + spec 변경 9개 파일)

---

## 발견사항

### [INFO] `spec/5-system/12-webhook.md` Rationale 섹션 — WH-NF-02 결정 근거 추가 (양호)
- 위치: `spec/5-system/12-webhook.md ## Rationale`
- 상세: 기각된 옵션 A/B, 채택된 옵션 C, `bodyParser: false` 순서 의존성, OOM 상한 클램프(`HOOKS_MAX_BODY_BYTES_CEILING`), 표준 413 직렬화 근거가 모두 `## Rationale` 신규 소절에 기록됐다. plan 완료 후에도 결정 추적이 가능하도록 한 올바른 문서화 패턴이다.
- 제안: 없음.

### [WARNING] `codebase/backend/.env.example` — 신규 환경변수 `HOOKS_MAX_BODY_BYTES`, `HOOKS_MAX_BODY_BYTES_CEILING` 미등재
- 위치: `codebase/backend/.env.example` (consistency 검토에서 I-9로 식별, naming_collision.md 참조)
- 상세: `hooks-body-parser.ts`에 신설된 두 환경변수가 `.env.example`에 없다. 운영자가 1MB 한도나 상한 클램프를 조정하려 할 때 env var 존재를 발견하지 못한다. 설정 문서화 관점에서 명백한 누락이다. 기존 `PUBLIC_WEBHOOK_MAX_BODY_BYTES` 등은 주석과 예시 값이 함께 등재되어 있어 패턴이 확립되어 있음에도 이번 신규 var는 빠져 있다.
- 제안: `.env.example`의 "Public Webhook Abuse Defense" 블록 하단 또는 별도 "Webhook Body Limits" 블록에 아래 두 항목 추가:
  - `HOOKS_MAX_BODY_BYTES=1048576` (기본 1MB, 주석으로 조정 범위 설명)
  - `HOOKS_MAX_BODY_BYTES_CEILING=16777216` (기본 16MiB OOM 방지 상한 클램프 설명 주석)

### [WARNING] 사용자 노출 문서 stale — 인증 webhook 1MB 한도 "Planned" 표기 잔존
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/02-nodes/triggers.mdx` L97, L151
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` L86, L140
- 상세: WH-NF-02 구현이 완료되어 spec에 `implemented`로 전환됐으나, 사용자 노출 문서(`.mdx`)는 여전히 "아직 미적용 — 예정(Planned)"으로 표기하고 있다. 외부 개발자가 이미 구현된 기능을 미구현으로 인지할 위험이 있다. 내부 spec 문서와 사용자 문서 간 불일치로 문서화 신뢰도를 떨어뜨린다.
- 제안: 두 `.mdx` 파일의 해당 행을 구현 완료 상태(`PAYLOAD_TOO_LARGE`, 1MB 한도)로 갱신. KO/EN 양쪽 동시 수정 필요.

### [INFO] `spec/2-navigation/4-integration.md` Rationale — `supportsTokenAutoRefresh=true` provider 목록 stale
- 위치: `spec/2-navigation/4-integration.md` Rationale l.1194
- 상세: Rationale 본문이 "현재 `cafe24`/`google` 만 true"라고 기술하나 spec §9.1 본문과 data-model §2.10은 `cafe24`, `google`, `makeshop` 세 provider를 true로 명시한다. MakeShop 도입 후 Rationale가 갱신되지 않아 구현자가 Rationale을 참조할 때 makeshop을 제외할 위험이 있다. §9.1 본문과 코드는 정확하지만 Rationale의 주석 정확성이 떨어진다.
- 제안: Rationale l.1194 "현재 `cafe24`/`google` 만 true" → "현재 `cafe24`/`google`/`makeshop` 이 true"로 1행 정정.

### [INFO] `spec/5-system/3-error-handling.md §1.3` — 섹션 제목과 `PAYLOAD_TOO_LARGE` 의미론적 위치 불일치
- 위치: `spec/5-system/3-error-handling.md §1.3`
- 상세: `PAYLOAD_TOO_LARGE`(413)는 인프라/파서 레이어 코드임에도 "유효성 검증 에러" 섹션에 배치됐다. 코드 자체의 명명과 설명은 훌륭하지만 섹션 분류가 독자에게 혼선을 줄 수 있다. API 문서 가독성 관점에서 섹션 제목 확장 또는 별도 소절 분리가 권장된다.
- 제안: 섹션 제목을 "유효성 검증·입력 에러 (400·413)"으로 확장하거나 `### 1.3a 본문 크기 에러` 소절 신설. 차단 아님.

### [INFO] `spec/7-channel-web-chat/2-sdk.md §1` — `resetSession` 주석 정확성 확인
- 위치: `spec/7-channel-web-chat/2-sdk.md §1`, §3
- 상세: 이번 변경으로 §1 메서드 목록 설명에 "`resetSession` 은 `wc:command` 전용이라 `ChatInstance`(§5)에 노출하지 않는다"는 주석이 추가됐다. 주석 정확성은 코드(`types.ts`, `loader.ts`)와 일치한다. spec §5 `ChatInstance` 타입 블록에 `resetSession(): void`가 명시되지 않은 상태가 유지되는 것이 의도임이 명확히 문서화됐다.
- 제안: 현행 유지. 문서화 방향이 올바르다.

### [INFO] review/ 산출물 — `_retry_state.json` 내 절대 경로 워크트리 참조
- 위치: `review/consistency/2026/06/28/15_02_09/_retry_state.json`, `16_05_14/_retry_state.json`, `16_48_46/_retry_state.json`
- 상세: `_retry_state.json` 파일들이 `/Volumes/project/private/clemvion/.claude/worktrees/<worktree>/` 절대 경로를 포함한다. 이는 머신·워크트리 이동 후 재사용 불가능한 경로다. 그러나 이 파일들은 orchestrator의 내부 상태 파일이며 사람이 직접 소비하는 문서가 아니므로 치명적이지 않다.
- 제안: 운영 문제는 아니나, 향후 `_retry_state.json` 스키마에 상대 경로 또는 `session_root` 상대 표기를 검토할 수 있다. 현재는 INFO 수준.

### [INFO] `spec/5-system/12-webhook.md` frontmatter `code:` — `hooks-body-parser.ts` 등재 여부
- 위치: `spec/5-system/12-webhook.md` frontmatter `code:` 배열
- 상세: WH-NF-02 구현 핵심 파일인 `codebase/backend/src/bootstrap/hooks-body-parser.ts`가 spec frontmatter `code:` 목록에 등재됐는지 확인 필요(consistency 검토에서 I-3으로 식별). spec-impl-evidence 추적·spec-coverage audit에서 이 파일이 webhook spec과 연결되지 않으면 갭으로 오탐될 수 있다.
- 제안: `hooks-body-parser.ts`를 `spec/5-system/12-webhook.md` frontmatter `code:` 에 추가 확인.

---

## 요약

이번 changeset은 webhook body-parser 게이트(WH-NF-02), channel-web-chat spec polish, consistency 검토 산출물 35개 파일로 구성된다. spec 변경 부분은 Rationale 추가, 주석 정확성 교정, 링크 수정이 전반적으로 잘 이루어졌다. 특히 `spec/5-system/12-webhook.md`의 WH-NF-02 Rationale 신규 추가와 `spec/7-channel-web-chat/2-sdk.md`의 `resetSession` 범위 명시는 모범적인 인라인 주석 패턴이다. 문서화 관점에서 실질적인 개선 필요 사항은 두 가지다: (1) 신규 환경변수 `HOOKS_MAX_BODY_BYTES`/`HOOKS_MAX_BODY_BYTES_CEILING`이 `.env.example`에 미등재(설정 문서화 누락 WARNING), (2) 구현 완료된 1MB 한도가 사용자 노출 `.mdx` 문서에 "Planned"로 표기된 채 잔존(사용자 문서 stale WARNING). 나머지 발견은 모두 INFO 수준의 개선 권고다.

---

## 위험도

LOW
