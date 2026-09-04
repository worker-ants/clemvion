# 문서화(Documentation) 리뷰 — Swagger DTO 계약 정합화 배치 (2R, 누적 diff)

## 검토 범위 메모

이 diff 는 `origin/main` 대비 누적분이라 직전 code-review 라운드(`review/code/2026/09/04/11_02_30/`)가
이미 지적한 항목의 **조치 결과**까지 함께 실려 있다. 그 라운드의 documentation WARNING(#5,
CHANGELOG 누락)과 consistency 라운드(`review/consistency/2026/09/04/11_33_21/`)의 W1(stale plan
경로 주석)·W2(§5.4 스코프 오인용) 이 실제로 이번 diff 에서 어떻게 반영됐는지를 소스를 직접
`Read` 해 대조하는 방식으로 검증했다(저장소 파일은 조회만 했고 아무것도 쓰지 않았다 —
`git status --short` 로 확인, 아래 "관측된 이상 상태" 참고).

## 발견사항

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 설명이 여전히 명시적 `null` 케이스를
  언급하지 않는다 — 직전 라운드 documentation.md INFO#2 에서 이미 지적됐고 이번 라운드에도
  그대로다 (WARNING 이 아니므로 자동 수정 대상은 아니었음, 재확인 차 기록)
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:13`
    (`description: '사용할 LLM Config UUID. 생략 시 워크스페이스 기본값 사용'`) — 이 줄은 이번
    diff 의 변경 대상이 아니라(`Read` 로 직접 확인한 실제 파일 줄 번호), 바로 아래 게이트 19
    (`llmConfigId?: string | null;`)만 타입이 넓어졌다.
  - 상세: 타입은 `string` → `string | null` 로 넓어졌는데 설명 문구는 "생략 시" 만 언급한다.
    자매 DTO `update-assistant-session.dto.ts:19` 는 정확히 같은 필드를 `'LLM Config UUID. null
    전달 시 workspace default로 폴백.'` 로 **명시적으로 null 케이스까지** 적어 대조된다(직접
    `Read` 로 두 파일 비교 확인). 서비스 코드(`workflow-assistant-session.service.ts` `dto.llmConfigId
    ?? null`)가 이미 두 표현을 동등하게 처리하므로 설명이 틀린 것은 아니지만, 자매 DTO 가 이미
    확립한 더 명확한 문구 패턴을 이번 수정이 따라가지 않았다.
  - 제안: 급하지 않음. 여유가 있으면 "(생략 또는 null 전달 시 워크스페이스 기본값 사용)" 으로
    통일 — `update-assistant-session.dto.ts` 문구를 참고.

- **[INFO]** `nullable-type-lie-cast.spec.ts` 의 리팩터 후 인라인 주석이 여전히 "모듈 스코프" 라는
  이전 문구를 유지한다 — 직전 라운드 documentation.md INFO#1 과 동일 지점, 이번 diff 가 바로 그
  파일(`withFiles` import 전환)을 편집했음에도 미수정
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:123`
    (`// 구현은 모듈 스코프의 \`withFiles\` — 단일 파일 호출은 그 얇은 래퍼다.`) — `grep`/`Read`
    로 확인, 이번 diff 의 변경 hunk 범위 밖(파일 상단 게이트 22-49 만 diff 에 포함)이라 이번에도
    손대지 않은 채 남았다.
  - 상세: 바로 위 JSDoc(게이트 44-49, 이번 diff 로 갱신됨)은 `withFiles` 가 이제
    `common/__test-utils__/temp-fixture.ts` 의 **import** 라고 정확히 설명하는데, 123번째 줄의
    주석은 "모듈 스코프" 라는 표현을 그대로 둬 이 파일 로컬 함수라는 인상을 준다. 틀린 문장은
    아니지만(import 바인딩도 모듈 스코프 식별자) 바로 위 JSDoc 과 어휘가 어긋난다.
  - 제안: 사소함. "// 구현은 공유 헬퍼의 `withFiles`(import) — 단일 파일 호출은 그 얇은 래퍼다."
    로 한 단어만 바꾸면 위 JSDoc 과 일치한다.

