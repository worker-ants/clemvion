# 문서화(Documentation) 코드 리뷰

## 검토 범위와 방법

프롬프트 번들 82개 파일 중 실질 변경 대상(코드 6개·프런트 테스트/클라이언트 4개·유저가이드
mdx 8개·신규 가드 3개·plan 2개) 전수를 확인했고, 나머지는 이전 두 라운드
(`review/code/.../10_12_19`, `10_40_34`, `review/consistency/.../01_15_40`, `10_12_54`,
`10_41_13`)가 이번 diff 에 산출물째로 커밋된 것이라 문서화 관점에서 새로 리뷰할 대상이 아니다
(이미 그 라운드들의 documentation reviewer 가 검토를 마쳤다).

프롬프트가 절단한 파일은 `git diff origin/main -- <path>` 로 원본을 전량 대조했다:
`llm-model-config.controller.spec.ts`(신규 138줄), `guide-error-code-existence.test.ts`(신규
189줄), `guide-error-code-scan.ts`(신규 165줄), `plan/in-progress/guide-error-code-truth.md`
(신규 289줄), `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 등재 3건.

정량적 주장은 직접 재실측했다:

- `sanitizeLlmErrorMessage` 의 반환 문자열 8개를 `Read`로 세어 `models{,.en}.mdx` 8행 표와
  글자까지 대조 — 일치.
- `nodeLabel` 이 execution-engine 전역에서 실제로 emit 됨을 grep 으로 확인(`nodeName` 잔존
  없음) — `run-results{,.en}.mdx` 정정이 정확.
- `LlmModelConfigController.testConnection` 심볼 실재 확인 — `models{,.en}.mdx` 의
  `<ImplAnchor symbol="testConnection">` 이 정확한 앵커.
- `.error` 소비처 재검색 — `result-detail.tsx`/`generic-renderer.tsx` 의 `result.error` 는
  execution 결과 객체(다른 shape)이고 `ModelTestConnectionResultDto` 소비처가 아님. CHANGELOG 의
  "저장소 안 소비처는 없었다" 주장과 일치.
- `spec/conventions/swagger.md:336-346` (JSDoc=공개 API 서술, `//`=내부 서사 규약)을 직접 열어
  `integration-response.dto.ts` 의 `code` 필드 주석 구조(내부 서사 `//` 4블록 + 공개 JSDoc 1블록)가
  규약을 정확히 따름을 확인.
- planner 백로그 이관 3건(§1 카탈로그 누락·`testConnection` shape 미문서·`user-guide-evidence.md
  §2.1` 관계표)이 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  미체크(`[ ]`) 항목으로 존재함을 grep 으로 확인 — "등재했다"는 서술이 실측과 일치.

저장소 파일은 뮤테이션하지 않았다(읽기 전용 `Read`/`Bash grep`/`git diff`만 사용). 종료 시
`git status --short` 확인 결과 이 리뷰 세션 자신의 산출물 디렉터리 외 변경 없음.

## 발견사항

