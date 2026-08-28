# 부작용(Side Effect) 리뷰 결과

## 검증 방법

`git diff origin/main..HEAD --stat` 로 실제 changeset(25개 파일, 3 커밋: `8b92546f5`, `8d7ce96a7`,
`085c3ada4`)이 프롬프트 번들의 파일 25개와 정확히 일치함을 확인. 이어서 코드 5개 파일에 대해

```
git diff origin/main..HEAD -- <5개 파일> \
  | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE '^[+-][[:space:]]*//' | grep -vE '^[+-][[:space:]]*$'
```

를 실행 — **출력 0줄**. 즉 추가·삭제된 모든 줄이 `//` 주석이거나 공백 줄이다(RESOLUTION.md 의 e2e
면제 실측과 동일한 결론을 독립적으로 재확인). 저장소 파일은 건드리지 않았고(`git diff`/`git log`/
`git status` 만 사용, read-only), `git status --short` 결과 내 세션 출력 디렉터리
(`review/code/2026/08/29/01_40_43/`) 외 잔여물 없음.

## 발견사항

- **[INFO]** 실질 코드 변경 없음 — 주석 추가/치환만
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` (throw 문 앞 주석 6줄 추가, 316~321)
  - 상세: `throw new Error(...,{ cause: err })` 호출부의 인자·조건은 diff 전후 바이트 단위로 동일. 위에 `spec/5-system/3-error-handling.md §6.3.1` 을 가리키는 근거 주석만 추가됐다.
  - 제안: 없음.

- **[INFO]** 실질 코드 변경 없음 — 주석 추가만
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` (컴파일 예외 rethrow 앞 주석 7줄 추가, 454~461)
  - 상세: `throw new Error(\`code has a syntax error: ${message}\`, { cause: err })` 호출은 무변경.
  - 제안: 없음.

- **[INFO]** 실질 코드 변경 없음 — 주석 블록 치환
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` `resolve()` catch 블록 (전체 컨텍스트 86~102)
  - 상세: `eslint-disable-next-line preserve-caught-error` 지시문과 `throw new Error('Secret decryption failed')` 는 diff 전후 동일 — `cause` 비부착 유지. 위 근거 설명 주석만 재작성.
  - 제안: 없음.

- **[INFO]** 테스트 스펙 — 주석만 치환, 단언·fixture 불변
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` (133~146행 영역, `it('원본 예외를 cause 로 보존한다...')`)
  - 상세: `expect` 체인은 무변경. 케이스 위 설명 주석만 §6.3.1 참조로 교체.
  - 제안: 없음.

- **[INFO]** 테스트 스펙 — 주석만 치환(2곳), 단언·fixture 불변
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (197~232행 영역, `it('원본 컴파일 예외를 cause 로 보존한다...')`)
  - 상세: 위와 동일 패턴. 추가로 이전 라운드에서 "isolate 경계" 로 잘못 귀속했던 설명을 "Jest realm" 으로 정정 — `toBeInstanceOf`/`toBeDefined`/`toContain` 단언 자체는 무변경.
  - 제안: 없음.

- **[INFO]** plan 문서 전용 변경, codebase 영향 없음
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md`
  - 상세: frontmatter `worktree:` 값 갱신 + 체크리스트 자기정정 텍스트 추가. 애플리케이션 동작·전역 상태·API 에 영향 없음. `spec/**` 는 이번 diff 대상이 아니다(`git diff origin/main..HEAD -- 'spec/**'` 0줄, consistency 산출물의 실측과 일치).
  - 제안: 없음.

- **[INFO]** 신규 파일 19개 — 리뷰/일관성 검토 산출물 (예상된 파일시스템 부작용)
  - 위치: `review/code/2026/08/29/01_07_51/*`(11개), `review/consistency/2026/08/29/01_30_29/*`(8개)
  - 상세: 전부 이전 라운드 sub-agent 들이 생성한 리포트(SUMMARY/RESOLUTION/개별 리뷰어 산출물 + `meta.json`/`_retry_state.json`)로, CLAUDE.md 정보 저장 위치 표(`review/code/**`, `review/consistency/**`)와 정확히 일치하는 위치에 커밋된 것이다. 애플리케이션 코드·설정·전역 상태에는 영향 없음. 참고로 `_retry_state.json`/`meta.json` 안에 로컬 워크스테이션의 절대경로(`/Users/gehrig/...`)가 하드코딩되어 있으나, 이는 이번 PR 이 새로 만든 패턴이 아니라 저장소 전역에 이미 존재하는 관행이다(`git log --all --oneline -- 'review/**/_retry_state.json' | wc -l` → 791건). 새로운 side effect 로 보지 않는다.
  - 제안: 없음(기존 관행과 일치).

## 부작용 관점 개별 체크

1. **의도치 않은 상태 변경** — 없음. 5개 실행 코드 파일의 non-comment diff 가 0줄임을 grep 으로 직접 확인.
2. **전역 변수** — 없음. 신규/수정된 전역 변수 없음.
3. **파일시스템 부작용** — `review/**` 신규 파일 19개는 리뷰 파이프라인이 규약대로 생성한 산출물이며 런타임 코드의 파일 I/O 와 무관. 애플리케이션 코드 쪽 파일 생성·삭제 로직 변경 없음.
4. **시그니처 변경** — 없음. `throw new Error(...)` 호출부의 인자(message, `{ cause }`)는 3개 실행 파일 전부 diff 전후 동일.
5. **인터페이스 변경** — 없음. `ExpressionResolverService`/`SecretResolverService`/`CodeHandler` 의 공개 메서드 시그니처·반환 타입·에러 계약 모두 불변.
6. **환경 변수** — 없음. diff 범위 내 `process.env` 신규 읽기/쓰기 없음.
7. **네트워크 호출** — 없음.
8. **이벤트/콜백** — 없음. throw/catch 흐름·로거 호출 모두 기존과 동일.

## 요약

이번 changeset(25개 파일, 3커밋)의 핵심인 backend 코드/스펙 5개 파일은 `git diff` 의 non-comment
라인이 정확히 0줄로, `eslint 10` `preserve-caught-error` 대응 주석을 정본(`spec/5-system/3-error-handling.md`
§6.3.1)을 가리키도록 정리한 순수 문서화 변경이다. `plan/*.md` 1개는 작업 추적 텍스트 갱신이고,
나머지 19개는 이전 리뷰/일관성 검토 라운드가 규약된 위치(`review/code/**`, `review/consistency/**`)에
남긴 산출물을 커밋에 포함한 것으로, 애플리케이션의 상태·전역변수·파일시스템·시그니처·공개
인터페이스·환경변수·네트워크·이벤트 흐름 어느 것도 변경하지 않는다. 뮤테이션 검증은 필요하지
않았다(가설을 재현할 로직 변경 자체가 없음) — 저장소 파일은 read-only 명령(`git diff`/`git log`/
`git status`)으로만 조회했고, 세션 종료 시점 `git status --short` 결과 이 리뷰 자신의 출력 디렉터리
외 잔여물 없음.

## 위험도

NONE
