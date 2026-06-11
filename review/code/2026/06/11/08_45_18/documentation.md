# Documentation Review

## 발견사항

### [INFO] `generateTokens` private 메서드 — 파라미터 변경 JSDoc 부재
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` L715–L826 (`generateTokens` 시그니처)
- 상세: `manager?: EntityManager` 파라미터가 추가됐으나 메서드 수준 JSDoc 이 없다. 현재 설명은 파라미터 직전 인라인 주석(한국어 3행)으로만 남아 있다. `private` 메서드라 외부 소비자에게 직접 노출되지 않지만, `registerWithInvitation`/`login`/`refresh`/`issueTokensAfterMfa` 등 내부 5개 경로가 동일 메서드를 호출하므로 의도를 명문화해두면 미래 호출처 추가 시 `manager` 전달 여부를 실수 없이 판단할 수 있다.
- 제안: 파라미터 설명을 포함한 JSDoc 블록 추가. 최소한 `@param manager - optional EntityManager. refresh 회전 경로에서만 전달. 미전달 시 모듈 수준 refreshTokenRepository 사용.` 수준이면 충분.

### [INFO] `refresh()` 메서드 — 공개 API 수준 JSDoc 부재
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` L627–L691 (`refresh`)
- 상세: `register`, `registerWithInvitation`, `loginWithTotp`, `consumeChallengeToken`, `issueTokensAfterMfa`, `resolveTokenWorkspaceContext` 등 대부분의 비자명 메서드에 JSDoc 이 있거나 섹션 구분 주석이 있다. `refresh` 는 복잡도가 높고(reuse 탐지, 만료 분기, 회전 원자성) 이번 변경에서 핵심 로직이 바뀌었음에도 메서드 레벨 설명이 없다.
- 제안: `refresh()` 상단에 동작 요약 + 세 분기(reuse / 만료 / 정상 회전) 설명을 JSDoc 으로 추가. 이미 본문 인라인 주석이 충분히 상세하므로 짧은 요약 형태로도 충분.

### [INFO] 테스트 파일 — `describe('refresh')` 블록 내 신규 테스트 케이스 맥락 주석 일관성
- 위치: `/codebase/backend/src/modules/auth/auth.service.spec.ts` L648–L96
- 상세: 기존 테스트들은 `// regression: void → await race` 나 `// 회귀 가드:` 같이 맥락(이유/원인)을 명시한다. 신규 두 케이스(`rotates revoke + issue inside a single transaction`, `propagates failure ...`)는 테스트명이 충분히 자명하나, 이번 변경의 배경("05 C-1" 이슈 레퍼런스)이 mock 설정 주석에만 언급되고 `it` 블록 안에는 빠져 있어 독자가 "왜 이 케이스가 추가됐는지" 를 mock 주석까지 거슬러 올라가야 한다.
- 제안: 각 `it` 블록 첫 줄에 `// 05 C-1 회귀 가드: ...` 형식 한 줄 주석 추가 (이미 존재하는 패턴을 맞추는 수준).

### [INFO] `spec/data-flow/2-auth.md` — 원자성 노트 단락 구성 밀도
- 위치: `/spec/data-flow/2-auth.md` L2247–L2253 (회전 원자성 blockquote)
- 상세: 추가된 blockquote 는 내용이 정확하고 구현을 잘 반영하나, 한 단락에 6개 이상의 사실을 나열해 밀도가 높다. 이 자체가 잘못된 것은 아니나 향후 독자를 위해 핵심 불변 조건(롤백 시 `is_revoked=false` 유지)이 제일 먼저 눈에 띄도록 문장 순서를 앞으로 당기면 가독성이 향상된다.
- 제안: 첫 문장에 핵심 불변 조건을 명시. 현 텍스트는 메커니즘 설명이 앞서고 결과가 후미에 위치.

### [INFO] `plan/in-progress/auth-refresh-rotation-atomic.md` — spec 변경 대상 경로 표기
- 위치: `/plan/in-progress/auth-refresh-rotation-atomic.md` L28 (`### Spec (data-flow/2-auth.md §1.4)`)
- 상세: 변경 대상 spec 파일이 `data-flow/2-auth.md §1.4` 로 기재돼 있는데 프로젝트 규약상 경로는 `spec/` 루트 기준 전체 경로(`spec/data-flow/2-auth.md`)로 적는 것이 일관적이다(CLAUDE.md 정보 저장 위치 표 참조). 현재는 상대 경로 스타일로 기재.
- 제안: `spec/data-flow/2-auth.md §1.4` 로 통일. 마이너 일관성 이슈.

## 요약

이번 변경(refresh 토큰 회전 원자화, 05 C-1)은 문서화 측면에서 전반적으로 잘 처리됐다. spec (`spec/data-flow/2-auth.md §1.4`) 의 시퀀스 다이어그램이 `rect` 블록과 원자성 노트로 갱신됐고, plan 문서가 변경 이유·설계 근거를 포함하며 생성됐다. 코드 인라인 주석("05 C-1") 도 구현 의도를 충분히 설명한다. 미비 사항은 모두 INFO 수준으로, `generateTokens` private 메서드와 `refresh` public 메서드에 JSDoc 이 없어 향후 호출 경로가 늘어날 때 `manager` 전달 여부 실수 위험이 존재하고, 신규 테스트 케이스에 기존 패턴과 동일한 맥락 주석이 누락된 점이다. 기능적으로 문서와 코드가 어긋나는 부분은 없다.

## 위험도

LOW
