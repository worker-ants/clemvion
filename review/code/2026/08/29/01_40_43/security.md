# 보안(Security) 리뷰 결과

## 검증 방법

이번 변경 set(`origin/main...HEAD`, 25개 파일)은 대부분 이전 리뷰 라운드(`01_07_51`)와
consistency 라운드(`01_30_29`)의 산출물을 저장소에 커밋하는 것이고, 실제 실행 코드가 있는
파일은 5개(`expression-resolver.service.ts`/`.spec.ts`, `secret-resolver.service.ts`,
`code.handler.ts`/`.spec.ts`) + `plan/in-progress/deps-peer-gating-and-eslint10.md` 뿐이다.
아래를 저장소에서 직접 열어 실측·교차검증했다(읽기 전용, 뮤테이션 없음):

- `git diff -U0 origin/main...HEAD -- codebase/ | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-][[:space:]]*//' | grep -vE '^[+-][[:space:]]*$'`
  → **출력 0줄**. `codebase/` 안의 diff 는 전부 주석(`//`)이거나 공백 줄 — 실행 로직·throw
  인자·eslint-disable 위치는 diff 전후 완전히 동일함을 직접 확인했다.
- `expression-resolver.service.ts:316-321`(현재 파일 실측)의 C2 서술이 "message·name 밖에
  **민감** 속성이 붙지 않는다"로 한정어를 포함하고 있고, `packages/expression-engine/src/errors.ts`
  를 직접 열어 `ExpressionError` 가 실제로 `code: ErrorCode`·`position?: number` 를 own
  property 로 갖음을 재확인 — 주석이 그 사실을 정확히 인정한 상태임을 검증. 형제 파일
  `expression-resolver.service.spec.ts:141-145` 도 같은 "민감" 한정어를 포함(이전 라운드
  `01_07_51` 의 security WARNING #1 이 지적한 과잉 일반화가 이번 diff 에서 이미 수정된
  상태로 커밋됨 — `RESOLUTION.md` 의 주장과 실측이 일치).
- `secret-resolver.service.ts:73-103`(전체 컨텍스트)을 직접 읽어 `resolve()` catch 분기의
  `cause` 비부착·`logger.error` 의 ref+workspaceId 한정 로깅·`eslint-disable-next-line
  preserve-caught-error` 가 diff 전후 바이트 단위로 동일함을 확인.
- `secret-resolver.service.spec.ts:206-230`(diff 밖 파일, 안정성 확인용)의 회귀 테스트가
  `err.cause` 가 `undefined` 임과 메시지가 `'Secret decryption failed'` 로 고정됨을 여전히
  단언하고 있어, crypto 에러 상세 비노출 불변식이 테스트로 잠겨 있음을 재확인.
- `grep -rn "\.cause\b" codebase/backend/src` 로 저장소 전체의 `.cause` 소비자를 재탐색.
  `telegram-client.ts:describeFetchError()` 1곳이 존재하나, 이는 Telegram Bot API 호출
  재시도 실패를 로거에 남기기 위한 별개 도메인 유틸(`fetch` 에러의 `cause` 를 사람이 읽을
  문자열로 풀어 `logger` 에만 전달)이고, `expression-resolver`/`code.handler`/
  `secret-resolver` 세 곳이 만드는 에러를 소비하지 않는다 — 호출부(`telegram-client.ts:248,257`)
  가 전부 로그 문자열 조합이며 클라이언트 응답으로 반환되지 않는다. 이전 라운드가 "저장소
  전체에 `.cause` 소비자가 없다"고 한 서술은 엄밀하는 아니지만(이 1곳이 이미 있었다), 이번
  diff 가 새로 연 경로가 아니고 이 diff 범위의 위험 결론(부착해도 안전)에는 영향이 없다 —
  참고용 INFO 로만 남긴다.
- `git diff origin/main...HEAD | grep -iE "ENCRYPTION_KEY[[:space:]]*[:=][[:space:]]*['\"a-zA-Z0-9]"`
  및 API 키/비밀번호/토큰 패턴 grep → 하드코딩된 시크릿 값 없음(전부 리뷰 산출물 텍스트 안의
  변수명·설명일 뿐).

## 발견사항