- **[INFO]** 신규 enforcement 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`)가 spec 쪽에서
  포인터 없이 단방향으로만 SoT 를 인용한다 — consistency 라운드(`rationale_continuity`)가 이미
  같은 지점을 지적했고 developer 권한 밖(spec 쓰기)이라 이번 diff 의 책임은 아님, 참고로 재기록
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:98`
    (`SoT: \`spec/5-system/2-api-convention.md\` §5.4.`) / `spec/5-system/2-api-convention.md`
    (§5.4 본문·Rationale 어디에도 이 가드에 대한 역참조 없음 — `grep -n "swagger-dto-contract"
    spec/5-system/2-api-convention.md` 결과 0건, 직접 확인)
  - 상세: 코드 쪽 docstring 은 spec 을 정확히 인용하지만 spec 쪽에는 "이 규칙은
    `swagger-dto-contract.spec.ts` 가 코드로 강제한다" 는 역참조가 없다. 같은 문서군의
    `1-auth.md` `## Rationale` 은 "부트 캐너리가 이 규약을 강제한다" 를 명시하는 선례가 있어
    비대칭이다. 다만 이는 `spec/` 쓰기가 필요한 정정이라 CLAUDE.md 상 developer 턴 권한 밖이고,
    "자기-반증형 소정정" 다섯 조건(대상 문장을 developer 자신이 쓰지 않았음)도 충족하지 않는다
    — planner 턴이 정공법이다.
  - 제안: 코드 수정 불필요. `spec/5-system/2-api-convention.md` §5.4 또는 그 Rationale 에 "강제:
    `swagger-dto-contract.spec.ts`(AST 기반, `backend-checks.yml`)" 한 줄 추가를 planner 턴
    백로그로 유지 — 이미 `rationale_continuity.md` 가 같은 제안을 남겨 뒀으므로 중복 등재는
    불필요, 확인만 되면 된다.

## 긍정 관찰 (직전 라운드 WARNING 조치 검증 — 발견사항 아님)

