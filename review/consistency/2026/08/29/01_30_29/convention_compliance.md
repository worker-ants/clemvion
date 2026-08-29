# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 요약

이번 diff(`origin/main...HEAD`)는 `#1219` eslint 10 상향(`preserve-caught-error` 룰)에 대응해 5개 코드
파일(`expression-resolver.service.ts`/`.spec.ts`, `secret-resolver.service.ts`,
`code.handler.ts`/`.spec.ts`)에 **주석·`cause` 부착 여부**만 변경했다. **spec 파일은 이 diff 에서
전혀 수정되지 않았다** — `git diff origin/main...HEAD -- 'spec/**'` 결과 0줄이며, diff 가 참조하는
`spec/5-system/3-error-handling.md §6.3.1`("`Error.cause` 부착 기준")은 이미 `origin/main` 에
존재하는 기존 규약이다(별도 선행 커밋에서 신설). 따라서 본 검토는 "diff 가 기존 정식 규약을
준수하는가" 를 판정한다.

## 대조한 규약

- `spec/5-system/3-error-handling.md §6.3.1` — `Error.cause` 부착 C1(message 가 원본을 이미 포함)
  AND C2(message·name 밖 민감 속성 없음) 기준
- `spec/conventions/secret-store.md` SS-SE-05 — 복호화 실패 시 ref+workspaceId 만 로그, plaintext 미기록
- `spec/conventions/node-output.md` Principle 3.1 — pre-flight 에러는 throw, runtime 에러는
  `port:'error'` + `output.error`
- `spec/conventions/error-codes.md` §4.1 — Code 노드 내부 분류 코드 파이프라인(참고용, 이 diff 의
  직접 대상은 아님 — 아래 발견사항 참고)

## 발견사항

이번 diff 범위 안에서 **CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.** 아래는 확인 결과와
INFO 수준 관찰이다.

- **[INFO] `cause` 부착/비부착 처분이 §6.3.1 기준과 실제로 정합함 — 확인 완료**
  - target 위치: `expression-resolver.service.ts:313-319`, `code.handler.ts:451-457`,
    `secret-resolver.service.ts:81-90`
  - 대조 규약: `spec/5-system/3-error-handling.md §6.3.1`
  - 상세: `expression-resolver`/`code.handler` 는 C1(message 가 이미 원본 `err.message` 를 포함)·
    C2(각각 `ExpressionError` 의 `code`/`position`, `SyntaxError` 의 `message`/`stack` 만 own
    property — 민감 속성 없음)를 모두 만족해 `cause: err` 를 부착했고, `secret-resolver.service.ts`
    는 C1 이 거짓(`'Secret decryption failed'` 는 원본을 의도적으로 감춤)이라 부착하지 않고
    `eslint-disable-next-line preserve-caught-error -- <사유>` 로 억제했다. 비부착 사례는
    `secret-store.md` SS-SE-05(원본 상세는 `logger.error` 로만, ref+workspaceId 한정)를 정확히
    인용한다. 규약 위반 없음.
  - 제안: 없음 (준수 확인).

- **[INFO] "요약을 정본 옆에 두지 않고 SoT 를 가리키게" 하는 서술 방식 — 프로젝트 관행과 정합**
  - target 위치: 4개 콜사이트 주석 전부 (`spec/5-system/3-error-handling.md §6.3.1 (C1 AND C2)` 를
    가리키고 그 자리가 어떻게 만족하는지만 적음)
  - 상세: 이 diff 이전 주석은 기준 자체를 각 콜사이트에 산문으로 반복해 적고 있었고, 그중 하나가
    실제로 stale 화(§6.3.1 이 C2 를 나중에 추가했을 때 갱신 누락 위험)됐던 사례가 Rationale 에
    기록돼 있다. 이번 변경은 기준을 스펙 정본 한 곳에만 두고 콜사이트는 "만족 방식"만 적어 사본
    drift 위험을 없앴다 — `spec/conventions/error-codes.md` Rationale 의 "왜 SoT 를 분리하는가"
    원칙, `node-output.md` 의 "정본화" 패턴과 같은 방향이다. 규약 위반 아님, 오히려 반대 방향의
    모범 사례.
  - 제안: 없음.