- **[INFO]** "저장소 전체에 `.cause` 소비자가 없다"는 이전 라운드(`01_07_51` security INFO #2,
  `documentation.md`, `RESOLUTION.md`)의 전역 부재 서술이 엄밀하게는 참이 아니다 —
  `telegram-client.ts` 의 `describeFetchError()` 가 이미 `err.cause` 를 읽어 로그 문자열에
  섞는다.
  - 위치: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts:90-107`
    (함수 `describeFetchError`, 이번 diff 대상 파일 아님 — 참고용 사전 존재 코드)
  - 상세: 이 소비자는 `fetch()` 실패(TypeError 래핑) 전용이고 `logger.warn`/`logger.error`
    호출부(`telegram-client.ts:248, 257`)에서만 쓰이며 클라이언트 응답으로 반환되지 않는다.
    `expression-resolver`/`code.handler`/`secret-resolver` 가 던지는 에러의 `cause` 를
    소비하는 경로가 아니라서 이번 diff 의 안전성 결론(“cause 부착이 오늘 시점 노출 경로를
    만들지 않는다”)에는 영향이 없다. 다만 "소비자가 **전혀** 없다"는 서술 자체는 plan/리뷰
    산출물에 그대로 남아 있어, 다음에 이 근거를 재사용할 때 "전역 부재" 대신 "이 세 경로의
    `cause` 를 소비하는 곳이 없다"로 좁혀 쓰는 편이 더 정확하다.
  - 제안: 조치 불요(이번 diff 범위 밖 관찰). `plan/in-progress/deps-peer-gating-and-eslint10.md`
    §2 후속 항목 "cause 비노출 불변식의 계측 지점"(INFO #2)을 실제로 착수할 때, 근거 문구를
    "저장소에 `.cause` 소비자가 없다" → "이 세 경로의 `cause` 를 소비하는 곳이 없다"로 함께
    좁히는 것을 권장.

- **[INFO]** 이전 라운드 security WARNING #1(`expression-resolver.service.spec.ts:142` 의
  C2 서술이 "민감" 한정어를 떨어뜨려 과잉 일반화)이 이번 diff 에서 이미 정정되어 커밋됨을
  실측으로 재확인. `RESOLUTION.md`·`SUMMARY.md` 의 "본 커밋에서 조치" 주장과 현재 파일
  내용이 정확히 일치한다 — 별도 조치 불요.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts`
    (함수 `describe('ExpressionResolverService')` 내 "원본 예외를 `cause` 로 보존한다" 테스트
    직전 주석 블록), `code.handler.ts`, `code.handler.spec.ts` 자매 2곳도 동일하게 정정됨.

## 그 외 점검 관점 (이상 없음)

- **인젝션**: diff 는 주석/문서뿐이라 신규 인젝션 표면 없음.
- **하드코딩 시크릿**: 소스·리뷰 산출물 전체에 실제 키/비밀번호/토큰 값 없음(grep 확인).
- **인증/인가**: 변경 없음.
- **암호화**: `secret-resolver.service.ts` 의 AES-GCM 기반 `decryptSecret`/`encryptSecret` 호출
  경로·마스터키 처리 로직은 diff 전후 바이트 단위 동일. crypto 에러 상세를 사용자에게
  노출하지 않는 기존 방어(추상화된 메시지 + `cause` 비부착)가 그대로 유지됨.
- **에러 처리**: `expression-resolver`/`code.handler` 의 `cause: err` 부착이 안전한 근거(C1:
  message 가 이미 원본을 포함 / C2: 부가 own property 가 비민감)를 실측으로 재확인했고,
  `secret-resolver` 의 비부착 판단(C1 불성립 — 의도적으로 원본을 감춤)도 정확함을 확인.
  Activity API 로 사용자에게 노출되는 것은 `.message` 이며 `cause` 자체를 직렬화해 응답에
  포함하는 코드는 발견되지 않았다(`GlobalExceptionFilter` 포함 grep 결과 없음).
- **의존성 보안**: 이번 diff 에 `package.json`/lockfile 변경 없음 — 해당 없음.

## 요약

이번 변경 set 은 `codebase/` 기준 실행 코드 변경이 0줄이고(직접 diff 필터링으로 재확인),
`eslint 10` `preserve-caught-error` 대응으로 붙인 `cause: err` 부착/비부착 판단 근거 주석을
정본(spec §6.3.1)에 정렬시키는 문서화 작업 + 이전 리뷰/consistency 라운드 산출물을 저장소에
기록하는 작업이다. 이전 라운드가 지적한 유일한 실질 WARNING(C2 서술의 한정어 누락)이 이번
diff 에서 정확히 정정되어 커밋됐음을 실측으로 재확인했고, crypto 에러 비노출·`cause` 비노출
불변식은 기존 회귀 테스트로 계속 잠겨 있다. 새로 발견한 것은 "저장소 전체에 `.cause` 소비자가
없다"는 기존 서술이 `telegram-client.ts` 라는 무관 도메인의 로그 전용 소비자 때문에 엄밀하게는
과장이라는 점뿐이며, 이번 diff 의 안전성 결론에는 영향이 없어 INFO 로 남긴다. Critical·Warning
없음.

## 위험도

NONE