- **[INFO]** MakeShop 통합 가이드의 에러 코드 목록이 실재 코드 11종 중 7종만 나열한다 —
  결함은 아니나 완결성 여지가 있다
  - 위치: `codebase/frontend/src/content/docs/02-nodes/integrations.mdx:301`,
    `integrations.en.mdx:290`
  - 상세: `plan/in-progress/guide-error-code-truth.md` §C 가 스스로 실측한 실재 목록은
    `MAKESHOP_404`·`422`·`4XX`·`5XX`·`AUTH_FAILED`·`RATE_LIMITED`·`TRANSPORT_FAILED`·
    `MISSING_FIELDS`·`UNKNOWN_OPERATION`·`INVALID_SHOP_UID`·`UNRESOLVED_PATH_PARAM` 11종인데,
    가이드 산문에는 앞의 7종만 실렸다. 나머지 4종(`MISSING_FIELDS`·`UNKNOWN_OPERATION`·
    `INVALID_SHOP_UID`·`UNRESOLVED_PATH_PARAM`)은 "호출이 실패한 방식"(HTTP 상태·인증·요청
    한도·네트워크)이 아니라 요청 구성 단계의 검증 실패라 문장의 주어("코드는 실패한 방식에 따라
    갈려요")와 성격이 다르므로 의도적 curation 일 가능성이 높고, 신규 가드
    (`guide-error-code-existence`)는 "적은 이름의 실재"만 보증하지 "실재하는 이름의 완전 열거"는
    보증하지 않는다 — 이 갭은 그 가드의 설계상 사각지대(§D 의 채택 이유: 산문 문맥 기반, 허용목록
    없음, 완전성 아님)와 일치해 이번 PR 의 결함이라기보다 가드 범위의 자연스러운 경계다.
  - 제안: 차단 사유 아님. 사용자가 검증 단계 오류(예: 필수 필드 누락)를 만났을 때 표에서
    코드를 못 찾을 수 있으므로, 후속 편집 시 "그 외 요청 구성 오류(`MISSING_FIELDS` 등)는 메시지
    본문을 참고" 한 줄을 추가하는 정도로 충분.

## 긍정적으로 확인한 사항 (참고)

- **CHANGELOG** — 필드 리네임(`error`→`message`)·제거(`latencyMs`)·추가(`code`)를 방향별로 갈라
  표로 정리했고, "왜 안 잡혔나"(정본 검사기 미배선) 절까지 포함해 배포 담당자가 판단할 정보가
  전부 실려 있다. 실측(반환 리터럴 8개, `.error` 소비처 0건)과 대조해 어긋남이 없다.
- **JSDoc/독스트링** — `llm.service.ts::testConnection`, `guide-error-code-scan.ts` 모듈 헤더,
  `guide-error-code-existence.test.ts`/`guide-sanitized-message-parity.test.ts`/
  `llm-model-config.controller.spec.ts`의 describe 블록 헤더 주석 모두 "무엇을 보나 + 왜
  필요한가 + 시도했다 폐기한 대안(실측 수치 포함)"을 갖추고 있어 이 저장소 문서화 관례 중
  상위권이다. `swagger.md` 의 JSDoc/`//` 분리 규약도 `code` 필드에서 정확히 지켜졌다.
  (이전 라운드가 지적한 위반 — 근거 산문이 JSDoc 안에 있던 것 — 은 이번 diff 에서 이미 `//`
  블록으로 분리돼 있다.)
- **주석 정확성(오래된 주석 없음)** — `run-results{,.en}.mdx`의 `nodeName`→`nodeLabel`,
  `integrations{,.en}.mdx`의 `MAKESHOP_API_ERROR`→`MAKESHOP_404`, `error-handling{,.en}.mdx`·
  `run-results{,.en}.mdx`의 은퇴 코드 `NODE_EXECUTION_FAILED` 제거 모두 실측 대조 결과 현재
  backend 동작과 일치한다.
- **회귀 방지 인프라** — `guide-error-code-existence`(코드 토큰 실재)와
  `guide-sanitized-message-parity`(문장 일치, 양방향)를 표면별로 분리 신설해 "SoT 가 바뀌면 미러
  문서가 조용히 낡는다"는 클래스를 build-time 에 두 축으로 고정했다. 두 신규 가드 모두 vacuity
  floor 단언(코퍼스 크기·축별 최소 건수)을 갖춰 "수집기가 조용히 0건을 돌려주는" 실패 모드를
  구조적으로 방어한다.
- **spec 경계 준수** — spec 갱신이 필요한 항목 3건(에러 코드 카탈로그 공백·`testConnection`
  실패 shape 미문서·`user-guide-evidence.md §2.1` 관계표)을 developer 가 직접 고치지 않고
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 미체크 항목으로 정확히
  이관했다 — CLAUDE.md 의 `developer`는 `spec/` read-only 원칙을 지켰다.
- **예제 코드** — `models{,.en}.mdx`의 8행 실패 메시지 표, `run-results{,.en}.mdx`의 노드
  종류별 코드표 모두 "사용자가 실제로 보는 것"을 그대로 옮겨 예제로서 실용적이다.

## 요약

이 PR 자체가 "유저 가이드 문서의 진위"를 주제로 하는 만큼 문서화 품질에 대한 자기 검증이
이례적으로 철저하다 — CHANGELOG·JSDoc·plan 세 층 모두 정량 주장을 실측 수치와 함께 남겼고,
독립적으로 재검증한 결과(8갈래 문장 대조, `nodeLabel` emit 확인, `.error` 소비처 재검색, swagger
JSDoc 분리 규약 준수, planner 백로그 실재 확인) 전부 일치했다. 이미 두 차례의 리뷰 라운드가 발견한
문서 결함(엔진 표 `LLM_RATE_LIMIT` 중복, `nodeName` 잔존, 주석-JSDoc 혼재, 파라미터 오명명)은
모두 현재 diff 에서 해소돼 있음을 직접 재확인했다. 유일한 발견은 MakeShop 코드 목록이 실재
11종 중 7종만 나열하는 완결성 여지(INFO)뿐이며, 이는 가드 설계상 자연스러운 경계이지 이번 PR 의
결함이 아니다. Critical/Warning 급 문서 결함은 없다.

## 위험도

NONE
