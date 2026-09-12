# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 신규 가드 docstring 의 실측 수치("127건")가 직접 재측정과 어긋난다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` — `apiParamUuidFlags` 함수 docstring (게이트 60~64줄)
  - 상세: 주석은 "객체 리터럴이 아닌 형태(변수 전개 등)는 담지 않는다 — 이 저장소에 그런 형태가
    없고(실측 127건이 전부 인라인 리터럴), 정적으로 따라가려면 데이터플로 분석이 된다" 라고
    적는다. 직접 재측정 결과:
    - `grep -roE "@ApiParam\(" codebase/backend/src/modules --include="*.controller.ts"` → **144건**
      (전부 `@ApiParam({` 형태 객체 리터럴, spread/변수 형태 0건 — 이 부분은 주석과 일치)
    - 즉 "모두 인라인 리터럴이라 스캔이 안전하다"는 **정성적 결론은 참**이지만, 근거로 인용한
      "127건" 이라는 **정량적 수치는 실측(144건)과 약 12% 어긋난다.**
    - 참고로 인접 주석의 다른 실측 수치("ParseUUIDPipe 실측 135건이 107:28 로 갈린다")는
      `new ParseUUIDPipe` 28건 / `@Param('id', ParseUUIDPipe)` 108건(±1, 줄바꿈 포맷 차이로 인한
      grep 오차 범위)으로 거의 정확히 재현되어, 유독 "127" 만 어긋난다.
  - 제안: "127" 을 재검증해 정확한 수치로 고치거나(예: 144), 향후 컨트롤러가 추가될 때마다
    이 숫자가 다시 stale 해지므로 정밀한 수치 대신 "전수(N건, 이 저장소 실측 시점)" 처럼 시점을
    명시하는 표현으로 완화하는 것을 고려. 이 저장소 컨벤션상 주석 속 "실측" 수치는 다음 사람의
    판단 근거로 그대로 쓰이므로(다른 실측 수치들은 정확했던 만큼) 이 한 곳만 방치하면 신뢰도가
    비대칭적으로 낮아진다.

