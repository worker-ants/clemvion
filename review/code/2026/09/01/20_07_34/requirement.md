# 요구사항(Requirement) 리뷰

대상 커밋: `8b0ee1741` `fix(packages): lint 글롭이 18개 최상위 파일을 통째로 건너뛰고 있었다 + 잔여 2건`

실질 코드 변경은 세 갈래다: (1) `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,masked-markers,node-summary}/package.json` 의 `lint` 스크립트 글롭 따옴표 추가, (2) `expression-engine/src/__tests__/error-shape.spec.ts` 의 타입 술어를 명시 캐스트에서 모듈-유도 타입으로 교체(TS2677 해소), (3) `expression-engine/src/parser.ts` 의 `case TokenType.LParen` 을 블록으로 감싸 `no-case-declarations` 해소. 나머지(파일 9~11)는 `plan/` 문서 갱신·이동이다.

## 발견사항

- **[WARNING]** plan 문서(파일 10)의 미체크 항목이 같은 커밋의 실제 코드 변경과 모순된다 — "이 PR 에서 고치지 않는다" 고 적어 놓고 바로 그 PR 이 고쳤다.
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:124` (게이트 숫자 기준, "체크리스트" 섹션 `parser.ts:317 no-case-declarations` 항목)
  - 상세: 해당 항목은 `- [ ]`(미체크) 상태로 "로컬 eslint 가 **내가 건드리지 않은** 파일에서 낸다 … **이 PR 에서 고치지 않는다**: 원인이 환경이면 고칠 대상이 아니고, 무관한 파일을 이 changeset 에 끌어들이게 된다" 라고 적는다. 그러나 같은 커밋(`8b0ee1741`)의 diff 는 실제로 `codebase/packages/expression-engine/src/parser.ts:317` 을 수정해 이 lint 에러를 고쳤고(파일 5 diff), 커밋 메시지 자체도 "`parser.ts:317` 은 … 블록으로 감쌌다" 라고 명시한다. 즉 이 changeset 은 이미 그 "무관한 파일" 을 끌어들였는데, 체크리스트만 "안 끌어들인다" 는 옛 판단을 그대로 남겼다. 근본 원인 서술도 어긋난다 — 체크리스트는 이 lint 실패를 "로컬-CI 툴체인 차이"(환경 원인)와 "같은 원인일 가능성이 높아 묶어서 본다" 고 적지만, 커밋 메시지의 최종 결론은 "그것도 틀렸다 — 위 글롭 버그였다. 신호는 하나뿐이다" 로 툴체인 차이 가설을 명시적으로 철회한다. 즉 이 항목은 (a) 미해결 상태 서술이 실제로는 해결됐고, (b) 원인 진단도 이 커밋 자신이 반증한 옛 가설을 그대로 담고 있다.
  - 제안: 이 항목을 `[x]` 로 바꾸고 "글롭 따옴표 버그로 확인, 이 커밋에서 함께 해소" 로 정정하거나, 최소한 "이 PR 에서 고치지 않는다" 서술을 취소선 처리하고 실제 처분(고쳤음)을 덧붙인다. `.claude/docs`/메모리의 "plan 서술은 철회로 거짓이 될 수 있다" 교훈과 같은 클래스의 결함이다.

- **[INFO]** 같은 파일의 "로컬-CI 툴체인 차이 규명" 항목(`:118`)은 미해결로 남아 있고 근거도 정합적이다 — 다만 위 발견사항이 그 항목의 전제("두 신호 중 하나")를 무너뜨렸으므로, 정정 시 "신호는 하나뿐" 이라는 커밋 메시지의 결론을 이 항목에도 반영해야 다음 사람이 잘못된 전제로 재조사하지 않는다.
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:118`
  - 상세: WARNING 항목과 원인이 같으므로 별도 fix 는 불필요하고 같은 정정에 묶으면 된다.
  - 제안: 위 WARNING 정정 시 함께 반영.

## 실측 검증

- `pnpm lint` (6개 패키지 전부) — exit 0, 에러 없음. 특히 `expression-engine` 은 `parser.ts:317` 수정 후 `no-case-declarations` 가 사라졌음을 직접 확인.
- `pnpm test -- error-shape` (`expression-engine`) — 10/10 통과, TS2677 컴파일 에러 재현 안 됨.
- `grep '"lint":' codebase/packages/*/package.json` — 8개 패키지 전부 `eslint "src/**/*.ts"` 형태로 일관. 이번 diff 밖의 `sdk`/`web-chat-sdk` 도 이미 따옴표 형태라 커밋 메시지의 "6/8 만 버그" 주장과 일치. `codebase/{frontend,backend,channel-web-chat}` 의 `lint` 스크립트는 이미 다른 형태(글롭 인자 없음 또는 이미 따옴표)라 이번 fix 범위 밖에서 같은 버그가 남아있지 않음을 확인 — fix 범위가 좁게 잘린 케이스 아님.
- `errors.ts` 의 실제 하위클래스(6개: SyntaxError/ReferenceError/TypeError/FunctionError/TimeoutError/DepthExceededError)와 `error-shape.spec.ts` 의 `EXPECTED_CODE`/전수성 리스트가 1:1 일치.
- `spec/5-system/3-error-handling.md` §6.3.1 C2("`err` 가 message·name 밖의 민감 정보를 속성으로 들고 있지 않다")와 테스트 docstring·검증 내용(enumerable own key 화이트리스트)이 일치 — spec fidelity 이상 없음.
- `spec/0-overview.md` §2.7 트리·표·Rationale(`:280`, `:371`)이 파일 9(`plan/complete/spec-draft-avatar-storage-key.md`)의 "적용 완료" 배너가 주장하는 내용과 실제로 일치함을 직접 확인. 파일 9→11 은 이미 다른 PR(#1258)에서 반영된 spec 변경을 뒤늦게 `plan/complete/` 로 옮기는 bookkeeping 이며, 이번 diff 자체는 spec 을 건드리지 않는다.
- `parser.ts` 의 블록 스코프 변경은 순수 문법적 리팩터(동작 변경 없음) — 반환값·분기·엣지케이스 전부 원본과 동일.
- 뮤테이션 검증 관련: 저장소 파일은 건드리지 않았다(읽기 전용 `pnpm lint`/`pnpm test` 실행만). `git status --short` 로 작업 트리 무변경 확인.

## 요약

핵심 코드 변경 세 갈래(lint 글롭 따옴표, error-shape 테스트의 타입 유도 방식, parser.ts 블록 스코프)는 모두 의도한 버그를 정확히 해소하며 실측(lint/test 재실행)으로 확인됐다. spec 참조가 있는 유일한 영역(C2 캐너리)도 `spec/5-system/3-error-handling.md` §6.3.1 과 line-level 로 일치한다. 유일한 흠은 코드가 아니라 동봉된 plan 문서(파일 10)의 체크리스트 항목 하나가 "이 PR 에서 안 고친다" 고 적은 채 남아 있는데 같은 커밋이 실제로는 그 파일을 고쳤다는 자기모순 — 기능적 위험은 없으나 다음 사람이 이 plan 을 신뢰해 잘못된 결론(아직 미해결/원인 불명)을 내릴 수 있어 WARNING 으로 기록한다.

## 위험도
LOW
