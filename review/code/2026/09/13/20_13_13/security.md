# 보안(Security) 코드 리뷰

## 검토 범위

`error-code-emission-axis` 배치는 `origin/main` 대비 59개 파일·+4,591/-7 줄 diff 이지만,
실질 코드 변경은 두 파일에 국한된다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
(가이드 문서가 인용하는 UPPER_SNAKE 식별자의 "발행(emission)" 여부를 판정하는 정적 스캐너에
축 하나 추가: `QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 정규식 3종, `collectQuotedLiterals`/
`collectMessagePrefixes`/`collectCatalogCodes`/`isMessagePrefixOnly` 함수, `GUIDE_NON_EMITTED_VOCABULARY`
면제 목록)와 그 대응 테스트 `guide-identifier-existence.test.ts`. 두 파일 모두 프롬프트에서 diff 가
생략돼 있어 `Read` 로 전체 파일을 직접 열람하고, `git diff origin/main -- <path>` 로 실제 변경 hunk 를
대조해 확인했다.

나머지는:
- 문서: `CHANGELOG.md`, `PROJECT.md`, `codebase/frontend/src/content/docs/02-nodes/logic{,.en}.mdx`
  (가이드 문장 정정 — "코드로 실패해요" → "메시지 접두일 뿐 전용 코드는 없다")
- `plan/**` — 트래커 문서
- `review/consistency/2026/09/13/18_40_54/**`, `review/code/2026/09/13/19_23_22/**`,
  `review/consistency/2026/09/13/19_23_31/**`, `review/consistency/2026/09/13/19_51_39/**`,
  `review/code/2026/09/13/19_51_33/**` — 이전 리뷰/consistency 라운드의 산출물(markdown·json) 커밋

모두 dev-time 문서/테스트/리포트이고, 런타임 프로덕션 경로(백엔드 API 핸들러, 인증/인가, DB 쿼리,
외부 네트워크 호출, 시크릿 취급)를 건드리는 코드 변경은 diff 안에 없다.

## 발견사항

- **[INFO]** 신규 정규식 3종(`QUOTED_LITERAL`·`MESSAGE_PREFIX`·`CATALOG_CODE`)의 ReDoS 가능성 확인 — 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`QUOTED_LITERAL`/`MESSAGE_PREFIX`/`CATALOG_CODE` 선언부, `UPPER_SNAKE = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+"` 재사용)
  - 상세: 세 정규식 모두 `[A-Z][A-Z0-9]*` 뒤에 `_` 로 시작하는 `(?:_[A-Z0-9]+)+` 를 잇는 형태라 두 구간의 매치 범위가 리터럴 `_` 로 명확히 갈려 모호한 부분 반복(중첩 정량자)이 없다 — 선형 시간. `FIELD_TABLE_NAME` 의 `[^}]*?`(lazy, 부정 문자 클래스)도 동일 클래스의 안전한 형태다. 입력도 사용자/네트워크 입력이 아니라 저장소 자신의 소스·mdx·spec 텍스트(테스트 실행 시점에 고정된 크기)이므로 공격자가 입력을 통제할 수 없다. 신규 수집 경로는 `matchAll` 을 써서 `lastIndex` 공유 오염도 없다(주석에 설계 근거 명시, 직접 코드 확인).
  - 제안: 조치 불필요 — 기록 목적의 INFO.

- **[INFO]** 파일 경로는 전부 하드코딩된 저장소 상대경로 — 경로 탐색(path traversal) 벡터 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:112`(`path.join(root, "spec/5-system/3-error-handling.md")`), `:42`(`readIfPresent` 의 `path.join(root, rel)`)
  - 상세: `collectCatalogCodes` 에 넘기는 카탈로그 경로, `.env.example` 경로 등이 전부 소스 리터럴이며 사용자 입력이나 외부 파라미터로 구성되지 않는다. `parseWhereRefs`(`:54-61`)가 `GUIDE_NON_EMITTED_VOCABULARY[].where` 필드에서 정규식 `/([\w./-]+\.ts):(\d+(?:·\d+)*)/g` 로 `파일:줄` 을 뽑아 `walkTree(root, ["codebase/backend/src"], { includeFile: (n) => n === path.basename(file) })` 로 대조하는데, `where` 값은 저장소에 하드코딩된 상수 배열(`GUIDE_NON_EMITTED_VOCABULARY`, 개발자가 소스에 직접 등재)이지 외부/런타임 입력이 아니므로 이 경로도 공격 표면이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 리뷰 대상 diff 전체 (`git diff origin/main` 전수 grep, `token`/`secret`/`password`/`key`/`Authorization` 패턴)
  - 상세: 매치되는 것은 전부 `token: string` 같은 식별자 타입 필드명이거나 `MAKESHOP_UNRESOLVED_PATH_PARAM`·`CONTAINER_MISSING_EMIT` 같은 에러 코드 **이름**이지 실제 비밀값이 아니다. `.env.example`/compose 파일 자체는 이번 diff 에 포함되지 않았고(테스트가 읽기만 함), 새 파일에서 API 키·인증서·평문 자격증명 패턴은 발견되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** 문서 정정 방향이 보안적으로도 개선 방향
  - 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`, `logic.en.mdx:103`
  - 상세: 기존 문구는 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 `error.code` 필드로 방출되는 것처럼 읽혔는데, 실제로는 `execution-engine.service.ts:7121·7125` 의 메시지 접두일 뿐 구조화된 코드로 나가지 않는다(`nodeExec.error = { message }`, `code` 필드 없음 — 실측 확인됨). 사용자/개발자가 `error.code` 를 신뢰해 (예: 코드값으로) 분기 처리하다 오동작하는 것을 막는 방향의 정정이라, 보안이 아니라 정확성 문제지만 부정적 영향은 없다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 유저 가이드 문서 2건의 서술 정정과, 그 정확성을 지속 검증하는 테스트 전용 정적 스캐너에
"발행(emission) 축" 하나를 추가한 것, 그리고 이전 리뷰/consistency 세션의 산출물(markdown·json) 커밋으로
구성된다. 프로덕션 런타임 코드·API·인증/인가·DB·네트워크·암호화 경로는 diff 에 전혀 포함되지 않는다.
신규 정규식은 기존에 이미 안전성이 검증된 `UPPER_SNAKE` 패턴을 조합한 형태로 중첩 정량자에 의한
ReDoS 위험이 없고, 입력도 저장소 자신의 정적 텍스트(사용자/네트워크 입력 아님)다. 파일 경로는 전부
하드코딩된 상대경로이거나 개발자가 소스에 직접 등재한 상수 문자열이라 경로 탐색 벡터가 없고, 하드코딩된
시크릿도 발견되지 않았다. 인젝션·인증/인가 우회·입력 검증 누락·안전하지 않은 암호화·에러 메시지를 통한
민감정보 노출·취약 의존성 등 OWASP Top 10 관련 항목에서 우려할 변경은 없다.

## 위험도

NONE
