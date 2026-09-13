# 부작용(Side Effect) 코드 리뷰

## 검증 방법

프롬프트 조립 문서(46개 리뷰 대상 항목, 다수는 과거 라운드의 `review/**` 커밋 산출물)를 훑은 뒤,
실질 코드 델타는 `git diff --stat origin/main...HEAD -- 'codebase/**'` 로 좁혔다 — 실제로 바뀐
소스는 5개뿐이다:

- `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` — 삭제
- `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` — 신규
- `guide-sanitized-message-parity.test.ts` — 주석(JSDoc cross-reference) 1줄만 변경

나머지(CHANGELOG.md·PROJECT.md·plan/**·review/**)는 문서·플랜·리뷰 산출물이라 실행 경로가 없다.
두 신규 파일을 전문 `Read` 했고, 삭제된 모듈의 export 표면(`scanErrorCodeCitations` ·
`collectBackendTokens` 등)을 다른 곳에서 import 하는지 `grep -rln "guide-identifier-scan\|guide-error-code-scan" codebase/` 로 확인했다(결과: 자기 자신의 테스트 파일 1건뿐 — 외부 소비자 없음).
`git status --short` 로 저장소가 이 세션의 산출물 외에는 깨끗함을 확인했다.

## 발견사항

해당 없음.

- **상태 변경**: 신규/변경 코드는 `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 세 순수 함수뿐이다. 모듈 스코프 정규식(`FIELD_TABLE_NAME`/`CODE_FIELD`/`BACKTICK`)은 `g` 플래그로 상태(`lastIndex`)를 갖지만, 세 곳 모두 `exec` 루프 진입 직전 `rx.lastIndex = 0` 으로 리셋하고 있어(예: `guide-identifier-scan.ts` 의 `push` 헬퍼, `collectSourceTokens`, `collectEnvDeclarations`) 파일 간·호출 간 상태 누수가 없다. 전역 변수 신규 도입 없음(`GUIDE_EXTERNAL_VOCABULARY` 는 `readonly` 리터럴 상수).
- **파일시스템**: `fs.readFileSync`/`fs.existsSync`/`fs.readdirSync` 만 사용하며 전부 read-only다. 쓰기·삭제 API 호출 0건(신규 파일 두 개, 변경 파일 세 개 전문 확인).
- **시그니처/인터페이스 변경**: 옛 모듈(`guide-error-code-scan.ts`)의 export(`scanErrorCodeCitations`, `collectBackendTokens`, `ErrorCodeCitation`, `CitationAxis`)는 그 자신의 테스트 파일에서만 소비됐고, 그 테스트 파일도 이번 diff 로 함께 삭제된다. `grep` 으로 확인한 결과 저장소 전체에서 이 두 파일 외에 옛 모듈을 import 하는 곳은 없다 — 공개 API 가 아닌 private 테스트 유틸이라 호출자 영향이 없다.
- **환경 변수**: 코드가 `process.env` 를 직접 읽거나 쓰지 않는다. `collectSourceTokens`/`collectEnvDeclarations` 는 소스·env 파일의 **텍스트**를 정규식으로 훑어 `process.env.X` 같은 패턴의 **이름 문자열**만 수집할 뿐, 실제 프로세스 환경변수 접근이 아니다.
- **네트워크 호출**: 없음. 전부 로컬 파일시스템 동기 읽기.
- **이벤트/콜백**: 없음(vitest `describe`/`it` 등록 외 콜백 발행 없음).
- **자매 파일 crossref**: `guide-sanitized-message-parity.test.ts:16` 의 JSDoc 이 옛 파일명을 신규 이름 + 구 이름 병기로 갱신한 상태를 직접 확인했다(과거 라운드에서 지적된 stale 참조가 이미 해소돼 있다).

## 요약

이번 diff 의 실질 코드 변경은 문서-정합성 검증용 vitest 정적 스캐너의 리네임·스코프 확장(에러 코드 전용 → 식별자 전반: 에러 코드 + 환경변수)이며, 순수 함수 + 동기 `fs` 읽기로만 구성된다. 전역 상태 변경, 새 전역 변수, 파일 쓰기/삭제(테스트 대상 외), 공개 API 시그니처 변경(외부 소비자 있는 export 없음), 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 발행 — 8개 점검 관점 모두 해당 사항이 없다. 유일하게 상태를 다루는 지점(공유 정규식의 `lastIndex`)은 매 호출 전 명시적으로 리셋되어 있어 교차 오염 위험이 없음을 소스에서 직접 확인했다. 저장소 뮤테이션 없이 검증을 마쳤다(`git status --short` 클린).

## 위험도

NONE
