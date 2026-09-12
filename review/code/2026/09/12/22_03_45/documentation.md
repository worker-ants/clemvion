# 문서화(Documentation) 리뷰

## 검증 방법

이 PR 은 이미 5라운드의 `/ai-review` 를 거쳐 여러 문서화 지적(수치 오기·근거 출처 정정·주석 귀속
정정)을 반영해 왔다. 6라운드째 발견을 새로 내기 위해, 산문으로 남은 정량적 주장들을 **재현**해
직접 검증했다.

- `param-uuid-pipe-guard.ts`/`param-uuid-pipe.spec.ts` 의 docstring 이 주장하는 수치를
  `ts-node` 로 동일 AST 순회를 재현해 대조:
  - `scanned`(id-형 `@Param` 총수) = **136** — 주장과 일치
  - `violations` = **0** — 주장과 일치
  - 파이프 보유 108(bare identifier) : 28(instantiated) — 주장("136건이 108:28 로 갈린다")과
    일치
  - `modules/` 전체 `@ApiParam` = **144** — 주장과 일치
  - 비-id 이름 breakdown `{provider:3, endpointPath:2, type:1, installToken:2, token:1}` = 9건 —
    주장과 일치
- `triggers.controller.ts` 의 "형제 6곳과 같은 형태" 주장: `grep` 으로 같은 파일의
  `@Param('id', ParseUUIDPipe)` 6건(+rotateBotToken 1건=7) 확인 — 일치.
- `auth.controller.ts switchWorkspace` 가 이미 `ParseUUIDPipe` 를 갖고 `format:'uuid'` 만
  없었다는 주장 — 실제 코드 확인, 일치.
- `sample.controller.ts` 의 "형제 가드 `dto-class-name-collision` 이 자기 fixture 를 잡고 죽은
  뒤 적어 둔 규칙" 주장 — 해당 가드의 스캔 루트(`modules`, `common`)와 자기 반증 코멘트를 직접
  확인, 일치.
- `simulateExecutionRunRedeliveryForTest` 가 `@ApiExcludeEndpoint()` 라 문서 축 면제라는
  주장 — 실제 코드 확인, 일치.
- `.env.example` 의 `MCP_ALLOW_INSECURE_URL`(신) vs `MCP_INSECURE_URL_ALLOWED`(구, mdx 의 오기)
  — 실제 환경변수명·backend 참조 전수 확인, mdx 수정이 옳다.
- `review-citations.md` §2/§3 준수 여부 — 이 diff 가 `codebase/**` 에 새로 추가한 리뷰 인용
  전부(`triggers.controller.spec.ts`, `sample.controller.ts`, `param-uuid-pipe-guard.ts`,
  `param-uuid-pipe.spec.ts`) 가 `review/code/2026/09/12/<hh_mm_ss>` 전체 경로 형태이고, 인용된
  세션 디렉터리(`20_01_18`·`20_26_58`·`20_53_01`·`21_20_01`·`21_41_49`) 가 실제로 존재함을
  확인 — bare 시각 위반 없음.
- `backend-labels.ts`/`backend-labels.test.ts` 의 주석 귀속 정정이 diff 밖의 인접 블록
  (`CHAT_CHANNEL_CODES` 위 주석, 484행)과 서로 모순 없이 정합함을 직접 파일을 열어 확인.

## 발견사항

- **[INFO]** `--impl-prep` 지적 인용에 세션 경로가 빠져 있다 — 같은 파일의 다른 인용과 형태가
  다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (`describe('경로
    UUID 파라미터 계약 가드', ...)` 위 JSDoc, "처음엔 파이프 축만 세려 했는데 `--impl-prep`
    convention_compliance WARNING 이 …" 문단)
  - 상세: 같은 docstring 안의 다른 인용들(`review/code/2026/09/12/20_01_18`,
    `review/code/2026/09/12/20_53_01`)은 전체 경로를 쓰는데, 이 `--impl-prep` 지적만 세션 경로
    없이 게이트 이름만 적혀 있다. 실제로는 `review/consistency/2026/09/12/19_34_19` 세션이고,
    plan 문서(`plan/in-progress/trigger-uuid-and-guide-error-codes.md`)에는 이 경로가 정확히
    적혀 있다 — 즉 정보 자체는 존재하지만 이 파일 안에서는 자기 완결적이지 않다.
    `review-citations.md` §2 가 금지하는 "bare `hh_mm_ss`" 위반은 아니다(시각 자체가 없다), 다만
    같은 문서 안에서 인용 형태가 갈리는 점은 다음에 이 docstring 만 읽는 사람에게는 "어디서
    지적됐는지" 를 재구성할 단서가 안 된다.
  - 제안: `` `--impl-prep` convention_compliance WARNING `` 뒤에
    `` (`review/consistency/2026/09/12/19_34_19`) `` 를 덧붙인다. 사소하고 비차단.

## 요약

이번 diff 는 이미 5라운드의 문서화 지적(수치 오기 2건·근거 출처 오귀속 1건·주석 귀속 오류
1건)을 실측으로 정정해 온 상태이며, 이번 라운드에서 재검증한 모든 정량적 주장(스캔 총수 136,
위반 0, 파이프 형태 108:28, `@ApiParam` 총수 144, 비-id 9건 breakdown, 형제 엔드포인트 6곳,
`ApiExcludeEndpoint` 면제 대상 등)이 코드 재실행/직접 열람으로 **전부 일치**했다. CHANGELOG 항목은
행위 변경(500→400)의 원인·영향·배포 시 확인 사항을 구체적으로 담고 있고, 컨트롤러·가드·테스트의
JSDoc/인라인 주석은 "왜 이 형태인가" 를 근거와 함께 남겨 두었다. 4개 유저 가이드 MDX 의 오류
코드 정정과 ko/en 페어의 병렬 수정도 정합적이다. `review-citations.md` 규약(전체 경로 인용)도
새로 추가된 모든 코드 주석에서 지켜졌다. 유일하게 남는 것은 인용 형태가 같은 파일 안에서 한
곳만 세션 경로를 생략한 사소한 비일관성(INFO)뿐이며, Critical/Warning 급 문서화 결함은
발견되지 않았다. spec 변경이 필요한 두 항목(`15-chat-channel.md §5.4` 표, `swagger.md §5-4`
체크리스트)은 developer 권한 밖이라는 것을 스스로 인지하고 planner 항목으로 올바르게 등재했을
뿐 이번 diff 에서 건드리지 않았다 — 이는 결함이 아니라 권한 경계를 지킨 것이다.

## 위험도

LOW
