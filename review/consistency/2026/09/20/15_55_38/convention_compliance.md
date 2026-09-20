# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 발견사항

- **[WARNING]** frontmatter `code:` 수정(①)이 스스로 드러낸 또 다른 누락을 남긴다 — `http-credentials.ts`
  - target 위치: 변경안 `① 1-http-request.md frontmatter code: 에 한 줄` (draft 62~73행)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"
  - 상세: draft 는 `http-redirect.ts` 미등재를 정정하면서 4개→5개로 늘리지만, 같은 draft 의 실측 항목 ③이 직접 인용하는
    `http-credentials.ts`(`resolveHttpCredentials`)는 여전히 어떤 spec frontmatter `code:` 에도 없다. 이 파일은
    `http-request.handler.ts` 가 직접 import 하며(`from './http-credentials.js'`) `1-http-request.md` §4.1(`auth_type`
    별 credential 적용 표)의 구현 SoT다. `2-navigation/4-integration.md` frontmatter 는 frontend 경로만 담아 이 파일을
    대신 커버하지 않는다. 즉 이 draft 가 "code: 증거 갭"을 고치는 바로 그 draft 이면서 같은 성격의 갭을 하나 더 남긴다.
  - 제안: `http-redirect.ts` 옆에 `http-credentials.ts` 도 함께 추가한다.

- **[WARNING]** `1-http-request.md` §4 step 8 삽입문이 `plan/in-progress/` 경로를 링크가 아닌 bare 코드로 인용해 향후 drift 를 gate 가 못 잡는다
  - target 위치: 변경안 `②` 중 "`1-http-request.md` §4 step 8 끝에 한 문장" (draft 93~96행)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` 행의 취지 — "spec 문서가 쓴
    `plan/**` 링크도 검사 대상이라, plan 이동(in-progress→complete) 시 갱신하지 않으면 build 가 깨진다"(즉 이 gate 가
    존재하는 이유 자체가 이런 참조의 staleness 를 강제로 잡아내기 위함)
  - 상세: 삽입 예정 문장이 `` `plan/in-progress/spec-draft-nullable-notation-followups.md` `` 를 **마크다운 링크가
    아니라 backtick 코드**로 적는다. `spec-link-integrity.test.ts` 는 `[..](path)` 형태만 스캔하므로 이 참조는 애초에
    검증 대상에 들지 않는다 — 트래커가 나중에 `plan/complete/`로 이동해도 build 는 깨지지 않고, `1-http-request.md`
    (status: implemented, 영구 문서)에는 존재하지 않는 경로를 가리키는 문장이 조용히 남는다. 이 경로 특정 자체가
    §4.2 가 명시적으로 경계하는 "spec 문서가 쓴 `plan/**` 링크" 패턴과 같은 성격의 위험이며, backtick 처리는 그 위험을
    줄이는 게 아니라 gate 의 감시망 밖으로 옮길 뿐이다.
  - 제안: 실제 마크다운 링크(`[트래커](../../../plan/in-progress/spec-draft-nullable-notation-followups.md)`)로 바꿔
    적어 최소한 이동 시 build 가 깨지게 하거나, 영구 spec 본문에는 트래커 파일명을 박지 않고 "열린 결정" 이라고만 적은
    뒤 실제 포인터는 별도로 관리하는 편이 안전하다.

- **[WARNING]** §5.9 「정책 동일」 정정(④)이 실제 모순 문장의 위치를 짚지 않아 자기모순이 남을 수 있다
  - target 위치: 변경안 `④ §5.9 «정책 동일» 의 범위를 좁힌다` (draft 119~124행) vs 실제 `spec/2-navigation/4-integration.md`
    §5.9 **테스트 방법** 문단
  - 위반 규약: 직접적인 spec/conventions 조항은 아니지만, `spec/conventions/error-codes.md` §1 의 "코드 이름은 조건의
    의미를 정확히 기술한다"는 정신과 이 draft 자신의 Rationale("«정책 동일» 은 읽는 사람에게 결과 코드까지 같다고
    약속한다")이 요구하는 정확성 기준에 어긋난다
  - 상세: 실측 결과 `spec/2-navigation/4-integration.md` §5.9 에는 이미 "**테스트 방법**: … 401 자동 회복·403 처리·
    transport 카운터 제외는 §5.8 정책 동일." 이라는 문장이 있다 — 이것이 바로 draft 가 반증한 그 "정책 동일" 주장의
    원문이다(draft 의 실측 ④ 가 `CAFE24_INSUFFICIENT_SCOPE` vs `MAKESHOP_AUTH_FAILED` 로 403 처리가 다름을 코드로
    확인했다). 그런데 변경안 ④는 "연결 테스트를 다루는 자리에 한 문장" 을 **추가**하라고만 적고, 이 기존 문장의
    "403 처리 … 동일" 부분을 명시적으로 고치라고 지시하지 않는다. 지시대로 새 문장만 얹으면 같은 절 안에 "403 처리는
    동일" 과 "403 은 다르다" 가 나란히 남아 스스로 모순되는 spec 문단이 된다.
  - 제안: 변경안 ④에 "기존 «테스트 방법» 문장의 '403 처리 … 동일' 구절을 '401 자동 회복·transport 카운터 제외는
    §5.8 정책 동일(403 은 다름 — 아래 참조)' 로 고친다" 는 지시를 명시적으로 추가한다.

## 요약

이 draft 는 error-codes.md 의 핵심 원칙(신규 코드 신설 금지·rename 금지, §2)을 지키며 넷 다 "이미 그렇게 동작하는" 사실만
문서화하려 하고, 각 대상 절의 실제 텍스트·코드(`http-redirect.ts`, `http-connection-tester.ts`, `connection-test-codes.ts`,
`cafe24-api.client.ts`/`makeshop-api.client.ts`)를 대조해 봐도 인용한 코드값·트리거 조건은 모두 실측과 일치했고, 표 구조도
`0-common.md §4.2`/`1-http-request.md §6`/`2-database-query.md §6.2`/`2-navigation/4-integration.md §5.3·§14.1` 각각의
기존 "코드 | 조건" 포맷을 그대로 따른다. 다만 draft 스스로 "code: 증거 갭"과 "«정책 동일» 과대 서술"을 고친다고 선언한
바로 그 지점에서, 고치는 항목과 같은 성격의 갭(`http-credentials.ts` 미등재, 기존 "403 … 동일" 문장 미수정)을 하나씩 새로
남기거나 놓치고 있고, `plan/in-progress/` 경로를 spec 영구 본문에 backtick 으로 박아 두는 것도 `spec-link-integrity` 가드의
보호를 우회하는 형태다. 셋 다 build 를 깨뜨리거나 명시적으로 금지된 패턴을 재현하는 CRITICAL 은 아니지만, 이대로 spec 에
반영하면 각각 새로운 증거 갭·죽은 참조·자기모순 문장을 만들 수 있어 반영 전에 손보는 편이 낫다.

## 위험도

MEDIUM
