# 보안(Security) 코드 리뷰

## 검토 범위

이번 배치(`error-code-emission-axis`)의 실질 코드 변경은 두 파일에 국한된다 —
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기
3종 + `GUIDE_NON_EMITTED_VOCABULARY` 신규 목록)와
`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(같은 축의
단언 7종 + 대조군). 나머지(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·`plan/**`·
`review/**`)는 문서/프로세스 산출물이며 런타임 코드 변경이 없다.

두 TS 파일은 **개발 시점(vitest) 전용 문서 검증 테스트**다 — 저장소 자신의 소스
트리(`codebase/backend/src`, `codebase/packages`), `.env.example`, `docker-compose*.yml`,
`spec/**`, `codebase/frontend/src/content/docs/**` 를 읽어 유저 가이드가 인용한
UPPER_SNAKE 식별자가 실제 코드/환경변수로 존재하는지, 그리고 "메시지 접두로만 등장하고
카탈로그에도 없는" 인용에 사유가 등록돼 있는지를 정적으로 대조한다. 프로덕션 런타임에
포함되지 않고, 네트워크·DB·인증·세션·사용자 입력을 전혀 다루지 않는다. 프롬프트 크기
제한으로 생략된 두 TS 파일은 `Read` 로 전체를 직접 열어 확인했다.

## 발견사항

- **[INFO]** 파일 경로가 저장소 내부 문자열 리터럴로만 구성되어 경로 탐색(path traversal)
  표면이 없음을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:41-48`
    (`readIfPresent`), `:56-60`(`parseWhereRefs`), `:242-245`(`where` 검증 루프)
  - 상세: `fs.readFileSync`/`fs.existsSync`/`walkTree` 에 넘기는 모든 경로는 (a) 테스트
    파일 안의 하드코딩된 상대경로 상수(`"codebase/backend/.env.example"` 등), (b)
    `GUIDE_NON_EMITTED_VOCABULARY` 배열 리터럴의 `where` 필드에서 정규식으로 뽑아낸
    `[\w./-]+\.ts` — 이 정규식은 `..`/절대경로 문자(`/` 선행)를 문법적으로 배제하지는
    않지만, 원본 값이 코드 저장소에 커밋된 상수 배열이지 외부/사용자 입력이 아니므로
    실질적인 공격 표면이 되지 않는다(테스트 스위트 실행자가 이미 저장소 전체에 대한
    쓰기 권한을 가진 신뢰 주체). 새 배열 항목을 추가하는 사람이 오탈자로 잘못된 파일을
    가리켜도 `hits.length !== 1` 검사가 실패를 알린다(라인 246 부근).
  - 제안: 조치 불필요 — 신뢰 경계 밖 입력이 유입되는 경로가 아님을 기록으로 남긴다.

- **[INFO]** 정규식 5종(`FIELD_TABLE_NAME`, `CODE_FIELD`, `QUOTED_LITERAL`,
  `MESSAGE_PREFIX`, `CATALOG_CODE`, `UPPER_SNAKE` 등)이 신뢰된 대형 텍스트(소스 트리
  전체, 92개 MDX)에 반복 실행되지만 ReDoS(재앙적 백트래킹) 패턴은 관측되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:136-266`
  - 상세: 각 정규식은 중첩된 가변 길이 정량자가 서로를 감싸는 형태(`(a+)+` 류)가 아니다.
    `FIELD_TABLE_NAME` 의 `[^}]*?\bname:` 는 부정 문자 클래스 기반 lazy 매칭이라 같은
    문자 클래스와 겹치는 모호성이 없고, `CODE_FIELD` 의 `(?<!\w)` 룩비하인드도 고정 길이라
    선형이다. 입력이 신뢰된 저장소 파일(사용자가 실시간으로 넣는 값 아님)이라는 점과
    함께, 이 축은 보안 위험으로 분류하지 않는다.
  - 제안: 조치 불필요 — 참고용 기록.

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 목록에 담긴
  값은 에러 코드/환경변수 **이름**일 뿐 비밀값이 아님을 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:300-354`
  - 상세: `MAKESHOP_UNRESOLVED_PATH_PARAM`, `CONTAINER_MISSING_EMIT` 등은 식별자 이름
    문자열이며, API 키·비밀번호·토큰 값이 아니다. `.env.example` 자체도 실제 값이 아닌
    변수명 플레이스홀더를 담는 파일이라 이 변경으로 새로 유출되는 시크릿은 없다.
  - 제안: 조치 불필요.

- **[INFO]** 문서(mdx/CHANGELOG/PROJECT.md) 변경은 에러 코드가 `error.code` 로
  방출되지 않고 메시지 접두로만 나간다는 사실을 사용자에게 더 정확히 알리는 방향으로,
  보안 관점에서 부정적 영향이 없다
  - 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`,
    `logic.en.mdx:103`
  - 상세: 오히려 "전용 에러 코드가 없으니 메시지를 보라" 는 안내는 사용자가 잘못된
    가정(구조화된 `error.code` 매칭)으로 실패 처리 로직을 짜는 것을 예방해 간접적으로
    에러 처리 신뢰성을 높인다. 민감 정보 노출은 없다.
  - 제안: 조치 불필요.

## 요약

이번 diff 의 실질 코드 변경은 유저 가이드 문서(MDX)가 인용한 에러 코드/환경변수 식별자가
실제 소스에 존재하는지, 그리고 "방출되지 않는 메시지 접두" 인용에 사유가 등록됐는지를
검증하는 **개발 시점 전용 vitest 테스트/스캐너**에 한정된다. 런타임 프로덕션 코드,
API 엔드포인트, 인증/인가, DB 쿼리, 외부 입력 처리 경로를 전혀 건드리지 않으며, 처리하는
모든 파일 경로는 저장소 내부 상수 또는 커밋된 배열 리터럴에서 나와 신뢰 경계 밖 입력이
유입될 여지가 없다. 정규식들도 재앙적 백트래킹 패턴이 아니고, 목록에 담긴 값들은 식별자
이름일 뿐 비밀값이 아니다. 문서 변경(CHANGELOG/PROJECT.md/logic.mdx)은 에러 코드가
실제로는 메시지 접두일 뿐이라는 사실을 명확히 하는 정정으로, 보안 관점에서 중립~긍정적이다.
인젝션·시크릿 하드코딩·인증 우회·입력 검증 누락·안전하지 않은 암호화·민감정보 노출·
취약 의존성 어느 항목에서도 Critical/Warning 급 발견사항이 없다.

## 위험도
NONE
