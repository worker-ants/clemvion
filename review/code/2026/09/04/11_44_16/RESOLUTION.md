# RESOLUTION — 2R (`11_44_16`)

1R 의 fix 를 겨눈 3건이다. 셋 다 **내가 1R 을 고치면서 만든 것**이라 그대로 조치했다.

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| W1 (maintainability) | `nullable-type-lie-cast.spec.ts` 의 지역 `withFixture` 가 공유 헬퍼에 위임하지 않고 로직을 복제. JSDoc 은 "얇은 래퍼" 라 서술 | `sharedWithFixture(content, fn, 'probe.entity.ts')` 위임으로 교체 — 서술과 구현을 일치시킴 |
| W2 (maintainability) | 경로 정규화 한 줄이 저장소 **8곳**에 복제(리뷰어 집계 7 + 실측 1). 그중 4곳은 **1R 의 "정규화 누락" 지적을 고치며 내가 늘린 것** | `source-scan.ts` 에 `toPosixPath`/`toPosixRelative` 추출, **8곳 전부** 호출로 통일 |
| W3 (testing) | 그 정규화에 **어떤 테스트도 없었다** — 리뷰어가 뮤턴트를 심어 관련 spec 50개 전부 GREEN 임을 실측 | 순수 문자열 변환을 분리해 테스트 가능하게 만들고 4개 단언 추가. **뮤테이션으로 검증**(아래) |
| INFO#6 | plan 안에서 곳수가 두 자리(111 vs 104)로 갈림 — 마이그레이션 절이 이 PR 의 8곳 정정을 미반영 | 두 수의 관계를 본문에 명시(111 = 103 + 8, 8곳은 이 세션이 정정, 104 = 103 + `llmConfigId`) |

## W3 — 뮤테이션 검증 (예측 / 실측)

| | 예측 | 실측 |
|---|---|---|
| `join('/')` → `join('WRONG')` (수정 전) | — | 리뷰어 실측 **50 spec 전부 GREEN** |
| 같은 뮤턴트 (수정 후) | RED | **RED — 3스위트 7건 실패** |
| 원복 | GREEN | **GREEN — 12스위트 218건** |

**한 번 틀렸다.** 처음엔 `toPosixRelative` 에 `sep` 인자만 주입해 윈도우 분기를 테스트하려
했는데, POSIX 의 `path.relative` 는 윈도우 경로를 몰라
`toPosixRelative('C:\a', 'C:\a\b\c.ts', '\\')` 가 `'../C:/a/b/c.ts'` 를 냈다. **문자열 변환을
`toPosixPath` 로 떼어내야** 플랫폼과 무관하게 그 분기를 겨눌 수 있다. 그 경위를 두 파일의
docstring 에 남겼다.

## 부수 — 죽은 import 2건

추출로 `path` 사용이 0이 된 `masked-reject-callers-guard.ts`·`swagger-dto-contract-guard.ts`
의 import 를 제거했다. 후자는 `grep 'path\.'` 이 **주석 안의 언급을 코드 사용으로 세서**
한 번 놓쳤다 — eslint 가 잡았다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** — backend jest 445스위트 **9,314건**
- build: **PASS**
- e2e: **PASS** — 292건

## 보류·후속 항목

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된 것 외 추가 없음.
2R 의 INFO 18건은 전부 비차단이며 그중 실질적인 둘(`ParenthesizedTypeNode` 언랩,
`readBooleanOption` non-literal)은 **현재 저장소 실사례 0건**으로 확인됐다.
