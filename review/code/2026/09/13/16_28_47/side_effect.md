# 부작용(Side Effect) 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD -- codebase/` 로 실질 코드 변경분만 추렸다(문서·plan·
`review/**` 산출물은 부작용 검토 대상 아님):

```
guide-error-code-existence.test.ts | 189 -----------  (삭제)
guide-error-code-scan.ts           | 184 -----------  (삭제)
guide-identifier-existence.test.ts | 367 +++++++++++++  (신규)
guide-identifier-scan.ts           | 244 +++++++++++++  (신규)
guide-sanitized-message-parity.test.ts | 4 +-  (주석 4줄)
```

이번 라운드(라운드 5, 직전 커밋 `1984d72d3`)의 순증분은 `CODE_FIELD` 정규식의 왼쪽 경계를
`(?<![A-Za-z])` → `(?<!\w)` 로 좁힌 것과, `collectSourceTokens` 에 합성 대조군
`describe` 블록을 추가한 것뿐이다. 두 파일(`guide-identifier-scan.ts`,
`guide-identifier-existence.test.ts`) 전문을 현재 워크트리에서 직접 `Read` 했고,
`writeFile|unlink|rmSync|mkdirSync|appendFile|process\.env\[|process\.env\.\w*\s*=|exec\(|spawn|fetch\(|http\.request|https\.request` 를 grep 했으나 두 파일 모두 매치 0건이다.
삭제된 두 파일(`guide-error-code-*`)에 대한 잔존 import 도 저장소 전수 grep 으로 0건 확인
(`guide-sanitized-message-parity.test.ts:16` 은 주석 안의 역사적 병기일 뿐 실행 경로가 아니다).
저장소는 뮤테이션하지 않았다(`git status --short` — 이 세션 산출물 디렉터리 2개 외 변경 없음).

## 발견사항

해당 없음 — CRITICAL/WARNING 없음.

- **[INFO]** 모듈 스코프 `g`-플래그 정규식 3개(`FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK`)가
  호출 간 공유되는 가변 상태(`lastIndex`)를 갖고, 매 호출 진입 시 수동 `rx.lastIndex = 0` 으로
  리셋하는 패턴에 의존한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의
    `scanIdentifierCitations`(168~180번째 줄, `push` 클로저) · `collectSourceTokens`(196번째
    줄) · `collectEnvDeclarations`(229·237번째 줄)
  - 상세: 단일 스레드·동기 실행이라 오늘 레이스는 없지만, 이 리셋 보일러플레이트가 함수마다
    손으로 4회 복제돼 있어 **향후 리셋 한 줄이 빠지면 두 번째 호출부터 매치가 조용히
    누락**되는 클래스의 결함이다(리셋 누락을 직접 겨누는 테스트는 없다). 이미 작성자 자신이
    같은 위험을 인지해 `plan/in-progress/guide-identifier-existence.md:189` 에 "공유 헬퍼로
    옮기는 리팩터" 백로그로 등재해 두었다 — 신규로 등재할 필요 없이 추적 상태 확인만 한다.
  - 제안: 조치 불요(이미 등재·추적 중). 공유 헬퍼로 옮길 때 "리셋 제거 뮤턴트가 RED 인가"
    를 선실측 조건으로 유지할 것.

- **[INFO]** 신규 모듈은 순수 함수 + 읽기 전용 파일시스템 접근만 사용, 삭제된 모듈에는
  잔존 참조가 없다
  - 위치: `guide-identifier-scan.ts`(전체) · `guide-identifier-existence.test.ts`(전체)
  - 상세: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 모두
    인자로 받은 텍스트만 다루며 반환값 외 부작용이 없다. 파일시스템 접근은 전부
    `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync`(읽기)뿐이고, env 스캔은 `.env.example`·
    `docker-compose*.yml` 파일의 **텍스트**에서 변수 **이름**만 정규식으로 추출한다 —
    `process.env` 자체를 읽거나 쓰지 않는다. 네트워크 호출 grep 도 0건. 신규 export
    `GUIDE_EXTERNAL_VOCABULARY` 는 `readonly` 배열이고 다른 파일에서 import 되지 않으며
    (grep 확인) 원소를 push/splice 하는 코드가 없어 새 가변 전역이 아니다. 삭제된
    `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts` 를 import 하던 곳은 그
    두 파일 자신뿐이었고(전수 grep), `.claude/**` 하네스에도 옛 파일명 참조가 없어 시그니처
    삭제가 다른 호출자에 영향을 주지 않는다.
  - 제안: 없음(정보성).

- **[INFO]** 이번 라운드의 순증분(`CODE_FIELD` 경계 `(?<![A-Za-z])`→`(?<!\w)`)은 매칭
  **축소** 방향 — 부작용 표면을 넓히지 않는다
  - 위치: `guide-identifier-scan.ts:135` (`CODE_FIELD` 선언)
  - 상세: 이전 경계는 `_`(밑줄)를 배제하지 않아 `"error_code":`/`"http_code":` 형태도 매칭
    대상이었는데(과대 매칭), 이번 경계는 워드 문자 전체(`[A-Za-z0-9_]`)를 배제해 매칭을 더
    좁혔다. 함수 시그니처·반환 타입·호출부는 변경이 없고, 이 정규식은 테스트 파일 내부에서만
    쓰여 프로덕션 코드 경로나 공개 API에 영향이 없다.
  - 제안: 없음(정보성).

## 요약

이번 diff 의 실질 코드 변경은 문서 검증용 vitest 정적 스캐너의 정규식 경계 정밀화
(`CODE_FIELD` 왼쪽 경계 축소)와 그에 대응하는 합성 대조군 테스트 추가뿐이며, 전부 순수 함수 +
읽기 전용 파일시스템 접근으로 구성되어 프로덕션 런타임 경로·전역 가변 상태·환경변수 쓰기·
네트워크 호출·이벤트/콜백 어느 것도 건드리지 않는다. 삭제된 구 가드 모듈에 대한 잔존
참조도 0건이라 시그니처/인터페이스 제거가 다른 호출자에 영향을 주지 않는다. 유일하게 주목할
설계 축(모듈 스코프 stateful regex 의 `lastIndex` 수동 리셋 반복)은 이미 작성자가 백로그로
등재·추적 중인 항목이라 이번 리뷰에서 새로 지적할 사항은 아니다.

## 위험도

NONE
