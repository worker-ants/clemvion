# Rationale 연속성 검토 — eslint10-upgrade (spec/5-system/)

## 검토 범위 요약

- Target: `spec/5-system/` (impl-done, diff-base `origin/main`)
- 실제 diff 내용: `spec/*.md` 변경 없음. 순수 코드/설정 변경 — eslint 9→10 상향(backend + `packages/*` 9곳),
  `eslint-plugin-unicorn` `^56`→`^73`, 신규 lint rule(`no-useless-assignment`, `preserve-caught-error`)
  자동수정 반영, 그에 따른 dead-store 제거·`{ cause: err }` 부착·가드 파서(`parseGteFloor`) 확장·회귀 테스트 추가.
- `spec/5-system/1-auth.md`, `3-error-handling.md` 의 `## Rationale` 전문과, 관련 spec(0-overview·1-data-model·
  2-navigation/*·3-workflow-editor/0-canvas 등)의 Rationale 발췌를 대조. 나머지 `5-system/*` 파일은 예산 초과로
  번들에서 절단되어 있어, 청킹 관련 항목(`8-embedding-pipeline.md`)은 저장소 원본을 직접 열어 대조했다.

## 발견사항

- **[INFO]** `preserve-caught-error` 자동수정과 CWE-209 마스킹 원칙의 교차점을 spec 에 명시적으로 연결해 둘 가치
  - target 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` (`throw new Error(..., { cause: err })` 신설), `codebase/backend/src/nodes/data/code/code.handler.ts` (동일 패턴), 대비 `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (`eslint-disable-next-line preserve-caught-error` 로 의도적 제외)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` `## Rationale` — "4xx http-error `message` 고정 문구 — CWE-209 방지" 항목("라이브러리 원문에는 …구현 세부가 섞일 수 있어 그대로 노출하면 정보 누출(CWE-209)이 된다… 5xx 마스킹(generic 500)과 일관된다"), 그리고 §3.2 "노드별 부가 정보 — stack / originalInput / attempts / missingFields 등. JSON 직렬화 가능해야 함"
  - 상세: eslint 10 의 `preserve-caught-error`(unicorn recommended, v66+)가 새로 발화하며 이번 PR 은 대부분의 `catch → rethrow` 지점에 `cause: err` 를 기계적으로 붙였다. 그런데 `secret-resolver.service.ts` 한 곳만 정반대로 `cause` 부착을 **명시적으로 억제**했고, 그 근거로 기존 결정(`SS-SE-05`, `#814` SSRF 메시지 일반화 Rationale)을 정확히 인용했다 — 이는 과거 결정을 잘 계승한 사례다. 실측 확인 결과 `.cause` 는 `GlobalExceptionFilter`(client 응답 조립 경로)나 node error-policy 경로 어디에서도 읽히지 않고(`grep -rn "\.cause\b" codebase/backend/src` 결과 `secret-resolver.service.spec.ts`·`telegram-client.ts` 두 곳뿐), `Error.cause` 는 spec 정의상 non-enumerable 이라 `JSON.stringify`로도 새지 않는다 — 따라서 expression-resolver/code.handler 쪽의 `cause` 부착이 실제 정보 누출을 만들지는 않는다(§3.2 가 애초에 노드 에러엔 stack 등 상세 노출을 허용). 다만 두 파일에는 "왜 여긴 붙여도 되는가"에 대한 근거 코멘트가 없어, secret-resolver 의 억제 사유(SS-SE-05)만 보면 나머지 파일도 같은 걱정을 해야 하는지 다음 리더가 재확인해야 하는 비대칭이 남는다.
  - 제안: (필수 아님) expression-resolver.service.ts/code.handler.ts 의 `cause: err` 옆에 "이 메시지는 이미 `${message}` 로 동일 정보를 노출 중이라 cause 부착이 추가 노출을 만들지 않음 — secret-resolver 의 SS-SE-05 억제와는 구분됨" 정도의 1줄 코멘트를 남기면 향후 동일 lint rule 이 새 파일에서 발화할 때 "붙여도 되는지"를 개별 재조사하지 않아도 된다.

## 요약

이번 diff 는 `spec/5-system/*.md` 본문을 전혀 건드리지 않는 순수 eslint 9→10 상향 + 신규 lint rule 자동수정(PR) 이다. 가장 민감할 수 있는 지점 — `preserve-caught-error` 가 강제하는 `cause: err` 부착과 `spec/5-system/3-error-handling.md` Rationale 의 CWE-209 마스킹 원칙의 충돌 가능성 — 은 실제로는 정확히 잘 처리되어 있다: 보안에 민감한 `secret-resolver.service.ts` 경로에서는 과거 결정(`SS-SE-05`, `#814`)을 코드 주석·회귀 테스트(`cause` 가 `undefined` 임을 단언)로 명시 인용하며 lint rule 을 의도적으로 억제했고, 그 외 경로(`expression-resolver`, `code.handler`)에서 `cause` 를 붙인 것은 실측상 클라이언트 노출 경로가 없어 원칙 위반이 아니다. `execution-engine.service.ts` 의 EIA §6 관련 3-strikes CRITICAL 코멘트 블록, `text-chunker.ts` 의 overlap 처리, `dependabot.yml`/`eslint.config.mjs` 의 버전 pin 정책 등도 모두 기존 결정을 뒤집지 않고 원 주석(과거 실측·과거 사고 이력)을 갱신하며 계승하고 있다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 — 네 관점 모두 CRITICAL/WARNING 급 발견 없음.

## 위험도
NONE
