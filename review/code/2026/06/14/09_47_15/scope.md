## 발견사항

### [INFO] spec/2-navigation/6-config.md — 구현 현황 노트 갱신
- 위치: `spec/2-navigation/6-config.md` line 1479 (diff +1)
- 상세: spec 문서의 "구현 현황" blockquote 를 "미구현 / Planned" → "✅ 구현" 으로 갱신했다. `developer` 역할은 `spec/` 을 read-only 로 제한하지만, 해당 변경은 구현 완료 사실을 반영하는 현황 메모 업데이트로 프로젝트 컨벤션상 developer 가 spec 현황 주석을 동반 업데이트하는 패턴은 관례적으로 허용된다. 단, CLAUDE.md 상 `spec/` 쓰기 권한은 `project-planner` 에게만 있으므로 규약 준수 여부를 확인해야 한다.
- 제안: 이 변경이 `project-planner` 위임 없이 developer 가 직접 작성한 경우라면 역할 경계 위반이다. 다만 내용 자체가 구현 현황 반영(단순 상태 갱신)에 국한되므로 실질적 risk 는 낮다.

### [INFO] plan/in-progress/spec-sync-config-gaps.md — 상태 갱신 및 미구현 항목 재분류
- 위치: `plan/in-progress/spec-sync-config-gaps.md` diff 전체
- 상세: 구현 완료된 §A.2 2건을 체크박스 완료(`[x]`)로 전환하고, 미구현 §A.3 항목들에 "결정 필요" 근거와 구체적 기술 분석(소스 IP 미저장 경로, HTTP 응답 코드 부재, 롤링 윈도 vs 캘린더 버킷 선택지)을 신규 추가했다. 구현 PR 에서 plan 상태를 갱신하는 것은 정상 범위다. 미구현 항목에 대한 분석 내용 추가도 후속 작업 명확화를 위한 합리적 범위다.
- 제안: 특이사항 없음.

### [INFO] 신규 i18n 키 — 영문·한국어 모두 추가됨
- 위치: `codebase/frontend/src/lib/i18n/dict/en/authentication.ts`, `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts`
- 상세: `apiKeyHeaderLabel`, `ipWhitelistLabel`, `ipWhitelistHint` 3개 키가 en/ko 두 파일에 추가됐다. page.tsx 의 `t()` 호출과 1:1 대응하며 누락 키 없음. 불필요하게 추가된 키나 미사용 키 없음.
- 제안: 특이사항 없음.

### [INFO] 테스트 파일 — `useLocaleStore.setState` 직접 사용
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` line 89
- 상세: `beforeEach` 에서 `useLocaleStore.setState({ locale: "en" })` 을 직접 호출한다. 이는 Zustand store 내부 상태를 직접 조작하는 패턴으로, 테스트 격리 측면에서 무방하지만 mock 없이 실제 store 를 변이한다. 해당 패턴이 프로젝트 다른 테스트 파일과 일관되는지 확인 권장.
- 제안: 기존 테스트 파일들에서 동일 패턴이 이미 사용되는 경우라면 허용. 그렇지 않다면 locale 환경 초기화 방식을 통일하는 것이 바람직하나, 현재 PR 범위 내에서는 blocking issue 아님.

### [INFO] page.tsx — `formApiKeyHeader` 기본값 조건 분기
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` lines 266-270 (diff)
- 상세: `if (header) config.headerName = header;` — `formApiKeyHeader` 가 비어 있으면 `config.headerName` 을 미송신하여 백엔드 기본값(`X-API-Key`)이 적용되도록 설계됐다. 그러나 상태 초기값이 `"X-API-Key"` 이므로 사용자가 기본값을 그대로 두면 조건이 참이 되어 `headerName: "X-API-Key"` 가 명시적으로 송신된다. 빈 문자열로 초기화하고 placeholder 로 "X-API-Key" 를 노출했을 때와 비교해 동작 차이가 없으나, 설계 의도("비우면 미송신")와 초기값("X-API-Key")이 미묘하게 불일치한다. 테스트 `it("defaults the header to X-API-Key ...")` 도 `{ headerName: "X-API-Key" }` 를 송신하는 경우를 기대하고 있어 실제 동작과는 부합한다.
- 제안: 현재 코드가 오동작하지는 않으나 "비우면 미송신" 주석 의도와 초기값이 정합하지 않는다. 범위 이탈이 아니라 설계 내부 세부 사항이므로 별도 이슈로 추적하거나 주석을 "초기값 또는 빈 문자열이 아닌 경우 송신" 으로 수정 권장.

---

## 요약

변경된 5개 파일(테스트 1 · page.tsx · i18n en/ko · plan · spec) 모두 plan `spec-sync-config-gaps.md` 의 §A.2 두 항목(IP Whitelist 폼 UI, API Key Header 이름 입력 필드) 구현에 직접 대응한다. 불필요한 리팩토링·무관한 파일 수정·포맷팅 전용 변경은 없다. `spec/` 변경이 `developer` 역할에서 직접 이루어진 점이 역할 경계 관점에서 주의사항이나, 변경 내용이 구현 완료 현황 반영에 국한되어 실질 위험은 낮다. 그 외 발견사항은 모두 INFO 수준으로 현재 PR 의 범위를 벗어나는 수정은 포함되지 않는다.

## 위험도

LOW
