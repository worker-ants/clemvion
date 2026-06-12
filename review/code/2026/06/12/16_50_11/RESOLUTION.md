# RESOLUTION — chat-channel-followups-batch ai-review (16_50_11)

리뷰 결과: **RISK LOW · Critical 0 · Warning 1**. Critical 없음.

## 조치 항목

| # | 카테고리 | 발견 | 조치 | commit |
|---|---|---|---|---|
| W1 | Testing/Maintainability | `workspace.decorator.spec.ts` 이중 factory 호출 패턴 — 첫 `toThrow` 실패 시 `code` 단언 누락 가능 | **fix** — 단일 factory 호출로 예외 타입 + `code` 를 함께 단언하는 공통 헬퍼 `expectWorkspaceIdRequired()` 추출(error 캡처 후 재던지기). 4개 throw 케이스 전부 헬퍼 사용 | `<refactor-hash>` |
| INFO #1 | Testing | 빈 문자열 헤더 케이스 `code` 미단언 | W1 헬퍼로 해소 (동일 단언 적용) | `<refactor-hash>` |
| INFO #2 | Testing | null/undefined 케이스 `code` 미단언 | W1 헬퍼로 해소 (기존 케이스도 헬퍼 전환) | `<refactor-hash>` |
| INFO #3 | Testing | `ERROR_KO['WORKSPACE_ID_REQUIRED']` i18n parity guard 포함 여부 | **검증 완료** — `backend-labels.test.ts` 가 `Object.keys` 기반 구조적 parity → 자동 포함. unit green 확인 | — |

### 미조치 (out of scope / 선택 — 후속)
- **INFO #5** (error-codes §5 preamble 진입기준 주석): 선택적 polish. preamble 은 이미 정확화함 — 추가 주석은 별 작업.
- **INFO #6** (mcp-client §2.3/§3.1 인라인 통합): 장기 구조 변경, 본 PR 범위 밖.
- **INFO #7** (backend-labels 파일 분리): 장기 리팩터, 범위 밖.
- **INFO #8** (rotate-bot-token 3필드 additive): 미구현 gap 관련(spec-sync plan 추적), 본 변경 아님.
- **INFO #9** (triggers.mdx callout 나머지 5코드 ko 미등록): callout "일부 코드 영문 노출" 문구가 여전히 사실(5개 미등록)이라 비차단. i18n 일괄 pass 후속.
- **INFO #10**: plan 체크박스 — 본 RESOLUTION 후 갱신.

## TEST 결과

- **lint**: 통과 (PASS)
- **unit**: 통과 (PASS, 40 — workspace.decorator.spec 7 passed)
- **build**: 통과 (PASS, fix 이전 동일 — 변경은 *.spec.ts 단일로 빌드 무영향)
- **e2e**: 통과 (PASS, 188/32 suites — *.spec.ts 변경이라 화이트리스트상 재수행, green)

## 보류·후속 항목
- INFO #5~#9 (위 표) — 별 작업 / i18n 일괄 pass / 장기 구조 개선.
