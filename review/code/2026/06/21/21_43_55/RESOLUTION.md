# Resolution — ai-review 2026/06/21 21_43_55 (M-1 2단계 fresh review)

직전 21_26_26 의 WARNING #3·#5 fix(test 신설 + 주석)를 커버하는 fresh review.
결과: **Critical 0 / Warning 4 / 위험도 LOW**. architecture WARNING(interface/DI)은
production 로직 무변경으로 architecture reviewer 가 skip 되어 자연 수렴(재발 없음).

신규 Warning 4건은 전부 **신규 spec 의 테스트 커버리지 미세 갭**(developer-fixable 3건)
+ **spec frontmatter**(planner-only 1건).

## 수정 (이 PR 반영)

### WARNING #1 (Testing) — recall scopeKey 변환 검증 ✅
- **조치**: `memoryKey` 미설정 케이스 추가 — `resolveScopeKey(undefined, 'exec-1')` →
  `'exec:exec-1'` 변환값이 `recall` 두 번째 인자로 흐르는지 직접 검증
  (`recall.mock.calls[0][1]` === `'exec:exec-1'`). 입력 원시값이 아닌 변환된 scopeKey
  전달을 고정.

### WARNING #2 (Testing) — `system_text` contextInjectionMode 분기 미커버 ✅
- **조치**: `config: { contextInjectionMode: 'system_text' }` 케이스 추가 — 꼬리를 별도
  메시지로 splice 하지 않고 system 메시지에 접어 `messages` 길이를 유지함을 검증
  (messages 모드의 prepend 와 대비).

### WARNING #3 (Testing) — `summaryModelConfigId` resolveConfig 경로 미커버 ✅
- **조치**: `summaryModelConfigId: 'sum-cfg'` 케이스 추가 — `llmService.resolveConfig`
  가 `('sum-cfg', 'ws-1')` 로 1회 호출됨을 검증 (요약 콜 provider 디커플 §12.12).

→ 신규 spec 14 → **17 케이스**, 17/17 PASS. lint 0 errors.

## Defer — planner 도메인

### WARNING #4 (Documentation) + SPEC-DRIFT #1·#2 → PLANNER 위임
- spec frontmatter `code:` 미등재 + §6.2 d.5 `tailMode`/`keepUserExchanges` 메커니즘 +
  §6.1 queryText 폴백 정책 미명시. 전부 **spec 쓰기 권한(planner) 도메인** — developer 는
  `spec/` read-only. **#665(M-1 1단계)도 동일하게 `ai-condition-evaluator.ts` 미등재로
  착지**했고 plan 이 비차단 SPEC-DRIFT 로 명시 추적 중. M-1 전체 완료 시 planner 가
  frontmatter `code:` 일괄 등재 + §6.1/§6.2 구현 참조·정책 기술을 일괄 처리한다.
  (developer 가 이번 PR 에서 해소 불가 — 영구적 비차단 잔존 WARNING.)

## INFO (비차단)

- **#5 (queryText null/undefined)**: 시그니처상 `string` 이라 런타임 유입 가능성 낮음 —
  빈 문자열(`'   '`) 폴백은 이미 커버. string-only 의도는 타입으로 고정됨.
- **#1 (config `as` 캐스팅)·#2 (workspaceId 로그)·#3 (thread mutation)·#4
  (`_retry_state.json` 경로)**: 21_26_26 RESOLUTION 과 동일 판정 (verbatim 이동 패턴 /
  review 산출물 기존 형식 / 로그 메시지 변경은 verbatim 불변식 위배). 미반영.
- **#7~#11 (테스트 픽스처 스타일 — 반복 캐스팅·파라미터명·shared mgr 인스턴스)**: 전부
  테스트 품질 style 나ит픽. 무상태 매니저라 인스턴스 공유는 실해 없음(리뷰어도 인정).
  과도한 추상화 회피 위해 현행 유지.

## 수렴 판정
Critical 0. developer-actionable WARNING(#1·#2·#3) 전부 해소. 잔존 WARNING #4 는
planner-only SPEC-DRIFT(developer 해소 불가, #665 선례와 동일 비차단). production 로직
무변경(test-only)이라 e2e 직전 PASS(205) 유효. fresh review 로 0 developer-WARNING 확인.