- **[INFO] `code.handler.ts` compile-error throw 는 §6.3.1 적용 전에 pre-flight 분류를 먼저 통과함 —
  확인 완료**
  - target 위치: `code.handler.ts` "compile user code (syntax error here = pre-flight invariant)"
    주석 블록
  - 대조 규약: `spec/conventions/node-output.md` Principle 3.1(Pre-flight 에러는 throw),
    `spec/conventions/error-codes.md §4.1`(Code 노드 내부 분류는 `classifyCodeNodeError` →
    `LEGACY_TO_NORMALIZED` 파이프라인, 대상은 **실행 중** 런타임 throw)
  - 상세: 이 diff 가 손댄 throw 는 스크립트 **컴파일 단계**(`compileScript` 실패)이며 주석이 명시하듯
    "pre-flight invariant" 로 분류돼 §4.1 의 정규화 파이프라인(런타임 분류 코드) 대상이 아니다. 두
    갈래(pre-flight throw vs runtime `output.error`)를 혼동하지 않았음을 확인했다 — 이 diff 는 해당
    분류 경계를 바꾸지 않았고 주석·`cause` 만 추가했다.
  - 제안: 없음.

- **[INFO] 노출 채널 분리(§6.3.1 vs api-convention §5.3) 오적용 없음**
  - target 위치: `spec/5-system/3-error-handling.md §6.3.1` 상단 note ("REST 표준 봉투 경로에는
    이 절을 적용하기 전에 §2·api-convention §5.3 을 먼저 본다")
  - 상세: 이 diff 의 3개 발행 지점(expression resolver·code handler·secret resolver)은 REST
    표준 검증 에러 봉투(`api-convention §5.3`, 원문 echo 조건 없이 금지)의 경로가 아니라 노드
    실행/설정 해석 단계의 예외이며, Activity API 로 노출되는 실행 에러 형식(`3-error-handling.md
    §2.2`)은 예시(`"LLM connection timeout"`)에서 보듯 원본 메시지 일부 포함을 이미 허용하는
    별도 축이다. §6.3.1 을 §5.3 대신 적용한 것이 잘못된 채널 선택은 아니다.
  - 제안: 없음.

- **[INFO] plan `spec_impact: none` 과 실제 diff 정합**
  - target 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter
  - 상세: 이 diff 는 `spec/**` 를 전혀 건드리지 않으므로 `spec_impact: none` 은 실측과 일치한다
    (Gate C 요구사항 — 리스트 또는 리터럴 `none`).
  - 제안: 없음.

## 요약

이번 PR 은 spec 문서를 전혀 수정하지 않고, 이미 존재하는 `spec/5-system/3-error-handling.md §6.3.1`
(`Error.cause` 부착 C1/C2 기준)과 `spec/conventions/secret-store.md`(SS-SE-05)를 코드 주석에서
정확히 인용·준수하는 방향으로 5개 파일의 주석과 `cause` 부착 여부를 정리했다. 명명·출력 포맷·문서
구조·API 문서(Swagger/OpenAPI)·금지 패턴 다섯 관점 모두에서 diff 범위 내 CRITICAL/WARNING 위반을
찾지 못했다. 오히려 "기준을 정본 한 곳에 두고 콜사이트는 만족 방식만 적는다" 는 이번 변경의 방향은
프로젝트가 다른 곳(error-codes.md Rationale, node-output.md)에서 이미 채택한 SoT 집중 원칙과
일치하는 모범 사례에 가깝다. spec 파일 자체가 diff 대상이 아니므로 문서 구조(Overview/본문/
Rationale)·frontmatter 명명 규칙에 대한 신규 위반 가능성도 없다.

## 위험도

NONE