- **[INFO]** `rotate-bot-token` 의 새 `400 VALIDATION_ERROR` 케이스가 그 엔드포인트를 다루는
  유저 가이드 Callout 에는 반영되지 않았다
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `triggers.en.mdx` — 이번
    diff 로 수정된 `<Callout type="warn">` 블록 (게이트 463~465줄 / 450~452줄)
  - 상세: 이 PR 은 같은 Callout 을 편집해 `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND` 로 바로잡고
    "API 를 직접 호출할 때 보이는 값" 이라는 설명을 새로 추가했다. 그런데 같은 PR 이 CHANGELOG 에
    명시한 배포 영향("`rotate-bot-token` 의 비-UUID `:id` 가 이제 500 대신 400
    `VALIDATION_ERROR` 를 낸다")은 이 Callout 목록에 없다. 다만 `VALIDATION_ERROR` 는 이 API
    패밀리 전반의 범용 400 fallback 코드라 원래도 이 Callout 이 나열하지 않던 종류이므로(이미
    `content/docs/**` 전역에 16곳 등장하는 범주어), **의도적 스코프 배제일 가능성이 높다** —
    확정적 결함이 아니라 "같은 PR 이 방금 손댄 문서에 방금 만든 신규 실패 모드가 빠져 있다"는
    관찰로만 남긴다.
  - 제안: 의도된 배제라면 그대로 두어도 무방. 사용자가 "왜 400 이 새로 뜨는지" 를 문서에서
    찾다가 놓칠 우려가 있다면 한 줄만 추가하는 것으로 충분.

## 검증된 항목 (문제 없음 — 정확성이 높아 특기)

- CHANGELOG.md 신규 항목: 배경(SQLSTATE 22P02 마스킹 사슬) · 전/후 표 · 배포 영향(유일한
  소비자인 프런트 토스트가 status 를 분기하지 않음을 확인) · 형제 엔드포인트 실측(136건 중
  1건)까지 모두 코드로 직접 대조해 일치함을 확인했다. `Read`/`grep` 대조 결과:
  `common/utils/uuid.ts`·`GlobalExceptionFilter` 의 세 분기 서술, `switchWorkspace` 의 `format`
  단독 보강 서술 모두 실제 코드와 부합. — `CHANGELOG.md`
- `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 정정: 코드베이스 전수 검색 결과
  `MCP_ALLOW_INSECURE_URL` 만 실재(`.env.example:331`, `production-guards.spec.ts`,
  `mcp-tool-provider.ts`), 옛 이름은 0건 — 정정이 정확하다. —
  `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx`,
  `mcp-servers.en.mdx`.
- `TRIGGER_NOT_FOUND` 의 유일한 발신처가 `hooks.service.ts:120`(인입 webhook 경로)라는 주장도
  전수 검색으로 확인 — 트리거 REST API 쪽 404 는 실제로 `RESOURCE_NOT_FOUND` 다. 4개 MDX +
  `backend-labels.ts`/`backend-labels.test.ts` 주석 귀속 정정 모두 이 사실과 일치한다. —
  `codebase/frontend/src/lib/i18n/backend-labels.ts`,
  `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`,
  `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`,
  `telegram.en.mdx`, `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`,
  `triggers.en.mdx`.
- `triggers.en.mdx` 의 "In the UI, a failed bot-token rotation shows a message such as 'Bot
  Token rotation failed'" 신규 서술은 `chat-channel-card.tsx` 의
  `t("triggers.chatChannel.rotateBotTokenFailed")` 및 `en/triggers.ts` 의 문자열과 정확히
  일치한다.
- `triggers.controller.ts` 의 `rotateBotToken` 에 새로 붙은 `@ApiParam({ name: 'id',
  description: '트리거 UUID', format: 'uuid' })` 는 같은 파일의 다른 4개 엔드포인트(`findOne`·
  `update`·`getHistory`·`remove`)와 완전히 동일한 문구·형태를 써서 일관성을 지켰다.
  인라인 주석(287~290줄)도 왜 이 변경이 필요한지(22P02 → 500 마스킹 사슬)를 정확히, `common/
  utils/uuid.ts` 를 상호 참조하며 설명한다.
- 신규 가드 3파일(`param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`,
  `fixtures/param-uuid-pipe/sample.controller.ts`) 은 함수·인터페이스마다 JSDoc 을 갖추고,
  스펙 파일 헤더는 "왜 이 가드가 필요한가"·"두 축을 나눈 근거"·"베이스라인이 왜 0인가"를
  히스토리(리뷰 라운드 인용 포함)와 함께 서술해 문서화 수준이 매우 높다. fixture 파일도 각
  테스트 케이스가 무엇을 가르는지 주석으로 명시한다.
- `spec-draft-nullable-notation-followups.md` 트래커 항목 종결 처리와 신규 plan 파일
  `trigger-uuid-and-guide-error-codes.md` 는 실측 근거·처분·뮤테이션 표까지 갖춰 plan lifecycle
  관례를 충실히 따른다.

## 요약

이 변경 세트는 문서화 관점에서 전반적으로 모범적이다 — CHANGELOG 항목, 컨트롤러 인라인 주석,
신규 가드의 JSDoc, 유저 가이드 MDX 정정, plan 트래커 갱신이 모두 상호 참조되며 대부분의
정량적 "실측" 주장이 직접 대조 검증을 통과했다(환경변수명 정정, `TRIGGER_NOT_FOUND` 귀속
정정, UI 메시지 서술 등). 유일하게 발견된 흠은 신규 가드 파일의 docstring 에 적힌 "127건"이라는
실측 수치가 직접 재측정치(144건)와 어긋나는 것으로, 정성적 결론(전부 인라인 리터럴)에는 영향이
없으나 이 저장소가 "실측 주석은 다음 판단의 근거가 된다"는 관례를 명시적으로 강조하는 만큼
정정을 권한다. 그 외 `rotate-bot-token` 의 신규 400 케이스가 방금 수정한 유저 가이드 Callout에
빠진 점은 의도된 스코프 배제로 보여 INFO 로만 남긴다.

## 위험도

LOW