- **CHANGELOG WARNING(직전 라운드 #5) 정확히 조치됨** — `CHANGELOG.md` 새 항목(게이트 3-51)이
  자매 두 항목(`invitedBy`·`ipWhitelist`)과 동일한 "종전/지금" 표 포맷을 따르고, 8필드(요구 방향
  반전)와 `llmConfigId`(반대 방향, OpenAPI 출력 불변)를 명확히 구분해 기재했다. "영향" 절도 두
  항목이 서로 반대 방향(좁히기 vs 무영향)임을 정확히 설명한다.
- **consistency W1(stale plan 경로 주석) 정확히 조치됨** — `source-scan.ts:190-193`,
  `nullable-type-lie-cast.spec.ts:22-25` 양쪽 모두 `plan/complete/entity-nullable-column-type-mismatch.md`
  (완료 이력)와 `plan/in-progress/spec-draft-nullable-notation-followups.md`(다음 배치, "§5.4
  drift 배치")로 정확히 갱신됐다 — `Read` 로 두 파일 모두 직접 대조해 문면이 실제 plan 상태와
  일치함을 확인했다.
- **consistency W2(§5.4 스코프 오인용) 정확히 조치됨** — `CHANGELOG.md` 의 `llmConfigId` 항목이
  "형태는 §5.4 를 따랐다" 는 과다 주장을 빼고, 대신 §5.4 가 `## 5. 응답 형식` 하위 절이라
  응답 바디 전제이며 이 필드는 **요청** DTO 라는 것, 그리고 고친 것은 "OpenAPI 선언과 TS 타입의
  내부 일치" 뿐이라는 것을 명시적으로 구분해 적었다(게이트 44-50). 같은 파일의 다른 두 항목
  (응답 DTO)에는 "§5.4 를 따랐다" 문구를 그대로 유지해 — 케이스별로 정확하게 갈라 썼다.
  이는 진짜 스코프 판단이 반영된 결과이지 기계적 문구 삭제가 아니다.
  `swagger-dto-contract.spec.ts` 헤더(게이트 11-14)도 같은 사실을 정확히 서술한다.
  - 참고로 이 스코프 경계는 consistency 라운드(`cross_spec`)가 spec 본문에 명문화할 것을 별도
    제안했고(`spec/in-progress/.../§5.4 에 "응답 바디 한정" 스코프 문구`, planner 항목으로 등재
    완료) — 코드/CHANGELOG 쪽 처리는 이 라운드에서 이미 끝난 것으로 확인된다.
- **신규 가드 2개·공유 픽스처의 문서 품질이 높다** — `swagger-dto-contract-guard.ts` 는 "왜
  정규식이 아니라 AST 인가" 를 세 가지 구체적 실패 형태(리터럴 안의 `;`, 화살표 함수 `)`,
  데코레이터 이름 오인)로 문서화하고, `swagger-dto-contract.spec.ts` 대조군 테스트가 각 형태를
  1:1 로 캐너리화한다(게이트 137-170). `temp-fixture.ts` 는 async 콜백이 조용한 레이스를 낼 수
  있다는 사실(직전 라운드 side_effect WARNING)을 JSDoc 에 상세히 남기고(게이트 29-42),
  `temp-fixture.spec.ts` 신설로 정상/예외/async-오용 경로를 전부 테스트했다 — 코드와 문서가
  같은 결함 서사를 공유한다.
- **W1(effectiveRequired 비공개 구현 결합) 캐너리가 문서와 함께 추가됨** — `swagger-dto-contract.spec.ts:242-276`
  이 "왜 이 캐너리가 필요한가" 를 JSDoc 으로 설명하고 실제 `@nestjs/swagger` 데코레이터를 호출해
  `Reflect` 메타데이터를 검증한다. 직전 라운드 architecture WARNING(canary 부재)에 대한 정확한
  해법이다.
- **CHANGELOG·plan 문서의 자기수정 이력이 투명하다** — `spec-draft-nullable-notation-followups.md`
  가 "이 표를 두 번 틀렸다"(70→102→103) 며 자기 오류를 숨기지 않고, 같은 PR 안에서 자신의
  실측(103/17/8/1)이 곧바로 낡는다는 사실(104/25/0/1)까지 명시했다(게이트 176-183) — 정량
  기록이 "잰 시점" 값이라는 것을 스스로 경고해 다음 사람이 오독하지 않도록 방어했다.

## 관측된 이상 상태 (내 뮤테이션 아님)

`git status --short` 확인 결과 `review/consistency/2026/09/04/11_33_21/SUMMARY.md` 가 워킹트리에서
수정된 상태(`M`)로 보였다. 본 리뷰는 전 과정에서 `Read`/`Bash`(읽기 전용 `grep`/`find`)만
사용했고 어떤 파일도 `Write`/편집하지 않았다 — 이 변경은 내가 만든 것이 아니다. 병렬로 도는 다른
프로세스(오케스트레이터 자신의 산출물 갱신 또는 동시 실행 중인 다른 reviewer)의 흔적일 가능성이
높다. 확인·원복은 내 권한/스코프 밖이라 사실만 보고한다.

## 요약

이번 diff 는 documentation 관점에서 CRITICAL/WARNING 급 결함이 없다. 특히 직전 code-review
라운드가 지적한 유일한 documentation WARNING(CHANGELOG 누락)과 consistency 라운드가 지적한 두
건(W1 stale plan 경로, W2 §5.4 스코프 오인용)이 전부 이번 diff 에 정확하고 세심하게 반영된 것을
소스 직접 대조로 확인했다 — 특히 W2 는 "문구를 지우기만" 한 것이 아니라 응답/요청 DTO 를
케이스별로 갈라 정확히 다르게 처리해 진짜 이해에 기반한 수정임을 확인했다. 신규 가드·공유
테스트 헬퍼의 JSDoc 품질은 이 저장소의 상위 수준에 속한다 — 근거·실측 수치·실패 사례가 코드와
테스트 양쪽에 일관되게 남아 있다. 남은 것은 전부 INFO 3건으로, 둘은 직전 라운드에서 이미 INFO로
분류되어 자동 수정 대상이 아니었던 항목의 재확인(문구 개선 여지, 급하지 않음)이고 나머지 하나는
spec 쪽 역참조 부재로 developer 권한 밖(planner 턴 필요, 이미 별도 트래킹됨)이다. 새로 생긴
문서화 결함은 없다.

## 위험도

NONE
