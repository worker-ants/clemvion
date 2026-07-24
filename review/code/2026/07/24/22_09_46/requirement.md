# 요구사항(Requirement) 리뷰 — 세션 ↔ 발급 apiBase 바인딩

## 발견사항

- **[SPEC-DRIFT]** `3-auth-session.md §3.1` 의 sessionStorage 스키마 열거가 신규 `apiBase` 필드를 반영하지 못함
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 step 1 — `"iframe-origin sessionStorage(§R6)에서 {executionId, token, expiresAt, endpoints} 조회"` 문장
  - 상세: 이번 diff 로 `PersistedSession` 은 필수 필드 `apiBase` 를 갖게 됐고(`codebase/channel-web-chat/src/lib/session-store.ts` `PersistedSession` 인터페이스, `loadSession` 의 발급-origin 대조/폐기 로직), 이는 코드 자체적으로 잘 근거된 의도적 보안 강화다(재전송이 `apiBase` 를 바꿨을 때 옛 세션의 단명 토큰이 새 origin 으로 전송되는 결함 차단). 그러나 §3.1 이 명시적으로 나열하는 저장 스키마 튜플 `{executionId, token, expiresAt, endpoints}` 와 "불일치/미기록 시 폐기" 라는 새 복원-거부 조건 모두 spec 본문에 반영되지 않았다. `4-security.md` 에도 이 위협 모델(재전송에 의한 stale-token cross-origin 유출)이나 완화책이 서술돼 있지 않다.
  - 이 diff 가 만든 `plan/complete/webchat-session-apibase-binding.md` 는 `spec_impact: none` 으로 명시하며 근거로 "§3.1·§3 은 복원 자체만 규정하고 스키마 표면을 규정하지 않는다"를 든다. 이는 일리 있는 판단이나, §3.1 의 해당 문장은 필드를 **문자 그대로 나열**하는 서술이라 독자 입장에서는 지금 코드와 어긋나 보인다. 코드가 옳고(테스트·mutation 검증 통과, 프로덕션 호출부 1곳 배선 확인 완료) spec 서술이 그 강화를 아직 반영하지 못한 전형적인 SPEC-DRIFT 로 판단한다.
  - 제안: 코드는 유지. `project-planner` 경유로 `spec/7-channel-web-chat/3-auth-session.md §3.1` step 1 의 필드 열거에 `apiBase` 추가 + "발급 origin 불일치/미기록 시 폐기" 한 줄 반영을 검토 요청. 원한다면 `4-security.md` 위협 표에도 재전송-origin 축 한 줄 추가.

- **[INFO]** vitest 서브셋(`session-store.test.ts` + `use-token-refresh.test.ts` + `use-widget-eager-start.test.ts`) 동시 지정 실행 시 산발적 실패 관측, 전체 스위트(`pnpm vitest run`, 22 files/400 tests)와 해당 서브셋 반복 단독 재실행(2회, 84/84)은 모두 통과
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (구체 실패 케이스는 매 실행마다 달라짐 — 신규 추가된 두 테스트가 실패 목록에 포함된 적 있으나 재현 불가)
  - 상세: 최초 1회는 stale `node_modules/.vite` 캐시가 원인으로 확인(캐시 삭제 후 즉시 재현 불가). 이후 동일 3-파일 조합을 다시 지정 실행했을 때 1회 17건 실패가 관측됐으나, 곧바로 2회 재실행(84/84, 84/84)과 전체 스위트 실행(400/400) 모두 그린이라 이번 diff 의 로직 결함으로 재현되지 않는다 — 특정 파일 서브셋만 골라 실행할 때만 나타나는 러너/워커 스케줄링 관련 flake 로 보인다(신규 테스트가 유일한 원인이라 단정할 근거 없음).
  - 제안: 액션 불요(비차단). CI 는 통상 전체 스위트로 실행되므로 영향 낮음. 향후 같은 서브셋에서 반복 재현되면 별도로 조사.

## 요약

핵심 로직(`session-store.ts` 의 `PersistedSession.apiBase` 필드·`normalizeApiBase`·`loadSession` 의 발급-origin 대조/폐기, `use-widget.ts` 의 `persist`/`applyConfig` 배선, `use-token-refresh.ts` 의 refresh 시 apiBase 보존)은 의도한 기능(재전송으로 apiBase 가 바뀌었을 때 옛 origin 세션 토큰이 새 origin 으로 유출되지 않도록 차단)을 정확하고 완전하게 구현했다. 엣지 케이스(불일치·미기록 레거시 세션·trailing slash 정규화·경로 포함 origin·만료 우선순위)를 모두 테스트로 고정했고, 프로덕션 호출부는 `loadSession`/`saveSession` 각 1곳뿐이라 typo 나 미배선 위험이 없음을 grep 으로 확인했다. `use-widget-eager-start.test.ts` 에 추가된 위젯 통합 테스트(실측 fetch 호출의 URL·헤더·바디 전수 검사 + 대조군)는 vacuous 하지 않고 실제로 fix 유무를 가른다(getStatus 가 Bearer 토큰을 헤더에 실어 발사되는 경로를 검증). TODO/FIXME 류 미완성 표식은 없다. 반환값·에러 경로(폐기 시 `clearSession`+`null`, storage 접근 실패 시 graceful null)도 전 경로에서 적절하다. 유일한 실질적 발견사항은 spec fidelity 축인데, `spec/7-channel-web-chat/3-auth-session.md §3.1` 이 나열하는 저장 스키마 필드 목록과 `4-security.md` 위협 모델이 이번에 추가된 `apiBase` 바인딩 계약을 아직 반영하지 못한 SPEC-DRIFT 로, 코드 수정이 아니라 spec 갱신으로 해소해야 한다.

## 위험도

LOW
